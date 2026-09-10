import React, { useState } from 'react';
import { X, Copy, Check, FileCode2, ExternalLink } from 'lucide-react';

interface XmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  xmlContent: string;
  isTruncated: boolean;
  length: number;
  isLoading: boolean;
}

export const XmlModal: React.FC<XmlModalProps> = ({
  isOpen,
  onClose,
  url,
  xmlContent,
  isTruncated,
  length,
  isLoading,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode2 className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                XML Source Inspector
              </h3>
              <p className="text-[11px] font-mono text-zinc-400 truncate max-w-lg">
                {url}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={isLoading || !xmlContent}
              className="px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? 'Copied' : 'Copy XML'}</span>
            </button>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg"
              title="Open raw in browser"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto bg-zinc-950 font-mono text-xs text-zinc-300">
          {isLoading ? (
            <div className="py-20 text-center text-zinc-500 space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Fetching raw sitemap XML content...</p>
            </div>
          ) : (
            <div>
              {isTruncated && (
                <div className="mb-3 px-3 py-1.5 bg-amber-950/80 border border-amber-800 text-amber-200 rounded-lg text-[11px]">
                  Large sitemap ({(length / 1024).toFixed(1)} KB) — displaying the first 100 KB
                </div>
              )}
              <pre className="whitespace-pre-wrap break-all leading-relaxed">
                {xmlContent || '// No XML content found'}
              </pre>
            </div>
          )}
        </div>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span>Total characters: {length.toLocaleString()}</span>
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
