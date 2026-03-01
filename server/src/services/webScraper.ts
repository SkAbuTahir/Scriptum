import axios from 'axios';
import * as cheerio from 'cheerio';
import { ExtractedContent, DocumentSection } from '../types';

// ─── Noise selectors to strip before extraction ──────────────────────────────

const STRIP_SELECTORS = [
  'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
  'header', 'footer', 'nav', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]', '[role="complementary"]',
  '.nav', '.navbar', '.navigation', '.header', '.footer', '.sidebar',
  '.advertisement', '.ads', '.ad', '.promo', '.banner',
  '.cookie', '.popup', '.modal', '.overlay', '.newsletter',
  '.social-share', '.share-buttons', '.comments', '#comments',
  '.related-posts', '.recommended', '.suggested',
  '.breadcrumb', '.breadcrumbs',
  '.menu', '#menu', '#main-menu',
  'form', 'button[type="submit"]',
].join(', ');

// ─── Candidate selectors for main article content ────────────────────────────
// Tried in priority order; the first one with >200 chars wins.

const CONTENT_SELECTORS = [
  'article[class*="post"]',
  'article[class*="entry"]',
  'article[class*="article"]',
  'article[class*="content"]',
  'article',
  '[role="main"]',
  'main',
  '.post-content',
  '.entry-content',
  '.article-content',
  '.article-body',
  '.story-body',
  '.blog-content',
  '.body-content',
  '.content-body',
  '.post-body',
  '.td-post-content',
  '.article__body',
  '.article__content',
  '.s-content',
  '.entry-body',
  '.post__content',
  '#article-body',
  '#post-content',
  '#story',
  '#content',
  '.content',
  'main',
];

// ─── Text cleaning utils ─────────────────────────────────────────────────────

function cleanWhitespace(s: string): string {
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#\d+;/g, '');
}

// ─── Main extractor ──────────────────────────────────────────────────────────

function extractStructured(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<cheerio.Element>
): { text: string; sections: DocumentSection[] } {
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection = {
    title: 'Introduction',
    paragraphs: [],
    narrationSegments: [],
  };
  const textParts: string[] = [];

  // Walk all block-level content in order
  root.find('h1, h2, h3, h4, p, li, blockquote, pre').each((_i, el) => {
    const tag = (el as cheerio.Element & { tagName: string }).tagName?.toLowerCase() ?? '';
    const raw = $(el).text() ?? '';
    const text = decodeEntities(cleanWhitespace(raw));

    if (!text || text.length < 3) return;

    if (/^h[1-4]$/.test(tag)) {
      // Save current section
      if (currentSection.paragraphs.length > 0) {
        sections.push(currentSection);
        textParts.push(`\n\n${currentSection.title}\n`);
      }
      currentSection = { title: text, paragraphs: [], narrationSegments: [] };
    } else {
      currentSection.paragraphs.push(text);
      textParts.push(text);
    }
  });

  // Push last section
  if (currentSection.paragraphs.length > 0) {
    sections.push(currentSection);
  }

  // Fallback: if no structured content found, grab all text
  if (sections.length === 0 || textParts.join(' ').length < 100) {
    const fallback = decodeEntities(cleanWhitespace(root.text() ?? ''));
    const paras = fallback.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 20);
    sections.push({ title: 'Content', paragraphs: paras, narrationSegments: [] });
    return { text: fallback, sections };
  }

  return { text: cleanWhitespace(textParts.join('\n')), sections };
}

// ─── Public entrypoint ───────────────────────────────────────────────────────

export async function extractFromWebsite(url: string): Promise<ExtractedContent> {
  // ── 1. Validate URL ────────────────────────────────────────────────────────
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL. Please enter a full URL including https://');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported.');
  }

  // ── 2. Fetch page ──────────────────────────────────────────────────────────
  let html: string;
  try {
    const resp = await axios.get<string>(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      timeout: 20_000,
      maxRedirects: 5,
      responseType: 'text',
    });
    html = resp.data as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('403') || msg.includes('Forbidden')) {
      throw new Error(
        'The website blocked the request (403 Forbidden). Try copying the article text manually.'
      );
    }
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      throw new Error('Could not reach the website. Check the URL and your internet connection.');
    }
    throw new Error(`Failed to fetch the webpage: ${msg}`);
  }

  // ── 3. Parse HTML ──────────────────────────────────────────────────────────
  const $ = cheerio.load(html);

  // Extract meta info before stripping
  const pageTitle =
    $('meta[property="og:title"]').attr('content') ||
    $('title').first().text() ||
    parsed.hostname;
  const metaDesc =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  // Strip noise
  $(STRIP_SELECTORS).remove();

  // ── 4. Find main content area ──────────────────────────────────────────────
  let contentRoot: cheerio.Cheerio<cheerio.Element> | null = null;

  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel).first();
    if (el.length > 0) {
      const txt = el.text() ?? '';
      if (txt.trim().length > 200) {
        contentRoot = el;
        break;
      }
    }
  }

  // Last resort: use body
  if (!contentRoot || (contentRoot.text() ?? '').trim().length < 100) {
    contentRoot = $('body');
  }

  // ── 5. Extract structured text ─────────────────────────────────────────────
  const { text, sections } = extractStructured($, contentRoot);

  if (!text || text.trim().length < 50) {
    throw new Error(
      'Could not extract readable text from this page. ' +
      'The page may require JavaScript or be behind a login wall.'
    );
  }

  // ── 6. Prepend title + description ────────────────────────────────────────
  const titleClean = decodeEntities(cleanWhitespace(pageTitle.trim()));
  const descClean  = metaDesc ? decodeEntities(cleanWhitespace(metaDesc.trim())) : '';

  const rawText     = [titleClean, descClean, text].filter(Boolean).join('\n\n');
  const cleanedText = cleanWhitespace(rawText);
  const words       = cleanedText.trim().split(/\s+/).filter((w) => w.length > 0);

  // If sections don't include the title as first, prepend it
  if (sections.length > 0 && sections[0].title !== titleClean) {
    sections.unshift({
      title: titleClean,
      paragraphs: descClean ? [descClean] : [],
      narrationSegments: [],
    });
  }

  return {
    rawText,
    cleanedText,
    structuredSections: sections,
    wordCount: words.length,
    sourceType: 'website',
    pageTitle: titleClean,
    pageUrl: url,
  };
}
