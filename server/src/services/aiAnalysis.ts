import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisResult, GrammarIssue, ToneResult } from '../types';
import { checkGrammar, computeGrammarScore } from './grammarCheck';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_GEMINI_CHARS   = 4_000;
const MAX_GRAMMAR_CHARS  = 10_000;
const MIN_ANALYSIS_CHARS = 50;
const LONG_SENTENCE_THRESHOLD = 30; // words

// ─── Gemini client ────────────────────────────────────────────────────────────
let _gemini: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    _gemini = new GoogleGenerativeAI(apiKey);
  }
  return _gemini;
}

// ─── Combined Gemini Analysis (single call) ───────────────────────────────────
// Covers: AI likelihood, content integrity, tone, bias — all in one prompt.
// This respects the "do not call Gemini more than once per analysis" requirement.

interface GeminiAnalysisResult {
  aiScore:          number | null;
  aiReasoning:      string;
  humanizationTips: string[];
  claimFlags:       string[];
  tone:             ToneResult;
}

async function runGeminiAnalysis(text: string): Promise<GeminiAnalysisResult> {
  const sample = text.slice(0, MAX_GEMINI_CHARS);

  const model = getGemini().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });

  const prompt = `You are a senior editorial analyst for a professional journalism platform.

Analyse the text below and return a single comprehensive editorial assessment.

Return ONLY valid JSON (no markdown, no extra text):
{
  "aiScore": <integer 0-100, where 100 = definitely AI-generated, 0 = definitely human>,
  "aiReasoning": "<2-3 sentences citing specific forensic linguistic evidence from the text>",
  "humanizationTips": [
    "<specific actionable tip — e.g. Replace opener 'It is important to note' with a direct statement>",
    "<tip 2>",
    "<tip 3>",
    "<tip 4>",
    "<tip 5>"
  ],
  "claimFlags": [
    "<exact sentence from text containing a statistic, number, percentage, or strong factual claim requiring source verification>",
    "...up to 10 sentences"
  ],
  "tone": {
    "dominantTone": "<one of: formal | conversational | persuasive | technical | narrative | instructional>",
    "confidence": <float 0.0-1.0>,
    "breakdown": {
      "formal": <float 0.0-1.0>,
      "conversational": <float 0.0-1.0>,
      "persuasive": <float 0.0-1.0>,
      "technical": <float 0.0-1.0>,
      "narrative": <float 0.0-1.0>,
      "instructional": <float 0.0-1.0>
    },
    "biasFlags": [
      "<example phrase or sentence showing emotional, opinionated, or speculative bias>",
      "...up to 5 examples"
    ]
  }
}

Text:
"""
${sample}
"""`;

  const fallback: GeminiAnalysisResult = {
    aiScore:          null,
    aiReasoning:      '',
    humanizationTips: [],
    claimFlags:       [],
    tone: {
      dominantTone: 'neutral',
      confidence:   0.5,
      breakdown:    { formal: 0.5, conversational: 0.5, persuasive: 0, technical: 0, narrative: 0, instructional: 0 },
      biasFlags:    [],
    },
  };

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(raw) as Partial<GeminiAnalysisResult> & {
      tone?: Partial<ToneResult>;
    };

    return {
      aiScore:          typeof parsed.aiScore === 'number'
        ? Math.min(100, Math.max(0, Math.round(parsed.aiScore)))
        : null,
      aiReasoning:      parsed.aiReasoning      ?? '',
      humanizationTips: (parsed.humanizationTips ?? []).slice(0, 5),
      claimFlags:       (parsed.claimFlags       ?? []).slice(0, 10),
      tone: {
        dominantTone: parsed.tone?.dominantTone ?? 'neutral',
        confidence:   Math.min(1, Math.max(0, parsed.tone?.confidence ?? 0.5)),
        breakdown:    parsed.tone?.breakdown    ?? fallback.tone.breakdown,
        biasFlags:    (parsed.tone?.biasFlags   ?? []).slice(0, 5),
      },
    };
  } catch (err) {
    console.error('[Gemini] combined analysis failed:', err);
    return fallback;
  }
}

// ─── Long sentence detection (local — no AI) ─────────────────────────────────

function detectLongSentences(text: string, threshold = LONG_SENTENCE_THRESHOLD): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  return sentences
    .filter((s) => {
      const words = s.trim().split(/\s+/).filter(Boolean);
      return words.length > threshold;
    })
    .slice(0, 20); // cap at 20 flagged sentences
}

