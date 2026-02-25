'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { documentApi } from '@/lib/api';
import { DocumentSummary } from '@/types';
import {
  formatRelativeTime, formatWordCount, sourceTypeLabel,
  statusBadgeColor, cn, grammarScoreLabel,
} from '@/lib/utils';
import {
  FileText, Upload, Plus, Trash2, BarChart2,
  FileType, Youtube, File, Loader2, BookOpen,
  ChevronRight, Pencil, CheckCircle2, Clock,
  AlertTriangle, TrendingUp, Lightbulb, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sourceIcon = (type: string) => {
  switch (type) {
    case 'docx': return FileType;
    case 'pdf':  return File;
    case 'youtube': return Youtube;
    default: return FileText;
  }
};

// ─── Score pill ───────────────────────────────────────────────────────────────

type ScoreVariant = 'grammar' | 'readability' | 'ai';

function scorePillStyle(variant: ScoreVariant, value: number) {
  if (variant === 'ai') {
    if (value >= 70) return 'ring-1 ring-red-500/20 bg-red-950/30 text-red-400';
    if (value >= 40) return 'ring-1 ring-amber-500/20 bg-amber-950/30 text-amber-400';
    return 'ring-1 ring-emerald-500/20 bg-emerald-950/30 text-emerald-400';
  }
  if (value >= 80) return 'ring-1 ring-emerald-500/20 bg-emerald-950/30 text-emerald-400';
  if (value >= 55) return 'ring-1 ring-amber-500/20 bg-amber-950/30 text-amber-400';
  return 'ring-1 ring-red-500/20 bg-red-950/30 text-red-400';
}

function ScorePill({ label, value, variant }: { label: string; value: number; variant: ScoreVariant }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', scorePillStyle(variant, value))}>
      {label} <span className="font-bold">{value}</span>
    </span>
  );
}

// ─── Mini score bar ───────────────────────────────────────────────────────────

