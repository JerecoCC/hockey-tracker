const EMPTY_RICH_TEXT = '<p></p>';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const descriptionHtmlToTextarea = (value: string | null | undefined): string => {
  if (!value || value.trim() === '' || value.trim() === EMPTY_RICH_TEXT) return '';

  const withLineBreaks = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/li>\s*<li>/gi, '\n• ')
    .replace(/<li>/gi, '• ')
    .replace(/<\/?(p|ul|ol)>/gi, '');

  if (typeof document === 'undefined') {
    return withLineBreaks.replace(/<[^>]+>/g, '').trim();
  }

  const root = document.createElement('div');
  root.innerHTML = withLineBreaks;
  return (root.textContent ?? '').trim();
};

export const textareaToDescriptionHtml = (value: string | null | undefined): string | null => {
  const normalized = (value ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
};
