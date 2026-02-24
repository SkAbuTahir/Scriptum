import { DocumentSection, StructuredContent } from '../types';

// ─── Sentence splitting ───────────────────────────────────────────────────────

function splitIntoSentences(text: string): string[] {
  // Handle abbreviations and decimals heuristically
  return text
    .replace(/(\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|etc|e\.g|i\.e|vs|Fig|No))\.\s/g, '$1<dot> ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map((s) => s.replace(/<dot>/g, '.').trim())
    .filter((s) => s.length > 0);
}

// ─── Section flattening ───────────────────────────────────────────────────────

function buildNarrationSegments(
  paragraphs: string[]
): StructuredContent['sections'][0]['narrationSegments'] {
  const sentences: string[] = [];
  for (const para of paragraphs) {
    sentences.push(...splitIntoSentences(para));
  }
  return sentences.map((s) => ({ text: s, audioUrl: undefined, duration: undefined }));
}

// ─── Main structuring function ────────────────────────────────────────────────

export function structureDocument(
  cleanedText: string,
  existingSections?: DocumentSection[]
): StructuredContent {
  // If sections are already provided (from extraction), enrich them
  if (existingSections && existingSections.length > 0) {
    return {
      sections: existingSections.map((section) => ({
        ...section,
        narrationSegments:
          section.narrationSegments.length > 0
            ? section.narrationSegments
            : buildNarrationSegments(section.paragraphs),
      })),
    };
  }

  // Re-structure from cleaned text
  const blocks = cleanedText
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection = {
    title: 'Introduction',
    paragraphs: [],
    narrationSegments: [],
  };

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];
    const isHeadingLike =
      firstLine.length < 80 &&
      !/[.!?]$/.test(firstLine) &&
      lines.length === 1;

    if (isHeadingLike && currentSection.paragraphs.length > 0) {
      currentSection.narrationSegments = buildNarrationSegments(currentSection.paragraphs);
      sections.push(currentSection);
      currentSection = {
        title: firstLine,
        paragraphs: [],
        narrationSegments: [],
      };
    } else {
      currentSection.paragraphs.push(block);
    }
  }

  if (currentSection.paragraphs.length > 0) {
    currentSection.narrationSegments = buildNarrationSegments(currentSection.paragraphs);
    sections.push(currentSection);
  }

  return { sections };
}

// ─── Flatten to plain text ────────────────────────────────────────────────────

export function flattenStructuredContent(content: StructuredContent): string {
  return content.sections
    .map((s) => `${s.title}\n\n${s.paragraphs.join('\n\n')}`)
    .join('\n\n---\n\n');
}

// ─── Extract all narration sentences ─────────────────────────────────────────

export function extractAllSentences(content: StructuredContent): string[] {
  return content.sections.flatMap((section) =>
    section.narrationSegments.map((seg) => seg.text)
  );
}
