'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Meteor {
  id: number;
  top: string;
  left: string;
  delay: string;
  duration: string;
  size: number;
}

function Meteors({ number = 14 }: { number?: number }) {
  const [meteors, setMeteors] = useState<Meteor[]>([]);

  useEffect(() => {
    setMeteors(
      Array.from({ length: number }, (_, i) => ({
        id: i,
        top: `${Math.floor(Math.random() * 80)}%`,
        left: `${Math.floor(Math.random() * 100)}%`,
        delay: `${(Math.random() * 1.5).toFixed(2)}s`,
        duration: `${(Math.random() * 3 + 3).toFixed(2)}s`,
        size: Math.floor(Math.random() * 1) + 1,
      }))
    );
  }, [number]);

  return (
    <>
      {meteors.map((m) => (
        <span
          key={m.id}
          className="pointer-events-none absolute rotate-[215deg] animate-meteor-effect rounded-full bg-slate-500"
          style={{
            top: m.top,
            left: m.left,
            width: `${m.size}px`,
            height: `${m.size}px`,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        >
          <span className="absolute top-1/2 -translate-y-1/2 left-full w-[80px] h-[1px] bg-gradient-to-r from-slate-500/70 to-transparent" />
        </span>
      ))}
    </>
  );
}

interface MeteorCardProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  meteors?: number;
}

/** A card with a comet/meteor shower effect. Wrap any content. */
export function MeteorCard({ title, description, children, className, meteors = 10 }: MeteorCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-px shadow-md',
        'dark:border-white/10 dark:bg-[#111113]',
        className,
      )}
    >
      {/* Inner glow ring */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 pointer-events-none" />
      <div className="relative z-10 rounded-2xl p-6">
        <Meteors number={meteors} />
        {title && <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>}
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        {children}
      </div>
    </div>
  );
}

/** Spotlight / glow card — subtle ambient glow on hover */
type GlowCardProps = React.HTMLAttributes<HTMLDivElement> & { className?: string };

export function GlowCard({ children, className, onMouseMove, onMouseEnter, onMouseLeave, ...rest }: GlowCardProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  return (
    <div
      {...rest}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-xl',
        'dark:border-white/8 dark:bg-[#111113]',
        className,
      )}
      onMouseMove={(e) => {
        onMouseMove?.(e);
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseEnter={(e) => { onMouseEnter?.(e); setVisible(true); }}
      onMouseLeave={(e) => { onMouseLeave?.(e); setVisible(false); }}
    >
      {/* Spotlight glow */}
      {visible && (
        <div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(350px circle at ${pos.x}px ${pos.y}px, rgba(99,102,241,0.12), transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
