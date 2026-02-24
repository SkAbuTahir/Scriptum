import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import DocumentModel from '../models/Document';
import { extractContent } from '../services/textExtraction';
import { structureDocument } from '../services/documentStructure';
import { deleteFile } from '../utils/fileFilter';
import { AuthenticatedRequest, ApiResponse, UploadResult } from '../types';

// ─── Upload File ──────────────────────────────────────────────────────────────

export const uploadFile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  try {
    const extracted = await extractContent({
      filePath: file.path,
      mimeType: file.mimetype,
      originalname: file.originalname,
    });

    const structured = structureDocument(extracted.cleanedText, extracted.structuredSections);

    const sourceType = extracted.sourceType;

    const doc = await DocumentModel.create({
      userId: req.user!.userId,
      originalFileName: file.originalname,
      sourceType,
      rawText: extracted.rawText,
      cleanedText: extracted.cleanedText,
      structuredContent: structured,
      wordCount: extracted.wordCount,
      status: 'pending',
    });

    // Clean up uploaded file (content is stored in DB)
    deleteFile(file.path);

    const response: ApiResponse<UploadResult> = {
      success: true,
      data: {
        documentId: doc._id.toString(),
        originalFileName: doc.originalFileName,
        rawText: doc.rawText,
        cleanedText: doc.cleanedText,
        wordCount: doc.wordCount,
        sourceType: doc.sourceType,
      },
      message: 'File uploaded and processed successfully',
    };

    res.status(201).json(response);
  } catch (err) {
    if (file?.path) deleteFile(file.path);
    console.error('Upload error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Upload processing failed',
    });
  }
};

// ─── Upload YouTube URL ───────────────────────────────────────────────────────

export const uploadYouTubeValidation = [
  body('youtubeUrl')
    .trim()
    .notEmpty()
    .withMessage('YouTube URL is required')
    .matches(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    .withMessage('Invalid YouTube URL format'),
];

export const uploadYouTube = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  const { youtubeUrl } = req.body as { youtubeUrl: string };

  try {
    const extracted = await extractContent({ youtubeUrl });
    const structured = structureDocument(extracted.cleanedText, extracted.structuredSections);

    const doc = await DocumentModel.create({
      userId: req.user!.userId,
      originalFileName: `YouTube: ${youtubeUrl}`,
      sourceType: 'youtube',
      youtubeUrl,
      rawText: extracted.rawText,
      cleanedText: extracted.cleanedText,
      structuredContent: structured,
      wordCount: extracted.wordCount,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      data: {
        documentId: doc._id.toString(),
        originalFileName: doc.originalFileName,
        rawText: doc.rawText,
        cleanedText: doc.cleanedText,
        wordCount: doc.wordCount,
        sourceType: 'youtube',
      },
      message: 'YouTube transcript processed successfully',
    });
  } catch (err) {
    console.error('YouTube upload error:', err);
    const message = err instanceof Error ? err.message : 'YouTube processing failed';
    // Transcript errors are user/content errors → 400, not 500
    const isUserError = message.includes('transcript') ||
      message.includes('caption') ||
      message.includes('private') ||
      message.includes('disabled') ||
      message.includes('Invalid YouTube');
    res.status(isUserError ? 400 : 500).json({
      success: false,
      error: message,
    });
  }
};
