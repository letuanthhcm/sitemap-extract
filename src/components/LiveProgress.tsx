import React from 'react';
import { Radio, CheckCircle2, Clock, Zap, AlertCircle, FileText, ClipboardPaste, Sparkles, ExternalLink } from 'lucide-react';
import { SitemapIndexInfo } from '../types';

interface LiveProgressProps {
  statusMessage: string;
  itemsCount: number;
  indexes: SitemapIndexInfo[];
  currentIndex?: string;
  elapsedSeconds: number;
  isStreaming: boolean;
  isCompleted: boolean;
  error?: string | null;
  onSwitchToPasteXml?: () => void;
  discoveredFromDomain?: string;
  discoveredSitemaps?: string[];
  targetUrl?: string;
}

export const LiveProgress: React.FC<LiveProgressProps> = ({
  statusMessage,
  itemsCount,
  indexes,
  currentIndex,
  elapsedSeconds,
  isStreaming,
  isCompleted,
  error,
  onSwitchToPasteXml,
  discoveredFromDomain,
  discoveredSitemaps,
  targetUrl,
}) => {
  const rate = elapsedSeconds > 0 ? Math.round(itemsCount / elapsedSeconds) : 0;
  const processedIndexes = indexes.filter(
    (i) => i.status === 'done' || i.status === 'failed'
  ).length;

  const is403Error =
    Boolean(error) &&
    (error!.includes('403') ||
      error!.toLowerCase().includes('forbidden') ||
      error!.toLowerCase().includes('cloudflare') ||
      error!.toLowerCase().includes('challenge') ||
      error!.toLowerCase().includes('turnstile') ||
      error!.toLowerCase().includes('firewall'));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isStreaming
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 animate-pulse'
                : isCompleted
                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400'
                : error
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
            }`}
          >
            {isStreaming ? (
              <Radio className="w-5 h-5" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : error ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              {isStreaming
                ? 'Active Stream Extraction'
                : isCompleted
                ? 'Crawl Finished Successfully'
                : error
                ? 'Extraction Error'
                : 'Crawl Status'}
              {isStreaming && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              )}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {statusMessage || 'Parsing sitemap structure...'}
            </p>
          </div>
        </div>

        {/* Real-time Counter Badges */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-zinc-900 dark:text-white text-sm">
              {itemsCount.toLocaleString()}
            </span>
            <span className="text-zinc-500">links</span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold text-zinc-900 dark:text-white">
              {elapsedSeconds.toFixed(1)}s
            </span>
          </div>

          {rate > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{rate} links/s</span>
            </div>
          )}
        </div>
      </div>

      {discoveredFromDomain && (
        <div className="mt-3 px-3.5 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              Auto-detected sitemap for <strong>{discoveredFromDomain}</strong>:
            </span>
          </div>
          <code className="text-[11px] font-mono bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 max-w-xs truncate">
            {discoveredSitemaps?.[0] || 'sitemap.xml'}
          </code>
        </div>
      )}

      {error && (
        <div className="mt-3 p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>

          {is403Error && (
            <div className="pt-2 pl-6 flex flex-wrap items-center gap-2">
              {(() => {
                const urlMatch = error?.match(/https?:\/\/[^\s\)\'\"\,]+/);
                const openUrl = targetUrl || (urlMatch ? urlMatch[0] : null);
                return openUrl ? (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở link sitemap trong tab mới</span>
                  </a>
                ) : null;
              })()}

              {onSwitchToPasteXml && (
                <button
                  type="button"
                  onClick={onSwitchToPasteXml}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Chuyển sang "Dán XML / Tải file"</span>
                </button>
              )}

              <span className="w-full text-[11px] text-rose-600/90 dark:text-rose-400 mt-1">
                (Mẹo: Mở link trên tab mới, nhấn Ctrl+U để copy mã nguồn XML, sau đó dán vào tab "Dán XML" để trích xuất 100% liên kết)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sub-Sitemap Index Progress if multiple indexes exist */}
      {indexes.length > 0 && (
        <div className="mt-4 pt-1">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>
              Sub-Sitemaps Progress: {processedIndexes} / {indexes.length}
            </span>
            <span>
              {indexes.length > 0
                ? Math.round((processedIndexes / indexes.length) * 100)
                : 0}
              %
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
              style={{
                width: `${
                  indexes.length > 0 ? (processedIndexes / indexes.length) * 100 : 0
                }%`,
              }}
            />
          </div>

          {/* Sitemaps Chip Stream */}
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {indexes.map((idx, i) => {
              const isCurrent = currentIndex === idx.loc;
              const isDone = idx.status === 'done';
              const isFailed = idx.status === 'failed';

              return (
                <div
                  key={idx.loc + i}
                  className={`text-[11px] px-2 py-1 rounded-md border flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300 animate-pulse'
                      : isDone
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300'
                      : isFailed
                      ? 'bg-rose-50/60 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  <span className="max-w-[200px] truncate">
                    {idx.loc.split('/').pop() || idx.loc}
                  </span>
                  {idx.count !== undefined && (
                    <span className="font-mono text-[10px] opacity-75">
                      ({idx.count})
                    </span>
                  )}
                  {isFailed && (
                    <span className="text-[10px] text-rose-600 font-bold">
                      (Skipped)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
