import { Request } from 'express';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ─── Document ────────────────────────────────────────────────────────────────

export interface NarrationSegment {
  text: string;
  audioUrl?: string;
  duration?: number;
}

export interface DocumentSection {
  title: string;
  paragraphs: string[];
  narrationSegments: NarrationSegment[];
}

export interface StructuredContent {
  sections: DocumentSection[];
}

export interface GrammarIssue {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: string[];
  context: string;
  rule: {
    id: string;
    description: string;
    category: string;
  };
}

export interface AISuggestion {
  type: 'rewrite' | 'simplify' | 'expand' | 'tone';
  original: string;
  suggested: string;
  reason: string;
}

export interface AnalysisResult {
  aiLikelihoodScore: number | null;  // 0–100 probability, null if unavailable
  grammarIssues: GrammarIssue[];
  plagiarismScore: number;         // 0–100
  suggestions: AISuggestion[];
  readabilityScore?: number;
  wordCount?: number;
  sentenceCount?: number;
  analyzedAt: Date;
}

export interface ExtractedContent {
  rawText: string;
  cleanedText: string;
  structuredSections: DocumentSection[];
  wordCount: number;
  sourceType: 'docx' | 'pdf' | 'txt' | 'youtube';
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export interface UploadResult {
  documentId: string;
  originalFileName: string;
  rawText: string;
  cleanedText: string;
  wordCount: number;
  sourceType: string;
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export interface AudioSegmentData {
  documentId: string;
  sentenceText: string;
  audioUrl: string;
  duration: number;
}

export interface NarrationJob {
  documentId: string;
  text: string;
  voice?: string;
  provider: 'elevenlabs' | 'google';
}

// ─── Export ──────────────────────────────────────────────────────────────────

export interface PPTExportOptions {
  title: string;
  theme?: 'light' | 'dark' | 'professional';
  includeNotes?: boolean;
}

export interface VideoExportOptions {
  resolution: '720p' | '1080p';
  fps: number;
  includeAudio: boolean;
  voiceId?: string;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
