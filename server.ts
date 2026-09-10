import express from 'express';
import path from 'path';
import zlib from 'zlib';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import GetSitemapLinksLib from 'get-sitemap-links';

// Resolve library function properly
const rawLib = GetSitemapLinksLib as any;
const GetSitemapLinks = (rawLib && typeof rawLib.default === 'function')
  ? rawLib.default
  : (typeof rawLib === 'function' ? rawLib : rawLib?.default?.default || rawLib);

const PORT = 3000;

interface RawSitemapItem {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  sourceSitemap?: string;
}

// Realistic modern browser headers
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const GOOGLEBOT_USER_AGENT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Set default headers on Axios globally so all requests inherit realistic headers
axios.defaults.headers.common['User-Agent'] = BROWSER_USER_AGENT;
axios.defaults.headers.common['Accept'] =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
axios.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.9';

// Clean dedicated Axios instance for bypass proxy requests (proxies reject browser-spoofing user agents)
const proxyAxios = axios.create();
delete (proxyAxios.defaults.headers as any).common?.['User-Agent'];
delete (proxyAxios.defaults.headers as any).common?.['Accept'];
delete (proxyAxios.defaults.headers as any).common?.['Accept-Language'];

// Helper to decompress buffer safely
function decompressBufferIfNeeded(buffer: Buffer, url: string, contentEncoding?: string): string {
  const isGzip =
    (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) ||
    url.endsWith('.gz') ||
    contentEncoding === 'gzip';

  if (isGzip) {
    try {
      const decompressed = zlib.gunzipSync(buffer);
      return decompressed.toString('utf-8');
    } catch {
      return buffer.toString('utf-8');
    }
  }
  return buffer.toString('utf-8');
}

// Check if returned content is a Cloudflare / WAF challenge or Bot Fight Mode block page
function isBotChallengeOrBlockPage(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  // If it's legitimate XML sitemap with <urlset> or <sitemapindex>, it's NOT a challenge page
  if (/<(urlset|sitemapindex)[\s>]/i.test(content)) {
    return false;
  }
  const lower = content.toLowerCase();

  // Cloudflare Turnstile / Managed Challenge / Bot Fight Mode indicators
  if (
    lower.includes('challenges.cloudflare.com') ||
    lower.includes('cf-chl-widget') ||
    lower.includes('cf-browser-verification') ||
    lower.includes('_cf_chl_opt') ||
    lower.includes('cf_chl_') ||
    lower.includes('cf-turnstile') ||
    lower.includes('turnstile/v0/api.js') ||
    (lower.includes('just a moment...') && lower.includes('cloudflare')) ||
    (lower.includes('attention required!') && lower.includes('cloudflare')) ||
    (lower.includes('checking your browser') && lower.includes('cloudflare')) ||
    (lower.includes('security check') && lower.includes('cloudflare')) ||
    lower.includes('ddos protection by cloudflare') ||
    (lower.includes('ray id:') && lower.includes('cloudflare') && !content.includes('<url>'))
  ) {
    return true;
  }

  // Akamai, Datadome, PerimeterX, Incapsula, AWS WAF, Imperva
  if (
    (lower.includes('perimeterx') && lower.includes('captcha')) ||
    (lower.includes('datadome') && lower.includes('captcha')) ||
    (lower.includes('incapsula') && lower.includes('incident id')) ||
    (lower.includes('aws waf') && lower.includes('captcha')) ||
    (lower.includes('access denied') && (lower.includes('firewall') || lower.includes('waf')) && !content.includes('<url>'))
  ) {
    return true;
  }

  return false;
}

// Clean and sanitize an extracted URL. Drops trailing punctuation (; , > ] ) etc.), drops Cloudflare/Captcha infrastructure
function cleanAndValidateExtractedUrl(rawUrl: string, targetOrigin?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  // Strip trailing punctuation like semicolons (;), commas, brackets, quotes, whitespace
  let clean = rawUrl.trim().replace(/[;,)\s"'>\]\\]+$/g, '').trim();

  // Must be a valid absolute http or https URL
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return null;
  }

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase();

    // Prevent Cloudflare challenge and internal firewall domains unless target is actually cloudflare.com
    const isTargetCloudflare = targetOrigin && targetOrigin.toLowerCase().includes('cloudflare.com');
    if (!isTargetCloudflare) {
      if (
        host === 'challenges.cloudflare.com' ||
        host.endsWith('.challenges.cloudflare.com') ||
        host === 'cloudflare.com' ||
        host.endsWith('.cloudflare.com') ||
        host.includes('cloudflareinsights.com') ||
        host.includes('turnstile')
      ) {
        return null;
      }
    }

    // Exclude proxy, schema, and bot verification hosts
    if (
      host === 'jina.ai' ||
      host.endsWith('.jina.ai') ||
      host === 'sitemaps.org' ||
      host.endsWith('.sitemaps.org') ||
      host === 'w3.org' ||
      host.endsWith('.w3.org') ||
      host === 'schema.org' ||
      host.endsWith('.schema.org') ||
      host === 'hcaptcha.com' ||
      host.endsWith('.hcaptcha.com') ||
      host === 'recaptcha.net' ||
      host.endsWith('.recaptcha.net') ||
      (host.includes('google') && clean.includes('recaptcha'))
    ) {
      return null;
    }

    return clean;
  } catch {
    return null;
  }
}

