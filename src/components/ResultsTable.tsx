import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Copy,
  Check,
  ExternalLink,
  Filter,
  ArrowUpDown,
  ListFilter,
  FileSpreadsheet,
  FileJson,
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers,
  Calendar,
  Gauge,
  Sparkles,
  RefreshCw,
  Columns,
  CheckCheck,
  ChevronDown,
  Eye,
  Scissors,
  Loader2,
} from 'lucide-react';
import { SitemapItem, CrawlStats } from '../types';
import {
  extractKeywordAndGroup,
  formatKeywordsAndGroupsTSV,
  formatKeywordsAndGroupsCSV,
  formatKeywords3ColumnsTSV,
  formatKeywords3ColumnsCSV,
} from '../utils/seoKeywords';
import {
  copyTextToClipboard,
  downloadTextFile,
  SAFE_CLIPBOARD_ROW_LIMIT,
} from '../utils/clipboard';
import {
  exportKeywords2ColExcel,
  exportKeywords3ColExcel,
  exportKeywords3ColWithExtractUrlExcel,
  exportSitemapFullExcel,
} from '../utils/excelExport';
import { KeywordPreviewModal } from './KeywordPreviewModal';

interface ResultsTableProps {
  items: SitemapItem[];
  stats?: CrawlStats | null;
  onInspectXmlUrl?: (url: string) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  items,
  stats,
  onInspectXmlUrl,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'default' | 'url-asc' | 'url-desc' | 'lastmod-desc' | 'priority-desc'>('default');
  const [viewMode, setViewMode] = useState<'table' | 'compact'>('table');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedKeywordsGroups, setCopiedKeywordsGroups] = useState(false);
  const [copiedSingleKwGroup, setCopiedSingleKwGroup] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [pruneKeywords, setPruneKeywords] = useState<boolean>(true);
  const [isProcessingKw, setIsProcessingKw] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Extract unique extensions from URLs
  const availableExtensions = useMemo(() => {
    const extSet = new Set<string>();
    for (const item of items) {
      try {
        const pathname = new URL(item.loc).pathname;
        const lastPart = pathname.split('/').pop() || '';
        if (lastPart.includes('.')) {
          const ext = lastPart.split('.').pop()?.toLowerCase();
          if (ext && ext.length <= 5) extSet.add('.' + ext);
        }
      } catch {}
    }
    return Array.from(extSet).slice(0, 10);
  }, [items]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let list = items;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => i.loc.toLowerCase().includes(q));
    }

    if (extensionFilter !== 'all') {
      list = list.filter((i) => i.loc.toLowerCase().endsWith(extensionFilter));
    }

    if (sortBy === 'url-asc') {
      list = [...list].sort((a, b) => a.loc.localeCompare(b.loc));
    } else if (sortBy === 'url-desc') {
      list = [...list].sort((a, b) => b.loc.localeCompare(a.loc));
    } else if (sortBy === 'lastmod-desc') {
      list = [...list].sort((a, b) => {
        const da = a.lastmod ? new Date(a.lastmod).getTime() : 0;
        const db = b.lastmod ? new Date(b.lastmod).getTime() : 0;
        return db - da;
      });
    } else if (sortBy === 'priority-desc') {
      list = [...list].sort((a, b) => {
        const pa = a.priority ? parseFloat(a.priority) : 0;
        const pb = b.priority ? parseFloat(b.priority) : 0;
        return pb - pa;
      });
    }

    return list;
  }, [items, searchQuery, extensionFilter, sortBy]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  const handleCopySingle = async (url: string) => {
    await copyTextToClipboard(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleCopyKeywordsAndGroups = async (includeHeader = true) => {
    if (filteredItems.length === 0) {
      setCopyToast('Không có dữ liệu để sao chép.');
      setTimeout(() => setCopyToast(null), 3000);
      return;
    }

    setIsProcessingKw(true);

    try {
      // Chỉ copy tối đa 25,000 dòng vào Clipboard, tuyệt đối không xuất/tải file TSV
      const rowsToCopy = filteredItems.slice(0, SAFE_CLIPBOARD_ROW_LIMIT);
      const clipboardTsv = formatKeywordsAndGroupsTSV(rowsToCopy, includeHeader, { prune: pruneKeywords });
      const ok = await copyTextToClipboard(clipboardTsv);
      if (ok) {
        setCopiedKeywordsGroups(true);
        setCopyToast(
          `Đã copy ${rowsToCopy.length.toLocaleString()} dòng (Keyword & Phân nhóm) vào Clipboard! Dán trực tiếp vào Google Sheets / Excel (Ctrl+V).`
        );
      } else {
        setCopyToast('Trình duyệt không cho phép truy cập Clipboard.');
      }
    } catch (err: any) {
      console.error('Lỗi khi copy keywords & groups:', err);
      setCopyToast('Không thể copy: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsProcessingKw(false);
      setTimeout(() => setCopiedKeywordsGroups(false), 2500);
      setTimeout(() => setCopyToast(null), 4000);
    }
  };

  const handleCopySingleKeywordGroup = async (url: string) => {
    const { keyword, group } = extractKeywordAndGroup(url, { prune: pruneKeywords });
    await copyTextToClipboard(`${keyword}\t${group}`);
    setCopiedSingleKwGroup(url);
    setTimeout(() => setCopiedSingleKwGroup(null), 2000);
  };

  const handleExportKeywordsExcel = () => {
    try {
      exportKeywords2ColExcel(filteredItems, { prune: pruneKeywords });
      setCopyToast(`Đã xuất và tải về file Excel (.xlsx) 2 Cột (${filteredItems.length.toLocaleString()} dòng)!`);
    } catch (e: any) {
      console.error(e);
      setCopyToast('Lỗi khi xuất file Excel: ' + (e?.message || ''));
    } finally {
      setTimeout(() => setCopyToast(null), 4000);
    }
  };

  const handleExport3ColWithUrlExcel = () => {
    try {
      exportKeywords3ColWithExtractUrlExcel(filteredItems, { prune: pruneKeywords });
      setCopyToast(`Đã xuất file Excel (.xlsx) 3 Cột: Keyword, Phân nhóm, Extract URL (${filteredItems.length.toLocaleString()} dòng)!`);
    } catch (e: any) {
      console.error(e);
      setCopyToast('Lỗi khi xuất file Excel: ' + (e?.message || ''));
    } finally {
      setTimeout(() => setCopyToast(null), 4000);
    }
  };

  const handleExport3ColExcel = () => {
    try {
      exportKeywords3ColExcel(filteredItems, { prune: pruneKeywords });
      setCopyToast(`Đã xuất và tải về file Excel (.xlsx) 3 Cột (${filteredItems.length.toLocaleString()} dòng)!`);
    } catch (e: any) {
      console.error(e);
      setCopyToast('Lỗi khi xuất file Excel: ' + (e?.message || ''));
    } finally {
      setTimeout(() => setCopyToast(null), 4000);
    }
  };

  const handleExportFullExcel = () => {
    try {
      exportSitemapFullExcel(filteredItems);
      setCopyToast(`Đã tải về file Excel (.xlsx) chứa ${filteredItems.length.toLocaleString()} URLs!`);
    } catch (e: any) {
      console.error(e);
      setCopyToast('Lỗi khi xuất file Excel: ' + (e?.message || ''));
    } finally {
      setTimeout(() => setCopyToast(null), 4000);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    downloadTextFile(content, filename, mimeType);
  };

  const handleExportTxt = () => {
    const text = filteredItems.map((i) => i.loc).join('\n');
    downloadFile(text, 'sitemap-links.txt', 'text/plain');
  };

  const handleExportCsv = () => {
    const headers = ['URL', 'Last Modified', 'Change Frequency', 'Priority', 'Source Sitemap'];
    const rows = filteredItems.map((i) => [
      `"${i.loc.replace(/"/g, '""')}"`,
      `"${(i.lastmod || '').replace(/"/g, '""')}"`,
      `"${(i.changefreq || '').replace(/"/g, '""')}"`,
      `"${(i.priority || '').replace(/"/g, '""')}"`,
      `"${(i.sourceSitemap || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(csvContent, 'sitemap-links.csv', 'text/csv');
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(filteredItems, null, 2);
    downloadFile(jsonStr, 'sitemap-links.json', 'application/json');
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Top Stats Banner */}
      {stats && (
        <div className="space-y-2">
          {stats.discoveredFromDomain && (
            <div className="px-4 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  Auto-discovered sitemap for domain <strong>{stats.discoveredFromDomain}</strong>:
                </span>
              </div>
              <code className="text-[11px] font-mono bg-white dark:bg-zinc-900 px-2.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 truncate max-w-md">
                {stats.rootUrl}
              </code>
            </div>
          )}

          {stats.recoveryNotice && (
            <div className="px-4 py-2.5 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 shadow-xs">
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-spin-reverse" />
              <div>
                <span className="font-semibold text-amber-950 dark:text-amber-100">Automatic Fallback Recovery Active: </span>
                <span>{stats.recoveryNotice}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
              Extracted URLs
            </span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.totalLinks.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
              Sitemaps Scanned
            </span>
            <span className="text-xl font-bold text-zinc-900 dark:text-white">
              {stats.sitemapsScanned}
            </span>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
              Sub-Indexes
            </span>
            <span className="text-xl font-bold text-zinc-900 dark:text-white">
              {stats.totalIndexes}
            </span>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider block mb-1">
              Duration
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {(stats.durationMs / 1000).toFixed(2)}s
            </span>
          </div>
        </div>
      </div>
    )}

      {/* Main Results Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={`Filter among ${items.length.toLocaleString()} links...`}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Quick Filters & View controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="default">Default Order</option>
                <option value="url-asc">URL (A to Z)</option>
                <option value="url-desc">URL (Z to A)</option>
                <option value="lastmod-desc">Newest Modified</option>
                <option value="priority-desc">Highest Priority</option>
              </select>
            </div>

            {/* Extensions Filter */}
            {availableExtensions.length > 0 && (
              <select
                value={extensionFilter}
                onChange={(e) => {
                  setExtensionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Extensions</option>
                {availableExtensions.map((ext) => (
                  <option key={ext} value={ext}>
                    {ext}
                  </option>
                ))}
              </select>
            )}

            {/* Export Buttons */}
            <div className="flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-700 pl-2">
              {/* 1. Nút Copy 25000 dòng (Chỉ copy vào clipboard, không xổ xuống, không xuất TSV) */}
              <button
                onClick={() => handleCopyKeywordsAndGroups(true)}
                disabled={isProcessingKw}
                id="copy-keywords-groups-btn"
                title="Copy tối đa 25.000 dòng (Keyword [Tab] Phân nhóm) vào clipboard để dán trực tiếp vào Google Sheets / Excel"
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all border shadow-2xs ${
                  copiedKeywordsGroups
                    ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80'
                } ${isProcessingKw ? 'opacity-80 cursor-wait' : ''}`}
              >
                {isProcessingKw ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                ) : copiedKeywordsGroups ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Columns className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>
                  {isProcessingKw
                    ? 'Đang copy...'
                    : copiedKeywordsGroups
                    ? 'Đã copy 25000 dòng!'
                    : 'Copy 25000 dòng'}
                </span>
              </button>

              {/* 2. Nút Tải excel 2 cột */}
              <button
                onClick={handleExportKeywordsExcel}
                id="export-excel-2col-btn"
                title="Tải File Excel (.xlsx) 2 Cột: Cột 1 = Keyword, Cột 2 = Phân nhóm"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-2xs transition-all shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-white" />
                <span>Tải excel 2 cột</span>
              </button>

              {/* 3. Nút Tải excel 3 cột (Keyword, Phân nhóm, Extract URL) */}
              <button
                onClick={handleExport3ColWithUrlExcel}
                id="export-excel-3col-btn"
                title="Tải File Excel (.xlsx) 3 Cột: Cột 1 = Keyword, Cột 2 = Phân nhóm, Cột 3 = Extract URL"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/90 dark:border-emerald-800/80 flex items-center gap-1.5 shadow-2xs transition-all shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Tải excel 3 cột</span>
              </button>

              {/* 4. Nút Tỉa Keyword Quick Toggle */}
              <button
                type="button"
                onClick={() => setPruneKeywords(!pruneKeywords)}
                id="toggle-prune-keywords-btn"
                title={
                  pruneKeywords
                    ? 'Đang bật: Tự động lược bỏ "the", "top 3", "top 10"... (Click để tắt)'
                    : 'Đang tắt: Giữ nguyên từ khóa slug gốc (Click để bật)'
                }
                className={`px-2 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all border shrink-0 ${
                  pruneKeywords
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300/80 dark:border-amber-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <Scissors className={`w-3.5 h-3.5 ${pruneKeywords ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`} />
                <span>Tỉa Keyword</span>
                <span className={`text-[10px] font-bold px-1 rounded ${pruneKeywords ? 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>
                  {pruneKeywords ? 'BẬT' : 'TẮT'}
                </span>
              </button>

              <button
                onClick={handleExportCsv}
                id="export-csv-btn"
                title="Export CSV with metadata"
                className="p-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </button>

              <button
                onClick={handleExportJson}
                id="export-json-btn"
                title="Export JSON"
                className="p-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
              >
                <FileJson className="w-4 h-4 text-amber-600" />
              </button>

              <button
                onClick={handleExportTxt}
                id="export-txt-btn"
                title="Export TXT (plain links)"
                className="p-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Copy Notification Toast */}
        {copyToast && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2 shadow-xs transition-all animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-medium">{copyToast}</span>
            </div>
            <button
              onClick={() => setCopyToast(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Results Count Bar */}
        <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1} -{' '}
            {Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of{' '}
            {filteredItems.length.toLocaleString()} URLs
            {searchQuery && ` (filtered from ${items.length.toLocaleString()})`}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table or Compact View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">#</th>
                <th className="py-2.5 px-4 font-semibold">Extracted URL</th>
                <th className="py-2.5 px-4 font-semibold hidden md:table-cell">Last Modified</th>
                <th className="py-2.5 px-4 font-semibold hidden lg:table-cell">Changefreq</th>
                <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">Priority</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {paginatedItems.map((item, idx) => {
                const globalIndex = (currentPage - 1) * PAGE_SIZE + idx + 1;
                const isCopied = copiedUrl === item.loc;

                return (
                  <tr
                    key={item.loc + idx}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-950/60 transition-colors group"
                  >
                    <td className="py-2 px-4 text-zinc-400 font-mono text-[11px] w-12">
                      {globalIndex}
                    </td>

                    <td className="py-2 px-4 font-mono text-zinc-800 dark:text-zinc-200 max-w-md break-all">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{item.loc}</span>
                      </div>
                      {item.sourceSitemap && item.sourceSitemap !== item.loc && (
                        <span className="block text-[10px] text-zinc-400 font-sans truncate">
                          via {item.sourceSitemap.split('/').pop()}
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-4 text-zinc-500 hidden md:table-cell whitespace-nowrap">
                      {item.lastmod ? (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {item.lastmod.split('T')[0]}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>

                    <td className="py-2 px-4 text-zinc-500 hidden lg:table-cell">
                      {item.changefreq ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                          {item.changefreq}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>

                    <td className="py-2 px-4 hidden sm:table-cell">
                      {item.priority ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            parseFloat(item.priority) >= 0.8
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : parseFloat(item.priority) >= 0.5
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {item.priority}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>

                    <td className="py-2 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopySingle(item.loc)}
                          title="Copy URL"
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySingleKeywordGroup(item.loc)}
                          title="Copy 2 cột (Keyword & Phân nhóm)"
                          className="p-1 rounded text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {copiedSingleKwGroup === item.loc ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Columns className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <a
                          href={item.loc}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open URL in new tab"
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-zinc-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      {/* 2-Column Keyword & Group Preview Modal */}
      <KeywordPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        items={filteredItems}
        initialPrune={pruneKeywords}
      />
    </div>
  );
};
