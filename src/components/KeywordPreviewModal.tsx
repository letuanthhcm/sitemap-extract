import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  FileSpreadsheet,
  Search,
  Columns,
  ExternalLink,
  Layers,
  Scissors,
  Download,
  Loader2,
} from 'lucide-react';
import { SitemapItem } from '../types';
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
} from '../utils/excelExport';

interface KeywordPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SitemapItem[];
  initialPrune?: boolean;
}

export const KeywordPreviewModal: React.FC<KeywordPreviewModalProps> = ({
  isOpen,
  onClose,
  items,
  initialPrune = true,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [viewFormat, setViewFormat] = useState<'2col' | '3col'>('2col');
  const [prune, setPrune] = useState<boolean>(initialPrune);

  // Fast filter on raw items first so we don't extract regexes on 200k items in memory on every render
  const rawFilteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.loc.toLowerCase().includes(q));
  }, [items, search]);

  // Preview only the first 300 items in the DOM for ultra-fast, 60fps rendering
  const previewRows = useMemo(() => {
    const sample = rawFilteredItems.slice(0, 300);
    return sample.map((item, idx) => {
      const { keyword, rawKeyword, group, tier1, tier2 } = extractKeywordAndGroup(item.loc, { prune });
      return {
        id: idx,
        url: item.loc,
        keyword,
        rawKeyword,
        group,
        tier1,
        tier2,
      };
    });
  }, [rawFilteredItems, prune]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopy2ColTSV = async (includeHeader = true) => {
    if (rawFilteredItems.length === 0) return;
    setIsProcessing(true);

    try {
      const isVeryLarge = rawFilteredItems.length > SAFE_CLIPBOARD_ROW_LIMIT;
      if (isVeryLarge) {
        const sample = rawFilteredItems.slice(0, SAFE_CLIPBOARD_ROW_LIMIT);
        const sampleTsv = formatKeywordsAndGroupsTSV(sample, includeHeader, { prune });
        await copyTextToClipboard(sampleTsv);

        const fullTsv = formatKeywordsAndGroupsTSV(rawFilteredItems, includeHeader, { prune });
        downloadTextFile(
          fullTsv,
          `keywords-2cot-full-${rawFilteredItems.length}-dong.tsv`,
          'text/tab-separated-values;charset=utf-8'
        );

        setCopied('2col');
        showNotification(
          `Đã copy ${SAFE_CLIPBOARD_ROW_LIMIT.toLocaleString()} dòng vào Clipboard & tự động tải file TSV trọn bộ ${rawFilteredItems.length.toLocaleString()} dòng!`
        );
      } else {
        const tsv = formatKeywordsAndGroupsTSV(rawFilteredItems, includeHeader, { prune });
        const ok = await copyTextToClipboard(tsv);
        if (ok) {
          setCopied('2col');
          showNotification(`Đã copy ${rawFilteredItems.length.toLocaleString()} dòng (2 Cột) vào Clipboard!`);
        } else {
          downloadTextFile(tsv, `keywords-2cot-${rawFilteredItems.length}-dong.tsv`, 'text/tab-separated-values;charset=utf-8');
          setCopied('2col');
          showNotification(`Trình duyệt chặn clipboard, hệ thống đã tự động tải file TSV về máy!`);
        }
      }
    } catch (e: any) {
      console.error(e);
      showNotification('Lỗi khi copy: ' + (e?.message || 'Không thể ghi vào bộ nhớ tạm'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setCopied(null), 2500);
    }
  };

  const handleCopy3ColTSV = async (includeHeader = true) => {
    if (rawFilteredItems.length === 0) return;
    setIsProcessing(true);

    try {
      const isVeryLarge = rawFilteredItems.length > SAFE_CLIPBOARD_ROW_LIMIT;
      if (isVeryLarge) {
        const sample = rawFilteredItems.slice(0, SAFE_CLIPBOARD_ROW_LIMIT);
        const sampleTsv = formatKeywords3ColumnsTSV(sample, includeHeader, { prune });
        await copyTextToClipboard(sampleTsv);

        const fullTsv = formatKeywords3ColumnsTSV(rawFilteredItems, includeHeader, { prune });
        downloadTextFile(
          fullTsv,
          `keywords-3cot-full-${rawFilteredItems.length}-dong.tsv`,
          'text/tab-separated-values;charset=utf-8'
        );

        setCopied('3col');
        showNotification(
          `Đã copy ${SAFE_CLIPBOARD_ROW_LIMIT.toLocaleString()} dòng vào Clipboard & tự động tải file TSV trọn bộ ${rawFilteredItems.length.toLocaleString()} dòng!`
        );
      } else {
        const tsv = formatKeywords3ColumnsTSV(rawFilteredItems, includeHeader, { prune });
        const ok = await copyTextToClipboard(tsv);
        if (ok) {
          setCopied('3col');
          showNotification(`Đã copy ${rawFilteredItems.length.toLocaleString()} dòng (3 Cột) vào Clipboard!`);
        } else {
          downloadTextFile(tsv, `keywords-3cot-${rawFilteredItems.length}-dong.tsv`, 'text/tab-separated-values;charset=utf-8');
          setCopied('3col');
          showNotification(`Trình duyệt chặn clipboard, hệ thống đã tự động tải file TSV về máy!`);
        }
      }
    } catch (e: any) {
      console.error(e);
      showNotification('Lỗi khi copy: ' + (e?.message || 'Không thể ghi vào bộ nhớ tạm'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setCopied(null), 2500);
    }
  };

  const handleDownload2ColExcel = () => {
    if (rawFilteredItems.length === 0) return;
    try {
      exportKeywords2ColExcel(rawFilteredItems, { prune });
      showNotification(`Đã tải về file Excel (.xlsx) 2 Cột: Keyword, Phân nhóm (${rawFilteredItems.length.toLocaleString()} dòng)!`);
    } catch (e: any) {
      console.error(e);
      showNotification('Lỗi khi xuất file Excel: ' + (e?.message || ''));
    }
  };

  const handleDownload3ColExcel = () => {
    if (rawFilteredItems.length === 0) return;
    try {
      exportKeywords3ColWithExtractUrlExcel(rawFilteredItems, { prune });
      showNotification(`Đã tải về file Excel (.xlsx) 3 Cột: Keyword, Phân nhóm, Extract URL (${rawFilteredItems.length.toLocaleString()} dòng)!`);
    } catch (e: any) {
      console.error(e);
      showNotification('Lỗi khi xuất file Excel: ' + (e?.message || ''));
    }
  };

  const handleDownloadTSV = (is3Col = false) => {
    if (rawFilteredItems.length === 0) return;
    const content = is3Col
      ? formatKeywords3ColumnsTSV(rawFilteredItems, true, { prune })
      : formatKeywordsAndGroupsTSV(rawFilteredItems, true, { prune });
    downloadTextFile(
      content,
      is3Col ? `keywords-3cot-${rawFilteredItems.length}-dong.tsv` : `keywords-2cot-${rawFilteredItems.length}-dong.tsv`,
      'text/tab-separated-values;charset=utf-8'
    );
  };

  const handleDownloadCSV = (is3Col = false) => {
    if (rawFilteredItems.length === 0) return;
    const csv = is3Col
      ? formatKeywords3ColumnsCSV(rawFilteredItems, true, { prune })
      : formatKeywordsAndGroupsCSV(rawFilteredItems, true, { prune });
    downloadTextFile(
      csv,
      is3Col ? `keywords-3cot-${rawFilteredItems.length}-dong.csv` : `keywords-2cot-${rawFilteredItems.length}-dong.csv`,
      'text/csv;charset=utf-8'
    );
  };

  const handleCopySingleRow = async (
    row: { keyword: string; group: string; tier1: string; tier2: string },
    id: number
  ) => {
    const text = viewFormat === '3col' ? `${row.keyword}\t${row.tier1}\t${row.tier2}` : `${row.keyword}\t${row.group}`;
    await copyTextToClipboard(text);
    setCopiedRow(id);
    setTimeout(() => setCopiedRow(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/50 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Phân loại Category & Subcategory 2 Cấp
                </h2>
                <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                  {rawFilteredItems.length.toLocaleString()} dòng
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Cấp 1 (Category: Kitchen, Appliances, Food, Bathroom...) / Cấp 2 (Subcategory: Faucet, Dehumidifier, Cat, Shower Door...)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast alert inside modal */}
        {toastMessage && (
          <div className="mx-4 mt-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm URL hoặc từ khóa..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Mode switch */}
            <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-lg shrink-0 text-[11px]">
              <button
                onClick={() => setViewFormat('2col')}
                className={`px-2 py-1 rounded-md font-medium transition-all ${
                  viewFormat === '2col'
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                2 Cột (Cấp 1/Cấp 2)
              </button>
              <button
                onClick={() => setViewFormat('3col')}
                className={`px-2 py-1 rounded-md font-medium transition-all ${
                  viewFormat === '3col'
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                3 Cột Riêng Biệt
              </button>
            </div>

            {/* Prune Toggle Button */}
            <button
              type="button"
              onClick={() => setPrune(!prune)}
              title="Lược bỏ 'the', 'top 3', 'top 10'..."
              className={`px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all border shrink-0 ${
                prune
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300/80 dark:border-amber-800'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <Scissors className={`w-3 h-3 ${prune ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`} />
              <span>Tỉa Keyword</span>
              <span className={`text-[10px] font-bold px-1 rounded ${prune ? 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>
                {prune ? 'BẬT' : 'TẮT'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy2ColTSV(true)}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              title="Copy 2 Cột: Cột 1 = Keyword, Cột 2 = Phân nhóm Cấp 1/Cấp 2 (ví dụ Food/Cat)"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : copied === '2col' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Columns className="w-3.5 h-3.5" />
              )}
              <span>{copied === '2col' ? 'Đã copy 2 cột!' : 'Copy 2 Cột (Food/Cat)'}</span>
            </button>

            <button
              onClick={() => handleCopy3ColTSV(true)}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Copy 3 Cột: Cột 1 = Keyword, Cột 2 = Cấp 1, Cột 3 = Cấp 2"
            >
              {copied === '3col' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied === '3col' ? 'Đã copy 3 cột!' : 'Copy 3 Cột Riêng'}</span>
            </button>

            <button
              onClick={handleDownload2ColExcel}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              title={`Tải file Excel (.xlsx) 2 Cột: Keyword, Phân nhóm (${rawFilteredItems.length.toLocaleString()} dòng)`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Tải Excel 2 Cột</span>
            </button>

            <button
              onClick={handleDownload3ColExcel}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              title={`Tải file Excel (.xlsx) 3 Cột: Keyword, Phân nhóm, Extract URL (${rawFilteredItems.length.toLocaleString()} dòng)`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Tải Excel 3 Cột</span>
            </button>

            <button
              onClick={() => handleDownloadTSV(viewFormat === '3col')}
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-indigo-600 rounded-lg transition-colors"
              title="Tải file TSV"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleDownloadCSV(viewFormat === '3col')}
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-lg transition-colors"
              title="Tải file CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 font-semibold sticky top-0 backdrop-blur-xs z-10 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center font-mono">#</th>
                <th className="py-2.5 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                  Cột 1: Keyword
                </th>
                {viewFormat === '2col' ? (
                  <th className="py-2.5 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                    Cột 2: Category / Subcategory (Ví dụ: Kitchen/Faucet)
                  </th>
                ) : (
                  <>
                    <th className="py-2.5 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                      Cột 2: Category (Cấp 1)
                    </th>
                    <th className="py-2.5 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                      Cột 3: Subcategory (Cấp 2)
                    </th>
                  </>
                )}
                <th className="py-2.5 px-4 font-semibold text-zinc-500 hidden lg:table-cell">
                  URL Nguồn
                </th>
                <th className="py-2.5 px-3 w-20 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-sans">
              {previewRows.map((row, idx) => (
                <tr
                  key={`preview-kw-${row.id}-${idx}-${row.url}`}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-950/60 transition-colors group"
                >
                  <td className="py-2.5 px-3 text-center text-[11px] font-mono text-zinc-400">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40 font-mono text-[11px]">
                        {row.keyword}
                      </span>
                      {prune && row.rawKeyword && row.rawKeyword.toLowerCase() !== row.keyword.toLowerCase() && (
                        <span
                          className="text-[10px] text-zinc-400 font-mono line-through truncate max-w-xs"
                          title={`Gốc: ${row.rawKeyword}`}
                        >
                          gốc: {row.rawKeyword}
                        </span>
                      )}
                    </div>
                  </td>
                  {viewFormat === '2col' ? (
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 font-semibold border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-emerald-700 dark:text-emerald-400">{row.tier1}</span>
                        <span className="text-zinc-400">/</span>
                        <span className="text-amber-700 dark:text-amber-300">{row.tier2}</span>
                      </span>
                    </td>
                  ) : (
                    <>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-100 dark:border-emerald-900/40">
                          {row.tier1}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium border border-amber-100 dark:border-amber-900/40">
                          {row.tier2}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-4 text-zinc-400 font-mono text-[10px] hidden lg:table-cell max-w-xs truncate">
                    {row.url}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopySingleRow(row, row.id)}
                        title={`Copy dòng này (${viewFormat === '3col' ? '3 cột' : '2 cột'})`}
                        className="p-1 rounded text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {copiedRow === row.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rawFilteredItems.length > 300 && (
            <div className="p-3 text-center text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
              Đang hiển thị 300 dòng xem trước (nút "Copy 2 Cột" / "Tải File TSV" sẽ xử lý toàn bộ {rawFilteredItems.length.toLocaleString()} dòng).
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Định dạng copy: <code className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
              {viewFormat === '3col' ? 'Keyword [TAB] Cấp 1 [TAB] Cấp 2' : 'Keyword [TAB] Cấp 1/Cấp 2 (Ví dụ: Food/Cat)'}
            </code>
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
