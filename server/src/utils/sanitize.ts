import sanitizeHtml from 'sanitize-html';

/**
 * Strip ALL HTML tags and attributes — returns plain text only.
 * Use this on any user-supplied or scraped content before storing.
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return '';
  return sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape',
  }).trim();
}

/**
 * Allow only basic formatting tags (for rich-text fields that need it).
 * Strips scripts, iframes, styles, event handlers, etc.
 */
export function sanitizeRichText(dirty: string): string {
  if (!dirty) return '';
  return sanitizeHtml(dirty, {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code'],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape',
  }).trim();
}

/**
 * Sanitize an array of strings (e.g. paragraphs, tips).
 */
export function sanitizeArray(arr: string[]): string[] {
  return arr.map(sanitizeText).filter(Boolean);
}
