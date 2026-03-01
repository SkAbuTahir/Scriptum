import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import DocumentModel from '../models/Document';
import { generatePowerPoint } from '../services/pptExport';
import { generatePdf } from '../services/pdfExport';
import { generateDocx } from '../services/docxExport';
import { AuthenticatedRequest } from '../types';

export const exportPptValidation = [
  body('documentId').isMongoId().withMessage('Invalid document ID'),
  body('title').optional().isString().trim(),
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'professional'])
    .withMessage('Theme must be light, dark, or professional'),
  body('includeNotes').optional().isBoolean(),
];

export const exportPpt = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  const {
    documentId,
    title,
    theme = 'professional',
    includeNotes = false,
  } = req.body as {
    documentId: string;
    title?: string;
    theme?: 'light' | 'dark' | 'professional';
    includeNotes?: boolean;
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

    const pptTitle = title || doc.originalFileName.replace(/\.[^.]+$/, '');

    const buffer = await generatePowerPoint(doc.structuredContent, {
      title: pptTitle,
      theme,
      includeNotes,
    });

    const safeFileName = pptTitle
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pptx"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (err) {
    console.error('PPT export error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Export failed',
    });
  }
};

// ─── Export PDF ────────────────────────────────────────────────────────────────

export const exportPdfValidation = [
  body('documentId').isMongoId().withMessage('Invalid document ID'),
  body('title').optional().isString().trim(),
];

export const exportPdf = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  const { documentId, title } = req.body as { documentId: string; title?: string };

  try {
    const doc = await DocumentModel.findOne({
      _id: documentId,
      userId: req.user!.userId,
    });

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const pdfTitle = title || doc.originalFileName.replace(/\.[^.]+$/, '');
    const buffer = await generatePdf(doc.structuredContent, { title: pdfTitle });

    const safeFileName = pdfTitle
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'PDF export failed',
    });
  }
};

// ─── Export DOCX ──────────────────────────────────────────────────────────────

export const exportDocxValidation = [
  body('documentId').isMongoId().withMessage('Invalid document ID'),
  body('title').optional().isString().trim(),
];

export const exportDocx = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  const { documentId, title } = req.body as { documentId: string; title?: string };

  try {
    const doc = await DocumentModel.findOne({
      _id: documentId,
      userId: req.user!.userId,
    });

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const docxTitle = title || doc.originalFileName.replace(/\.[^.]+$/, '');
    const buffer = await generateDocx(doc.structuredContent, { title: docxTitle });

    const safeFileName = docxTitle
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.docx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('DOCX export error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'DOCX export failed',
    });
  }
};

// ─── Video Export (Future / Remotion placeholder) ─────────────────────────────

export const exportVideo = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  res.status(501).json({
    success: false,
    error: 'Video export is not yet available. This feature is planned for Phase 3.',
    planned: true,
  });
};
