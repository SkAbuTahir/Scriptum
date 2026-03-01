import { Response } from 'express';
import { param, validationResult } from 'express-validator';
import DocumentModel from '../models/Document';
import { analyseDocument } from '../services/aiAnalysis';
import { AuthenticatedRequest } from '../types';

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
    // Use lean() — plain JS object, no Mongoose version tracking
    const doc = await DocumentModel.findOne({
      _id: id,
      userId: req.user!.userId,
    }).lean();

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    // Mark as processing (atomic — no save(), no version conflict)
    await DocumentModel.findByIdAndUpdate(id, { status: 'processing' });

    const analysis = await analyseDocument(doc.cleanedText);

    const analyzedAt = new Date();

    // Save results atomically — no save(), no VersionError possible
    const updated = await DocumentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          aiScore:          analysis.aiLikelihoodScore ?? null,
          grammarScore:     analysis.grammarScore      ?? null,
          plagiarismScore:  analysis.plagiarismScore   ?? 0,
          grammarIssues:    analysis.grammarIssues     ?? [],
          suggestions:      analysis.suggestions       ?? [],
          readabilityScore: analysis.readabilityScore  ?? null,
          analysisRunAt:    analyzedAt,
          status:           'analyzed',
        },
      },
      { new: true }
    );

    res.json({
      success: true,
      data: {
        documentId:        id,
        aiLikelihoodScore: updated?.aiScore,
        grammarScore:      updated?.grammarScore,
        plagiarismScore:   updated?.plagiarismScore,
        readabilityScore:  updated?.readabilityScore,
        grammarIssues:     updated?.grammarIssues,
        suggestions:       updated?.suggestions,
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
