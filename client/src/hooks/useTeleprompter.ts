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

  useEffect(() => { speedRef.current = speed; }, [speed]);

  // ── Speech synthesis ─────────────────────────────────────────────────────
  const startSpeech = useCallback((fromChar: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const slice = text.slice(fromChar).trimStart();
    if (!slice) return;

    // fromChar adjusted for trimStart
    const trimOffset = text.slice(fromChar).length - slice.length;
    const base = fromChar + trimOffset;

    const utterance = new SpeechSynthesisUtterance(slice);
    utterance.rate  = 0.92;   // comfortable reading pace
    utterance.lang  = 'en-US';

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

  // Clean up on unmount
  useEffect(() => () => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  // ── RAF scroll loop ──────────────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    if (!isPlayingRef.current || !scrollRef.current) return;

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // speed 1 → ~0.03 px/ms  |  speed 20 → ~0.6 px/ms
    const px = speedRef.current * 0.03 * delta;

    const el = scrollRef.current;
    const maxScroll = el.scrollHeight - el.clientHeight;

    if (el.scrollTop >= maxScroll - 1) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setProgress(100);
      return;
    }

    el.scrollTop = Math.min(el.scrollTop + px, maxScroll);
    setProgress(Math.round((el.scrollTop / maxScroll) * 100));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

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

  // ── Controls ─────────────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        startSpeech(pausedAtCharRef.current);
      } else {
        stopSpeech();
      }
      return next;
    });
  }, [startSpeech, stopSpeech]);

  const reset = useCallback(() => {
    stopSpeech();
    setIsPlaying(false);
    isPlayingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current   = 0;
    pausedAtCharRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setProgress(0);
    setCurrentCharIndex(-1);
  }, [stopSpeech]);

  const setSpeed     = useCallback((v: number) => setSpeedState(Math.max(1, Math.min(20, v))), []);
  const setFontSize  = useCallback((v: number) => setFontSizeState(Math.max(16, Math.min(72, v))), []);
  const setTheme     = useCallback((t: 'dark' | 'light') => setThemeState(t), []);
  const toggleMirror = useCallback(() => setMirror((m) => !m), []);

  return {
    isPlaying, speed, fontSize, theme, mirror, progress, currentCharIndex, isSpeaking,
    scrollRef, toggle, reset, setSpeed, setFontSize, setTheme, toggleMirror,
  };
}

