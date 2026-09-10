/**
 * Bulletproof Clipboard and File Download Utilities
 * Handles large text payloads, iframe restrictions, and browser permission policies
 */

/** Maximum rows safely supported by browser clipboard and Google Sheets/Excel paste without crashing */
export const SAFE_CLIPBOARD_ROW_LIMIT = 25000;

/**
 * Robust copy-to-clipboard function
 * 1. Tries modern navigator.clipboard.writeText
 * 2. Seamlessly falls back to off-screen textarea + document.execCommand('copy')
 * 3. Never throws an uncaught error, returns boolean indicating success
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Method 1: navigator.clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, attempting execCommand fallback:', err);
    }
  }

  // Method 2: document.execCommand('copy') fallback with off-screen textarea
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Ensure invisible and non-scrolling
    textarea.style.contain = 'strict';
    textarea.style.position = 'fixed';
    textarea.style.left = '-99999px';
    textarea.style.top = '-99999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('execCommand copy failed:', err);
    return false;
  }
}

/**
 * Triggers a browser download for a given Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Triggers a browser download for plain text, TSV, or CSV
 */
export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}
