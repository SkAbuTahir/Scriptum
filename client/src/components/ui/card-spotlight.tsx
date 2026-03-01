'use client';

import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CardSpotlightProps {
  children:  React.ReactNode;
  className?: string;
  /** Spotlight radial colour — defaults to indigo tint */
  color?:    string;
  /** Radius of the spotlight circle in px — defaults to 280 */
  radius?:   number;
}

export function CardSpotlight({
  children,
  className,
  color   = 'rgba(99,102,241,0.12)',
  radius  = 280,
}: CardSpotlightProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [pos,  setPos]  = useState({ x: 0, y: 0 });
  const [isHov, setHov] = useState(false);

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = divRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMove}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={cn(
        // base structure
        'group relative overflow-hidden rounded-2xl',
        // light mode — subtle card with gentle lift shadow
        'bg-white border border-slate-200/70',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]',
        'hover:shadow-[0_4px_16px_rgba(99,102,241,0.18),0_12px_32px_rgba(99,102,241,0.10),0_1px_4px_rgba(0,0,0,0.06)]',
        // dark mode — deep card with indigo glow
        'dark:bg-[#0d0d1a]/90 dark:border-white/[0.07]',
        'dark:shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.4)]',
        'dark:hover:shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_4px_24px_rgba(99,102,241,0.25),0_16px_40px_rgba(0,0,0,0.6)]',
        // smooth transitions
        'transition-shadow duration-300',
        className,
      )}
    >
      {/* Spotlight radial gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity:    isHov ? 1 : 0,
          background: `radial-gradient(${radius}px circle at ${pos.x}px ${pos.y}px, ${color} 0%, transparent 65%)`,
        }}
      />

      {/* Subtle top-edge shine in dark mode */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/20 to-transparent opacity-0 dark:opacity-100"
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