// Fetch snapshot from Wayback Machine Archive (clean pre-rendered sitemap unaffected by Cloudflare blocks)
async function fetchWaybackSitemap(url: string, timeoutMs: number = 10000): Promise<string | null> {
  try {
    let rawSnapshotUrl: string | null = null;

    // 1. Check closest snapshot via Wayback availability API
    try {
      const checkRes = await axios.get(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
        timeout: 4000,
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
        },
        validateStatus: (s) => s === 200,
      });
      const snap = checkRes.data?.archived_snapshots?.closest;
      if (snap && snap.url && (snap.available === true || snap.status === '200' || snap.status === 200)) {
        rawSnapshotUrl = snap.url.replace(/^http:\/\//i, 'https://').replace(/\/web\/(\d+)\//, '/web/$1id_/');
      }
    } catch {}

    // 2. Fallback to Wayback Timemap API if availability lookup was empty
    if (!rawSnapshotUrl) {
      try {
        const tmRes = await axios.get(`https://web.archive.org/web/timemap/json?url=${encodeURIComponent(url)}&limit=-1`, {
          timeout: 4000,
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
          },
          validateStatus: (s) => s === 200,
        });
        if (Array.isArray(tmRes.data) && tmRes.data.length > 1) {
          const lastEntry = tmRes.data[tmRes.data.length - 1];
          const timestamp = lastEntry[1];
          const originalUrl = lastEntry[2];
          if (timestamp && originalUrl) {
            rawSnapshotUrl = `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
          }
        }
      } catch {}
    }

    if (rawSnapshotUrl) {
      const contentRes = await axios.get(rawSnapshotUrl, {
        timeout: timeoutMs,
        responseType: 'text',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Accept-Encoding': 'gzip, deflate',
        },
        validateStatus: (s) => s >= 200 && s < 300,
      });
      if (
        contentRes.data &&
        typeof contentRes.data === 'string' &&
        !isBotChallengeOrBlockPage(contentRes.data) &&
        (contentRes.data.includes('<urlset') ||
          contentRes.data.includes('<sitemapindex') ||
          contentRes.data.includes('<rss') ||
          contentRes.data.includes('<feed') ||
          contentRes.data.includes('<url>') ||
          contentRes.data.includes('<item>') ||
          contentRes.data.includes('<entry>') ||
          contentRes.data.includes('<loc>'))
      ) {
        return contentRes.data;
      }
    }
  } catch {}
  return null;
}

// Multi-tier resilient XML fetcher (Browser UA -> Googlebot UA -> Bingbot UA -> Node fetch -> Wayback Archive -> Multi-proxy bridges)
async function fetchXmlContent(url: string, timeoutMs: number = 15000): Promise<string> {
  let lastError: any = null;
  let detectedCloudflare = false;

  // Tier 1: Modern Desktop Browser headers
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: Math.min(timeoutMs, 6000),
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const buffer = Buffer.from(response.data);
    const contentEnc = response.headers['content-encoding'] ? String(response.headers['content-encoding']) : undefined;
    const content = decompressBufferIfNeeded(buffer, url, contentEnc);

    // Verify whether Cloudflare returned a 200 OK challenge HTML instead of real XML
    if (isBotChallengeOrBlockPage(content)) {
      detectedCloudflare = true;
      lastError = new Error('Cloudflare Bot Challenge / Turnstile verification page returned');
    } else {
      return content;
    }
  } catch (err: any) {
    lastError = err;
    const status = err.response?.status;
    if (status === 403) detectedCloudflare = true;
    if (status !== 403 && status !== 401 && status !== 406 && status !== 503) {
      throw formatFetchError(url, err, detectedCloudflare);
    }
  }

  // Fast-track 1: If Cloudflare challenge was detected, check Wayback snapshot immediately
  if (detectedCloudflare) {
    try {
      const waybackData = await fetchWaybackSitemap(url, 10000);
      if (waybackData && waybackData.trim().length > 0) {
        return waybackData;
      }
    } catch {}

    // Fast-track 2: If live sitemap is blocked, check origin syndication feeds directly (e.g. /feed/, /feed/atom/, /sitemap.rss)
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;
      const feeds = [`${origin}/feed/`, `${origin}/feed/atom/`, `${origin}/sitemap.rss`];
      for (const f of feeds) {
        if (f !== url) {
          try {
            const feedRes = await axios.get(f, {
              timeout: 4000,
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': BROWSER_USER_AGENT,
                'Accept': 'text/xml,application/xml,application/rss+xml,application/atom+xml,*/*;q=0.8',
              },
              validateStatus: (s) => s === 200,
            });
            const buf = Buffer.from(feedRes.data);
            const dec = decompressBufferIfNeeded(buf, f, feedRes.headers['content-encoding'] as string);
            if (
              dec &&
              !isBotChallengeOrBlockPage(dec) &&
              (dec.includes('<rss') ||
                dec.includes('<feed') ||
                dec.includes('<urlset') ||
                dec.includes('<item>') ||
                dec.includes('<entry>') ||
                dec.includes('<url>'))
            ) {
              return dec;
            }
          } catch {}
        }
      }
    } catch {}
  }

  // Tier 2: Googlebot User-Agent fallback (Cloudflare & WAFs frequently whitelist search engine bots for sitemaps)
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: Math.min(timeoutMs, 5000),
      headers: {
        'User-Agent': GOOGLEBOT_USER_AGENT,
        'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'From': 'googlebot(at)googlebot.com',
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const buffer = Buffer.from(response.data);
    const contentEnc = response.headers['content-encoding'] ? String(response.headers['content-encoding']) : undefined;
    const content = decompressBufferIfNeeded(buffer, url, contentEnc);

    if (isBotChallengeOrBlockPage(content)) {
      detectedCloudflare = true;
    } else {
      return content;
    }
  } catch (err: any) {
    lastError = err;
  }

  // Tier 2b: Bingbot User-Agent fallback
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: Math.min(timeoutMs, 5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Accept': 'text/xml,application/xml,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const buffer = Buffer.from(response.data);
    const contentEnc = response.headers['content-encoding'] ? String(response.headers['content-encoding']) : undefined;
    const content = decompressBufferIfNeeded(buffer, url, contentEnc);

    if (isBotChallengeOrBlockPage(content)) {
      detectedCloudflare = true;
    } else {
      return content;
    }
  } catch (err: any) {
    lastError = err;
  }

  // Tier 3: Native fetch fallback
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': '*/*',
      },
      signal: AbortSignal.timeout(Math.min(timeoutMs, 5000)),
    });

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const content = decompressBufferIfNeeded(buffer, url, res.headers.get('content-encoding') || undefined);
      if (isBotChallengeOrBlockPage(content)) {
        detectedCloudflare = true;
      } else {
        return content;
      }
    } else {
      if (res.status === 403) detectedCloudflare = true;
      lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
      (lastError as any).status = res.status;
    }
  } catch (err: any) {
    lastError = err;
  }

  // Tier 4: Wayback Machine Archive Snapshot (Bypasses real-time Cloudflare Turnstile blocks with 100% clean snapshots)
  try {
    const waybackData = await fetchWaybackSitemap(url, 8000);
    if (waybackData && waybackData.trim().length > 0) {
      return waybackData;
    }
  } catch {}

  // Tier 5: Public Bypass Proxies (Jina Reader, CorsProxy, AllOrigins)
  const proxyBridges = [
    {
      name: 'jina',
      fetcher: async () => {
        const proxyRes = await proxyAxios.get(`https://r.jina.ai/${url}`, {
          timeout: 5000,
          headers: { 'X-Return-Format': 'html', 'X-No-Cache': 'true' },
          validateStatus: (s) => s >= 200 && s < 300,
        });
        return typeof proxyRes.data === 'string' ? proxyRes.data : '';
      },
    },
    {
      name: 'corsproxy',
      fetcher: async () => {
        const proxyRes = await proxyAxios.get(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, {
          timeout: 5000,
          validateStatus: (s) => s === 200,
        });
        return typeof proxyRes.data === 'string' ? proxyRes.data : '';
      },
    },
    {
      name: 'allorigins',
      fetcher: async () => {
        const proxyRes = await proxyAxios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
          timeout: 5000,
          validateStatus: (s) => s === 200,
        });
        return typeof proxyRes.data === 'string' ? proxyRes.data : '';
      },
    },
  ];

  for (const bridge of proxyBridges) {
    try {
      const data = await bridge.fetcher();
      if (data && data.trim().length > 0) {
        if (isBotChallengeOrBlockPage(data)) {
          detectedCloudflare = true;
        } else {
          return data;
        }
      }
    } catch {}
  }

  // Tier 6: If URL was an XML sitemap on a domain blocked by Cloudflare, check common alternate feeds on Wayback
  if (detectedCloudflare) {
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;
      const alternates = [
        `${origin}/sitemap.rss`,
        `${origin}/feed/`,
        `${origin}/feed/atom/`,
        `${origin}/wp-sitemap.xml`,
        `${origin}/sitemap_index.xml`,
        `${origin}/sitemap.xml`,
      ];
      for (const alt of alternates) {
        if (alt !== url) {
          const altWb = await fetchWaybackSitemap(alt, 6000);
          if (altWb) return altWb;
        }
      }
    } catch {}
  }

  throw formatFetchError(url, lastError, detectedCloudflare);
}

// User-friendly error formatter with explicit guidance for Cloudflare challenges
function formatFetchError(url: string, err: any, wasCloudflareBlocked: boolean = false): Error {
  const status = err?.response?.status || err?.status;
  const isCf = wasCloudflareBlocked || status === 403 || err?.message?.toLowerCase()?.includes('cloudflare');

  if (isCf) {
    let domain = 'website';
    try {
      domain = new URL(url).hostname;
    } catch {}
    return new Error(
      `Cloudflare Anti-Bot Challenge (HTTP 403): Website (${domain}) kích hoạt tường lửa Cloudflare ("challenges.cloudflare.com") để chặn các truy vấn tự động từ máy chủ. Vui lòng mở đường dẫn sitemap trên trình duyệt web của bạn, bấm Ctrl+U để copy toàn bộ nội dung XML và chuyển sang tab "Dán XML / Tải file" để trích xuất ngay lập tức!`
    );
  }
  if (status === 404) {
    return new Error(
      `Sitemap Not Found (HTTP 404): Không tìm thấy file sitemap tại ${url}. Vui lòng kiểm tra lại URL hoặc bấm "Detect" để tự động dò sitemap.`
    );
  }
  if (status === 401) {
    return new Error(
      `Authentication Required (HTTP 401): Sitemap này yêu cầu thông tin đăng nhập/mật khẩu để truy cập.`
    );
  }
  if (err?.code === 'ECONNABORTED' || err?.name === 'TimeoutError') {
    return new Error(`Hết thời gian chờ (Timeout) khi kết nối tới ${url}. Máy chủ phản hồi quá lâu.`);
  }
  return new Error(err?.message || `Không thể tải dữ liệu sitemap từ ${url}`);
}

