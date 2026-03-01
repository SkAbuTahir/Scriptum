'use client';

import { useRef, useCallback } from 'react';
import { Token, normalizeWord } from './useScriptTokens';

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many tokens ahead we search when the first word doesn't match */
const LOOK_AHEAD = 6;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseWordMatcherReturn {
  /** Feed a raw transcript chunk.  Returns the new pointer value. */
  processChunk: (chunk: string) => number;
  /** Current pointer (tokens consumed so far) */
  getPointer: () => number;
  /** Hard-reset the pointer to 0 (or a specific index) */
  reset: (to?: number) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Forward-only O(n) word matcher.
 *
 * Rules:
 *  - Never scan backwards.
 *  - On mismatch: look up to LOOK_AHEAD tokens ahead; if found, jump there.
 *  - If nothing matches in the window: skip the spoken word, do NOT advance script pointer.
 *  - Only reset if `reset()` is called explicitly.
 */
export function useWordMatcher(scriptTokens: Token[]): UseWordMatcherReturn {
  const pointerRef = useRef<number>(0);

  const getPointer = useCallback((): number => pointerRef.current, []);

  const reset = useCallback((to = 0): void => {
    pointerRef.current = Math.max(0, Math.min(to, scriptTokens.length - 1));
  }, [scriptTokens.length]);

  const processChunk = useCallback((chunk: string): number => {
    if (!chunk || scriptTokens.length === 0) return pointerRef.current;

    // Normalise and split transcript chunk into individual spoken words
    const spokenWords = chunk
      .split(/\s+/)
      .map(normalizeWord)
      .filter(Boolean);

    for (const spoken of spokenWords) {
      const ptr = pointerRef.current;

      // Already consumed all tokens — stop processing
      if (ptr >= scriptTokens.length) break;

      // ── Case 1: exact match at current pointer ────────────────────────────
      if (scriptTokens[ptr].normalized === spoken) {
        pointerRef.current = ptr + 1;
        continue;
      }

      // ── Case 2: look ahead up to LOOK_AHEAD tokens ────────────────────────
      const windowEnd = Math.min(ptr + LOOK_AHEAD, scriptTokens.length);
      let found = false;

      for (let i = ptr + 1; i < windowEnd; i++) {
        if (scriptTokens[i].normalized === spoken) {
          // Jump pointer to one past the match
          pointerRef.current = i + 1;
          found = true;
          break;
        }
      }

      // ── Case 3: no match found — skip this spoken word, keep pointer ──────
      if (!found) {
        // intentionally do nothing; never go back
      }
    }

    return pointerRef.current;
  }, [scriptTokens]);

  return { processChunk, getPointer, reset };
}
