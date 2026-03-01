'use client';

import { useRef, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'error'
  | 'stopped';

export interface UseDeepgramSyncOptions {
  /** Called with each transcript chunk (interim or final) */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Called when status changes */
  onStatusChange: (status: SyncStatus) => void;
  /** Called on unrecoverable error */
  onError: (message: string) => void;
  /** Max session duration in ms (default: 15 min) */
  maxDurationMs?: number;
}

export interface UseDeepgramSyncReturn {
  start: () => Promise<void>;
  stop: () => void;
  status: React.MutableRefObject<SyncStatus>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the entire Deepgram real-time transcription lifecycle:
 *
 *  1. Fetches a short-lived API key from our backend (/api/deepgram/token)
 *  2. Opens a mic MediaStream
 *  3. Opens a WebSocket to Deepgram's streaming endpoint
 *  4. Pipes mic audio → WS; WS transcription events → onTranscript
 *  5. Enforces max session duration
 *  6. Cleans up on unmount
 */
export function useDeepgramSync(options: UseDeepgramSyncOptions): UseDeepgramSyncReturn {
  const { onTranscript, onStatusChange, onError, maxDurationMs = 15 * 60 * 1000 } = options;

  const statusRef        = useRef<SyncStatus>('idle');
  const wsRef            = useRef<WebSocket | null>(null);
  const mediaStreamRef   = useRef<MediaStream | null>(null);
  const processorRef     = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const sessionTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useCallback((s: SyncStatus) => {
    statusRef.current = s;
    onStatusChange(s);
  }, [onStatusChange]);

  // ── Cleanup helper ────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    // Stop media tracks
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    // Disconnect script processor
    processorRef.current?.disconnect();
    processorRef.current = null;

    // Close audio context
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    // Close WebSocket
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close(1000, 'session ended');
    }
    wsRef.current = null;

    // Clear session timer
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, []);

  // ── Fetch temporary key from our backend ─────────────────────────────────

  const fetchTempKey = useCallback(async (): Promise<string> => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('scriptum_token')
      : null;

    const res = await fetch(`${API_BASE}/api/deepgram/token`, {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
      },
    });

    if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);

    const json = (await res.json()) as { success: boolean; data?: { key: string } };
    if (!json.success || !json.data?.key) throw new Error('Invalid token response');

    return json.data.key;
  }, []);

  // ── Start session ─────────────────────────────────────────────────────────

  const start = useCallback(async (): Promise<void> => {
    if (statusRef.current === 'listening' || statusRef.current === 'connecting') return;

    setStatus('connecting');

    try {
      // 1. Get mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      // 2. Get temp key
      const tempKey = await fetchTempKey();

      // 3. Open Deepgram WebSocket
      const wsUrl = [
        'wss://api.deepgram.com/v1/listen',
        '?model=nova-3',
        '&language=en-US',
        '&punctuate=true',
        '&interim_results=true',
        '&endpointing=300',
        '&utterance_end_ms=1000',
      ].join('');

      const ws = new WebSocket(wsUrl, ['token', tempKey]);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('listening');

        // 4. Pipe mic audio via ScriptProcessor → WS
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const source    = audioCtx.createMediaStreamSource(stream);
        // bufferSize 4096 gives ~256 ms chunks at 16 kHz — good balance
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const pcm  = e.inputBuffer.getChannelData(0);
          const i16  = floatTo16BitPCM(pcm);
          ws.send(i16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

        // 5. Enforce max session duration
        sessionTimerRef.current = setTimeout(() => {
          onError('Max session duration reached (15 min). Mic stopped.');
          stop(); // eslint-disable-line @typescript-eslint/no-use-before-define
        }, maxDurationMs);
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as DeepgramTranscriptMessage;
          if (msg.type !== 'Results') return;

          const channel   = msg.channel?.alternatives?.[0];
          const transcript = channel?.transcript ?? '';
          if (!transcript) return;

          const isFinal = msg.is_final ?? false;
          onTranscript(transcript, isFinal);
        } catch {
          // parse error — ignore silently
        }
      };

      ws.onerror = () => {
        setStatus('error');
        onError('WebSocket connection to Deepgram failed');
        cleanup();
      };

      ws.onclose = (e: CloseEvent) => {
        if (statusRef.current !== 'stopped') {
          setStatus('stopped');
        }
        if (e.code !== 1000) {
          onError(`Connection closed unexpectedly (code ${e.code})`);
        }
        cleanup();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');

      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        onError('Microphone permission denied. Please allow mic access and try again.');
      } else {
        onError(message);
      }

      cleanup();
    }
  }, [cleanup, fetchTempKey, maxDurationMs, onError, onTranscript, setStatus]);

  // ── Stop session ──────────────────────────────────────────────────────────

  const stop = useCallback((): void => {
    setStatus('stopped');
    cleanup();
  }, [cleanup, setStatus]);

  // ── Unmount cleanup ───────────────────────────────────────────────────────

  useEffect(() => () => { cleanup(); }, [cleanup]);

  return { start, stop, status: statusRef };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

// ─── Deepgram message types ───────────────────────────────────────────────────

interface DeepgramTranscriptMessage {
  type: string;
  is_final?: boolean;
  channel?: {
    alternatives?: Array<{ transcript: string }>;
  };
}
