'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/** Aceternity-style label */
export function AceLabel({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5', className)}
      {...props}
    >
      {children}
    </label>
  );
}

/** Aceternity-style input with animated bottom border */
export const AceInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className="group relative">
    <input
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900',
        'placeholder:text-slate-400 outline-none',
        'transition-all duration-200',
        'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
        'dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30',
        'dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20',
        className,
      )}
      {...props}
    />
  </div>
));
AceInput.displayName = 'AceInput';

/** Shimmer button */
export function ShimmerButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl',
        'bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md',
        'hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] transition-all duration-200',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {/* Shimmer sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite] bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.15)_50%,transparent_60%)]"
      />
      {children}
    </button>
  );
}
