import axios from 'axios';
import { GrammarIssue } from '../types';

// --- LanguageTool API (free public API -- no key required) -------------------

const LT_API = 'https://api.languagetool.org/v2/check';
const LT_MAX_CHARS = 20_000; // free API limit per request

interface LTMatch {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  context: { text: string };
  rule: {
    id: string;
    description: string;
    issueType?: string;
    category: { id: string; name: string };
  };
}

function mapSeverity(
  categoryId: string,
  issueType?: string
): 'error' | 'warning' | 'suggestion' {
  if (['TYPOS', 'GRAMMAR'].includes(categoryId)) return 'error';
  if (issueType === 'misspelling' || issueType === 'typographical') return 'error';
  if (['PUNCTUATION', 'CONFUSED_WORDS', 'CASING'].includes(categoryId)) return 'warning';
  if (['STYLE', 'REDUNDANCY', 'TYPOGRAPHY'].includes(categoryId)) return 'suggestion';
  return 'warning';
}

// --- Public API --------------------------------------------------------------

export async function checkGrammar(
  text: string,
  language = 'en-US'
): Promise<GrammarIssue[]> {
  if (!text || text.trim().length === 0) return [];

  const sample = text.slice(0, LT_MAX_CHARS);

  try {
    const response = await axios.post<{ matches: LTMatch[] }>(
      LT_API,
      new URLSearchParams({ text: sample, language }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 }
    );

    const matches: LTMatch[] = response.data.matches ?? [];

    // Deduplicate by offset
    const seen = new Set<number>();
    return matches
      .filter((m) => {
        if (seen.has(m.offset)) return false;
        seen.add(m.offset);
        return true;
      })
      .map((m) => ({
        message:      m.message,
        shortMessage: m.shortMessage || undefined,
        offset:       m.offset,
        length:       m.length,
        replacements: m.replacements.slice(0, 5).map((r) => r.value),
        context:      m.context.text,
        severity:     mapSeverity(m.rule.category.id, m.rule.issueType),
        rule: {
          id:          m.rule.id,
          description: m.rule.description,
          category:    m.rule.category.name,
        },
      }));
  } catch (err) {
    console.error('LanguageTool grammar check failed:', err);
    return [];
  }
}

export function summariseGrammarIssues(issues: GrammarIssue[]): {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  topIssues: GrammarIssue[];
} {
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = { error: 0, warning: 0, suggestion: 0 };
  for (const issue of issues) {
    byCategory[issue.rule.category] = (byCategory[issue.rule.category] || 0) + 1;
    const sev = issue.severity ?? 'warning';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }
  return {
    total: issues.length,
    byCategory,
    bySeverity,
    topIssues: issues.slice(0, 10),
  };
}

/**
 * Compute a grammar score (0-100) based on issue density and severity.
 * 100 = perfect, 0 = heavily flawed.
 */
export function computeGrammarScore(wordCount: number, issues: GrammarIssue[]): number {
  if (wordCount === 0) return 100;
  if (issues.length === 0) return 100;

  const weights: Record<string, number> = { error: 4, warning: 2, suggestion: 1 };
  const totalPenalty = issues.reduce((sum, issue) => {
    return sum + (weights[issue.severity ?? 'warning'] ?? 2);
  }, 0);

  const penaltyPerWord = totalPenalty / wordCount;
  const score = Math.max(0, Math.round(100 - penaltyPerWord * 100));
  return Math.min(100, score);
}
