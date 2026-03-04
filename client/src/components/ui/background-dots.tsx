'use client';

import { cn } from '@/lib/utils';

interface BackgroundDotsProps {
  className?: string;
  dotColor?: string;
  gap?: number;
  dotSize?: number;
  mask?: boolean;
}

/**
 * Aceternity-style animated dot-grid background.
 * Position your parent as `relative overflow-hidden`.
 */
export function BackgroundDots({
  className,
  dotColor,
  gap = 20,
  dotSize = 1,
  mask = true,
}: BackgroundDotsProps) {
  const color = dotColor ?? 'rgba(99,102,241,0.18)';
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 -z-10', className)}
      style={{
        backgroundImage: `radial-gradient(circle, ${color} ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${gap}px ${gap}px`,
        ...(mask
          ? {
              maskImage:
                'radial-gradient(ellipse 80% 70% at 50% 0%, black 30%, transparent 100%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 80% 70% at 50% 0%, black 30%, transparent 100%)',
            }
          : {}),
      }}
    />
  );
}

/**
 * Full-page subtle grid overlay (lines), similar to Aceternity hero backgrounds.
 */
export function BackgroundGrid({
  className,
  isDark = false,
}: {
  className?: string;
  isDark?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 -z-10', className)}
      style={{
        backgroundImage: isDark
          ? `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(99 102 241 / 0.07)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`
          : `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(99 102 241 / 0.05)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
        maskImage:
          'radial-gradient(ellipse 100% 80% at 50% 0%, black 20%, transparent 100%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 100% 80% at 50% 0%, black 20%, transparent 100%)',
      }}
    />
  );
}
