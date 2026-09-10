import React from 'react';
import { X, Compass, CheckCircle2, Globe, ExternalLink, ArrowRight } from 'lucide-react';
import { DiscoveredSitemap } from '../types';

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  sitemaps: DiscoveredSitemap[];
  robotsFound: boolean;
  onSelectSitemap: (url: string) => void;
  isLoading: boolean;
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({
  isOpen,
  onClose,
  domain,
  sitemaps,
  robotsFound,
  onSelectSitemap,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Sitemap Discovery for {domain || 'Domain'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 text-xs space-y-3">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Checking /robots.txt and probing standard sitemap locations...</p>
            </div>
          ) : sitemaps.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-xs">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                No standard sitemaps found
              </p>
              <p>
                Neither robots.txt declared a sitemap nor did /sitemap.xml return a 200 OK.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Found {sitemaps.length} candidate sitemap{sitemaps.length > 1 ? 's' : ''}:
                </span>
                {robotsFound && (
                  <span className="text-[11px] text-emerald-600 font-medium">
                    robots.txt found
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {sitemaps.map((item, idx) => (
                  <div
                    key={item.url + idx}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-zinc-50 dark:bg-zinc-950 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.status === 404
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                              : item.source === 'robots.txt'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : item.source === 'feed'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300'
                              : item.source === 'wp-api'
                              ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                          }`}
                        >
                          {item.source === 'wp-api' ? 'WP REST API' : item.source === 'feed' ? 'Syndication Feed' : item.source}
                        </span>
                        {item.status && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              item.status === 200
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                                : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 font-semibold'
                            }`}
                          >
                            HTTP {item.status}
                          </span>
                        )}
                        {item.note && (
                          <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                            {item.note}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-mono truncate ${item.status === 404 ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-200'}`}>
                        {item.url}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectSitemap(item.url);
                        onClose();
                      }}
                      className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors ${
                        item.status === 404
                          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <span>{item.status === 404 ? 'Try Anyway' : 'Select'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
