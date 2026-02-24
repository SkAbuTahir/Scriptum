import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const narrationSegmentSchema = new Schema(
  {
    text: { type: String, required: true },
    audioUrl: { type: String, default: null },
    duration: { type: Number, default: null },
  },
  { _id: false }
);

const documentSectionSchema = new Schema(
  {
    title: { type: String, required: true },
    paragraphs: [{ type: String }],
    narrationSegments: [narrationSegmentSchema],
  },
  { _id: true }
);

const grammarIssueSchema = new Schema(
  {
    message: String,
    shortMessage: String,
    offset: Number,
    length: Number,
    replacements: [String],
    context: String,
    rule: {
      id: String,
      description: String,
      category: String,
    },
  },
  { _id: false }
);

const suggestionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['rewrite', 'simplify', 'expand', 'tone'],
    },
    original: String,
    suggested: String,
    reason: String,
  },
  { _id: false }
);

// ─── Main Document Interface ──────────────────────────────────────────────────

export interface IDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  originalFileName: string;
  sourceType: 'docx' | 'pdf' | 'txt' | 'youtube';
  youtubeUrl?: string;
  rawText: string;
  cleanedText: string;
  structuredContent: {
    sections: Array<{
      _id?: mongoose.Types.ObjectId;
      title: string;
      paragraphs: string[];
      narrationSegments: Array<{
        text: string;
        audioUrl?: string;
        duration?: number;
      }>;
    }>;
  };
  wordCount: number;
  aiScore: number | null;
  plagiarismScore: number | null;
  readabilityScore: number | null;
  grammarIssues: Array<{
    message: string;
    shortMessage?: string;
    offset: number;
    length: number;
    replacements: string[];
    context: string;
    rule: { id: string; description: string; category: string };
  }>;
  suggestions: Array<{
    type: string;
    original: string;
    suggested: string;
    reason: string;
  }>;
  analysisRunAt: Date | null;
  status: 'pending' | 'processing' | 'analyzed' | 'ready';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const documentSchema = new Schema<IDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ['docx', 'pdf', 'txt', 'youtube'],
      required: true,
    },
    youtubeUrl: {
      type: String,
      default: null,
    },
    rawText: {
      type: String,
      required: true,
    },
    cleanedText: {
      type: String,
      required: true,
    },
    structuredContent: {
      sections: [documentSectionSchema],
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    aiScore: {
      type: Number,
      default: null,
    },
    plagiarismScore: {
      type: Number,
      default: null,
    },
    readabilityScore: {
      type: Number,
      default: null,
    },
    grammarIssues: [grammarIssueSchema],
    suggestions: [suggestionSchema],
    analysisRunAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'analyzed', 'ready'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Text index for search
documentSchema.index({ cleanedText: 'text', originalFileName: 'text' });

const DocumentModel: Model<IDocument> = mongoose.model<IDocument>('Document', documentSchema);
export default DocumentModel;
