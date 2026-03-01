'use client';

/**
 * useTTSPlayback
 * ──────────────
 * Fetches Deepgram Aura TTS audio from our backend, plays it,
 * and drives word-by-word highlighting via estimated token timings.
 *
 * Strategy:
 *  1. Split the script into ≤1800-char chunks at sentence boundaries.
 *  2. Precompute per-token expected startTime (cumulative estimated durations).
 *  3. Fetch all chunks as Blob URLs (prefetch ahead while current chunk plays).
 *  4. Play chunks sequentially using HTMLAudioElement.
 *  5. On each rAF tick, map audio.currentTime → globalTime → token index
 *     via binary search on the timings array.
 *  6. Call onPointerChange(tokenIndex) → parent applies DOM highlight + scroll.
 */

import { useRef, useCallback, useEffect } from 'react';
import { Token } from './useScriptTokens';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Deepgram Aura Draco speaking rate (words per minute) */
const WPM = 155;
const SEC_PER_WORD = 60 / WPM; // ~0.387 s

/** Extra pause added after sentence-ending punctuation */
const SENTENCE_PAUSE_SEC = 0.22;

/** Maximum characters per TTS API request */
const MAX_CHUNK_CHARS = 1800;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TTSStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'done';

interface TokenTiming {
  tokenIndex: number;
  /** Seconds from the very start of the full script */
  startTime: number;
}

export interface UseTTSPlaybackOptions {
  tokens: Token[];
  script: string;
  onPointerChange: (index: number) => void;
  onStatusChange:  (status: TTSStatus) => void;
  onError:         (msg: string) => void;
}

export interface UseTTSPlaybackReturn {
  start:  () => Promise<void>;
  pause:  () => void;
  resume: () => void;
  stop:   () => void;
}

// ─── Timing helpers ───────────────────────────────────────────────────────────

function estimateTokenDuration(token: Token): number {
  // Longer words take proportionally longer
  const chars   = Math.max(1, token.normalized.length);
  const wordDur = SEC_PER_WORD * Math.max(0.55, Math.min(2.2, chars / 5));
  // Add silence after sentence-ending punctuation
  const pause   = /[.!?;:]+$/.test(token.original) ? SENTENCE_PAUSE_SEC : 0;
  return wordDur + pause;
}

function buildTimings(tokens: Token[]): TokenTiming[] {
  const timings: TokenTiming[] = [];
  let t = 0;
  for (const token of tokens) {
    timings.push({ tokenIndex: token.index, startTime: t });
    t += estimateTokenDuration(token);
  }
  return timings;
}

/** Binary search: last timing whose startTime ≤ globalTime */
function findTokenAt(timings: TokenTiming[], globalTime: number): number {
  if (timings.length === 0) return 0;
  let lo = 0, hi = timings.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timings[mid].startTime <= globalTime) lo = mid;
    else hi = mid - 1;
  }
  return timings[lo].tokenIndex;
}

// ─── Script chunker ───────────────────────────────────────────────────────────

