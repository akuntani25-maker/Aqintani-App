/**
 * HTML escape utility — prevents XSS injection when building HTML strings
 * for print windows / dot matrix / receipts.
 * Always escape ANY dynamic data (product names, store names, addresses, etc.)
 * before interpolating into HTML.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shortcut alias
export const e = escapeHtml;