// ─── Syllable estimator (local) ───────────────────────────────────────────────

function estimateSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  const vowels = word.match(/[aeiouy]+/g);
  return vowels ? vowels.length : 1;
}

function fleschGrade(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th–9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th–12th grade)';
  if (score >= 30) return 'Difficult (College)';
  return 'Very Confusing (Professional)';
}

// ─── Readability (local Flesch + optional TextGears) ─────────────────────────

async function computeReadabilityScore(text: string): Promise<{
  score:              number;
  wordCount:          number;
  sentenceCount:      number;
  readingTimeMinutes: number;
  fleschGradeLevel:   string;
  avgSentenceLength:  number;
}> {
  const words     = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const wordCount          = words.length;
  const sentenceCount      = Math.max(sentences.length, 1);
  const avgSentenceLength  = wordCount / sentenceCount;
  const readingTimeMinutes = wordCount / 238;

  const avgSyllables =
    words.reduce((sum, w) => sum + estimateSyllables(w), 0) / Math.max(wordCount, 1);
  let localScore = Math.round(206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllables);
  localScore = Math.min(100, Math.max(0, localScore));

  const tgKey = process.env.TEXTGEARS_API_KEY;
  let finalScore = localScore;
  let finalGrade = fleschGrade(localScore);

  if (tgKey && wordCount >= 30) {
    try {
      interface TGStats {
        fleschKincaid?: { readingEase?: number; grade?: string; interpretation?: string };
      }
      type TGResponse = { status?: boolean; response?: { stats?: TGStats } };

      const res = await axios.get<TGResponse>(
        'https://api.textgears.com/readability',
        {
          params:  { key: tgKey, text: text.slice(0, MAX_GEMINI_CHARS), language: 'en-US' },
          timeout: 10_000,
        }
      );

      if (res.data?.status !== false) {
        const fk = res.data?.response?.stats?.fleschKincaid;
        if (typeof fk?.readingEase === 'number') {
          finalScore = Math.min(100, Math.max(0, Math.round(fk.readingEase)));
        }
        if (fk?.grade) {
          finalGrade = fk.interpretation ? `${fk.grade} — ${fk.interpretation}` : fk.grade;
        } else {
          finalGrade = fleschGrade(finalScore);
        }
      }
    } catch (e) {
      console.warn('[TextGears] readability fallback to local:', (e as Error).message);
    }
  }

  return { score: finalScore, wordCount, sentenceCount, readingTimeMinutes, fleschGradeLevel: finalGrade, avgSentenceLength };
}

// ─── Main Analysis Orchestrator ───────────────────────────────────────────────

export async function analyseDocument(text: string): Promise<AnalysisResult> {
  if (!text || text.trim().length < MIN_ANALYSIS_CHARS) {
    throw new Error(`Text is too short to analyse (minimum ${MIN_ANALYSIS_CHARS} characters).`);
  }

  const grammarText = text.slice(0, MAX_GRAMMAR_CHARS);

  // Run grammar + readability (no AI cost) in parallel with the single Gemini call
  const [grammarIssues, readabilityData, geminiData] = await Promise.all([
    checkGrammar(grammarText),
    computeReadabilityScore(text),
    runGeminiAnalysis(text),
  ]) as [GrammarIssue[], Awaited<ReturnType<typeof computeReadabilityScore>>, GeminiAnalysisResult];

  const {
    score: readabilityScore,
    wordCount,
    sentenceCount,
    readingTimeMinutes,
    fleschGradeLevel,
    avgSentenceLength,
  } = readabilityData;

  const grammarScore    = computeGrammarScore(wordCount, grammarIssues);
  const longSentences   = detectLongSentences(text);

  return {
    aiScore:             geminiData.aiScore,
    aiReasoning:         geminiData.aiReasoning,
    humanizationTips:    geminiData.humanizationTips,
    claimFlags:          geminiData.claimFlags,
    grammarIssues,
    grammarScore,
    readabilityScore,
    fleschGradeLevel,
    avgSentenceLength,
    readingTimeMinutes,
    longSentences,
    wordCount,
    sentenceCount,
    tone:                geminiData.tone,
    analyzedAt:          new Date(),
  };
}
