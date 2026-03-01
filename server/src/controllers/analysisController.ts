import { Response } from 'express';
import { param, validationResult } from 'express-validator';
import crypto from 'crypto';
import DocumentModel from '../models/Document';
import { analyseDocument } from '../services/aiAnalysis';
import { checkAndIncrementUsage } from '../models/Usage';
import { AuthenticatedRequest } from '../types';

// Cache TTL: return stored results without calling Gemini if the text
// hasn’t changed and the analysis was run within this window.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export const analyzeDocumentValidation = [
  param('id').isMongoId().withMessage('Invalid document ID'),
];

export const analyzeDocument = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  const { id } = req.params;

  try {
    // ── 1. Per-user Gemini rate limit (MongoDB-backed) ──────────────────────
    const { allowed, remaining, retryAfterMs } = await checkAndIncrementUsage(req.user!.userId);
    if (!allowed) {
      const mins = Math.ceil(retryAfterMs / 60_000);
      res.status(429).json({
        success: false,
        error: `Gemini analysis limit reached (10/hour per user). Try again in ${mins} min.`,
        retryAfterMs,
        remaining: 0,
      });
      return;
    }

    // ── 2. Load document ───────────────────────────────────────────────
    const doc = await DocumentModel.findOne({
      _id: id,
      userId: req.user!.userId,
    }).lean();

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    // ── 3. Content hash — serve cached result if text hasn’t changed ────────
    const newHash     = hashText(doc.cleanedText);
    const forceRerun  = req.query.force === '1';
    const isCacheHit  =
      !forceRerun &&
      doc.contentHash  === newHash &&
      doc.analysisRunAt !== null &&
      Date.now() - new Date(doc.analysisRunAt).getTime() < CACHE_TTL_MS &&
      doc.grammarScore  !== null;

    if (isCacheHit) {
      res.json({
        success: true,
        cached: true,
        data: {
          documentId:         id,
          aiLikelihoodScore:  doc.aiScore,
          grammarScore:       doc.grammarScore,
          plagiarismScore:    doc.plagiarismScore,
          readabilityScore:   doc.readabilityScore,
          grammarIssues:      doc.grammarIssues,
          suggestions:        doc.suggestions,
          wordCount:          doc.wordCount,
          sentenceCount:      doc.sentenceCount,
          readingTimeMinutes: doc.readingTimeMinutes,
          fleschGradeLevel:   doc.fleschGradeLevel,
          avgSentenceLength:  doc.avgSentenceLength,
          toneAnalysis:       doc.toneAnalysis,
          aiReasoning:        doc.aiReasoning,
          humanizationTips:   doc.humanizationTips ?? [],
          analyzedAt:         doc.analysisRunAt,
        },
        message: 'Returned from cache (text unchanged)',
      });
      return;
    }

    // ── 4. Mark as processing ──────────────────────────────────────────
    // Mark as processing (atomic — no save(), no version conflict)
    await DocumentModel.findByIdAndUpdate(id, { status: 'processing' });

    // ── 5. Run analysis ─────────────────────────────────────────────
    const analysis = await analyseDocument(doc.cleanedText);
    const analyzedAt = new Date();

    // ── 6. Persist results + hash ─────────────────────────────────────
    // Save results atomically — no save(), no VersionError possible
    const updated = await DocumentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          contentHash:        newHash,
          aiScore:            analysis.aiLikelihoodScore ?? null,
          grammarScore:       analysis.grammarScore      ?? null,
          plagiarismScore:    analysis.plagiarismScore   ?? 0,
          grammarIssues:      analysis.grammarIssues     ?? [],
          suggestions:        analysis.suggestions       ?? [],
          readabilityScore:   analysis.readabilityScore  ?? null,
          sentenceCount:      analysis.sentenceCount     ?? null,
          readingTimeMinutes: analysis.readingTimeMinutes ?? null,
          fleschGradeLevel:   analysis.fleschGradeLevel  ?? null,
          avgSentenceLength:  analysis.avgSentenceLength ?? null,
          toneAnalysis:       analysis.toneAnalysis      ?? null,
          aiReasoning:        analysis.aiReasoning       ?? null,
          humanizationTips:   analysis.humanizationTips  ?? [],
          analysisRunAt:      analyzedAt,
          status:             'analyzed',
        },
      },
      { new: true }
    );

    res.json({
      success: true,
      cached: false,
      remaining,
      data: {
        documentId:         id,
        aiLikelihoodScore:  updated?.aiScore,
        grammarScore:       updated?.grammarScore,
        plagiarismScore:    updated?.plagiarismScore,
        readabilityScore:   updated?.readabilityScore,
        grammarIssues:      updated?.grammarIssues,
        suggestions:        updated?.suggestions,
        wordCount:          doc.wordCount,
        sentenceCount:      analysis.sentenceCount,
        readingTimeMinutes: analysis.readingTimeMinutes,
        fleschGradeLevel:   analysis.fleschGradeLevel,
        avgSentenceLength:  analysis.avgSentenceLength,
        toneAnalysis:       analysis.toneAnalysis,
        aiReasoning:        analysis.aiReasoning,
        humanizationTips:   analysis.humanizationTips,
        analyzedAt,
      },
      message: 'Analysis complete',
    });
  } catch (err) {
    await DocumentModel.findByIdAndUpdate(id, { status: 'pending' });
    console.error('Analysis error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Analysis failed',
    });
  }
};
