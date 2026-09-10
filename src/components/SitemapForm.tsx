import React from 'react';
import {
  Globe,
  Play,
  Radio,
  FileCode2,
  Compass,
  X,
  Sparkles,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { CrawlOptions } from '../types';

interface SitemapFormProps {
  url: string;
  setUrl: (url: string) => void;
  xmlContent: string;
  setXmlContent: (content: string) => void;
  activeInputTab: 'url' | 'paste';
  setActiveInputTab: (tab: 'url' | 'paste') => void;
  options: CrawlOptions;
  setOptions: React.Dispatch<React.SetStateAction<CrawlOptions>>;
  onExtract: () => void;
  onStream: () => void;
  onInspectXml: () => void;
  onDiscover: () => void;
  isLoading: boolean;
  isStreaming: boolean;
  onAbort?: () => void;
}

const PRESET_SITEMAPS = [
  {
    name: 'wordpress.org (Domain)',
    url: 'wordpress.org',
    filter: '',
  },
  {
    name: 'sitemaps.org (Domain)',
    url: 'sitemaps.org',
    filter: '',
  },
  {
    name: 'vercel.com (Domain)',
    url: 'vercel.com',
    filter: '',
  },
  {
    name: 'WordPress News (XML)',
    url: 'https://wordpress.org/news/sitemap.xml',
    filter: '',
  },
  {
    name: 'WordPress (Filter: "posts")',
    url: 'https://wordpress.org/news/sitemap.xml',
    filter: 'posts',
  },
];

export const SitemapForm: React.FC<SitemapFormProps> = ({
  url,
  setUrl,
  xmlContent,
  setXmlContent,
  activeInputTab,
  setActiveInputTab,
  options,
  setOptions,
  onExtract,
  onStream,
  onInspectXml,
  onDiscover,
  isLoading,
  isStreaming,
  onAbort,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeInputTab === 'url' && !url.trim()) return;
    if (activeInputTab === 'paste' && !xmlContent.trim()) return;
    onExtract();
  };

  const handleSelectPreset = (preset: typeof PRESET_SITEMAPS[0]) => {
    setActiveInputTab('url');
    setUrl(preset.url);
    if (preset.filter) {
      setOptions((prev) => ({ ...prev, filterIndexes: preset.filter }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setXmlContent(text);
        setActiveInputTab('paste');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-xs">
      <form onSubmit={handleSubmit} className="space-y-4">
        {activeInputTab === 'url' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="sitemap-url-input"
                className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider"
              >
                Website Domain hoặc URL Sitemap
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Tự động dò tìm sitemap từ domain
                </span>
                <button
                  type="button"
                  onClick={() => setActiveInputTab('paste')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 underline transition-colors"
                >
                  Dán XML / Tải file
                </button>
              </div>
            </div>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                <Globe className="w-5 h-5" />
              </div>
              <input
                id="sitemap-url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Nhập tên miền hoặc link sitemap (ví dụ: example.com, https://example.com/sitemap.xml)..."
                disabled={isLoading || isStreaming}
                className="w-full pl-11 pr-24 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
              />
              {url && !isLoading && !isStreaming && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute right-12 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onDiscover}
                disabled={isLoading || isStreaming || !url.trim()}
                title="Check robots.txt and common locations for sitemaps"
                className="absolute right-2 px-2.5 py-1.5 text-xs font-medium bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Detect</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="sitemap-xml-textarea"
                className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider"
              >
                Dán Sitemap XML hoặc Tải File
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveInputTab('url')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  ← Quay lại nhập URL
                </button>
                <label
                  htmlFor="xml-file-upload"
                  className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải file .xml</span>
                  <input
                    id="xml-file-upload"
                    type="file"
                    accept=".xml,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
            <textarea
              id="sitemap-xml-textarea"
              rows={4}
              value={xmlContent}
              onChange={(e) => setXmlContent(e.target.value)}
              placeholder="Paste raw <urlset> or <sitemapindex> XML content here (ideal if target website blocks automated scrapers with HTTP 403)..."
              disabled={isLoading}
              className="w-full p-3 font-mono text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        )}

        {/* Quick Presets (URL mode) */}
        {activeInputTab === 'url' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Verified Presets:
            </span>
            {PRESET_SITEMAPS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="text-xs px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700/60"
              >
                {preset.name}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="submit"
              disabled={
                isLoading ||
                isStreaming ||
                (activeInputTab === 'url' ? !url.trim() : !xmlContent.trim())
              }
              id="extract-links-btn"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>
                {isLoading
                  ? 'Extracting...'
                  : activeInputTab === 'url'
                  ? 'Extract All Links'
                  : 'Extract from Pasted XML'}
              </span>
            </button>

            {activeInputTab === 'url' && (
              <button
                type="button"
                onClick={onStream}
                disabled={isLoading || isStreaming || !url.trim()}
                id="stream-crawl-btn"
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isStreaming ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                )}
                <span>{isStreaming ? 'Streaming...' : 'Live Stream Crawl'}</span>
              </button>
            )}

            {isStreaming && onAbort && (
              <button
                type="button"
                onClick={onAbort}
                id="stop-crawl-btn"
                className="px-3 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 text-xs sm:text-sm font-semibold rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Stop</span>
              </button>
            )}
          </div>

          {activeInputTab === 'url' && (
            <button
              type="button"
              onClick={onInspectXml}
              disabled={!url.trim()}
              id="inspect-xml-btn"
              className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <FileCode2 className="w-3.5 h-3.5 text-zinc-500" />
              <span>Inspect XML Source</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
