import fs from 'fs';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import axios from 'axios';
import { ExtractedContent, DocumentSection } from '../types';

// ─── Text Cleaning ─────────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')            // Normalise line endings
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')           // Collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')        // Max two consecutive newlines
    .replace(/^\s+|\s+$/g, '')         // Trim outer whitespace
    .trim();
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

// ─── Structuring ──────────────────────────────────────────────────────────────

function structureText(cleanedText: string): DocumentSection[] {
  const lines = cleanedText.split('\n');
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;

  const isHeading = (line: string): boolean => {
    const trimmed = line.trim();
    // Heuristic: short line (< 80 chars), no terminal punctuation, possibly ALL_CAPS or title case
    if (!trimmed || trimmed.length > 80) return false;
    if (/[.!?]$/.test(trimmed)) return false;
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) return true;
    if (/^#+\s/.test(trimmed)) return true;                          // Markdown heading
    if (/^\d+\.\s+[A-Z]/.test(trimmed)) return true;                // Numbered heading
    if (/^[A-Z][A-Za-z\s,:-]{5,60}$/.test(trimmed) && !/,\s/.test(trimmed)) return true;
    return false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isHeading(trimmed)) {
      // Save previous section
      if (currentSection && currentSection.paragraphs.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        title: trimmed.replace(/^#+\s*/, ''),
        paragraphs: [],
        narrationSegments: [],
      };
    } else {
      if (!currentSection) {
        currentSection = {
          title: 'Introduction',
          paragraphs: [],
          narrationSegments: [],
        };
      }
      currentSection.paragraphs.push(trimmed);
    }
  }

  if (currentSection && currentSection.paragraphs.length > 0) {
    sections.push(currentSection);
  }

  // Fallback: single section if nothing was structured
  if (sections.length === 0 && cleanedText.trim().length > 0) {
    sections.push({
      title: 'Content',
      paragraphs: cleanedText
        .split('\n\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
      narrationSegments: [],
    });
  }

  return sections;
}

// ─── Extraction Functions ──────────────────────────────────────────────────────

export async function extractFromDocx(filePath: string): Promise<ExtractedContent> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value;

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('No text could be extracted from the DOCX file');
  }

  const cleanedText = cleanText(rawText);
  const structuredSections = structureText(cleanedText);

  return {
    rawText,
    cleanedText,
    structuredSections,
    wordCount: countWords(cleanedText),
    sourceType: 'docx',
  };
}

export async function extractFromPdf(filePath: string): Promise<ExtractedContent> {
  const buffer = fs.readFileSync(filePath);
  const result = await pdfParse(buffer);
  const rawText = result.text;

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('No text could be extracted from the PDF file');
  }

  const cleanedText = cleanText(rawText);
  const structuredSections = structureText(cleanedText);

  return {
    rawText,
    cleanedText,
    structuredSections,
    wordCount: countWords(cleanedText),
    sourceType: 'pdf',
  };
}

export async function extractFromTxt(filePath: string): Promise<ExtractedContent> {
  const rawText = fs.readFileSync(filePath, 'utf-8');

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('The text file appears to be empty');
  }

  const cleanedText = cleanText(rawText);
  const structuredSections = structureText(cleanedText);

  return {
    rawText,
    cleanedText,
    structuredSections,
    wordCount: countWords(cleanedText),
    sourceType: 'txt',
  };
}

export async function extractFromYouTube(youtubeUrl: string): Promise<ExtractedContent> {
  const videoIdMatch = youtubeUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );

  if (!videoIdMatch?.[1]) {
    throw new Error('Invalid YouTube URL. Could not extract video ID.');
  }

  const videoId = videoIdMatch[1];
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // ── Step 1: fetch the watch page with browser-like headers ───────────────
  let pageHtml: string;
  try {
    const resp = await axios.get<string>(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    });
    pageHtml = resp.data as string;
  } catch (err) {
    throw new Error(
      `Could not reach YouTube. Check the server's internet connection. (${
        err instanceof Error ? err.message : err
      })`
    );
  }

  // ── Step 2: extract ytInitialPlayerResponse JSON ─────────────────────────
  let playerResponse: Record<string, unknown>;
  try {
    const match = pageHtml.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|const|let|<\/script)/s);
    if (!match?.[1]) throw new Error('ytInitialPlayerResponse not found in page');
    playerResponse = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    throw new Error(
      'Could not parse YouTube page data. YouTube may have changed its page structure.'
    );
  }

  // ── Step 3: locate a caption track URL ───────────────────────────────────
  type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };
  const tracks: CaptionTrack[] = (
    (playerResponse?.captions as Record<string, unknown>)
      ?.playerCaptionsTracklistRenderer as Record<string, unknown>
  )?.captionTracks as CaptionTrack[] ?? [];

  if (!tracks || tracks.length === 0) {
    throw new Error(
      'This YouTube video has no transcript/captions available. ' +
        'Please try a video that has auto-generated or manually added subtitles.'
    );
  }

  // Prefer: manual English → auto-generated English → any English → first available
  const preferred =
    tracks.find((t) => t.languageCode === 'en' && t.kind !== 'asr') ??
    tracks.find((t) => t.languageCode === 'en') ??
    tracks.find((t) => t.languageCode?.startsWith('en')) ??
    tracks[0];

  const captionUrl = preferred.baseUrl;

  // ── Step 4: fetch the timed-text XML ─────────────────────────────────────
  let xmlText: string;
  try {
    const xmlResp = await axios.get<string>(captionUrl, { timeout: 10000 });
    xmlText = xmlResp.data as string;
  } catch (err) {
    throw new Error(
      `Failed to download caption XML. (${err instanceof Error ? err.message : err})`
    );
  }

  // ── Step 5: parse XML into plain text ─────────────────────────────────────
  // Format: <text start="x" dur="y">...html-entities...</text>
  const textParts: string[] = [];
  const xmlRe = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = xmlRe.exec(xmlText)) !== null) {
    const raw = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<[^>]+>/g, '')  // strip any inner tags
      .trim();
    if (raw) textParts.push(raw);
  }

  if (textParts.length === 0) {
    throw new Error(
      'The caption file was empty or could not be parsed. The video may not have readable subtitles.'
    );
  }

  const rawText = textParts.join(' ');
  const cleanedText = cleanText(rawText);
  const structuredSections = structureText(cleanedText);

  return {
    rawText,
    cleanedText,
    structuredSections,
    wordCount: countWords(cleanedText),
    sourceType: 'youtube',
  };
}

// ─── Auto-detect and extract ──────────────────────────────────────────────────

export async function extractContent(
  source: { filePath?: string; youtubeUrl?: string; mimeType?: string; originalname?: string }
): Promise<ExtractedContent> {
  if (source.youtubeUrl) {
    return extractFromYouTube(source.youtubeUrl);
  }

  if (!source.filePath) {
    throw new Error('No file path or YouTube URL provided');
  }

  const ext = source.originalname
    ? source.originalname.split('.').pop()?.toLowerCase()
    : source.filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'docx':
      return extractFromDocx(source.filePath);
    case 'pdf':
      return extractFromPdf(source.filePath);
    case 'txt':
      return extractFromTxt(source.filePath);
    default:
      throw new Error(`Unsupported file extension: .${ext}`);
  }
}
