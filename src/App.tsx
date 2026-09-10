import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Clock, Ban } from 'lucide-react';
import { SitemapForm } from './components/SitemapForm';
import { LiveProgress } from './components/LiveProgress';
import { ResultsTable } from './components/ResultsTable';
import { DiscoveryModal } from './components/DiscoveryModal';
import { XmlModal } from './components/XmlModal';
import { AuthModal } from './components/AuthModal';
import { AdminModal } from './components/AdminModal';
import { UserNav } from './components/UserNav';
import { useAuth } from './context/AuthContext';
import {
  SitemapItem,
  CrawlStats,
  CrawlOptions,
  SitemapIndexInfo,
  DiscoveredSitemap,
} from './types';

export default function App() {
  const { firebaseUser, appUser, isActive, isAdmin, recordCrawlUsage } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const [url, setUrl] = useState('');
  const [inputTab, setInputTab] = useState<'url' | 'paste'>('url');
  const [rawXmlInput, setRawXmlInput] = useState('');

  const [options, setOptions] = useState<CrawlOptions>({
    filterIndexes: '',
    includeMetadata: true,
    maxLinks: 0,
    urlFilter: '',
    urlExclude: '',
    method: 'enhanced',
  });

  const [items, setItems] = useState<SitemapItem[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [indexes, setIndexes] = useState<SitemapIndexInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [streamDiscoveredDomain, setStreamDiscoveredDomain] = useState<string | undefined>();
  const [streamDiscoveredSitemaps, setStreamDiscoveredSitemaps] = useState<string[] | undefined>();

  // Modals
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [discoveryDomain, setDiscoveryDomain] = useState('');
  const [discoveredSitemaps, setDiscoveredSitemaps] = useState<DiscoveredSitemap[]>([]);
  const [robotsFound, setRobotsFound] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [xmlTargetUrl, setXmlTargetUrl] = useState('');
  const [xmlPreviewContent, setXmlPreviewContent] = useState('');
  const [xmlLength, setXmlLength] = useState(0);
  const [xmlIsTruncated, setXmlIsTruncated] = useState(false);
  const [isXmlLoading, setIsXmlLoading] = useState(false);

  // Timers & Abort controllers
  const timerRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedSeconds(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds((Date.now() - start) / 1000);
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Auth gate check
  const ensureAuthAndActive = (): boolean => {
    if (!firebaseUser) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      setErrorMessage('Vui lòng đăng nhập hoặc đăng ký tài khoản để bắt đầu sử dụng.');
      return false;
    }
    if (!isActive) {
      if (appUser?.status === 'pending') {
        setErrorMessage('Tài khoản của bạn đang chờ Quản trị viên (Admin) phê duyệt kích hoạt.');
      } else if (appUser?.status === 'disabled') {
        setErrorMessage('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để được hỗ trợ.');
      } else {
        setErrorMessage('Tài khoản chưa được kích hoạt để sử dụng.');
      }
      return false;
    }
    return true;
  };

  // 1. Extract Links (Direct Request or Pasted XML)
  const handleExtract = async () => {
    if (!ensureAuthAndActive()) return;

    const isPasteMode = inputTab === 'paste';
    if (isPasteMode && !rawXmlInput.trim()) return;
    if (!isPasteMode && !url.trim()) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsLoading(true);
    setIsStreaming(false);
    setIsCompleted(false);
    setErrorMessage(null);
    setStreamDiscoveredDomain(undefined);
    setStreamDiscoveredSitemaps(undefined);
    setItems([]);
    setIndexes([]);
    setStatusMessage(
      isPasteMode
        ? 'Parsing pasted XML sitemap...'
        : 'Connecting to sitemap or domain and retrieving links...'
    );
    startTimer();

    try {
      const bodyPayload = isPasteMode
        ? {
            xmlContent: rawXmlInput.trim(),
            url: url.trim() || 'pasted-sitemap.xml',
            filterIndexes: options.filterIndexes,
            maxLinks: options.maxLinks,
            urlFilter: options.urlFilter,
            urlExclude: options.urlExclude,
          }
        : {
            url: url.trim(),
            filterIndexes: options.filterIndexes,
            method: options.method,
            includeMetadata: options.includeMetadata,
            maxLinks: options.maxLinks,
            urlFilter: options.urlFilter,
            urlExclude: options.urlExclude,
          };

      const response = await fetch('/api/sitemap/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json();
      stopTimer();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to extract sitemap links');
      }

      const cleanItems = (data.items || []).filter(
        (it: any) => it && it.loc && !it.loc.includes('challenges.cloudflare.com')
      );
      setItems(cleanItems);
      setStats(data.stats || null);
      if (data.indexes && Array.isArray(data.indexes)) {
        setIndexes(
          data.indexes.map((idx: any) => ({
            loc: idx.loc,
            lastmod: idx.lastmod,
            status: 'done',
          }))
        );
      }
      setIsCompleted(true);
      setStatusMessage(
        `Successfully extracted ${(data.items || []).length.toLocaleString()} links`
      );
      // Track usage for authenticated user
      recordCrawlUsage();
    } catch (err: any) {
      stopTimer();
      setErrorMessage(err.message || 'Error occurred while crawling sitemap');
      setStatusMessage('Extraction failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Stream Crawl via SSE
  const handleStream = () => {
    if (!ensureAuthAndActive()) return;
    if (!url.trim()) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsLoading(false);
    setIsStreaming(true);
    setIsCompleted(false);
    setErrorMessage(null);
    setStreamDiscoveredDomain(undefined);
    setStreamDiscoveredSitemaps(undefined);
    setItems([]);
    setIndexes([]);
    setCurrentIndex(undefined);
    setStatusMessage('Initializing live event stream...');
    startTimer();

    const queryParams = new URLSearchParams({
      url: url.trim(),
      filterIndexes: options.filterIndexes || '',
      maxLinks: String(options.maxLinks !== undefined ? options.maxLinks : 0),
    });

    const sse = new EventSource(`/api/sitemap/stream?${queryParams.toString()}`);
    eventSourceRef.current = sse;

    sse.addEventListener('domain_resolved', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setStreamDiscoveredDomain(data.domain);
        setStreamDiscoveredSitemaps(data.allSitemaps || [data.sitemap]);
        setStatusMessage(`Auto-discovered sitemap: ${data.sitemap}`);
      } catch {}
    });

    sse.addEventListener('status', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setStatusMessage(data.message || 'Crawling sitemap...');
      } catch {}
    });

    sse.addEventListener('root_parsed', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.indexes && Array.isArray(data.indexes)) {
          setIndexes(
            data.indexes.map((idx: any) => ({
              loc: idx.loc,
              lastmod: idx.lastmod,
              status: 'pending',
            }))
          );
        }
      } catch {}
    });

    sse.addEventListener('index_start', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentIndex(data.loc);
        setStatusMessage(
          `Crawling sub-sitemap [${data.indexIndex}/${data.totalIndexes}]: ${
            data.loc.split('/').pop() || data.loc
          }`
        );
        setIndexes((prev) =>
          prev.map((idx) =>
            idx.loc === data.loc ? { ...idx, status: 'processing' } : idx
          )
        );
      } catch {}
    });

    sse.addEventListener('links_batch', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.items && Array.isArray(data.items)) {
          const cleanBatch = data.items.filter(
            (it: any) => it && it.loc && !it.loc.includes('challenges.cloudflare.com')
          );
          setItems((prev) => [...prev, ...cleanBatch]);
        }
      } catch {}
    });

    sse.addEventListener('index_complete', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.items && Array.isArray(data.items)) {
          const cleanBatch = data.items.filter(
            (it: any) => it && it.loc && !it.loc.includes('challenges.cloudflare.com')
          );
          setItems((prev) => [...prev, ...cleanBatch]);
        }
        setIndexes((prev) =>
          prev.map((idx) =>
            idx.loc === data.loc
              ? { ...idx, status: 'done', count: data.itemsCount }
              : idx
          )
        );
      } catch {}
    });

    sse.addEventListener('index_error', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setIndexes((prev) =>
          prev.map((idx) =>
            idx.loc === data.loc
              ? { ...idx, status: 'failed', error: data.error }
              : idx
          )
        );
      } catch {}
    });

    sse.addEventListener('complete', (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setStats({
          totalLinks: data.totalLinks,
          totalIndexes: indexes.length,
          sitemapsScanned: data.sitemapsScanned,
          durationMs: data.durationMs,
          rootUrl: url.trim(),
          isIndex: indexes.length > 0,
        });
      } catch {}
      stopTimer();
      setIsStreaming(false);
      setIsCompleted(true);
      setStatusMessage('Stream extraction completed');
      // Track usage for authenticated user
      recordCrawlUsage();
      sse.close();
      eventSourceRef.current = null;
    });

    sse.addEventListener('error', (e: any) => {
      try {
        if (e.data) {
          const data = JSON.parse(e.data);
          setErrorMessage(data.message || 'Stream connection error');
        } else {
          setErrorMessage('Connection lost or sitemap could not be reached');
        }
      } catch {
        setErrorMessage('Stream connection closed');
      }
      stopTimer();
      setIsStreaming(false);
      sse.close();
      eventSourceRef.current = null;
    });
  };

  const handleAbort = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    stopTimer();
    setIsStreaming(false);
    setStatusMessage('Crawl stopped by user');
  };

  // 3. Discover Sitemaps on Domain
  const handleDiscover = async () => {
    if (!ensureAuthAndActive()) return;
    if (!url.trim()) return;
    setIsDiscovering(true);
    setIsDiscoveryModalOpen(true);
    setDiscoveredSitemaps([]);
    setDiscoveryDomain(url.trim());

    try {
      const res = await fetch('/api/sitemap/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: url.trim() }),
      });
      const data = await res.json();
      if (data.sitemaps) {
        setDiscoveredSitemaps(data.sitemaps);
        setRobotsFound(Boolean(data.robotsFound));
        setDiscoveryDomain(data.domain || url);
      }
    } catch (err: any) {
      console.error('Discovery error:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  // 4. Inspect Raw XML
  const handleInspectXml = async (targetUrl?: string) => {
    if (!ensureAuthAndActive()) return;
    const finalUrl = targetUrl || url;
    if (!finalUrl.trim()) return;

    setXmlTargetUrl(finalUrl);
    setIsXmlModalOpen(true);
    setIsXmlLoading(true);
    setXmlPreviewContent('');

    try {
      const res = await fetch(`/api/sitemap/preview-xml?url=${encodeURIComponent(finalUrl)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setXmlPreviewContent(data.content || '');
      setXmlLength(data.length || 0);
      setXmlIsTruncated(Boolean(data.isTruncated));
    } catch (err: any) {
      setXmlPreviewContent(`<!-- Error fetching XML: ${err.message} -->`);
    } finally {
      setIsXmlLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Application Header Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-tight">
                  SEO Sitemap & Keyword Studio
                </h1>
                <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden xs:block">
                Trích xuất liên kết sitemap, tự động giải mã cấu trúc & tỉa từ khóa SEO
              </p>
            </div>
          </div>

          <UserNav
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setIsAuthModalOpen(true);
            }}
            onOpenAdmin={() => setIsAdminModalOpen(true)}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Guest prompt banner if not logged in */}
        {!firebaseUser && (
          <div className="p-3.5 sm:p-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-indigo-950 dark:text-indigo-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-indigo-900 dark:text-white">
                  Yêu cầu đăng nhập:
                </span>{' '}
                <span>
                  Vui lòng Đăng nhập hoặc Đăng ký tài khoản để bắt đầu sử dụng công cụ bóc tách sitemap và tỉa từ khóa SEO.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('register');
                  setIsAuthModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs"
              >
                Đăng ký miễn phí
              </button>
            </div>
          </div>
        )}

        {/* Pending Approval Banner */}
        {firebaseUser && appUser?.status === 'pending' && !isAdmin && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                Tài khoản <strong className="text-zinc-900 dark:text-white">{appUser.email}</strong> đang chờ Admin phê duyệt kích hoạt. Bạn sẽ có thể sử dụng sau khi tài khoản được kích hoạt.
              </div>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 rounded-md shrink-0">
              Đang chờ duyệt
            </span>
          </div>
        )}

        {/* Disabled Account Banner */}
        {firebaseUser && appUser?.status === 'disabled' && !isAdmin && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                Tài khoản <strong className="text-zinc-900 dark:text-white">{appUser.email}</strong> hiện đang tạm khóa bởi Quản trị viên. Vui lòng liên hệ Admin để được hỗ trợ mở khóa.
              </div>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100 rounded-md shrink-0">
              Đã khóa
            </span>
          </div>
        )}

        {/* Form and Controls Card */}
        <SitemapForm
          url={url}
          setUrl={setUrl}
          xmlContent={rawXmlInput}
          setXmlContent={setRawXmlInput}
          activeInputTab={inputTab}
          setActiveInputTab={setInputTab}
          options={options}
          setOptions={setOptions}
          onExtract={handleExtract}
          onStream={handleStream}
          onInspectXml={() => handleInspectXml()}
          onDiscover={handleDiscover}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onAbort={handleAbort}
        />

        {/* Live Progress or Status Indicator */}
        {(isLoading || isStreaming || isCompleted || errorMessage) && (
          <LiveProgress
            statusMessage={statusMessage}
            itemsCount={items.length}
            indexes={indexes}
            currentIndex={currentIndex}
            elapsedSeconds={elapsedSeconds}
            isStreaming={isStreaming}
            isCompleted={isCompleted}
            error={errorMessage}
            onSwitchToPasteXml={() => setInputTab('paste')}
            discoveredFromDomain={stats?.discoveredFromDomain || streamDiscoveredDomain}
            discoveredSitemaps={stats?.discoveredSitemaps || streamDiscoveredSitemaps}
            targetUrl={url}
          />
        )}

        {/* Results Table and Exporting */}
        {items.length > 0 && (
          <ResultsTable
            items={items}
            stats={stats}
            onInspectXmlUrl={(target) => handleInspectXml(target)}
          />
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalMode}
      />

      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      <DiscoveryModal
        isOpen={isDiscoveryModalOpen}
        onClose={() => setIsDiscoveryModalOpen(false)}
        domain={discoveryDomain}
        sitemaps={discoveredSitemaps}
        robotsFound={robotsFound}
        onSelectSitemap={(selected) => {
          setUrl(selected);
          setInputTab('url');
        }}
        isLoading={isDiscovering}
      />

      <XmlModal
        isOpen={isXmlModalOpen}
        onClose={() => setIsXmlModalOpen(false)}
        url={xmlTargetUrl}
        xmlContent={xmlPreviewContent}
        isTruncated={xmlIsTruncated}
        length={xmlLength}
        isLoading={isXmlLoading}
      />
    </div>
  );
}