// Helper to extract clean text from tags with CDATA handling
function cleanTagValue(val: string): string {
  if (!val) return '';
  return val
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

// Helper to parse HTML / reader proxy formatted or plain text sitemap
function parseHtmlOrTextSitemap(content: string, sourceUrl: string): {
  isIndex: boolean;
  indexes: Array<{ loc: string; lastmod?: string }>;
  urls: RawSitemapItem[];
} {
  const indexes: Array<{ loc: string; lastmod?: string }> = [];
  const urls: RawSitemapItem[] = [];

  // Reject Cloudflare and bot challenge HTML outright
  if (isBotChallengeOrBlockPage(content)) {
    return { isIndex: false, indexes: [], urls: [] };
  }

  const isIndexTitle =
    /<title[^>]*>[\s\S]*?(?:index|sitemap index)[\s\S]*?<\/title>/i.test(content) ||
    /sitemap_index|sitemap-index/i.test(sourceUrl);

  // Match <div><a href="...">...</a><br><time>...</time></div> or standard <a href="...">
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>(?:\s*(?:<br\s*\/?>)?\s*<time>([^<]+)<\/time>)?/gi;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const rawLoc = match[1].trim();
    const lastmod = match[2] ? match[2].trim() : undefined;
    if (!rawLoc || rawLoc.startsWith('#') || rawLoc.startsWith('javascript:')) continue;

    const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
    if (!loc) continue;

    const looksLikeSitemapFile =
      loc.endsWith('.xml') ||
      loc.endsWith('.xml.gz') ||
      loc.endsWith('.gz') ||
      loc.includes('sitemap');

    if (isIndexTitle || looksLikeSitemapFile) {
      if (looksLikeSitemapFile) {
        indexes.push({ loc, lastmod });
      } else {
        urls.push({ loc, lastmod, sourceSitemap: sourceUrl });
      }
    } else {
      urls.push({ loc, lastmod, sourceSitemap: sourceUrl });
    }
  }

  // Fallback: If no <a> links found, extract URLs from text
  if (indexes.length === 0 && urls.length === 0) {
    const urlRegex = /https?:\/\/[^\s"'<>\\]+/gi;
    const foundUrls = content.match(urlRegex) || [];
    for (const rawLoc of foundUrls) {
      const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
      if (!loc) continue;

      const isSub = loc.endsWith('.xml') || loc.endsWith('.xml.gz') || loc.includes('sitemap');
      if (isIndexTitle || isSub) {
        if (isSub) {
          indexes.push({ loc });
        } else {
          urls.push({ loc, sourceSitemap: sourceUrl });
        }
      } else {
        urls.push({ loc, sourceSitemap: sourceUrl });
      }
    }
  }

  const isIndex = indexes.length > 0;
  return { isIndex, indexes, urls };
}

// Helper to fetch posts from WordPress REST API if XML sitemaps are missing/broken
async function fetchWordPressPosts(origin: string, maxLinks = 1000): Promise<RawSitemapItem[]> {
  const items: RawSitemapItem[] = [];
  let page = 1;
  while (items.length < maxLinks) {
    try {
      const res = await axios.get(`${origin}/wp-json/wp/v2/posts?per_page=100&page=${page}`, {
        headers: { 'User-Agent': BROWSER_USER_AGENT },
        timeout: 6000,
        validateStatus: (s) => s === 200,
      });
      if (!Array.isArray(res.data) || res.data.length === 0) break;
      for (const p of res.data) {
        if (p.link) {
          items.push({
            loc: p.link,
            lastmod: p.modified || p.date,
            sourceSitemap: `${origin}/wp-json/wp/v2/posts`,
          });
        }
      }
      const totalPages = parseInt(String(res.headers['x-wp-totalpages'] || '1'), 10);
      if (page >= totalPages) break;
      page++;
    } catch {
      break;
    }
  }
  return items;
}

// Parse sitemap XML, RSS/Atom feeds, or JSON CMS posts into entries (either sitemaps or urls)
function parseSitemapXml(xml: string, sourceUrl: string): {
  isIndex: boolean;
  indexes: Array<{ loc: string; lastmod?: string }>;
  urls: RawSitemapItem[];
} {
  const trimmed = (xml || '').trim();

  // 1. Check if input is JSON (e.g. from WordPress REST API /wp-json/wp/v2/posts)
  if (trimmed.startsWith('[') || (trimmed.startsWith('{') && !trimmed.startsWith('<?xml'))) {
    try {
      const parsedJson = JSON.parse(trimmed);
      const postList = Array.isArray(parsedJson)
        ? parsedJson
        : Array.isArray(parsedJson.posts)
        ? parsedJson.posts
        : [];
      if (postList.length > 0) {
        const urls: RawSitemapItem[] = [];
        for (const item of postList) {
          const loc = item.link || item.url || (typeof item.guid === 'object' ? item.guid?.rendered : item.guid);
          if (loc && typeof loc === 'string') {
            urls.push({
              loc,
              lastmod: item.modified || item.date || item.published || undefined,
              sourceSitemap: sourceUrl,
            });
          }
        }
        if (urls.length > 0) {
          return { isIndex: false, indexes: [], urls };
        }
      }
    } catch {}
  }

  // 2. Check if XML format
  const isXml = /<\?xml|<sitemapindex|<urlset|<url[\s>]|<sitemap[\s>]|<rss|<feed|<channel/i.test(xml);
  if (!isXml) {
    if (isBotChallengeOrBlockPage(xml)) {
      return { isIndex: false, indexes: [], urls: [] };
    }
    return parseHtmlOrTextSitemap(xml, sourceUrl);
  }

  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const indexes: Array<{ loc: string; lastmod?: string }> = [];
  const urls: RawSitemapItem[] = [];

  if (isIndex) {
    const sitemapMatches = xml.match(/<sitemap[\s>]([\s\S]*?)<\/sitemap>/gi) || [];
    for (const sm of sitemapMatches) {
      const locMatch = sm.match(/<loc[\s>]([\s\S]*?)<\/loc>/i);
      const lastmodMatch = sm.match(/<lastmod[\s>]([\s\S]*?)<\/lastmod>/i);
      if (locMatch && locMatch[1]) {
        const rawLoc = cleanTagValue(locMatch[1]);
        const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
        if (loc) {
          indexes.push({
            loc,
            lastmod: lastmodMatch && lastmodMatch[1] ? cleanTagValue(lastmodMatch[1]) : undefined,
          });
        }
      }
    }

    if (indexes.length === 0) {
      const genericLocs = xml.match(/(?<=<loc[\s>])([\s\S]*?)(?=<\/loc>)/gi) || [];
      for (const raw of genericLocs) {
        const rawLoc = cleanTagValue(raw);
        const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
        if (loc) indexes.push({ loc });
      }
    }
  } else {
    // Check standard <url> entries
    const urlMatches = xml.match(/<url[\s>]([\s\S]*?)<\/url>/gi) || [];
    if (urlMatches.length > 0) {
      for (const um of urlMatches) {
        const locMatch = um.match(/<loc[\s>]([\s\S]*?)<\/loc>/i);
        if (locMatch && locMatch[1]) {
          const rawLoc = cleanTagValue(locMatch[1]);
          const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
          if (loc) {
            const lastmod = um.match(/<lastmod[\s>]([\s\S]*?)<\/lastmod>/i);
            const changefreq = um.match(/<changefreq[\s>]([\s\S]*?)<\/changefreq>/i);
            const priority = um.match(/<priority[\s>]([\s\S]*?)<\/priority>/i);

            urls.push({
              loc,
              lastmod: lastmod && lastmod[1] ? cleanTagValue(lastmod[1]) : undefined,
              changefreq: changefreq && changefreq[1] ? cleanTagValue(changefreq[1]) : undefined,
              priority: priority && priority[1] ? cleanTagValue(priority[1]) : undefined,
              sourceSitemap: sourceUrl,
            });
          }
        }
      }
    } else {
      // Check RSS <item> entries (e.g. /feed/ or /rss.xml)
      const rssItems = xml.match(/<item[\s>]([\s\S]*?)<\/item>/gi) || [];
      if (rssItems.length > 0) {
        for (const item of rssItems) {
          const linkMatch = item.match(/<link[\s>]([\s\S]*?)<\/link>/i) || item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
          const rawLoc = linkMatch && linkMatch[1] ? cleanTagValue(linkMatch[1]) : '';
          const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
          if (loc) {
            const pubDate = item.match(/<pubDate[\s>]([\s\S]*?)<\/pubDate>/i);
            urls.push({
              loc,
              lastmod: pubDate && pubDate[1] ? cleanTagValue(pubDate[1]) : undefined,
              sourceSitemap: sourceUrl,
            });
          }
        }
      } else {
        // Check Atom <entry> entries
        const atomEntries = xml.match(/<entry[\s>]([\s\S]*?)<\/entry>/gi) || [];
        if (atomEntries.length > 0) {
          for (const entry of atomEntries) {
            const linkMatch = entry.match(/<link[^>]*href=["']([^"']+)["']/i) || entry.match(/<link[\s>]([\s\S]*?)<\/link>/i);
            const rawLoc = linkMatch && linkMatch[1] ? cleanTagValue(linkMatch[1]) : '';
            const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
            if (loc) {
              const updated = entry.match(/<updated[\s>]([\s\S]*?)<\/updated>/i) || entry.match(/<published[\s>]([\s\S]*?)<\/published>/i);
              urls.push({
                loc,
                lastmod: updated && updated[1] ? cleanTagValue(updated[1]) : undefined,
                sourceSitemap: sourceUrl,
              });
            }
          }
        } else {
          // Generic <loc> fallback
          const regex = /(?<=<loc[\s>])([\s\S]*?)(?=<\/loc>)/gi;
          const genericLocs = xml.match(regex) || [];
          for (const raw of genericLocs) {
            const rawLoc = cleanTagValue(raw);
            const loc = cleanAndValidateExtractedUrl(rawLoc, sourceUrl);
            if (loc) {
              urls.push({ loc, sourceSitemap: sourceUrl });
            }
          }
        }
      }
    }
  }

  // If XML contained no structured items, try HTML/text parsing only if not a bot challenge page
  if (!isIndex && urls.length === 0 && !isBotChallengeOrBlockPage(xml)) {
    return parseHtmlOrTextSitemap(xml, sourceUrl);
  }

  return { isIndex, indexes, urls };
}

// Check if input URL looks like an explicit sitemap file or if it's a domain/home page
function isLikelyDirectSitemapUrl(input: string): boolean {
  try {
    let testUrl = input.trim();
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      testUrl = 'https://' + testUrl;
    }
    const urlObj = new URL(testUrl);
    const pathname = urlObj.pathname.toLowerCase();

    // Ends with typical sitemap extension
    if (
      pathname.endsWith('.xml') ||
      pathname.endsWith('.xml.gz') ||
      pathname.endsWith('.gz') ||
      pathname.endsWith('.txt')
    ) {
      return true;
    }

    // Has a specific sitemap path other than root
    if (pathname.includes('sitemap') && pathname !== '/sitemap' && pathname !== '/sitemap/') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Discover sitemaps from robots.txt, standard candidate locations, feeds, and CMS APIs
async function discoverSitemapsForDomain(domainOrUrl: string): Promise<{
  domain: string;
  robotsFound: boolean;
  sitemaps: Array<{
    url: string;
    source: 'robots.txt' | 'well-known' | 'common-pattern' | 'feed' | 'wp-api';
    status?: number;
    note?: string;
  }>;
}> {
  let host = domainOrUrl.trim();
  if (!host.startsWith('http://') && !host.startsWith('https://')) {
    host = 'https://' + host;
  }

  const urlObj = new URL(host);
  const origin = urlObj.origin;

  const results: Array<{
    url: string;
    source: 'robots.txt' | 'well-known' | 'common-pattern' | 'feed' | 'wp-api';
    status?: number;
    note?: string;
  }> = [];

  let robotsFound = false;
  const rawRobotsCandidates: string[] = [];

  // 1. Check robots.txt with browser headers
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const robotsRes = await axios.get(robotsUrl, {
      timeout: 5000,
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      validateStatus: (s) => s === 200,
    });

    if (robotsRes.data && typeof robotsRes.data === 'string') {
      robotsFound = true;
      const sitemapLines = robotsRes.data.match(/sitemap:\s*(.+)/gi) || [];
      for (const line of sitemapLines) {
        const match = line.replace(/sitemap:\s*/i, '').trim();
        if (match && !rawRobotsCandidates.includes(match)) {
          rawRobotsCandidates.push(match);
        }
      }
    }
  } catch {}

  // 1b. If direct robots.txt failed or was blocked by WAF/Cloudflare, try via bypass proxy
  if (rawRobotsCandidates.length === 0) {
    try {
      const proxyRes = await proxyAxios.get(`https://r.jina.ai/${robotsUrl}`, {
        timeout: 8000,
        headers: { 'X-Return-Format': 'text', 'X-No-Cache': 'true' },
        validateStatus: (s) => s === 200,
      });

      if (proxyRes.data && typeof proxyRes.data === 'string') {
        const sitemapLines = proxyRes.data.match(/sitemap:\s*(https?:\/\/[^\s]+)/gi) || [];
        for (const line of sitemapLines) {
          const match = line.replace(/sitemap:\s*/i, '').trim();
          if (match && !rawRobotsCandidates.includes(match)) {
            rawRobotsCandidates.push(match);
            robotsFound = true;
          }
        }
      }
    } catch {}
  }

  // 1c. Verify reachability of declared robots.txt sitemaps
  if (rawRobotsCandidates.length > 0) {
    await Promise.allSettled(
      rawRobotsCandidates.map(async (candidateUrl) => {
        let status = 200;
        let note: string | undefined = undefined;
        try {
          const checkRes = await axios.get(candidateUrl, {
            timeout: 4500,
            maxContentLength: 50000,
            headers: { 'User-Agent': BROWSER_USER_AGENT },
            validateStatus: () => true,
          });
          status = checkRes.status;

          // If blocked by 403, check if bypass proxy can read it
          if (status === 403) {
            try {
              const pRes = await proxyAxios.get(`https://r.jina.ai/${candidateUrl}`, {
                timeout: 6000,
                headers: { 'X-Return-Format': 'text' },
                validateStatus: () => true,
              });
              if (pRes.status === 200 && !pRes.data?.includes('404: Not Found')) {
                status = 200;
              }
            } catch {}
          }
        } catch (err: any) {
          status = err?.response?.status || 404;
        }

        if (status === 404) {
          note = 'Referenced in robots.txt but returns HTTP 404 Not Found on server';
        }

        results.push({ url: candidateUrl, source: 'robots.txt', status, note });
      })
    );
  }

  // Check if at least one declared sitemap from robots.txt is 200 OK
  const hasWorkingRobotsSitemap = results.some((r) => r.status === 200);
  if (hasWorkingRobotsSitemap) {
    return {
      domain: origin,
      robotsFound,
      sitemaps: results,
    };
  }

  // 2. If no declared sitemaps or all declared sitemaps are 404, probe standard candidates, feeds, and CMS APIs
  const standardCandidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemaps.xml`,
    `${origin}/post-sitemap.xml`,
    `${origin}/page-sitemap.xml`,
  ];

  await Promise.allSettled(
    standardCandidates.map(async (candidate) => {
      if (results.some((r) => r.url === candidate)) return;
      try {
        const headRes = await axios.get(candidate, {
          timeout: 4000,
          maxContentLength: 50000,
          headers: { 'User-Agent': BROWSER_USER_AGENT },
          validateStatus: (s) => s === 200,
        });
        if (headRes.status === 200 && !results.some((r) => r.url === candidate)) {
          results.push({ url: candidate, source: 'common-pattern', status: 200 });
        }
      } catch {}
    })
  );

  // 3. Probe RSS / Atom feeds (critical fallback for WordPress, Ghost, Drupal, Substack)
  const feedCandidates = [
    { url: `${origin}/feed/`, note: 'WordPress RSS feed' },
    { url: `${origin}/feed/atom/`, note: 'Atom syndication feed' },
    { url: `${origin}/rss.xml`, note: 'Standard RSS feed' },
  ];

  await Promise.allSettled(
    feedCandidates.map(async (item) => {
      if (results.some((r) => r.url === item.url)) return;
      try {
        const fRes = await axios.get(item.url, {
          timeout: 4000,
          maxContentLength: 100000,
          headers: { 'User-Agent': BROWSER_USER_AGENT },
          validateStatus: (s) => s === 200,
        });
        if (
          fRes.status === 200 &&
          typeof fRes.data === 'string' &&
          (fRes.data.includes('<item') || fRes.data.includes('<entry'))
        ) {
          results.push({ url: item.url, source: 'feed', status: 200, note: item.note });
        }
      } catch {}
    })
  );

  // 4. Probe WordPress REST API
  try {
    const wpApiUrl = `${origin}/wp-json/wp/v2/posts?per_page=10`;
    const wpRes = await axios.get(wpApiUrl, {
      timeout: 4000,
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      validateStatus: (s) => s === 200,
    });
    if (Array.isArray(wpRes.data) && wpRes.data.length > 0) {
      const totalCount = wpRes.headers['x-wp-total'] ? `${wpRes.headers['x-wp-total']} posts` : 'Active posts API';
      results.push({
        url: `${origin}/wp-json/wp/v2/posts`,
        source: 'wp-api',
        status: 200,
        note: `WordPress REST API (${totalCount})`,
      });
    }
  } catch {}

  // 5. Proxy fallback check if still no working candidate found
  if (!results.some((r) => r.status === 200)) {
    for (const cand of [`${origin}/sitemap_index.xml`, `${origin}/sitemap.xml`]) {
      try {
        const candRes = await proxyAxios.get(`https://r.jina.ai/${cand}`, {
          timeout: 6000,
          headers: { 'X-Return-Format': 'html' },
          validateStatus: (s) => s === 200,
        });
        if (
          candRes.data &&
          typeof candRes.data === 'string' &&
          (candRes.data.includes('<a href=') || candRes.data.includes('sitemap'))
        ) {
          results.push({ url: cand, source: 'common-pattern', status: 200 });
          break;
        }
      } catch {}
    }
  }

  return {
    domain: origin,
    robotsFound,
    sitemaps: results,
  };
}

