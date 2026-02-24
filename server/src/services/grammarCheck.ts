import { GoogleGenerativeAI } from '@google/generative-ai';
import { GrammarIssue } from '../types';

// ─── Gemini client (lazy init) ────────────────────────────────────────────────

let _gemini: GoogleGenerativeAI | null = null;

function getGemini(): GoogleGenerativeAI {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    _gemini = new GoogleGenerativeAI(apiKey);
  }
  return _gemini;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 8_000; // keep well within Gemini Flash context window per call

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('. ', end);
      if (lastPeriod > i + size / 2) end = lastPeriod + 1;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

// ─── Core Gemini grammar check ────────────────────────────────────────────────

async function checkChunkWithGemini(
  text: string,
  baseOffset: number
): Promise<GrammarIssue[]> {
  const model = getGemini().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const prompt = `You are a professional grammar, spelling, and style checker.

Analyse the following text and return a JSON array of issues found.
For each issue include the character offset inside THIS text snippet.

Return ONLY a valid JSON array (empty [] if no issues):
[
  {
    "message": "Full description of the problem",
    "shortMessage": "Brief label (e.g. 'Spelling error')",
    "offset": <integer — char index in text where issue starts>,
    "length": <integer — char length of problematic text>,
    "context": "<the surrounding sentence for context>",
    "replacements": ["best fix", "alternative fix"],
    "rule": {
      "id": "RULE_ID",
      "description": "What rule this violates",
      "category": "GRAMMAR|SPELLING|PUNCTUATION|STYLE|TYPOS"
    }
  }
]

Text:
"""
${text}
"""`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps the JSON
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(clean) as GrammarIssue[];
    if (!Array.isArray(parsed)) return [];

    return parsed.map((issue) => ({
      ...issue,
      offset: (issue.offset ?? 0) + baseOffset,
      replacements: (issue.replacements ?? []).slice(0, 5),
    }));
  } catch (err) {
    console.error('Gemini grammar check failed for chunk:', err);
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkGrammar(
  text: string,
  _language = 'en-US'
): Promise<GrammarIssue[]> {
  if (!text || text.trim().length === 0) return [];

  const chunks = splitIntoChunks(text, CHUNK_SIZE);
  let offset = 0;
  const allIssues: GrammarIssue[] = [];

  for (const chunk of chunks) {
    const issues = await checkChunkWithGemini(chunk, offset);
    allIssues.push(...issues);
    offset += chunk.length;

    if (chunks.length > 1) {
      // Small delay to avoid Gemini rate-limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  // Deduplicate by offset
  const seen = new Set<number>();
  return allIssues.filter((issue) => {
    if (seen.has(issue.offset)) return false;
    seen.add(issue.offset);
    return true;
  });
}

export function summariseGrammarIssues(issues: GrammarIssue[]): {
  total: number;
  byCategory: Record<string, number>;
  topIssues: GrammarIssue[];
} {
  const byCategory: Record<string, number> = {};
  for (const issue of issues) {
    byCategory[issue.rule.category] = (byCategory[issue.rule.category] || 0) + 1;
  }
  return {
    total: issues.length,
    byCategory,
    topIssues: issues.slice(0, 10),
  };
}
