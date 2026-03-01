'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { documentApi } from '@/lib/api';
import { useUsage } from '@/hooks/useUsage';
import { DocumentSummary } from '@/types';
import {
  formatRelativeTime, formatWordCount, sourceTypeLabel,
  cn, grammarScoreLabel,
} from '@/lib/utils';
import {
  FileText, Upload, Plus, Trash2,
  FileType, Youtube, File, Loader2, BookOpen,
  Pencil, CheckCircle2, Clock,
  AlertTriangle, TrendingUp, Sparkles,
  Search, SlidersHorizontal, ArrowUpRight,
  Zap, Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Footer } from '@/components/ui/footer';
import { GlowCard } from '@/components/ui/meteor-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { NumberTicker } from '@/components/ui/number-ticker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sourceIcon = (type: string) => {
  switch (type) {
    case 'docx':    return FileType;
    case 'pdf':     return File;
    case 'youtube': return Youtube;
    case 'website': return Globe;
    default:        return FileText;
  }
};

function scoreColor(variant: 'grammar' | 'readability' | 'ai', value: number) {
  if (variant === 'ai') {
    if (value >= 70) return 'text-red-500 dark:text-red-400';
    if (value >= 40) return 'text-amber-500 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (value >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 55) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-200 dark:border-white/[0.08]">
      <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-white/[0.04] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-3 w-48 rounded bg-slate-200 dark:bg-white/[0.06] animate-pulse" />
        <div className="h-2.5 w-28 rounded bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
      </div>
      <div className="hidden sm:flex items-center gap-4">
        {[48, 40, 44].map((w) => (
          <div key={w} className="flex flex-col items-center gap-1">
            <div className="h-4 w-8 rounded bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
            <div className="h-2 w-6 rounded bg-slate-100 dark:bg-white/[0.03] animate-pulse" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 opacity-0">
        <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-white/[0.04]" />
        <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-white/[0.04]" />
        <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-white/[0.04]" />
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <div className="h-2 w-14 rounded bg-slate-200 dark:bg-white/[0.06] animate-pulse" />
        <div className="h-3.5 w-3.5 rounded bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
      </div>
      <div className="h-7 w-12 rounded bg-slate-200 dark:bg-white/[0.06] animate-pulse" />
      <div className="h-2.5 w-20 rounded bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
    </div>
  );
}

// ─── Document Row  (Aceternity spotlight hover) ────────────────────────────────

interface DocRowProps {
  doc: DocumentSummary;
  isLast: boolean;
  deletingId: string | null;
  onDelete: (e: React.MouseEvent, id: string, name: string) => Promise<void>;
}

function DocRow({ doc, isLast, deletingId, onDelete }: DocRowProps) {
  const router  = useRouter();
  const rowRef  = useRef<HTMLLIElement>(null);
  const [pos, setPos]     = useState({ x: 0, y: 0 });
  const [isHov, setIsHov] = useState(false);

  const Icon       = sourceIcon(doc.sourceType);
  const isAnalyzed = (doc.status === 'analyzed' || doc.status === 'ready') && doc.analysisRunAt;
  const hasGrammar = isAnalyzed && doc.grammarScore        != null;
  const hasReading = isAnalyzed && doc.readabilityScore    != null;
  const hasAI      = isAnalyzed && doc.aiScore             != null;
  const issueCount = doc.grammarIssues?.length ?? 0;

  return (
    <li
      ref={rowRef}
      className={cn(
        'group relative flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors overflow-hidden',
        !isLast && 'border-b border-slate-200 dark:border-white/[0.2]',
      )}
      onMouseMove={(e) => {
        const r = rowRef.current?.getBoundingClientRect();
        if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={() => setIsHov(true)}
      onMouseLeave={() => setIsHov(false)}
      onClick={() => router.push(`/editor/${doc._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/editor/${doc._id}`)}
    >
      {/* Aceternity spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHov ? 1 : 0,
          background: `radial-gradient(340px circle at ${pos.x}px ${pos.y}px, rgba(99,102,241,0.08) 0%, transparent 65%)`,
        }}
      />
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-[2px] bg-indigo-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center rounded-r-full" />

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0 h-9 w-9 rounded-xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
        <Icon className="h-4 w-4 text-slate-400 dark:text-white/30 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
      </div>

      {/* Name + meta */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-white/80 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
          {doc.originalFileName}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] text-slate-400 dark:text-white/30">
          <span className="capitalize">{sourceTypeLabel(doc.sourceType)}</span>
          <span>·</span>
          <span>{formatWordCount(doc.wordCount)}</span>
          <span>·</span>
          <span>{formatRelativeTime(doc.createdAt)}</span>
          {isAnalyzed && (
            <>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-emerald-500 dark:text-emerald-500/60">
                <CheckCircle2 className="h-2.5 w-2.5" />
                analysed {formatRelativeTime(doc.analysisRunAt!)}
              </span>
            </>
          )}
          {!isAnalyzed && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-amber-500 dark:text-amber-500/60">
                <Clock className="h-2.5 w-2.5" /> not analysed
              </span>
            </>
          )}
        </div>
      </div>

      {/* Score tokens */}
      {isAnalyzed ? (
        <div className="relative z-10 hidden sm:flex items-center gap-5 flex-shrink-0">
          {hasGrammar && <ScoreToken label="Grammar" value={doc.grammarScore!}     variant="grammar"     />}
          {hasReading && <ScoreToken label="Read."   value={doc.readabilityScore!} variant="readability" />}
          {hasAI      && <ScoreToken label="AI %"    value={doc.aiScore!}           variant="ai"          />}
          {issueCount > 0 ? (
            <div className="flex flex-col items-center min-w-[44px]">
              <span className="text-sm font-bold tabular-nums text-amber-500 dark:text-amber-400">{issueCount}</span>
              <span className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5">issues</span>
            </div>
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-500/60 flex-shrink-0" />
          )}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
          className="relative z-10 hidden sm:block flex-shrink-0 text-xs font-medium text-indigo-500 dark:text-indigo-400/60 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
        >
          Run analysis →
        </button>
      )}

      {/* Actions — visible on hover */}
      <div
        className="relative z-10 flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/editor/${doc._id}`); }}
          title="Edit"
          className="rounded-lg p-2 text-slate-300 dark:text-white/25 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
          title="Analysis"
          className="rounded-lg p-2 text-slate-300 dark:text-white/25 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => onDelete(e, doc._id, doc.originalFileName)}
          disabled={deletingId === doc._id}
          title="Delete"
          className="rounded-lg p-2 text-slate-300 dark:text-white/20 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30"
        >
          {deletingId === doc._id
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </li>
  );
}

// ─── Score token ──────────────────────────────────────────────────────────────

function ScoreToken({ label, value, variant }: {
  label: string;
  value: number;
  variant: 'grammar' | 'readability' | 'ai';
}) {
  return (
    <div className="flex flex-col items-center min-w-[44px]">
      <span className={`text-sm font-bold tabular-nums ${scoreColor(variant, value)}`}>{value}</span>
      <span className="text-[10px] text-slate-400 dark:text-white/25 mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user }   = useAuth();
  const router     = useRouter();
  const { usage }  = useUsage();

  const [documents, setDocuments]   = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [total, setTotal]           = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy]         = useState<'recent' | 'name' | 'score'>('recent');
  const [query, setQuery]           = useState('');

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const { documents: docs, total: t } = await documentApi.list(1, 50);
      setDocuments(docs);
      setTotal(t);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"?\nThis cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await documentApi.delete(id);
      setDocuments((prev) => prev.filter((d) => d._id !== id));
      setTotal((t) => t - 1);
      toast.success('Document deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const firstName    = user?.name?.split(' ')[0] ?? 'there';
  const analyzedDocs = documents.filter((d) => d.status === 'analyzed' || d.status === 'ready');
  const docsWithGram = analyzedDocs.filter((d) => d.grammarScore != null);
  const avgGrammar   = docsWithGram.length
    ? Math.round(docsWithGram.reduce((s, d) => s + (d.grammarScore ?? 0), 0) / docsWithGram.length)
    : null;
  const totalWords  = documents.reduce((s, d) => s + (d.wordCount || 0), 0);
  const totalIssues = analyzedDocs.reduce((s, d) => s + (d.grammarIssues?.length ?? 0), 0);

  const stats = [
    {
      label:  'Documents',
      value:  String(total),
      sub:    `${analyzedDocs.length} analysed`,
      icon:   FileText,
      accent: 'text-indigo-500 dark:text-indigo-400',
    },
    {
      label:  'Avg Grammar',
      value:  avgGrammar != null ? String(avgGrammar) : '—',
      sub:    avgGrammar != null ? grammarScoreLabel(avgGrammar) : 'Run analysis',
      icon:   TrendingUp,
      accent: avgGrammar == null
        ? 'text-slate-300 dark:text-white/20'
        : avgGrammar >= 80 ? 'text-emerald-500 dark:text-emerald-400'
        : avgGrammar >= 55 ? 'text-amber-500 dark:text-amber-400'
        : 'text-red-500 dark:text-red-400',
    },
    {
      label:  'Grammar Issues',
      value:  analyzedDocs.length ? String(totalIssues) : '—',
      sub:    analyzedDocs.length ? `across ${docsWithGram.length} doc${docsWithGram.length !== 1 ? 's' : ''}` : 'No analysis yet',
      icon:   AlertTriangle,
      accent: 'text-amber-500 dark:text-amber-400',
    },
    {
      label:  'Total Words',
      value:  formatWordCount(totalWords),
      sub:    `${documents.length} file${documents.length !== 1 ? 's' : ''}`,
      icon:   BookOpen,
      accent: 'text-violet-500 dark:text-violet-400',
    },
  ];

  const sortedFiltered = [...documents]
    .filter((d) => !query || d.originalFileName.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name')  return a.originalFileName.localeCompare(b.originalFileName);
      if (sortBy === 'score') return (b.grammarScore ?? -1) - (a.grammarScore ?? -1);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="min-h-screen">

      <main className="relative mx-auto max-w-5xl px-4 pt-12 pb-16 sm:px-6">

        {/* Top indigo glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-30 dark:opacity-20 -z-10"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(99,102,241,0.35) 0%, transparent 80%)' }}
        />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-0.5 backdrop-blur-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600">
                <Sparkles className="h-2 w-2 text-white" />
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Workspace</span>
            </div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
              {isLoading ? 'Loading…' : `Hello, ${firstName}`}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-white/35">
              {isLoading
                ? 'Fetching your documents'
                : total === 0
                ? 'Upload your first document to get started'
                : `${total} document${total !== 1 ? 's' : ''} in your workspace`}
            </p>
          </div>
          <Link
            href="/upload"
            className="group flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 hover:-translate-y-0.5 transition-all active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Document</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>

        {/* ── Stats label ─────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Overview</span>
          </div>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/[0.06]" />
        </div>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            : stats.map((s) => (
                <GlowCard key={s.label} className="p-5 flex flex-col border border-slate-200/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/25">{s.label}</p>
                    <s.icon className={cn('h-3.5 w-3.5', s.accent)} />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{s.value}</p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-white/25">{s.sub}</p>
                </GlowCard>
              ))}
        </div>

        {/* ── AI Usage Meter ──────────────────────────────────────────── */}
        {usage && (
          <div className="relative mb-8 flex items-center gap-3 overflow-hidden rounded-2xl border border-indigo-200/60 dark:border-indigo-500/20 bg-white/80 backdrop-blur-sm dark:bg-[#0d0d1a]/80 px-5 py-4">
            <BorderBeam duration={10} colorFrom="#6366f1" colorTo="#a855f7" />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex-shrink-0">
              <Zap className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-sm font-semibold text-slate-700 dark:text-white/80">
                  AI analyses used: <span className="text-indigo-600 dark:text-indigo-400">{usage.geminiCallsThisHour}</span> / {usage.maxCallsPerHour} this hour
                </p>
                {usage.remaining === 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/20">
                    Limit reached
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full max-w-xs rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    usage.remaining === 0 ? 'bg-red-500' : usage.remaining <= 3 ? 'bg-amber-500' : 'bg-indigo-500',
                  )}
                  style={{ width: `${Math.round((usage.geminiCallsThisHour / usage.maxCallsPerHour) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-white/20">
                {usage.remaining > 0
                  ? `${usage.remaining} remaining · resets ${new Date(usage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : `Resets at ${new Date(usage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                {usage.totalAnalyses > 0 && ` · ${usage.totalAnalyses} total analyses`}
              </p>
            </div>
          </div>
        )}

        {/* ── Documents label ──────────────────────────────────────────── */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Documents</span>
          </div>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/[0.06]" />
          <span className="text-[11px] font-semibold text-slate-400 dark:text-white/30">
            {!isLoading && `${sortedFiltered.length} of ${total}`}
          </span>
        </div>

        {/* ── Document list ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.3] bg-white/70 backdrop-blur-sm dark:bg-white/[0.02] overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/[0.08]">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 dark:text-white/20 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="w-full rounded-lg bg-slate-50 dark:bg-white/[0.03] pl-8 pr-3 py-1.5 text-xs text-slate-700 dark:text-white/80 placeholder:text-slate-300 dark:placeholder:text-white/20 border border-slate-200 dark:border-white/[0.05] focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/40 focus:bg-white dark:focus:bg-white/[0.05] transition-colors"
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-300 dark:text-white/20 mr-1 flex-shrink-0" />
              {(['recent', 'name', 'score'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setSortBy(val)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all',
                    sortBy === val
                      ? 'bg-indigo-600 text-white dark:bg-indigo-600/80'
                      : 'text-slate-400 dark:text-white/25 hover:text-slate-700 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.04]',
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          {!isLoading && sortedFiltered.length > 0 && (
            <div className="hidden sm:flex items-center px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-white/20 border-b border-slate-200 dark:border-white/[0.08]">
              <span className="flex-1">Document</span>
              <span className="mr-[90px]">Scores</span>
            </div>
          )}

          {/* Rows */}
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
          ) : sortedFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                <Upload className="h-7 w-7 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-slate-900 dark:text-white">
                {query ? 'No results' : 'No documents yet'}
              </h3>
              <p className="mb-6 max-w-xs text-sm text-slate-400 dark:text-white/30 leading-relaxed">
                {query
                  ? `No documents match "${query}".`
                  : 'Upload a Word doc, PDF, plain text, or a YouTube link to begin AI analysis.'}
              </p>
              {!query && (
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Upload your first document
                </Link>
              )}
            </div>
          ) : (
            <ul>
              {sortedFiltered.map((doc, idx) => (
                <DocRow
                  key={doc._id}
                  doc={doc}
                  isLast={idx === sortedFiltered.length - 1}
                  deletingId={deletingId}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}

          {/* Footer */}
          {!isLoading && sortedFiltered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
              <p className="text-[11px] text-slate-400 dark:text-white/20">
                {sortedFiltered.length} document{sortedFiltered.length !== 1 ? 's' : ''}
                {query && <> matching <span className="text-slate-600 dark:text-white/35">&ldquo;{query}&rdquo;</span></>}
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-500 dark:text-indigo-400/60 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add document
              </Link>
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}