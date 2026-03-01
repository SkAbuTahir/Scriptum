'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface NumberTickerProps {
  value: number;
  /** Decimal places */
  decimals?: number;
  className?: string;
  /** Duration in ms */
  duration?: number;
}

/**
 * Aceternity-style number ticker that counts up from 0 to `value` on mount.
 */
export function NumberTicker({ value, decimals = 0, className, duration = 1600 }: NumberTickerProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Only run once on mount (intersection observer would be better, but simple is fine here)
    if (mountedRef.current) return;
    mountedRef.current = true;

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(parseFloat((eased * value).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, decimals, duration]);

  return (
    <span className={cn('tabular-nums', className)}>
      {display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}