function chunkScript(script: string): string[] {
  // Split on sentence boundaries; accumulate into chunks ≤ MAX_CHUNK_CHARS
  const sentences = script.match(/[^.!?\n]+[.!?\n]*/g) ?? [script];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [script];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTTSPlayback({
  tokens,
  script,
  onPointerChange,
  onStatusChange,
  onError,
}: UseTTSPlaybackOptions): UseTTSPlaybackReturn {

  const audioRef           = useRef<HTMLAudioElement | null>(null);
  const timingsRef         = useRef<TokenTiming[]>([]);
  const chunkStartTimesRef = useRef<number[]>([]);   // global start time of each audio chunk
  const blobUrlsRef        = useRef<(string | null)[]>([]);
  const currentChunkRef    = useRef<number>(0);
  const isActiveRef        = useRef<boolean>(false);
  const rafRef             = useRef<number>(0);
  const statusRef          = useRef<TTSStatus>('idle');

  const setStatus = useCallback((s: TTSStatus) => {
    statusRef.current = s;
    onStatusChange(s);
  }, [onStatusChange]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    isActiveRef.current = false;
    cancelAnimationFrame(rafRef.current);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended  = null;
      audioRef.current.onerror  = null;
      audioRef.current.src      = '';
      audioRef.current          = null;
    }

    blobUrlsRef.current.forEach((url) => { if (url) URL.revokeObjectURL(url); });
    blobUrlsRef.current = [];
  }, []);

  // ── Fetch one chunk → blob URL ────────────────────────────────────────────

  const fetchChunk = useCallback(async (text: string): Promise<string> => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('scriptum_token')
      : null;

    const res = await fetch(`${API_BASE}/api/deepgram/tts`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify({ text, model: 'aura-2-draco-en' }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`TTS error ${res.status}: ${msg}`);
    }

    const buffer = await res.arrayBuffer();
    const blob   = new Blob([buffer], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }, []);

  // ── rAF ticker: maps currentTime → token pointer ──────────────────────────

  const startTicker = useCallback((audio: HTMLAudioElement, chunkIndex: number) => {
    cancelAnimationFrame(rafRef.current);

    const tick = () => {
      if (!isActiveRef.current) return;
      if (!audio.paused && !audio.ended) {
        const globalTime = chunkStartTimesRef.current[chunkIndex] + audio.currentTime;
        onPointerChange(findTokenAt(timingsRef.current, globalTime));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [onPointerChange]);

  // ── Play a single chunk ───────────────────────────────────────────────────

  const playChunk = useCallback((chunkIndex: number, onDone: () => void): void => {
    const url = blobUrlsRef.current[chunkIndex];
    if (!url || !isActiveRef.current) return;

    const audio = new Audio(url);
    audioRef.current = audio;
    currentChunkRef.current = chunkIndex;

    startTicker(audio, chunkIndex);

    audio.onended = () => {
      cancelAnimationFrame(rafRef.current);
      onDone();
    };

    audio.onerror = () => {
      cancelAnimationFrame(rafRef.current);
      onError(`Audio playback error on chunk ${chunkIndex}`);
      setStatus('error');
    };

    audio.play().catch((e: Error) => {
      onError(`Playback failed: ${e.message}`);
      setStatus('error');
    });
  }, [onError, setStatus, startTicker]);

  // ── Main start ─────────────────────────────────────────────────────────────

  const start = useCallback(async (): Promise<void> => {
    cleanup();
    setStatus('loading');
    isActiveRef.current = true;

    try {
      // 1. Build per-token timings
      timingsRef.current = buildTimings(tokens);

      // 2. Chunk the script
      const chunks = chunkScript(script);
      blobUrlsRef.current = new Array(chunks.length).fill(null);

      // 3. Compute global start time for each chunk using proportional token lookup
      const chunkStartTimes: number[] = [0];
      let charOffset = 0;
      for (let i = 0; i < chunks.length - 1; i++) {
        charOffset += chunks[i].length;
        const proportion     = charOffset / Math.max(1, script.length);
        const approxIndex    = Math.floor(proportion * tokens.length);
        const t              = timingsRef.current[Math.min(approxIndex, timingsRef.current.length - 1)]?.startTime ?? 0;
        chunkStartTimes.push(t);
      }
      chunkStartTimesRef.current = chunkStartTimes;

      // 4. Fetch first chunk immediately, then prefetch the rest in background
      const firstUrl = await fetchChunk(chunks[0]);
      if (!isActiveRef.current) return;
      blobUrlsRef.current[0] = firstUrl;

      // Kick off background prefetch for remaining chunks
      (async () => {
        for (let i = 1; i < chunks.length; i++) {
          if (!isActiveRef.current) break;
          try {
            const url = await fetchChunk(chunks[i]);
            blobUrlsRef.current[i] = url;
          } catch {
            // non-fatal: chunk will be retried in playNext via waitForBlob
          }
        }
      })();

      setStatus('playing');

      // 5. Play chunks sequentially
      let chunkIndex = 0;

      const playNext = () => {
        if (!isActiveRef.current) return;

        if (chunkIndex >= chunks.length) {
          setStatus('done');
          return;
        }

        const tryPlay = () => {
          if (!isActiveRef.current) return;
          if (blobUrlsRef.current[chunkIndex]) {
            playChunk(chunkIndex, () => {
              chunkIndex++;
              playNext();
            });
          } else {
            // Blob not ready yet; retry in 150 ms
            setTimeout(tryPlay, 150);
          }
        };

        tryPlay();
      };

      playNext();

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TTS failed';
      onError(msg);
      setStatus('error');
      cleanup();
    }
  }, [cleanup, fetchChunk, onError, playChunk, script, setStatus, tokens]);

  // ── Pause / Resume / Stop ────────────────────────────────────────────────

  const pause = useCallback((): void => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      cancelAnimationFrame(rafRef.current);
      setStatus('paused');
    }
  }, [setStatus]);

  const resume = useCallback((): void => {
    const audio = audioRef.current;
    if (audio && audio.paused && isActiveRef.current) {
      audio.play().catch(() => {});
      startTicker(audio, currentChunkRef.current);
      setStatus('playing');
    }
  }, [setStatus, startTicker]);

  const stop = useCallback((): void => {
    setStatus('idle');
    cleanup();
  }, [cleanup, setStatus]);

  // ── Unmount cleanup ───────────────────────────────────────────────────────

  useEffect(() => () => cleanup(), [cleanup]);

  return { start, pause, resume, stop };
}