// Auto-resolve any user input: if domain, find sitemaps automatically; if direct sitemap URL, preserve as-is
async function resolveInputToSitemapUrls(inputUrl: string): Promise<{
  isDomainInput: boolean;
  domain?: string;
  resolvedSitemaps: string[];
}> {
  let normalized = inputUrl.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  // If user provided an explicit direct sitemap URL
  if (isLikelyDirectSitemapUrl(normalized)) {
    return {
      isDomainInput: false,
      resolvedSitemaps: [normalized],
    };
  }

  // User provided a domain or site root -> automatically find its sitemaps
  const urlObj = new URL(normalized);
  const origin = urlObj.origin;
  const discovery = await discoverSitemapsForDomain(origin);

  if (discovery.sitemaps.length > 0) {
    // Prioritize sitemaps that are working (status !== 404)
    const workingSitemaps = discovery.sitemaps.filter((s) => s.status === 200);
    const chosen = workingSitemaps.length > 0 ? workingSitemaps : discovery.sitemaps;
    const urls = chosen.map((s) => s.url);
    return {
      isDomainInput: true,
      domain: origin,
      resolvedSitemaps: urls,
    };
  }

  // Fallback: If no sitemap found in robots.txt or common patterns, attempt standard /sitemap.xml
  return {
    isDomainInput: true,
    domain: origin,
    resolvedSitemaps: [`${origin}/sitemap.xml`],
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. Direct extract endpoint (Supports URL or Direct raw XML Content)
  app.post('/api/sitemap/extract', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        url,
        xmlContent,
        filterIndexes,
        method = 'enhanced',
        includeMetadata = true,
        maxLinks = 0,
        urlFilter,
        urlExclude,
      } = req.body;

      const parsedMax = maxLinks !== undefined ? Number(maxLinks) : 0;
      const effectiveMaxLinks = isNaN(parsedMax) ? 0 : parsedMax;

      // Case A: User provided direct raw XML content (bypasses all network/CORS/403 blocks)
      if (xmlContent && typeof xmlContent === 'string' && xmlContent.trim()) {
        const sourceName = url || 'pasted-sitemap.xml';
        const parsed = parseSitemapXml(xmlContent.trim(), sourceName);

        let items = parsed.urls;
        if (urlFilter) {
          items = items.filter((it) => it.loc.toLowerCase().includes(urlFilter.toLowerCase()));
        }
        if (urlExclude) {
          items = items.filter((it) => !it.loc.toLowerCase().includes(urlExclude.toLowerCase()));
        }
        if (effectiveMaxLinks > 0 && items.length > effectiveMaxLinks) {
          items = items.slice(0, effectiveMaxLinks);
        }

        return res.json({
          success: true,
          method: 'pasted-xml',
          rootUrl: sourceName,
          items,
          indexes: parsed.indexes,
          stats: {
            totalLinks: items.length,
            totalIndexes: parsed.indexes.length,
            sitemapsScanned: 1,
            durationMs: Date.now() - startTime,
            rootUrl: sourceName,
            isIndex: parsed.isIndex,
          },
        });
      }

      // Case B: Fetch from URL or Domain
      if (!url || typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ error: 'Valid URL, Domain, or XML content is required' });
      }

      // Automatically resolve input: if domain, find sitemaps automatically; if direct sitemap URL, preserve as-is
      const { isDomainInput, domain, resolvedSitemaps } = await resolveInputToSitemapUrls(url);

      if (!resolvedSitemaps || resolvedSitemaps.length === 0) {
        return res.status(404).json({
          error: `Could not auto-detect any public XML sitemaps for ${domain || url}. Check the domain name or paste the sitemap XML directly.`
        });
      }

      const primarySitemapUrl = resolvedSitemaps[0];

      // If user specifically requested standard library
      if (method === 'standard') {
        try {
          const links = await GetSitemapLinks(primarySitemapUrl, {
            filterIndexes: filterIndexes || undefined,
          });

          let resultLinks = (Array.isArray(links) ? links : []).map((loc) => ({
            loc,
            sourceSitemap: primarySitemapUrl,
          }));

          if (urlFilter) {
            resultLinks = resultLinks.filter((item) =>
              item.loc.toLowerCase().includes(urlFilter.toLowerCase())
            );
          }
          if (urlExclude) {
            resultLinks = resultLinks.filter(
              (item) => !item.loc.toLowerCase().includes(urlExclude.toLowerCase())
            );
          }
          if (effectiveMaxLinks > 0 && resultLinks.length > effectiveMaxLinks) {
            resultLinks = resultLinks.slice(0, effectiveMaxLinks);
          }

          return res.json({
            success: true,
            method: isDomainInput ? 'domain-standard' : 'standard',
            rootUrl: primarySitemapUrl,
            discoveredFromDomain: isDomainInput ? domain : undefined,
            discoveredSitemaps: isDomainInput ? resolvedSitemaps : undefined,
            items: resultLinks,
            stats: {
              totalLinks: resultLinks.length,
              totalIndexes: 0,
              sitemapsScanned: 1,
              durationMs: Date.now() - startTime,
              rootUrl: primarySitemapUrl,
              isIndex: false,
              discoveredFromDomain: isDomainInput ? domain : undefined,
              discoveredSitemaps: isDomainInput ? resolvedSitemaps : undefined,
            },
          });
        } catch (err: any) {
          // If standard library failed with 403 or parser error, fallback to enhanced crawler with multi-tier retries
          console.warn('Standard GetSitemapLinks failed, falling back to enhanced crawler:', err.message);
        }
      }

      // Enhanced crawler with multi-tier fetch, metadata extraction, and sub-index error resilience
      // Supports crawling single sitemap OR multiple discovered sitemaps (e.g. from robots.txt)
      const items: RawSitemapItem[] = [];
      const visitedUrls = new Set<string>();
      let totalSitemapsScanned = 0;
      let totalIndexesFound = 0;
      let hasAnyIndex = false;
      const allDiscoveredIndexes: Array<{ loc: string; lastmod?: string }> = [];
      let recoveryNotice: string | undefined = undefined;

      for (let targetUrl of resolvedSitemaps) {
        if (effectiveMaxLinks > 0 && items.length >= effectiveMaxLinks) break;

        let rootXml = '';
        try {
          rootXml = await fetchXmlContent(targetUrl);
        } catch (targetErr: any) {
          console.warn(`Sitemap fetch failed (${targetUrl}):`, targetErr.message);

          // If targetUrl returned 404 or 403/Cloudflare firewall block, attempt intelligent auto-recovery
          const isBlockedOrNotFound =
            targetErr?.message?.includes('404') ||
            targetErr?.status === 404 ||
            targetErr?.message?.includes('403') ||
            targetErr?.status === 403 ||
            targetErr?.message?.toLowerCase()?.includes('cloudflare') ||
            targetErr?.message?.toLowerCase()?.includes('challenge') ||
            targetErr?.message?.toLowerCase()?.includes('turnstile');

          if (isBlockedOrNotFound) {
            let recovered = false;
            try {
              const urlObj = new URL(targetUrl);
              const origin = urlObj.origin;

              // 1. Try Wayback Archive snapshot first (clean raw snapshot bypassing live Cloudflare blocks)
              try {
                const wbData = await fetchWaybackSitemap(targetUrl, 10000);
                if (wbData) {
                  rootXml = wbData;
                  recoveryNotice = `Sitemap bị tường lửa Cloudflare chặn truy vấn tự động. Hệ thống đã tự động phục hồi dữ liệu từ bản sao snapshot lưu trữ (Archive).`;
                  recovered = true;
                }
              } catch {}

              // 2. Check direct syndication feeds on origin (many CMS keep /feed/ open even if sitemaps are firewalled)
              if (!recovered) {
                const feedUrls = [`${origin}/feed/`, `${origin}/feed/atom/`, `${origin}/sitemap.rss`];
                for (const feedUrl of feedUrls) {
                  try {
                    const fRes = await axios.get(feedUrl, {
                      timeout: 5000,
                      responseType: 'arraybuffer',
                      headers: {
                        'User-Agent': BROWSER_USER_AGENT,
                        'Accept': 'text/xml,application/xml,application/rss+xml,application/atom+xml,*/*;q=0.8',
                      },
                      validateStatus: (s) => s === 200,
                    });
                    const buf = Buffer.from(fRes.data);
                    const fXml = decompressBufferIfNeeded(buf, feedUrl, fRes.headers['content-encoding'] as string);
                    if (fXml && !isBotChallengeOrBlockPage(fXml)) {
                      const fParsed = parseSitemapXml(fXml, feedUrl);
                      if (fParsed.urls.length > 0 || fParsed.indexes.length > 0) {
                        rootXml = fXml;
                        targetUrl = feedUrl;
                        recoveryNotice = `Sitemap chính bị chặn. Hệ thống đã tự động chuyển đổi sang nguồn syndication feed: ${feedUrl}.`;
                        recovered = true;
                        break;
                      }
                    }
                  } catch {}
                }
              }

              // 3. Check if WordPress REST API is available
              if (!recovered) {
                const wpItems = await fetchWordPressPosts(origin, effectiveMaxLinks > 0 ? effectiveMaxLinks : 5000);
                if (wpItems.length > 0) {
                  const wasCf = targetErr?.message?.toLowerCase()?.includes('cloudflare') || targetErr?.status === 403;
                  recoveryNotice = wasCf
                    ? `Sitemap (${targetUrl}) bị tường lửa Cloudflare chặn truy vấn tự động. Hệ thống đã tự động vượt qua tường lửa bằng cách trích xuất ${wpItems.length} liên kết bài viết qua WordPress REST API.`
                    : `Đường dẫn sitemap (${targetUrl}) trả về lỗi 404 Not Found. Hệ thống đã tự động phục hồi và trích xuất ${wpItems.length} liên kết từ WordPress REST API.`;
                  for (const u of wpItems) {
                    if (!visitedUrls.has(u.loc)) {
                      visitedUrls.add(u.loc);
                      items.push(u);
                    }
                  }
                  totalSitemapsScanned++;
                  recovered = true;
                }
              }

              // 4. Check if other standard alternate sitemaps exist
              if (!recovered) {
                const fallbacks = [
                  `${origin}/sitemap.xml`,
                  `${origin}/wp-sitemap.xml`,
                  `${origin}/sitemap_index.xml`,
                  `${origin}/rss.xml`,
                ];

                for (const fb of fallbacks) {
                  if (fb !== targetUrl) {
                    try {
                      let fbXml = await fetchWaybackSitemap(fb, 6000);
                      if (!fbXml) {
                        fbXml = await fetchXmlContent(fb, 6000);
                      }
                      if (fbXml) {
                        const fbParsed = parseSitemapXml(fbXml, fb);
                        if (fbParsed.urls.length > 0 || fbParsed.indexes.length > 0) {
                          rootXml = fbXml;
                          targetUrl = fb;
                          recoveryNotice = `Sitemap tự động chuyển đổi thành công sang nguồn dữ liệu thay thế: ${fb}.`;
                          recovered = true;
                          break;
                        }
                      }
                    } catch {}
                  }
                }
              }
            } catch {}

            if (recovered) {
              if (!rootXml) {
                continue;
              }
            } else {
              if (resolvedSitemaps.length === 1) {
                throw targetErr;
              }
              continue;
            }
          } else {
            if (resolvedSitemaps.length === 1) {
              throw targetErr;
            }
            continue;
          }
        }

        try {
          const parsedRoot = parseSitemapXml(rootXml, targetUrl);
          totalSitemapsScanned++;

          if (!parsedRoot.isIndex) {
            for (const u of parsedRoot.urls) {
              if (!visitedUrls.has(u.loc)) {
                visitedUrls.add(u.loc);
                items.push(u);
              }
            }
          } else {
            hasAnyIndex = true;
            totalIndexesFound += parsedRoot.indexes.length;
            allDiscoveredIndexes.push(...parsedRoot.indexes);

            let targetIndexes = parsedRoot.indexes;
            if (filterIndexes && filterIndexes.trim()) {
              const filterStr = filterIndexes.trim().toLowerCase();
              targetIndexes = targetIndexes.filter((idx) =>
                idx.loc.toLowerCase().includes(filterStr)
              );
            }

            const BATCH_SIZE = 5;
            for (let i = 0; i < targetIndexes.length; i += BATCH_SIZE) {
              if (maxLinks && items.length >= maxLinks) break;

              const batch = targetIndexes.slice(i, i + BATCH_SIZE);
              await Promise.allSettled(
                batch.map(async (idx) => {
                  try {
                    const subXml = await fetchXmlContent(idx.loc);
                    const subParsed = parseSitemapXml(subXml, idx.loc);
                    totalSitemapsScanned++;
                    for (const u of subParsed.urls) {
                      if (!visitedUrls.has(u.loc)) {
                        visitedUrls.add(u.loc);
                        items.push(u);
                      }
                    }
                  } catch (subErr: any) {
                    console.warn(`Sub-sitemap skipped (${idx.loc}):`, subErr.message);
                  }
                })
              );
            }
          }
        } catch (parseErr: any) {
          console.warn(`Sitemap parsing failed for (${targetUrl}):`, parseErr.message);
          if (resolvedSitemaps.length === 1 && items.length === 0) {
            throw parseErr;
          }
        }

        // If an index was found but all sub-sitemaps were blocked by Cloudflare (0 items extracted), attempt alternate feeds
        if (hasAnyIndex && items.length === 0) {
          let origin = '';
          try {
            origin = new URL(targetUrl).origin;
          } catch {}

          if (origin) {
            const domainFallbacks = [
              `${origin}/sitemap.rss`,
              `${origin}/feed/`,
              `${origin}/feed/atom/`,
              `${origin}/wp-sitemap.xml`,
              `${origin}/rss.xml`,
            ];

            for (const fb of domainFallbacks) {
              try {
                let fbXml = await fetchWaybackSitemap(fb, 8000);
                if (!fbXml) {
                  fbXml = await fetchXmlContent(fb, 5000);
                }
                if (fbXml) {
                  const fbParsed = parseSitemapXml(fbXml, fb);
                  if (fbParsed.urls.length > 0) {
                    for (const u of fbParsed.urls) {
                      if (!visitedUrls.has(u.loc)) {
                        visitedUrls.add(u.loc);
                        items.push(u);
                      }
                    }
                    recoveryNotice = `Các sitemap con bị tường lửa Cloudflare chặn tự động tải. Hệ thống đã tự động trích xuất ${fbParsed.urls.length} liên kết từ nguồn thay thế: ${fb}.`;
                    totalSitemapsScanned++;
                    break;
                  }
                }
              } catch {}
            }
          }
        }
      }

      let filteredItems = items;
      if (urlFilter) {
        filteredItems = filteredItems.filter((it) =>
          it.loc.toLowerCase().includes(urlFilter.toLowerCase())
        );
      }
      if (urlExclude) {
        filteredItems = filteredItems.filter(
          (it) => !it.loc.toLowerCase().includes(urlExclude.toLowerCase())
        );
      }
      if (effectiveMaxLinks > 0 && filteredItems.length > effectiveMaxLinks) {
        filteredItems = filteredItems.slice(0, effectiveMaxLinks);
      }

      return res.json({
        success: true,
        method: isDomainInput ? 'domain-enhanced' : 'enhanced',
        rootUrl: primarySitemapUrl,
        discoveredFromDomain: isDomainInput ? domain : undefined,
        discoveredSitemaps: isDomainInput ? resolvedSitemaps : undefined,
        items: filteredItems,
        indexes: allDiscoveredIndexes,
        recoveryNotice,
        stats: {
          totalLinks: filteredItems.length,
          totalIndexes: totalIndexesFound,
          sitemapsScanned: totalSitemapsScanned,
          durationMs: Date.now() - startTime,
          rootUrl: primarySitemapUrl,
          isIndex: hasAnyIndex,
          recoveryNotice,
          discoveredFromDomain: isDomainInput ? domain : undefined,
          discoveredSitemaps: isDomainInput ? resolvedSitemaps : undefined,
        },
      });
    } catch (err: any) {
      console.warn('Extract error handled:', err.message);
      res.status(400).json({
        error: err.message || 'Failed to fetch and parse sitemap',
      });
    }
  });

  // 2. Server-Sent Events (SSE) stream endpoint
  app.get('/api/sitemap/stream', async (req, res) => {
    const url = req.query.url as string;
    const filterIndexes = (req.query.filterIndexes as string) || '';
    const rawMax = req.query.maxLinks !== undefined ? parseInt(req.query.maxLinks as string, 10) : 0;
    const maxLinks = isNaN(rawMax) ? 0 : rawMax;

    if (!url) {
      res.status(400).send('Missing url parameter');
      return;
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const startTime = Date.now();
    let isAborted = false;
    req.on('close', () => {
      isAborted = true;
    });

    try {
      // Auto-resolve input: if domain, detect sitemaps; if direct sitemap URL, proceed
      const { isDomainInput, domain, resolvedSitemaps } = await resolveInputToSitemapUrls(normalizedUrl);
      if (isDomainInput) {
        sendEvent('status', {
          message: `Auto-detected sitemap for ${domain}: ${resolvedSitemaps[0]}`,
          stage: 'discovered',
          domain,
          resolvedSitemap: resolvedSitemaps[0],
          allDiscovered: resolvedSitemaps,
        });
        sendEvent('domain_resolved', {
          domain,
          sitemap: resolvedSitemaps[0],
          allSitemaps: resolvedSitemaps,
        });
        normalizedUrl = resolvedSitemaps[0];
      }

      sendEvent('status', { message: `Connecting to ${normalizedUrl}...`, stage: 'connecting' });
      let rootXml = '';
      let streamRecoveryNotice: string | undefined = undefined;

      try {
        rootXml = await fetchXmlContent(normalizedUrl);
      } catch (streamErr: any) {
        const isBlockedOrNotFound =
          streamErr?.message?.includes('404') ||
          streamErr?.status === 404 ||
          streamErr?.message?.includes('403') ||
          streamErr?.status === 403 ||
          streamErr?.message?.toLowerCase()?.includes('cloudflare') ||
          streamErr?.message?.toLowerCase()?.includes('challenge') ||
          streamErr?.message?.toLowerCase()?.includes('turnstile');

        if (isBlockedOrNotFound) {
          sendEvent('status', {
            message: `Phát hiện chặn bảo mật hoặc 404. Đang tự động dò tìm Wayback Snapshot, Feeds & WordPress API...`,
            stage: 'recovering',
          });

          // 1. Try Wayback Archive snapshot first
          try {
            const wb = await fetchWaybackSitemap(normalizedUrl, 10000);
            if (wb) {
              rootXml = wb;
              streamRecoveryNotice = `Sitemap bị Cloudflare chặn truy vấn trực tiếp. Đã tự động phục hồi dữ liệu từ bản sao snapshot lưu trữ (Archive).`;
              sendEvent('status', {
                message: streamRecoveryNotice,
                stage: 'streaming',
              });
            }
          } catch {}

          let origin = '';
          try {
            origin = new URL(normalizedUrl).origin;
          } catch {}

          if (!rootXml && origin) {
            // 2. Check direct syndication feeds on origin
            const feedUrls = [`${origin}/feed/`, `${origin}/feed/atom/`, `${origin}/sitemap.rss`];
            for (const feedUrl of feedUrls) {
              try {
                const fRes = await axios.get(feedUrl, {
                  timeout: 5000,
                  responseType: 'arraybuffer',
                  headers: {
                    'User-Agent': BROWSER_USER_AGENT,
                    'Accept': 'text/xml,application/xml,application/rss+xml,application/atom+xml,*/*;q=0.8',
                  },
                  validateStatus: (s) => s === 200,
                });
                const buf = Buffer.from(fRes.data);
                const fXml = decompressBufferIfNeeded(buf, feedUrl, fRes.headers['content-encoding'] as string);
                if (fXml && !isBotChallengeOrBlockPage(fXml)) {
                  const fParsed = parseSitemapXml(fXml, feedUrl);
                  if (fParsed.urls.length > 0 || fParsed.indexes.length > 0) {
                    rootXml = fXml;
                    normalizedUrl = feedUrl;
                    streamRecoveryNotice = `Sitemap bị chặn. Hệ thống đã tự động chuyển đổi sang nguồn feed: ${feedUrl}.`;
                    sendEvent('status', {
                      message: streamRecoveryNotice,
                      stage: 'streaming',
                    });
                    break;
                  }
                }
              } catch {}
            }

            // 3. Check WordPress REST API
            if (!rootXml) {
              const wpItems = await fetchWordPressPosts(origin, maxLinks || 1000);
              if (wpItems.length > 0) {
                const wasCf = streamErr?.message?.toLowerCase()?.includes('cloudflare') || streamErr?.status === 403;
                streamRecoveryNotice = wasCf
                  ? `Sitemap (${normalizedUrl}) bị tường lửa Cloudflare chặn. Đã tự động vượt qua tường lửa và trích xuất ${wpItems.length} liên kết qua WordPress REST API.`
                  : `Sitemap (${normalizedUrl}) trả về lỗi 404. Đã tự động phục hồi ${wpItems.length} liên kết qua WordPress REST API.`;
                sendEvent('status', {
                  message: streamRecoveryNotice,
                  stage: 'streaming',
                });
                const batchSize = 50;
                for (let i = 0; i < wpItems.length; i += batchSize) {
                  if (isAborted) break;
                  const chunk = wpItems.slice(i, i + batchSize);
                  sendEvent('links_batch', {
                    items: chunk,
                    sourceSitemap: `${origin}/wp-json/wp/v2/posts`,
                    totalSoFar: Math.min(i + chunk.length, wpItems.length),
                  });
                }
                sendEvent('complete', {
                  totalLinks: wpItems.length,
                  sitemapsScanned: 1,
                  durationMs: Date.now() - startTime,
                  recoveryNotice: streamRecoveryNotice,
                });
                return;
              }
            }

            // 4. Check alternate standard sitemaps
            if (!rootXml) {
              for (const fb of [`${origin}/sitemap.xml`, `${origin}/wp-sitemap.xml`, `${origin}/sitemap_index.xml`]) {
                try {
                  let fbXml = await fetchWaybackSitemap(fb, 6000);
                  if (!fbXml) {
                    fbXml = await fetchXmlContent(fb, 8000);
                  }
                  if (fbXml) {
                    const fbParsed = parseSitemapXml(fbXml, fb);
                    if (fbParsed.urls.length > 0 || fbParsed.indexes.length > 0) {
                      rootXml = fbXml;
                      normalizedUrl = fb;
                      streamRecoveryNotice = `Sitemap tự động chuyển đổi thành công sang nguồn dữ liệu thay thế: ${fb}.`;
                      sendEvent('status', {
                        message: streamRecoveryNotice,
                        stage: 'streaming',
                      });
                      break;
                    }
                  }
                } catch {}
              }
            }
          }
        }

        if (!rootXml) {
          throw streamErr;
        }
      }

      const parsedRoot = parseSitemapXml(rootXml, normalizedUrl);

      sendEvent('root_parsed', {
        isIndex: parsedRoot.isIndex,
        indexesCount: parsedRoot.indexes.length,
        directUrlsCount: parsedRoot.urls.length,
        indexes: parsedRoot.indexes,
      });

      const uniqueSet = new Set<string>();
      let totalEmitted = 0;

      if (!parsedRoot.isIndex) {
        let urlsToEmit = parsedRoot.urls;
        if (maxLinks > 0 && urlsToEmit.length > maxLinks) {
          urlsToEmit = urlsToEmit.slice(0, maxLinks);
        }
        const batchSize = 100;
        for (let i = 0; i < urlsToEmit.length; i += batchSize) {
          if (isAborted) break;
          const chunk = urlsToEmit.slice(i, i + batchSize);
          sendEvent('links_batch', {
            items: chunk,
            sourceSitemap: normalizedUrl,
            totalSoFar: Math.min(i + chunk.length, urlsToEmit.length),
          });
        }
        sendEvent('complete', {
          totalLinks: urlsToEmit.length,
          sitemapsScanned: 1,
          durationMs: Date.now() - startTime,
        });
      } else {
        let targetIndexes = parsedRoot.indexes;
        if (filterIndexes.trim()) {
          const f = filterIndexes.trim().toLowerCase();
          targetIndexes = targetIndexes.filter((idx) => idx.loc.toLowerCase().includes(f));
        }

        sendEvent('status', {
          message: `Found ${parsedRoot.indexes.length} sub-sitemaps (${targetIndexes.length} matching filter). Starting processing...`,
          totalToProcess: targetIndexes.length,
        });

        let scannedCount = 0;
        for (const idx of targetIndexes) {
          if (isAborted || (maxLinks > 0 && totalEmitted >= maxLinks)) break;

          sendEvent('index_start', {
            loc: idx.loc,
            indexIndex: scannedCount + 1,
            totalIndexes: targetIndexes.length,
          });

          try {
            const subXml = await fetchXmlContent(idx.loc);
            const subParsed = parseSitemapXml(subXml, idx.loc);

            const newItems: RawSitemapItem[] = [];
            for (const item of subParsed.urls) {
              if (!uniqueSet.has(item.loc)) {
                uniqueSet.add(item.loc);
                newItems.push(item);
                totalEmitted++;
                if (maxLinks > 0 && totalEmitted >= maxLinks) break;
              }
            }

            scannedCount++;
            sendEvent('index_complete', {
              loc: idx.loc,
              itemsCount: newItems.length,
              totalSoFar: totalEmitted,
              items: newItems,
            });
          } catch (err: any) {
            sendEvent('index_error', { loc: idx.loc, error: err.message });
          }
        }

        // If all sub-sitemaps were blocked by Cloudflare (0 links emitted), try alternate feeds & Wayback snapshots
        if (totalEmitted === 0 && !isAborted) {
          sendEvent('status', {
            message: 'Các sitemap con bị tường lửa Cloudflare chặn. Đang tự động quét nguồn dự phòng sitemap.rss & feeds...',
            stage: 'recovering',
          });
          let origin = '';
          try {
            origin = new URL(normalizedUrl).origin;
          } catch {}

          if (origin) {
            const domainFallbacks = [
              `${origin}/sitemap.rss`,
              `${origin}/feed/`,
              `${origin}/feed/atom/`,
              `${origin}/wp-sitemap.xml`,
              `${origin}/rss.xml`,
            ];

            for (const fb of domainFallbacks) {
              try {
                let fbXml = await fetchWaybackSitemap(fb, 8000);
                if (!fbXml) {
                  fbXml = await fetchXmlContent(fb, 5000);
                }
                if (fbXml) {
                  const fbParsed = parseSitemapXml(fbXml, fb);
                  if (fbParsed.urls.length > 0) {
                    const fallbackItems: RawSitemapItem[] = [];
                    for (const u of fbParsed.urls) {
                      if (!uniqueSet.has(u.loc)) {
                        uniqueSet.add(u.loc);
                        fallbackItems.push(u);
                        totalEmitted++;
                        if (maxLinks > 0 && totalEmitted >= maxLinks) break;
                      }
                    }
                    if (fallbackItems.length > 0) {
                      sendEvent('links_batch', {
                        items: fallbackItems,
                        sourceSitemap: fb,
                        totalSoFar: totalEmitted,
                      });
                      streamRecoveryNotice = `Sitemap con bị chặn bởi Cloudflare. Đã tự động phục hồi ${fallbackItems.length} liên kết từ nguồn thay thế: ${fb}.`;
                      break;
                    }
                  }
                }
              } catch {}
            }
          }
        }

        sendEvent('complete', {
          totalLinks: totalEmitted,
          sitemapsScanned: scannedCount + 1,
          durationMs: Date.now() - startTime,
          recoveryNotice: streamRecoveryNotice,
        });
      }
    } catch (err: any) {
      sendEvent('error', { message: err.message || 'Error fetching sitemap' });
    } finally {
      res.end();
    }
  });

  // 3. Sitemap auto-discovery from domain or website URL
  app.post('/api/sitemap/discover', async (req, res) => {
    try {
      const { domain } = req.body;
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ error: 'Domain is required' });
      }

      const discovery = await discoverSitemapsForDomain(domain);
      return res.json(discovery);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Discovery failed' });
    }
  });

  // 4. Raw XML inspector endpoint
  app.get('/api/sitemap/preview-xml', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: 'url required' });

      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      const raw = await fetchXmlContent(normalizedUrl, 10000);
      const sample = raw.slice(0, 100000);

      res.json({
        url: normalizedUrl,
        length: raw.length,
        isTruncated: raw.length > 100000,
        content: sample,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to preview XML' });
    }
  });

  // Vite middleware in development or static serve in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
