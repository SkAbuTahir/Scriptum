import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAudioSegment extends Document {
  _id: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  sentenceIndex: number;
  sentenceText: string;
  audioUrl: string;
  localPath: string;
  duration: number;          // in seconds
  provider: 'elevenlabs' | 'google' | 'browser';
  voiceId: string;
  createdAt: Date;
}

const audioSegmentSchema = new Schema<IAudioSegment>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    sentenceIndex: {
      type: Number,
      required: true,
    },
    sentenceText: {
      type: String,
      required: true,
    },
    audioUrl: {
      type: String,
      required: true,
    },
    localPath: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0,
    },
    provider: {
      type: String,
      enum: ['elevenlabs', 'google', 'browser'],
      default: 'elevenlabs',
    },
    voiceId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one segment per sentence per document
audioSegmentSchema.index({ documentId: 1, sentenceIndex: 1 }, { unique: true });

const AudioSegment: Model<IAudioSegment> = mongoose.model<IAudioSegment>('AudioSegment', audioSegmentSchema);
export default AudioSegment;
