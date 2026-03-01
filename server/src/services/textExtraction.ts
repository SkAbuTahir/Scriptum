import fs from 'fs';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import {
  YoutubeTranscript,
  TranscriptResponse,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptTooManyRequestError,
} from 'youtube-transcript';
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

  let segments: TranscriptResponse[];
  try {
    // fetchTranscript accepts the full URL or just the video ID
    segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId));
  } catch (err) {
    if (
      err instanceof YoutubeTranscriptDisabledError ||
      err instanceof YoutubeTranscriptNotAvailableError
    ) {
      throw new Error(
        'This YouTube video has no transcript/captions available. ' +
        'Please try a video that has auto-generated or manually added subtitles.'
      );
    }
    if (err instanceof YoutubeTranscriptVideoUnavailableError) {
      throw new Error(
        'This YouTube video is unavailable or private. Please check the URL and try again.'
      );
    }
    if (err instanceof YoutubeTranscriptTooManyRequestError) {
      throw new Error(
        'YouTube is rate-limiting transcript requests. Please try again in a few minutes.'
      );
    }
    if (err instanceof YoutubeTranscriptNotAvailableLanguageError) {
      // Should not reach here since we fallback, but guard anyway
      throw new Error(
        'No English transcript found. Please try a video with English captions.'
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not fetch YouTube transcript: ${msg}`);
  }

  if (!segments || segments.length === 0) {
    throw new Error(
      'The transcript was empty. The video may not have readable subtitles.'
    );
  }

  // Join caption segments into continuous text
  const rawText = segments
    .map((s) =>
      s.text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/<[^>]+>/g, '')
        .trim()
    )
    .filter(Boolean)
    .join(' ');

  if (!rawText.trim()) {
    throw new Error('The transcript was empty after parsing. The video may not have readable subtitles.');
  }

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
