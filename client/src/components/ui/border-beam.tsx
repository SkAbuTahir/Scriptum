'use client';

import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
}

/**
 * Aceternity-style animated beam that sweeps around the border of a container.
 * The parent must have `relative overflow-hidden`.
 */
export function BorderBeam({
  className,
  size = 200,
  duration = 12,
  delay = 0,
  colorFrom = '#6366f1',
  colorTo = '#a855f7',
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        className,
      )}
      style={
        {
          '--size': size,
          '--duration': duration,
          '--delay': `-${delay}s`,
          '--color-from': colorFrom,
          '--color-to': colorTo,
        } as React.CSSProperties
      }
    >
      {/* The sweeping gradient conic that looks like a beam going around */}
      <div
        className="absolute inset-[-1px] rounded-[inherit] [animation:border-beam_calc(var(--duration)*1s)_infinite_linear_var(--delay)]"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, transparent 70%, ${colorFrom} 85%, ${colorTo} 100%)`,
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
        }}
      />
    </div>
  );
}
