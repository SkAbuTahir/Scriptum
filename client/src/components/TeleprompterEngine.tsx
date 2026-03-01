'use client';

/**
 * TeleprompterEngine
 * ──────────────────
 * Three-layer architecture:
 *
 *  1. RENDERING ENGINE  — <ScriptRenderer>  — memoised, never re-renders on pointer change
 *  2. SYNC ENGINE       — useDeepgramSync   — Deepgram WebSocket mic → word matching
 *  3. CONTROL ENGINE    — <Controls>        — speed, mode, reset
 *
 * Manual auto-scroll uses requestAnimationFrame.
 * Deepgram sync scroll uses useAutoScroll (debounced, smooth).
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  memo,
} from 'react';
import {
  Mic, MicOff, Play, Pause, RotateCcw,
  SlidersHorizontal, ChevronDown, ChevronUp,
  AlertCircle, Loader2, Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScriptTokens, Token } from '@/hooks/useScriptTokens';
import { useWordMatcher } from '@/hooks/useWordMatcher';
import { useDeepgramSync, SyncStatus } from '@/hooks/useDeepgramSync';
import { useAutoScroll } from '@/hooks/useAutoScroll';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeleprompterEngineProps {
  script: string;
  documentTitle?: string;
}

// ─── Script Renderer — MEMOISED ───────────────────────────────────────────────
// We pass `pointerRef` not `pointer` to avoid re-rendering on every spoken word.
// Highlighting is applied directly via DOM class manipulation in `applyHighlight`.

interface ScriptRendererProps {
  tokens: Token[];
  containerRef: React.RefObject<HTMLDivElement>;
  fontSize: number;
}

const ScriptRenderer = memo(function ScriptRenderer({
  tokens,
  containerRef,
  fontSize,
}: ScriptRendererProps) {
  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto px-8 py-12 leading-[1.85] focus:outline-none"
      style={{ fontSize: `${fontSize}px` }}
      tabIndex={-1}
    >
      <p className="mx-auto max-w-3xl select-none" aria-live="off">
        {tokens.map((token) => (
          <span
            key={token.index}
            data-token-index={token.index}
            className="tp-token mr-[0.28em] inline-block transition-colors duration-100"
          >
            {token.original}
          </span>
        ))}
      </p>
    </div>
  );
});

// ─── Controls ─────────────────────────────────────────────────────────────────

interface ControlsProps {
  syncStatus: SyncStatus;
  isManual: boolean;
  isManualPlaying: boolean;
  speed: number;
  fontSize: number;
  onStartMic: () => void;
  onStopMic: () => void;
  onToggleManual: () => void;
  onReset: () => void;
  onSpeedChange: (v: number) => void;
  onFontSizeChange: (v: number) => void;
}

function Controls({
  syncStatus,
  isManual,
  isManualPlaying,
  speed,
  fontSize,
  onStartMic,
  onStopMic,
  onToggleManual,
  onReset,
  onSpeedChange,
  onFontSizeChange,
}: ControlsProps) {
  const isSyncing     = syncStatus === 'listening';
  const isConnecting  = syncStatus === 'connecting';

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] bg-[#0a0a12]/90 px-4 py-3 backdrop-blur-sm">

      {/* ── Mic buttons ── */}
      {!isSyncing && !isConnecting && (
        <button
          onClick={onStartMic}
          disabled={isManual}
          title="Start mic sync"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.97]',
            isManual
              ? 'cursor-not-allowed bg-white/[0.04] text-white/20'
              : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500',
          )}
        >
          <Mic className="h-3.5 w-3.5" />
          Start Mic
        </button>
      )}

      {(isSyncing || isConnecting) && (
        <button
          onClick={onStopMic}
          title="Stop mic sync"
          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600/90 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/20 hover:bg-red-500 active:scale-[0.97] transition-all"
        >
          {isConnecting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <MicOff className="h-3.5 w-3.5" />}
          {isConnecting ? 'Connecting…' : 'Stop Mic'}
        </button>
      )}

      {/* Listening indicator */}
      {isSyncing && (
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 ring-1 ring-emerald-500/30">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400">Live</span>
        </div>
      )}

      <div className="h-5 w-px bg-white/[0.08]" />

      {/* ── Manual mode ── */}
      <button
        onClick={onToggleManual}
        title={isManual ? 'Switch to mic sync' : 'Switch to manual scroll'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.97]',
          isManual
            ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30 hover:bg-amber-500/25'
            : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.09] hover:text-white/70',
        )}
      >
        <Volume2 className="h-3.5 w-3.5" />
        Manual
      </button>

      {/* ── Play / Pause (manual only) ── */}
      {isManual && (
        <button
          onClick={onToggleManual}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.10] hover:text-white transition-all active:scale-[0.97]"
          title={isManualPlaying ? 'Pause' : 'Play'}
        >
          {isManualPlaying
            ? <Pause className="h-3.5 w-3.5" />
            : <Play  className="h-3.5 w-3.5" />}
        </button>
      )}

      <div className="h-5 w-px bg-white/[0.08]" />

      {/* ── Speed ── */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
        <input
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          title={`Scroll speed: ${speed}`}
          className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-indigo-500"
        />
        <span className="w-6 text-right text-[11px] text-white/30">{speed}×</span>
      </div>

      {/* ── Font size ── */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onFontSizeChange(Math.max(18, fontSize - 4))}
          className="rounded-lg px-2 py-1.5 text-xs text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
          title="Smaller text"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <span className="text-[11px] text-white/20 tabular-nums">{fontSize}px</span>
        <button
          onClick={() => onFontSizeChange(Math.min(72, fontSize + 4))}
          className="rounded-lg px-2 py-1.5 text-xs text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
          title="Larger text"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="ml-auto">
        <button
          onClick={onReset}
          title="Reset to beginning"
          className="rounded-xl px-3 py-2 text-xs font-medium text-white/30 hover:bg-white/[0.06] hover:text-white/50 transition-all active:scale-[0.97]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export default function TeleprompterEngine({ script, documentTitle }: TeleprompterEngineProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [syncStatus,      setSyncStatus]      = useState<SyncStatus>('idle');
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null);
  const [isManual,        setIsManual]        = useState(false);
  const [isManualPlaying, setIsManualPlaying] = useState(false);
  const [speed,           setSpeed]           = useState(3);
  const [fontSize,        setFontSize]        = useState(32);
  // Current pointer — stored as ref to avoid re-rendering ScriptRenderer
  const pointerRef = useRef<number>(0);
  // Track rendered pointer for token highlight updates (separate from full re-render)
  const lastHighlightedRef = useRef<number>(-1);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef   = useRef<HTMLDivElement>(null);
  const rafManualRef   = useRef<number>(0);
  const speedRef       = useRef(speed);
  const isManualRef    = useRef(isManual);
  const isPlayingRef   = useRef(isManualPlaying);

  useEffect(() => { speedRef.current    = speed; },           [speed]);
  useEffect(() => { isManualRef.current = isManual; },        [isManual]);
  useEffect(() => { isPlayingRef.current = isManualPlaying; },[isManualPlaying]);

  // ── Tokenise script ────────────────────────────────────────────────────────
  const tokens = useScriptTokens(script);

  // ── Word matcher ───────────────────────────────────────────────────────────
  const { processChunk, reset: resetMatcher } = useWordMatcher(tokens);

  // ── Auto scroll ────────────────────────────────────────────────────────────
  const { scrollToToken } = useAutoScroll(containerRef);

  // ── Token highlight (direct DOM — no re-render) ───────────────────────────
  const applyHighlight = useCallback((newPointer: number) => {
    const container = containerRef.current;
    if (!container) return;

    const prev = lastHighlightedRef.current;

    // Unhighlight previously active token
    if (prev >= 0) {
      const el = container.querySelector<HTMLElement>(`[data-token-index="${prev}"]`);
      el?.classList.remove('tp-active');
    }

    // Mark all spoken tokens
    // Only add/remove classes on the delta range — O(delta), not O(n)
    for (let i = Math.max(0, prev); i < newPointer; i++) {
      const el = container.querySelector<HTMLElement>(`[data-token-index="${i}"]`);
      if (el) {
        el.classList.add('tp-spoken');
        el.classList.remove('tp-active');
      }
    }

    // Mark new active
    const active = container.querySelector<HTMLElement>(`[data-token-index="${newPointer}"]`);
    active?.classList.add('tp-active');

    lastHighlightedRef.current = newPointer;
  }, []);

  const advancePointer = useCallback((newPointer: number) => {
    pointerRef.current = newPointer;
    applyHighlight(newPointer);
    scrollToToken(newPointer);
  }, [applyHighlight, scrollToToken]);

  // ── Deepgram sync ──────────────────────────────────────────────────────────
  const { start: startMic, stop: stopMic } = useDeepgramSync({
    onTranscript: (text, _isFinal) => {
      const newPointer = processChunk(text);
      advancePointer(newPointer);
    },
    onStatusChange: setSyncStatus,
    onError: (msg) => {
      setErrorMsg(msg);
      // Auto-fallback to manual mode
      setIsManual(true);
    },
  });

  // ── Manual scroll engine ───────────────────────────────────────────────────
  const runManualScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const tick = () => {
      if (!isPlayingRef.current || !isManualRef.current) return;
      // px per frame: speed * 0.7 gives ~42 px/s at speed=1 (60 fps)
      container.scrollTop += speedRef.current * 0.7;
      rafManualRef.current = requestAnimationFrame(tick);
    };

    rafManualRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isManual && isManualPlaying) {
      runManualScroll();
    } else {
      cancelAnimationFrame(rafManualRef.current);
    }
    return () => cancelAnimationFrame(rafManualRef.current);
  }, [isManual, isManualPlaying, runManualScroll]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartMic = useCallback(() => {
    setErrorMsg(null);
    setIsManual(false);
    setIsManualPlaying(false);
    cancelAnimationFrame(rafManualRef.current);
    startMic();
  }, [startMic]);

  const handleStopMic = useCallback(() => {
    stopMic();
  }, [stopMic]);

  const handleToggleManual = useCallback(() => {
    if (!isManual) {
      // Switch TO manual
      stopMic();
      setIsManual(true);
      setIsManualPlaying(true);
    } else {
      // Toggle play/pause within manual mode
      setIsManualPlaying((v) => !v);
    }
  }, [isManual, stopMic]);

  const handleReset = useCallback(() => {
    stopMic();
    cancelAnimationFrame(rafManualRef.current);
    resetMatcher();
    pointerRef.current = 0;
    lastHighlightedRef.current = -1;
    setIsManualPlaying(false);
    setErrorMsg(null);
    // Reset scroll + DOM classes
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      containerRef.current.querySelectorAll<HTMLElement>('.tp-token').forEach((el) => {
        el.classList.remove('tp-spoken', 'tp-active');
      });
    }
  }, [stopMic, resetMatcher]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => {
    stopMic();
    cancelAnimationFrame(rafManualRef.current);
  }, [stopMic]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-[#07070f] text-white">

      {/* Title bar */}
      {documentTitle && (
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-2.5">
          <span className="truncate text-xs font-medium text-white/30">{documentTitle}</span>
          <span className="ml-auto rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400 ring-1 ring-indigo-500/20">
            Teleprompter
          </span>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-center gap-2.5 border-b border-red-500/20 bg-red-500/10 px-5 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 text-xs">{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-400/60 hover:text-red-300 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Script renderer — takes all remaining vertical space */}
      <div className="flex-1 overflow-hidden">
        {tokens.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-white/20">No script loaded.</p>
          </div>
        ) : (
          <ScriptRenderer
            tokens={tokens}
            containerRef={containerRef}
            fontSize={fontSize}
          />
        )}
      </div>

      {/* Controls bar */}
      <Controls
        syncStatus={syncStatus}
        isManual={isManual}
        isManualPlaying={isManualPlaying}
        speed={speed}
        fontSize={fontSize}
        onStartMic={handleStartMic}
        onStopMic={handleStopMic}
        onToggleManual={handleToggleManual}
        onReset={handleReset}
        onSpeedChange={setSpeed}
        onFontSizeChange={setFontSize}
      />
    </div>
  );
}
