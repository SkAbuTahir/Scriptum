'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Token } from './useScriptTokens';

const WORDS_PER_CHUNK = 150;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export type TTSStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'done';

export interface UseTTSPlaybackOptions {
  tokens:          Token[];
  script:          string;
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

function chunkTokens(tokens: Token[], size: number): Token[][] {
  const out: Token[][] = [];
  for (let i = 0; i < tokens.length; i += size) out.push(tokens.slice(i, i + size));
  return out.length > 0 ? out : [tokens];
}

export function useTTSPlayback({
  tokens,
  script: _script,
  onPointerChange,
  onStatusChange,
  onError,
}: UseTTSPlaybackOptions): UseTTSPlaybackReturn {

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const isActiveRef = useRef(false);
  const statusRef   = useRef<TTSStatus>('idle');

  // Keep latest callbacks in refs so helpers never rebuild on re-render.
  const onPointerRef = useRef(onPointerChange);
  const onStatusRef  = useRef(onStatusChange);
  const onErrorRef   = useRef(onError);
  const tokensRef    = useRef(tokens);

  useEffect(() => { onPointerRef.current = onPointerChange; }, [onPointerChange]);
  useEffect(() => { onStatusRef.current  = onStatusChange;  }, [onStatusChange]);
  useEffect(() => { onErrorRef.current   = onError;         }, [onError]);
  useEffect(() => { tokensRef.current    = tokens;          }, [tokens]);

  const setStatus = useCallback((s: TTSStatus) => {
    statusRef.current = s;
    onStatusRef.current(s);
  }, []);

  const clearAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onended      = null;
      audioRef.current.onerror      = null;
      audioRef.current.src          = '';
      audioRef.current              = null;
    }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  // ─── Fetch audio blob from server ────────────────────────────────────────────
  const fetchAudio = useCallback(async (text: string, signal: AbortSignal): Promise<string> => {
    const jwt = typeof window !== 'undefined' ? localStorage.getItem('ultimoversio_token') : null;
    const res = await fetch(API_BASE + '/api/deepgram/tts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (jwt ?? '') },
      body:    JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'HTTP ' + res.status);
      throw new Error('TTS ' + res.status + ': ' + msg);
    }
    const buf  = await res.arrayBuffer();
    const blob = new Blob([buf], { type: 'audio/mpeg' });
    if (blob.size < 100) throw new Error('Empty audio response from Deepgram');
    return URL.createObjectURL(blob);
  }, []);

  // ─── Play blob with ontimeupdate word-sync ───────────────────────────────────
  const playBlob = useCallback(
    (url: string, chunkStart: number, chunkLen: number): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!isActiveRef.current) { resolve(); return; }

        const audio        = new Audio(url);
        audioRef.current   = audio;

        audio.oncanplaythrough = () => {
          if (!isActiveRef.current) { resolve(); return; }
          audio.play().catch(reject);
        };

        // Real-time word pointer: maps audio.currentTime → word index
        audio.ontimeupdate = () => {
          if (!isActiveRef.current) return;
          const dur = audio.duration;
          if (!dur || !isFinite(dur)) return;
          const idx = Math.min(
            Math.floor((audio.currentTime / dur) * chunkLen),
            chunkLen - 1,
          );
          onPointerRef.current(chunkStart + idx);
        };

        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Audio playback error at chunk starting at token ' + chunkStart));
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const start = useCallback(async (): Promise<void> => {
    isActiveRef.current = false;
    clearAudio();
    isActiveRef.current = true;

    const toks = tokensRef.current;
    if (toks.length === 0) return;

    setStatus('loading');
    onPointerRef.current(0);

    const chunks = chunkTokens(toks, WORDS_PER_CHUNK);
    const ctrl   = new AbortController();
    abortRef.current = ctrl;

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (!isActiveRef.current) break;
        const chunk      = chunks[i];
        const chunkStart = i * WORDS_PER_CHUNK;
        const text       = chunk.map((t) => t.original).join(' ');

        const url = await fetchAudio(text, ctrl.signal);
        if (!isActiveRef.current) { URL.revokeObjectURL(url); break; }

        if (i === 0) setStatus('playing');
        await playBlob(url, chunkStart, chunk.length);
      }
      if (isActiveRef.current) {
        onPointerRef.current(tokensRef.current.length - 1);
        setStatus('done');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'TTS failed';
      console.error('[TTS]', msg);
      onErrorRef.current(msg);
      setStatus('error');
      clearAudio();
    }
  }, [clearAudio, fetchAudio, playBlob, setStatus]);

  const pause = useCallback((): void => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      setStatus('paused');
    }
  }, [setStatus]);

  const resume = useCallback((): void => {
    const audio = audioRef.current;
    if (audio && audio.paused && isActiveRef.current) {
      audio.play().catch((e: Error) => onErrorRef.current(e.message));
      setStatus('playing');
    }
  }, [setStatus]);

  const stop = useCallback((): void => {
    isActiveRef.current = false;
    clearAudio();
    setStatus('idle');
  }, [clearAudio, setStatus]);

  useEffect(() => () => { isActiveRef.current = false; clearAudio(); }, [clearAudio]);

  return { start, pause, resume, stop };
}