function MiniBar({ value, variant }: { value: number; variant: ScoreVariant }) {
  const pct = Math.min(100, Math.max(0, value));
  const barColor =
    variant === 'ai'
      ? pct >= 70 ? 'bg-red-400' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400'
      : pct >= 80 ? 'bg-emerald-400' : pct >= 55 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
      <div className={cn('h-1 rounded-full transition-all duration-700', barColor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.2] bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/8 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-48 rounded bg-white/8 animate-pulse" />
          <div className="h-3 w-32 rounded bg-white/8 animate-pulse" />
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-white/8 animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-white/8 animate-pulse" />
          <div className="h-7 w-8 rounded-lg bg-white/8 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.2] bg-white/[0.025] p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
          <div className="h-7 w-12 rounded bg-white/8 animate-pulse" />
          <div className="h-3 w-20 rounded bg-white/8 animate-pulse" />
        </div>
        <div className="h-9 w-9 rounded-xl bg-white/8 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'score'>('recent');

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
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
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

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const analyzedDocs = documents.filter((d) => d.status === 'analyzed' || d.status === 'ready');
  const docsWithGrammar = analyzedDocs.filter((d) => d.grammarScore !== null && d.grammarScore !== undefined);
  const avgGrammarScore = docsWithGrammar.length
    ? Math.round(docsWithGrammar.reduce((s, d) => s + (d.grammarScore ?? 0), 0) / docsWithGrammar.length)
    : null;
  const totalIssues = analyzedDocs.reduce((s, d) => s + (d.grammarIssues?.length ?? 0), 0);

  const stats = [
    {
      label: 'Total Documents',
      value: String(total),
      sub: `${analyzedDocs.length} analyzed`,
      icon: FileText,
      iconBg: 'bg-indigo-500/10 text-indigo-400',
    },
    {
      label: 'Avg Grammar',
      value: avgGrammarScore !== null ? `${avgGrammarScore}` : '—',
      sub: avgGrammarScore !== null ? grammarScoreLabel(avgGrammarScore) : 'Run analysis',
      icon: TrendingUp,
      iconBg: avgGrammarScore === null
        ? 'bg-white/5 text-white/30'
        : avgGrammarScore >= 80
        ? 'bg-emerald-500/10 text-emerald-400'
        : avgGrammarScore >= 55
        ? 'bg-amber-500/10 text-amber-400'
        : 'bg-red-500/10 text-red-400',
    },
    {
      label: 'Grammar Issues',
      value: analyzedDocs.length ? String(totalIssues) : '—',
      sub: analyzedDocs.length ? `across ${analyzedDocs.length} doc${analyzedDocs.length !== 1 ? 's' : ''}` : 'No analysis yet',
      icon: AlertTriangle,
      iconBg: 'bg-amber-500/10 text-amber-400',
    },
    {
      label: 'Total Words',
      value: formatWordCount(documents.reduce((s, d) => s + (d.wordCount || 0), 0)),
      sub: `${documents.length} document${documents.length !== 1 ? 's' : ''}`,
      icon: BookOpen,
      iconBg: 'bg-violet-500/10 text-violet-400',
    },
  ];

  const sortedDocs = [...documents].sort((a, b) => {
    if (sortBy === 'name') return a.originalFileName.localeCompare(b.originalFileName);
    if (sortBy === 'score') return (b.grammarScore ?? -1) - (a.grammarScore ?? -1);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-[#08080f]">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[500px]"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      <main className="relative mx-auto max-w-6xl px-4 py-10 pb-32 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            {/* Greeting badge */}
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
              <Sparkles className="h-3 w-3" />
              Your workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Good to see you, {firstName}
            </h1>
            <p className="mt-1.5 text-sm text-white/40">
              {isLoading
                ? 'Loading your workspace…'
                : total > 0
                ? `${total} document${total !== 1 ? 's' : ''} in your workspace`
                : 'Upload your first document to get started'}
            </p>
          </div>
          <Link
            href="/upload"
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Document</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>

        {/* ── Stats grid ── */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            : stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/[0.2] bg-white/[0.06] p-5 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{stat.label}</p>
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', stat.iconBg)}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-white/30">{stat.sub}</p>
                </div>
              ))}
        </div>

        {/* ── Document list header ── */}
        {!isLoading && documents.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
              Documents
            </h2>
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.2] bg-white/[0.025] p-1">
              {(['recent', 'name', 'score'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setSortBy(val)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all',
                    sortBy === val
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-white/30 hover:text-white/60',
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Document list ── */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          ) : documents.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.015] py-24 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-500/10">
                <Upload className="h-9 w-9 text-indigo-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">No documents yet</h3>
              <p className="mb-6 max-w-sm text-sm leading-relaxed text-white/40">
                Upload a Word doc, PDF, plain text file, or paste a YouTube link to begin AI analysis.
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors"
              >
                <Plus className="h-4 w-4" /> Upload your first document
              </Link>
            </div>
          ) : (
            sortedDocs.map((doc) => {
              const Icon = sourceIcon(doc.sourceType);
              const isAnalyzed = (doc.status === 'analyzed' || doc.status === 'ready') && doc.analysisRunAt;
              const hasGrammar     = isAnalyzed && doc.grammarScore !== null && doc.grammarScore !== undefined;
              const hasReadability = isAnalyzed && doc.readabilityScore !== null && doc.readabilityScore !== undefined;
              const hasAI          = isAnalyzed && doc.aiScore !== null && doc.aiScore !== undefined;
              const issueCount = doc.grammarIssues?.length ?? 0;
              const tipCount   = doc.suggestions?.length ?? 0;

              return (
                <div
                  key={doc._id}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/[0.2] bg-white/[0.025] p-4 transition-colors hover:bg-white/[0.04] hover:border-indigo-500/20"
                  onClick={() => router.push(`/editor/${doc._id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/editor/${doc._id}`)}
                >
                  {/* Left accent bar on hover */}
                  <div className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Top row */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] transition-colors group-hover:bg-indigo-500/10">
                      <Icon className="h-5 w-5 text-white/40 transition-colors group-hover:text-indigo-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
                          {doc.originalFileName}
                        </p>
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', statusBadgeColor(doc.status))}>
                          {doc.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/30">
                        <span>{sourceTypeLabel(doc.sourceType)}</span>
                        <span className="hidden sm:inline">·</span>
                        <span className="hidden sm:inline">{formatWordCount(doc.wordCount)}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(doc.createdAt)}</span>
                        {isAnalyzed && (
                          <>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline-flex items-center gap-1 text-emerald-500/70">
                              <CheckCircle2 className="h-3 w-3" />
                              Analyzed {formatRelativeTime(doc.analysisRunAt!)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/editor/${doc._id}`); }}
                        className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white sm:inline-flex"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
                        className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white sm:inline-flex"
                      >
                        <BarChart2 className="h-3.5 w-3.5" /> {isAnalyzed ? 'Scores' : 'Analyse'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/editor/${doc._id}`); }}
                        className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white sm:hidden"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
                        className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white sm:hidden"
                      >
                        <BarChart2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, doc._id, doc.originalFileName)}
                        disabled={deletingId === doc._id}
                        className="rounded-lg p-2 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                      >
                        {deletingId === doc._id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </button>
                      <ChevronRight className="hidden h-4 w-4 text-white/10 sm:block" />
                    </div>
                  </div>

                  {/* Analysis scores */}
                  {isAnalyzed && (
                    <div className="mt-3 border-t border-white/[0.05] pt-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {hasGrammar     && <ScorePill label="Grammar"     value={doc.grammarScore!}     variant="grammar" />}
                          {hasReadability && <ScorePill label="Readability" value={doc.readabilityScore!} variant="readability" />}
                          {hasAI          && <ScorePill label="AI%"         value={doc.aiScore!}          variant="ai" />}
                        </div>
                        {hasGrammar && (
                          <div className="hidden lg:flex items-center gap-2 flex-1 max-w-[200px]">
                            <span className="w-16 flex-shrink-0 text-xs text-white/30">Grammar</span>
                            <MiniBar value={doc.grammarScore!} variant="grammar" />
                            <span className="w-8 flex-shrink-0 text-right text-xs font-semibold text-white/60">{doc.grammarScore}</span>
                          </div>
                        )}
                        <div className="ml-auto flex items-center gap-3 text-xs text-white/30">
                          {issueCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-400/70" />
                              {issueCount} issue{issueCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {issueCount === 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-500/60">
                              <CheckCircle2 className="h-3 w-3" /> No issues
                            </span>
                          )}
                          {tipCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Lightbulb className="h-3 w-3 text-amber-400/70" />
                              {tipCount} tip{tipCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
                            className="hidden font-medium text-indigo-400 hover:text-indigo-300 hover:underline sm:inline"
                          >
                            Full report →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Not-analyzed nudge */}
                  {!isAnalyzed && doc.status === 'pending' && (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-2.5">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0 text-white/20" />
                      <p className="text-xs text-white/30">
                        Not yet analyzed —{' '}
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
                          className="font-medium text-indigo-400 hover:underline"
                        >
                          Run analysis
                        </button>
                        {' '}to see grammar score, AI likelihood & tips
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
