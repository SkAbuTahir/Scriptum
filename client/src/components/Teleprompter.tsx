'use client';

import React, { useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTeleprompter } from '@/hooks/useTeleprompter';
import { cn } from '@/lib/utils';
import {
  Play, Pause, RotateCcw, ChevronLeft,
  Sun, Moon, Minus, Plus, Gauge, FlipHorizontal, Volume2, VolumeX,
} from 'lucide-react';

interface Props {
  text: string;
  documentTitle: string;
  documentId: string;
}

// Tokenise text into words and non-word runs so each word can be
// independently highlighted by the speech-synthesis charIndex.
interface Token {
  text: string;
  start: number;
  isWord: boolean;
}

function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\S+|\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], start: m.index, isWord: /\S/.test(m[0]) });
  }
  return tokens;
}

export default function TeleprompterView({ text, documentTitle, documentId }: Props) {
  const {
    isPlaying, speed, fontSize, theme, mirror, progress,
    currentCharIndex, isSpeaking,
    scrollRef, toggle, reset, setSpeed, setFontSize, setTheme, toggleMirror,
  } = useTeleprompter(text);

  const isDark = theme === 'dark';

  // Word count / estimate
  const wordCount        = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);
  const estimatedMinutes = wordCount > 0 ? Math.ceil(wordCount / 130) : 0;

  // Pre-tokenise once
  const tokens = useMemo(() => tokenise(text), [text]);

  // â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          toggle();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          reset();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSpeed(speed + 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSpeed(speed - 1);
          break;
        case '+':
        case '=':
          setFontSize(fontSize + 2);
          break;
        case '-':
          setFontSize(fontSize - 2);
          break;
        case 'm':
        case 'M':
          toggleMirror();
          break;
      }
    },
    [toggle, reset, setSpeed, setFontSize, toggleMirror, speed, fontSize]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={cn(
        'relative flex h-screen flex-col overflow-hidden select-none',
        isDark ? 'bg-gray-950 text-white' : 'bg-white text-gray-900'
      )}
    >
      {/* â”€â”€ Top gradient fade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-20 h-28',
          isDark
            ? 'bg-gradient-to-b from-gray-950 via-gray-950/80 to-transparent'
            : 'bg-gradient-to-b from-white via-white/80 to-transparent'
        )}
      />

      {/* â”€â”€ Reading position indicator (horizontal line at centre) â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
        <div className="flex items-center">
          <div className={cn('h-px flex-1', isDark ? 'bg-white/8' : 'bg-gray-200')} />
          <div className={cn('mx-3 h-0.5 w-10 rounded-full', isDark ? 'bg-brand-400/50' : 'bg-brand-600/40')} />
          <div className={cn('h-px flex-1', isDark ? 'bg-white/8' : 'bg-gray-200')} />
        </div>
      </div>

      {/* â”€â”€ Scrolling text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-scroll"
        style={{ scrollBehavior: 'auto' }}
      >
        <div
          className="mx-auto max-w-3xl px-6"
          style={{
            paddingTop: '45vh',
            paddingBottom: '50vh',
            transform: mirror ? 'scaleX(-1)' : 'none',
          }}
        >
          <p
            className={cn(
              'text-center leading-relaxed tracking-wide',
              isDark ? 'text-white/92' : 'text-gray-900'
            )}
            style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }}
          >
            {tokens.map((token, i) => {
              // Render whitespace tokens â€” convert newlines to <br />
              if (!token.isWord) {
                if (token.text.includes('\n')) {
                  return token.text.split('\n').map((_, ni) =>
                    ni === 0 ? null : <br key={`${i}-${ni}`} />
                  );
                }
                return <span key={i}>{token.text}</span>;
              }

              // Word token â€” may be highlighted
              const isHighlighted =
                currentCharIndex >= token.start &&
                currentCharIndex < token.start + token.text.length;

              return (
                <span
                  key={i}
                  style={
                    isHighlighted
                      ? {
                          backgroundColor: isDark
                            ? 'rgba(234, 179, 8, 0.35)'
                            : 'rgba(234, 179, 8, 0.45)',
                          borderRadius: '4px',
                          padding: '0 2px',
                          color: isDark ? '#fef08a' : '#78350f',
                          transition: 'background-color 0.1s',
                        }
                      : undefined
                  }
                >
                  {token.text}
                </span>
              );
            })}
          </p>
        </div>
      </div>

      {/* â”€â”€ Bottom gradient fade (sits ABOVE controls bar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 z-20',
          isDark
            ? 'bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent'
            : 'bg-gradient-to-t from-white via-white/70 to-transparent'
        )}
        style={{ bottom: '80px', height: '120px' }}
      />

      {/* â”€â”€ Controls bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={cn(
          'relative z-30 flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3',
          isDark
            ? 'border-white/10 bg-gray-900/90 backdrop-blur-md'
            : 'border-gray-200 bg-gray-50/95 backdrop-blur-md'
        )}
        style={{ height: '72px' }}
      >
        {/* Left: back + title */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/editor/${documentId}`}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
              isDark
                ? 'text-white/60 hover:bg-white/10 hover:text-white'
                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
          <div className="min-w-0">
            <p className={cn('truncate text-xs font-medium', isDark ? 'text-white/60' : 'text-gray-500')}>
              {documentTitle}
            </p>
            <p className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
              {wordCount.toLocaleString()} words Â· ~{estimatedMinutes} min
            </p>
          </div>
        </div>

        {/* Center: reset + play/pause + voice indicator */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={reset}
            className={cn(
              'rounded-lg p-2 transition-all',
              isDark
                ? 'text-white/50 hover:bg-white/10 hover:text-white'
                : 'text-gray-400 hover:bg-gray-200 hover:text-gray-900'
            )}
            title="Reset (R)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            onClick={toggle}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-all active:scale-95',
              isPlaying
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : isDark
                  ? 'bg-white text-gray-900 hover:bg-white/90'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
            )}
            title="Play/Pause (Space)"
          >
            {isPlaying
              ? <Pause className="h-5 w-5" />
              : <Play className="h-5 w-5 translate-x-0.5" />
            }
          </button>

          {/* Voice / TTS status indicator */}
          <div
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all',
              isSpeaking
                ? isDark
                  ? 'bg-yellow-500/15 text-yellow-400'
                  : 'bg-yellow-100 text-yellow-700'
                : isDark
                  ? 'text-white/20'
                  : 'text-gray-300'
            )}
            title={isSpeaking ? 'Voice active' : 'Voice inactive'}
          >
            {isSpeaking
              ? <Volume2 className="h-4 w-4 animate-pulse" />
              : <VolumeX className="h-4 w-4" />
            }
          </div>
        </div>

        {/* Right: speed + font + mirror + theme */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Speed */}
          <div className="flex items-center gap-1.5">
            <Gauge className={cn('h-3.5 w-3.5', isDark ? 'text-white/30' : 'text-gray-400')} />
            <button
              onClick={() => setSpeed(speed - 1)}
              className={cn('rounded p-1 transition-all', isDark ? 'text-white/50 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-200')}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className={cn('w-5 text-center text-xs font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-800')}>
              {speed}
            </span>
            <button
              onClick={() => setSpeed(speed + 1)}
              className={cn('rounded p-1 transition-all', isDark ? 'text-white/50 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-200')}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Font size (hidden on small screens) */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className={cn('text-xs font-medium', isDark ? 'text-white/30' : 'text-gray-400')}>Aa</span>
            <button
              onClick={() => setFontSize(fontSize - 2)}
              className={cn('rounded p-1 transition-all', isDark ? 'text-white/50 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-200')}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className={cn('w-6 text-center text-xs font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-800')}>
              {fontSize}
            </span>
            <button
              onClick={() => setFontSize(fontSize + 2)}
              className={cn('rounded p-1 transition-all', isDark ? 'text-white/50 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-200')}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Mirror toggle */}
          <button
            onClick={toggleMirror}
            className={cn(
              'rounded-lg p-2 transition-all',
              mirror
                ? 'bg-brand-500/20 text-brand-400'
                : isDark
                  ? 'text-white/50 hover:bg-white/10 hover:text-white'
                  : 'text-gray-400 hover:bg-gray-200 hover:text-gray-900'
            )}
            title="Mirror text (M)"
          >
            <FlipHorizontal className="h-4 w-4" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
              'rounded-lg p-2 transition-all',
              isDark
                ? 'text-white/50 hover:bg-white/10 hover:text-white'
                : 'text-gray-400 hover:bg-gray-200 hover:text-gray-900'
            )}
            title="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* â”€â”€ Keyboard hints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={cn(
          'relative z-30 hidden justify-center gap-5 pb-2 text-xs md:flex',
          isDark ? 'bg-gray-900/90 text-white/20' : 'bg-gray-50/95 text-gray-300'
        )}
      >
        {[
          { key: 'Space', label: 'Play/Pause' },
          { key: 'R',     label: 'Reset'      },
          { key: 'â†‘ â†“',  label: 'Speed'      },
          { key: '+ âˆ’',  label: 'Font size'   },
          { key: 'M',     label: 'Mirror'     },
        ].map(({ key, label }) => (
          <span key={key}>
            <kbd className="font-mono">{key}</kbd> {label}
          </span>
        ))}
      </div>

      {/* â”€â”€ Progress bar (BOTTOM) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={cn(
          'relative z-30 h-1 w-full shrink-0',
          isDark ? 'bg-white/10' : 'bg-gray-200'
        )}
      >
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
