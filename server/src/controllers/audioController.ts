import { Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import DocumentModel from '../models/Document';
import AudioSegmentModel from '../models/AudioSegment';
import { generateNarrationBatch } from '../services/narration';
import { extractAllSentences } from '../services/documentStructure';
import { AuthenticatedRequest } from '../types';

export const generateAudioValidation = [
  body('documentId').isMongoId().withMessage('Invalid document ID'),
  body('provider')
    .optional()
    .isIn(['elevenlabs', 'google'])
    .withMessage('Provider must be elevenlabs or google'),
];

export const generateAudio = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  const { documentId, provider = 'elevenlabs' } = req.body as {
    documentId: string;
    provider?: 'elevenlabs' | 'google';
  };

  try {
    const doc = await DocumentModel.findOne({
      _id: documentId,
      userId: req.user!.userId,
    });

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    // Check API key is configured
    if (provider === 'elevenlabs' && !process.env.ELEVENLABS_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'ElevenLabs API key is not configured on this server',
      });
      return;
    }
    if (provider === 'google' && !process.env.GOOGLE_TTS_KEY) {
      res.status(503).json({
        success: false,
        error: 'Google TTS API key is not configured on this server',
      });
      return;
    }

    const sentences = extractAllSentences(doc.structuredContent);

    if (sentences.length === 0) {
      res.status(400).json({ success: false, error: 'No sentences to narrate' });
      return;
    }

    // Delete existing audio segments
    await AudioSegmentModel.deleteMany({ documentId });

    const segments = await generateNarrationBatch(documentId, sentences, provider);

    // Bulk insert new segments
    const segmentDocs = segments.map((seg, idx) => ({
      documentId,
      sentenceIndex: idx,
      sentenceText: seg.sentenceText,
      audioUrl: seg.audioUrl,
      localPath: '',
      duration: seg.duration,
      provider,
      voiceId: process.env.ELEVENLABS_VOICE_ID || '',
    }));

    const saved = await AudioSegmentModel.insertMany(segmentDocs);

    res.json({
      success: true,
      data: {
        documentId,
        totalSegments: saved.length,
        segments: saved.map((s) => ({
          id: s._id,
          sentenceIndex: s.sentenceIndex,
          sentenceText: s.sentenceText,
          audioUrl: s.audioUrl,
          duration: s.duration,
        })),
      },
      message: `Generated ${saved.length} audio segments`,
    });
  } catch (err) {
    console.error('Audio generation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Audio generation failed',
    });
  }
};

export const getAudioSegments = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  try {
    const { documentId } = req.params;
    const doc = await DocumentModel.findOne({ _id: documentId, userId: req.user!.userId });
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const segments = await AudioSegmentModel.find({ documentId }).sort({ sentenceIndex: 1 });

    res.json({ success: true, data: segments });
  } catch (err) {
    console.error('getAudioSegments error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audio segments' });
  }
};

export const getAudioSegmentsValidation = [
  param('documentId').isMongoId().withMessage('Invalid document ID'),
];
