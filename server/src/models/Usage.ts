import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUsage extends Document {
  userId: mongoose.Types.ObjectId;
  geminiCallsThisHour: number;
  lastResetAt: Date;
  totalGeminiCalls: number;
  totalAnalyses: number;
  createdAt: Date;
  updatedAt: Date;
}

const usageSchema = new Schema<IUsage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    geminiCallsThisHour: {
      type: Number,
      default: 0,
    },
    lastResetAt: {
      type: Date,
      default: () => new Date(),
    },
    totalGeminiCalls: {
      type: Number,
      default: 0,
    },
    totalAnalyses: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const HOUR_MS = 60 * 60 * 1000;
const MAX_CALLS_PER_HOUR = 10;

/**
 * Get or create usage record for a user.
 * Auto-resets hourly counter if the window has elapsed.
 */
export async function getOrResetUsage(userId: string): Promise<IUsage> {
  let usage = await UsageModel.findOne({ userId });

  if (!usage) {
    usage = await UsageModel.create({ userId });
    return usage;
  }

  const now = Date.now();
  if (now - usage.lastResetAt.getTime() >= HOUR_MS) {
    usage.geminiCallsThisHour = 0;
    usage.lastResetAt = new Date();
    await usage.save();
  }

  return usage;
}

/**
 * Check if user can make a Gemini call. Returns remaining count and allowed flag.
 */
export async function checkAndIncrementUsage(
  userId: string
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const usage = await getOrResetUsage(userId);

  if (usage.geminiCallsThisHour >= MAX_CALLS_PER_HOUR) {
    const retryAfterMs = Math.max(0, HOUR_MS - (Date.now() - usage.lastResetAt.getTime()));
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  usage.geminiCallsThisHour += 1;
  usage.totalGeminiCalls += 1;
  usage.totalAnalyses += 1;
  await usage.save();

  return {
    allowed: true,
    remaining: MAX_CALLS_PER_HOUR - usage.geminiCallsThisHour,
    retryAfterMs: 0,
  };
}

/**
 * Get current usage stats for display.
 */
export async function getUserUsageStats(userId: string): Promise<{
  geminiCallsThisHour: number;
  maxCallsPerHour: number;
  remaining: number;
  totalGeminiCalls: number;
  totalAnalyses: number;
  resetsAt: string;
}> {
  const usage = await getOrResetUsage(userId);
  const resetsAt = new Date(usage.lastResetAt.getTime() + HOUR_MS).toISOString();

  return {
    geminiCallsThisHour: usage.geminiCallsThisHour,
    maxCallsPerHour: MAX_CALLS_PER_HOUR,
    remaining: Math.max(0, MAX_CALLS_PER_HOUR - usage.geminiCallsThisHour),
    totalGeminiCalls: usage.totalGeminiCalls,
    totalAnalyses: usage.totalAnalyses,
    resetsAt,
  };
}

const UsageModel: Model<IUsage> = mongoose.model<IUsage>('Usage', usageSchema);
export default UsageModel;
