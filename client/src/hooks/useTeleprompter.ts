'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface TeleprompterControls {
  isPlaying: boolean;
  speed: number;
  fontSize: number;
  theme: 'dark' | 'light';
  mirror: boolean;
  progress: number;
  currentCharIndex: number;
  isSpeaking: boolean;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  toggle: () => void;
  reset: () => void;
  setSpeed: (v: number) => void;
  setFontSize: (v: number) => void;
  setTheme: (t: 'dark' | 'light') => void;
  toggleMirror: () => void;
}

export function useTeleprompter(text: string): TeleprompterControls {
  const [isPlaying, setIsPlaying]               = useState(false);
  const [speed, setSpeedState]                  = useState(5);
  const [fontSize, setFontSizeState]            = useState(32);
  const [theme, setThemeState]                  = useState<'dark' | 'light'>('dark');
  const [mirror, setMirror]                     = useState(false);
  const [progress, setProgress]                 = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [isSpeaking, setIsSpeaking]             = useState(false);

  const scrollRef       = useRef<HTMLDivElement | null>(null);
  const rafRef          = useRef<number>(0);
  const lastTimeRef     = useRef<number>(0);
  const isPlayingRef    = useRef(false);
  const speedRef        = useRef(speed);
  const pausedAtCharRef = useRef(0);
  const isSpeakingRef   = useRef(false);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    // Reset delta accumulator so RAF doesn't lurch when speech hands back control
    if (!isSpeaking) lastTimeRef.current = 0;
  }, [isSpeaking]);

  // ── Speech synthesis ──────────────────────────────────────────────────────
  const startSpeech = useCallback((fromChar: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const slice = text.slice(fromChar).trimStart();
    if (!slice) return;

    const trimOffset = text.slice(fromChar).length - slice.length;
    const base       = fromChar + trimOffset;

    const utterance  = new SpeechSynthesisUtterance(slice);
    utterance.rate   = 0.92;
    utterance.lang   = 'en-US';

    utterance.onstart = () => setIsSpeaking(true);

    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name === 'word') {
        const abs = base + e.charIndex;
        pausedAtCharRef.current = abs;
        setCurrentCharIndex(abs);
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentCharIndex(-1);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentCharIndex(-1);
    };

    window.speechSynthesis.speak(utterance);
  }, [text]);

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setCurrentCharIndex(-1);
  }, []);

  // ── Drive speech from isPlaying state ────────────────────────────────────
  // IMPORTANT: do NOT call side-effects inside a state-updater callback.
  // React 18 Strict Mode calls updaters twice, which would double-fire speak().
  // Use a dedicated effect instead.
  useEffect(() => {
    if (isPlaying) {
      startSpeech(pausedAtCharRef.current);
    } else {
      stopSpeech();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);   // startSpeech/stopSpeech intentionally omitted — text changes shouldn't restart

  // ── Chrome keepAlive: speechSynthesis pauses after ~14 s ─────────────────
  useEffect(() => {
    if (!isPlaying || typeof window === 'undefined') return;
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  // ── RAF scroll loop ───────────────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    if (!isPlayingRef.current || !scrollRef.current) return;

    const el        = scrollRef.current;
    const maxScroll = el.scrollHeight - el.clientHeight;

    // When speech synthesis is active it drives the scroll position via the
    // component's scrollIntoView effect.  The RAF loop only tracks progress.
    if (isSpeakingRef.current) {
      if (maxScroll > 0) setProgress(Math.round((el.scrollTop / maxScroll) * 100));
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Guard: content not yet laid out
    if (maxScroll <= 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // speed 1 → ~0.03 px/ms  |  speed 20 → ~0.6 px/ms
    const px = speedRef.current * 0.03 * delta;

    if (el.scrollTop >= maxScroll - 1) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setProgress(100);
      return;
    }

    el.scrollTop = Math.min(el.scrollTop + px, maxScroll);
    setProgress(Math.round((el.scrollTop / maxScroll) * 100));
    rafRef.current = requestAnimationFrame(tick);
  }, []);   // refs only — stable

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick]);

  // ── Controls ──────────────────────────────────────────────────────────────

  // Pure state flip — side-effects are handled by the useEffect above
  const toggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    // Flip state first — the isPlaying effect will call stopSpeech
    setIsPlaying(false);
    isPlayingRef.current    = false;
    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current     = 0;
    pausedAtCharRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setProgress(0);
    setCurrentCharIndex(-1);
  }, []);

  const setSpeed     = useCallback((v: number) => setSpeedState(Math.max(1, Math.min(20, v))), []);
  const setFontSize  = useCallback((v: number) => setFontSizeState(Math.max(16, Math.min(72, v))), []);
  const setTheme     = useCallback((t: 'dark' | 'light') => setThemeState(t), []);
  const toggleMirror = useCallback(() => setMirror((m) => !m), []);

  return {
    isPlaying, speed, fontSize, theme, mirror, progress, currentCharIndex, isSpeaking,
    scrollRef, toggle, reset, setSpeed, setFontSize, setTheme, toggleMirror,
  };
}
