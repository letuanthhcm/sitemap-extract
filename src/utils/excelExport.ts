import * as XLSX from 'xlsx';
import { SitemapItem } from '../types';
import { extractKeywordAndGroup } from './seoKeywords';
import { downloadBlob } from './clipboard';

/**
 * Exports 3-column data directly to a native Microsoft Excel (.xlsx) file
 * Column A: Keyword (Từ khóa)
 * Column B: Phân nhóm (Category / Subcategory, ví dụ: Kitchen/Faucet, Food/Cat)
 * Column C: Extract URL (URL sitemap trích xuất)
 */
export function exportKeywords3ColWithExtractUrlExcel(
  items: SitemapItem[],
  options: { prune?: boolean; filename?: string } = {}
): void {
  const { prune = true, filename = `keywords-phan-nhom-extract-url-3cot-${items.length}-dong.xlsx` } = options;

  // 3 CỘT: Cột 1 = Keyword, Cột 2 = Phân nhóm, Cột 3 = Extract URL
  const headers = ['Keyword', 'Phân nhóm', 'Extract URL'];
  const rows: (string | number)[][] = [headers];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { keyword, group } = extractKeywordAndGroup(item.loc, { prune });
    rows.push([keyword, group, item.loc]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set friendly column widths
  ws['!cols'] = [
    { wch: 45 }, // Cột 1: Keyword
    { wch: 35 }, // Cột 2: Phân nhóm
    { wch: 65 }, // Cột 3: Extract URL
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Key & Phân Nhóm & URL');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Exports 2-column Category / Subcategory data directly to a native Microsoft Excel (.xlsx) file
 * Column A: Keyword (Từ khóa)
 * Column B: Phân nhóm (Category / Subcategory, ví dụ: Kitchen/Faucet, Food/Cat)
 * (Chỉ đúng 2 cột chuẩn theo yêu cầu)
 */
export function exportKeywords2ColExcel(
  items: SitemapItem[],
  options: { prune?: boolean; filename?: string } = {}
): void {
  const { prune = true, filename = `keywords-phan-nhom-2cot-${items.length}-dong.xlsx` } = options;

  // CHỈ ĐÚNG 2 CỘT: Cột 1 = Keyword, Cột 2 = Phân nhóm
  const headers = ['Keyword', 'Phân nhóm'];
  const rows: (string | number)[][] = [headers];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { keyword, group } = extractKeywordAndGroup(item.loc, { prune });
    rows.push([keyword, group]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set friendly column widths for the 2 columns
  ws['!cols'] = [
    { wch: 45 }, // Cột 1: Keyword
    { wch: 35 }, // Cột 2: Phân nhóm
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Key & Phân Nhóm');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Exports 3-column data directly to a native Microsoft Excel (.xlsx) file
 * Column A: Keyword
 * Column B: Category (Cấp 1)
 * Column C: Subcategory (Cấp 2)
 * (Chỉ đúng 3 cột)
 */
export function exportKeywords3ColExcel(
  items: SitemapItem[],
  options: { prune?: boolean; filename?: string } = {}
): void {
  const { prune = true, filename = `keywords-3cot-category-subcategory-${items.length}-dong.xlsx` } = options;

  const headers = ['Keyword', 'Category (Cấp 1)', 'Subcategory (Cấp 2)'];
  const rows: (string | number)[][] = [headers];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { keyword, tier1, tier2 } = extractKeywordAndGroup(item.loc, { prune });
    rows.push([keyword, tier1, tier2]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 45 }, // Keyword
    { wch: 25 }, // Category
    { wch: 30 }, // Subcategory
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Keywords 3 Cột');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Exports full sitemap list with metadata to Excel (.xlsx)
 */
export function exportSitemapFullExcel(
  items: SitemapItem[],
  filename = `sitemap-urls-${items.length}.xlsx`
): void {
  const headers = ['URL', 'Ngày sửa đổi (Lastmod)', 'Tần suất (Changefreq)', 'Độ ưu tiên (Priority)', 'Nguồn sitemap'];
  const rows: (string | number)[][] = [headers];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    rows.push([
      item.loc,
      item.lastmod || '',
      item.changefreq || '',
      item.priority || '',
      item.sourceSitemap || '',
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 60 },
    { wch: 22 },
    { wch: 15 },
    { wch: 12 },
    { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Sitemap URLs');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
