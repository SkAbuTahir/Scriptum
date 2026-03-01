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
  /** Mic-sync mode: user speaks → words are highlighted in real-time */
  isSyncMode: boolean;
  /** True while the Web Speech API recognition engine is actively listening */
  isListening: boolean;
  toggleSyncMode: () => void;
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

  // ── Sync-mode state ──────────────────────────────────────────────────────
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const scrollRef        = useRef<HTMLDivElement | null>(null);
  const rafRef           = useRef<number>(0);
  const lastTimeRef      = useRef<number>(0);
  const isPlayingRef     = useRef(false);
  const speedRef         = useRef(speed);
  const pausedAtCharRef  = useRef(0);
  const isSpeakingRef    = useRef(false);
  const isSyncModeRef    = useRef(false);
  // Parsed word tokens: { clean: normalised string, charStart: index in raw text }
  const scriptWordsRef   = useRef<Array<{ clean: string; charStart: number }>>([]);
  // Pointer into scriptWordsRef — how far through the script we've matched
  const recogPtrRef      = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef   = useRef<any>(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (!isSpeaking) lastTimeRef.current = 0;
  }, [isSpeaking]);
  useEffect(() => { isSyncModeRef.current = isSyncMode; }, [isSyncMode]);

  // Parse script into word tokens whenever text changes
  useEffect(() => {
    const words: Array<{ clean: string; charStart: number }> = [];
    const re = /(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      words.push({
        clean: m[0].toLowerCase().replace(/[^a-z']/g, ''),
        charStart: m.index,
      });
    }
    scriptWordsRef.current = words;
    recogPtrRef.current    = 0;
  }, [text]);

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

  // ── Web Speech API recognition (mic-sync mode) ────────────────────────────
  const startRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { console.warn('Web SpeechRecognition not supported in this browser.'); return; }

    // Dispose any previous instance
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    // Initialise recogPtr to current scroll position
    const charPos  = pausedAtCharRef.current;
    const script   = scriptWordsRef.current;
    let   startIdx = 0;
    for (let i = 0; i < script.length; i++) {
      if (script[i].charStart <= charPos) startIdx = i;
      else break;
    }
    recogPtrRef.current = startIdx;

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    recognitionRef.current = rec;

    rec.onstart = () => setIsListening(true);

    rec.onend = () => {
      setIsListening(false);
      // Auto-restart if still active
      if (isSyncModeRef.current && isPlayingRef.current) {
        try { rec.start(); } catch { /* already started */ }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      const scr = scriptWordsRef.current;
      for (let ri = event.resultIndex; ri < event.results.length; ri++) {
        const result     = event.results[ri];
        const transcript = result[0].transcript as string;
        const spoken     = transcript
          .trim().toLowerCase()
          .split(/\s+/)
          .map((w: string) => w.replace(/[^a-z']/g, ''))
          .filter(Boolean);

        if (result.isFinal) {
          // Commit all words — advance pointer
          for (const word of spoken) {
            const ptr = recogPtrRef.current;
            for (let i = ptr; i < Math.min(ptr + 20, scr.length); i++) {
              if (
                scr[i].clean === word ||
                (word.length >= 3 && scr[i].clean.startsWith(word.slice(0, 3)))
              ) {
                recogPtrRef.current    = i + 1;
                pausedAtCharRef.current = scr[i].charStart;
                setCurrentCharIndex(scr[i].charStart);
                break;
              }
            }
          }
        } else {
          // Interim: live-highlight from last spoken word
          const last = spoken[spoken.length - 1];
          if (!last || last.length < 2) continue;
          const ptr = recogPtrRef.current;
          for (let i = ptr; i < Math.min(ptr + 12, scr.length); i++) {
            if (scr[i].clean.startsWith(last)) {
              setCurrentCharIndex(scr[i].charStart);
              break;
            }
          }
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('SpeechRecognition error:', event.error);
    };

    rec.start();
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;  // prevent auto-restart
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ── Drive speech from isPlaying state ────────────────────────────────────
  // IMPORTANT: do NOT call side-effects inside a state-updater callback.
  // React 18 Strict Mode calls updaters twice, which would double-fire speak().
  // Use a dedicated effect instead.
  useEffect(() => {
    if (isPlaying) {
      if (isSyncModeRef.current) {
        // Mic-sync mode: listen to the user's voice
        startRecognition();
      } else {
        // Normal mode: TTS narrates
        startSpeech(pausedAtCharRef.current);
      }
    } else {
      stopSpeech();
      stopRecognition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);  // handler refs are stable; isSyncModeRef read via ref intentionally

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
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  // ── RAF scroll loop ───────────────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    if (!isPlayingRef.current || !scrollRef.current) return;

    const el        = scrollRef.current;
    const maxScroll = el.scrollHeight - el.clientHeight;

    // When TTS or mic-sync is active, scroll is driven by the word-highlight
    // effect in the component. The RAF loop only tracks progress here.
    if (isSpeakingRef.current || isSyncModeRef.current) {
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
    setIsPlaying(false);
    isPlayingRef.current    = false;
    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current     = 0;
    pausedAtCharRef.current = 0;
    recogPtrRef.current     = 0;
    stopRecognition();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setProgress(0);
    setCurrentCharIndex(-1);
  }, [stopRecognition]);

  const toggleSyncMode = useCallback(() => {
    setIsSyncMode((prev) => {
      const next = !prev;
      isSyncModeRef.current = next;
      if (isPlayingRef.current) {
        if (next) {
          // Switch to mic-sync while playing
          stopSpeech();
          startRecognition();
        } else {
          // Switch back to TTS while playing
          stopRecognition();
          startSpeech(pausedAtCharRef.current);
        }
      }
      return next;
    });
  }, [startSpeech, startRecognition, stopSpeech, stopRecognition]);

  const setSpeed     = useCallback((v: number) => setSpeedState(Math.max(1, Math.min(20, v))), []);
  const setFontSize  = useCallback((v: number) => setFontSizeState(Math.max(16, Math.min(72, v))), []);
  const setTheme     = useCallback((t: 'dark' | 'light') => setThemeState(t), []);
  const toggleMirror = useCallback(() => setMirror((m) => !m), []);

  return {
    isPlaying, speed, fontSize, theme, mirror, progress, currentCharIndex, isSpeaking,
    isSyncMode, isListening, toggleSyncMode,
    scrollRef, toggle, reset, setSpeed, setFontSize, setTheme, toggleMirror,
  };
}
