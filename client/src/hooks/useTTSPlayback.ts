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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const isActiveRef = useRef(false);
  const statusRef   = useRef<TTSStatus>('idle');

  // Store latest callbacks in refs so ALL hook functions stay stable forever.
  // Without this, inline callback props change identity each render, causing
  // useCallback to rebuild stop/start, the engine's useEffect cleanup fires
  // the old ttsStop mid-playback, which aborts the AbortController => status 0.
  const onPointerRef = useRef(onPointerChange);
  const onStatusRef  = useRef(onStatusChange);
  const onErrorRef   = useRef(onError);
  const tokensRef    = useRef(tokens);

  useEffect(() => { onPointerRef.current = onPointerChange; }, [onPointerChange]);
  useEffect(() => { onStatusRef.current  = onStatusChange;  }, [onStatusChange]);
  useEffect(() => { onErrorRef.current   = onError;         }, [onError]);
  useEffect(() => { tokensRef.current    = tokens;          }, [tokens]);

  // All helpers below have empty or minimal deps — they never rebuild.

  const setStatus = useCallback((s: TTSStatus) => {
    statusRef.current = s;
    onStatusRef.current(s);
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (audioRef.current)    { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    if (abortRef.current)    { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  const fetchAudio = useCallback(async (text: string, signal: AbortSignal): Promise<string> => {
    const jwt = typeof window !== 'undefined' ? localStorage.getItem('scriptum_token') : null;
    try {
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
    } catch (err) {
      // Fallback to browser TTS if Deepgram fails
      console.warn('[TTS] Deepgram failed, using browser TTS:', err);
      throw err; // Let caller handle fallback
    }
  }, []);

  const playBlob = useCallback(
    (url: string, startIdx: number, len: number): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!isActiveRef.current) { resolve(); return; }

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.oncanplaythrough = () => {
          if (!isActiveRef.current) { resolve(); return; }

          const dur       = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : len * 0.38;
          const msPerWord = (dur * 1000) / Math.max(len, 1);

          console.log('[TTS] chunk start=' + startIdx + ' words=' + len + ' dur=' + dur.toFixed(1) + 's ms/word=' + msPerWord.toFixed(0));

          let localIdx = 0;
          onPointerRef.current(startIdx);

          intervalRef.current = setInterval(() => {
            if (!isActiveRef.current) { clearInterval(intervalRef.current!); return; }
            if (localIdx < len - 1) {
              localIdx++;
              onPointerRef.current(startIdx + localIdx);
            } else {
              clearInterval(intervalRef.current!);
              intervalRef.current = null;
            }
          }, msPerWord);

          audio.play().catch(reject);
        };

        audio.onended = () => {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          URL.revokeObjectURL(url);
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Audio error at token ' + startIdx));
        };
      }),
    [],
  );

  const start = useCallback(async (): Promise<void> => {
    isActiveRef.current = false;
    clearTimers();
    isActiveRef.current = true;

    const toks = tokensRef.current;
    if (toks.length === 0) return;

    setStatus('loading');

    const chunks = chunkTokens(toks, WORDS_PER_CHUNK);
    const ctrl   = new AbortController();
    abortRef.current = ctrl;

    onPointerRef.current(0);

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (!isActiveRef.current) break;
        const chunk     = chunks[i];
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
      clearTimers();
    }
  }, [clearTimers, fetchAudio, playBlob, setStatus]);

  const pause = useCallback((): void => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
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
    clearTimers();
    setStatus('idle');
  }, [clearTimers, setStatus]);

  useEffect(() => () => { isActiveRef.current = false; clearTimers(); }, [clearTimers]);

  return { start, pause, resume, stop };
}
