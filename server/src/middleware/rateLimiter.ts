import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

/**
 * General API rate limiter – 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again after 15 minutes.',
  },
});

/**
 * Auth endpoints – stricter: 10 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

/**
 * AI analysis endpoints – expensive: 20 requests per hour per IP
 */
export const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI analysis rate limit reached. Please try again after 1 hour.',
  },
});

/**
 * Upload endpoint – 10 uploads per 30 minutes per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Upload limit reached. Please try again after 30 minutes.',
  },
});

/**
 * Deepgram temp-key endpoint – 10 keys per user per hour
 * Prevents abuse of our primary Deepgram API key.
 */
export const deepgramTokenLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Deepgram token rate limit reached. Please try again after 1 hour.',
  },
});

// ─── Per-User Gemini analysis rate limiter ─────────────────────────────────
// Tracks each authenticated user by userId (not by IP).
// Limit: 10 Gemini analysis calls per user per hour.
// Uses in-memory Map (resets on server restart — sufficient for dev/MVP).

const USER_WINDOW_MS   = 60 * 60 * 1000; // 1 hour
const USER_MAX_CALLS   = 10;             // max Gemini calls per hour per user

interface UserBucket { count: number; resetAt: number; }
const _userBuckets = new Map<string, UserBucket>();

// Prune stale buckets every 10 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [id, b] of _userBuckets) {
    if (now >= b.resetAt) _userBuckets.delete(id);
  }
}, 10 * 60 * 1000);

export function checkUserAnalysisLimit(
  userId: string
): { allowed: boolean; retryAfterMs: number } {
  const now    = Date.now();
  const bucket = _userBuckets.get(userId);

  if (!bucket || now >= bucket.resetAt) {
    _userBuckets.set(userId, { count: 1, resetAt: now + USER_WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= USER_MAX_CALLS) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/** How many calls the user has left this window (for debug/UI) */
export function userAnalysisRemaining(userId: string): number {
  const now    = Date.now();
  const bucket = _userBuckets.get(userId);
  if (!bucket || now >= bucket.resetAt) return USER_MAX_CALLS;
  return Math.max(0, USER_MAX_CALLS - bucket.count);
}
