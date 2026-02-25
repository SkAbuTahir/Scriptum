'use client';

import { AnalysisResult, GrammarIssue, AISuggestion } from '@/types';
import { cn, scoreColor, positiveScoreColor, grammarScoreLabel, scoreLabel } from '@/lib/utils';
import {
  BarChart2, Loader2, AlertTriangle, CheckCircle2,
  Lightbulb, Zap, MessageSquare, BookOpen,
  ChevronDown, ChevronRight, Play, XCircle, AlertCircle, Info,
  RefreshCw, ArrowRight,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  documentStatus: string;
  expanded?: boolean;
}

// ─── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({
  value,
  label,
  color,
  size = 'md',
}: {
  value: number;
  label: string;
  color: string;
  size?: 'sm' | 'md';
}) {
  const pct = Math.min(100, Math.max(0, value));
  const isSmall = size === 'sm';
  const radius = isSmall ? 22 : 28;
  const dim = isSmall ? 52 : 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn('relative', isSmall ? 'h-14 w-14' : 'h-16 w-16')}>
        <svg
          className={cn(isSmall ? 'h-14 w-14' : 'h-16 w-16', '-rotate-90')}
          viewBox={`0 0 ${dim} ${dim}`}
        >
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none" strokeWidth="5"
            className="stroke-slate-100 dark:stroke-slate-700"
          />
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none" strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn('transition-all duration-700', color)}
          />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center font-bold', isSmall ? 'text-xs' : 'text-sm', color)}>
          {value < 0 ? '—' : `${pct}`}
        </span>
      </div>
      <p className="text-center text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ─── Severity config ──────────────────────────────────────────────────────────

const severityConfig = {
  error: {
    label: 'Error',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
  },
  warning: {
    label: 'Warning',
    icon: AlertCircle,
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  suggestion: {
    label: 'Suggestion',
    icon: Info,
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  },
} as const;

// ─── Grammar Issue Card ───────────────────────────────────────────────────────

function GrammarIssueCard({ issue }: { issue: GrammarIssue }) {
  const [open, setOpen] = useState(false);
  const sev = (issue.severity ?? 'warning') as keyof typeof severityConfig;
  const { label: sevLabel, icon: SevIcon, className: sevClass } = severityConfig[sev] ?? severityConfig.warning;

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-colors',
      sev === 'error'
        ? 'border-red-100 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20'
        : sev === 'suggestion'
        ? 'border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20'
        : 'border-amber-100 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium', sevClass)}>
              <SevIcon className="h-3 w-3" />
              {sevLabel}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
              {issue.rule.category}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
            {issue.shortMessage || issue.message}
          </p>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400" />
          : <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-2.5 space-y-2 border-t border-slate-200 dark:border-slate-700 pt-2.5">
          {issue.shortMessage && issue.shortMessage !== issue.message && (
            <p className="text-xs text-slate-600 dark:text-slate-300">{issue.message}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">Rule: </span>
            {issue.rule.description || issue.rule.id}
          </p>
          {issue.context && (
            <div className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
              …{issue.context}…
            </div>
          )}
          {issue.replacements.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-slate-400 font-medium">Suggested fixes:</p>
              <div className="flex flex-wrap gap-1">
                {issue.replacements.slice(0, 5).map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-0.5 rounded bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                  >
                    <ArrowRight className="h-2.5 w-2.5" />
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

const suggestionTypeConfig: Record<string, { bg: string; icon: string }> = {
  rewrite:    { bg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',         icon: '✏️' },
  simplify:   { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',     icon: '✂️' },
  expand:     { bg: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: '📖' },
  tone:       { bg: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',         icon: '🎭' },
  clarity:    { bg: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',         icon: '🔍' },
  vocabulary: { bg: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',         icon: '📚' },
  structure:  { bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: '🏗️' },
  concise:    { bg: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: '⚡' },
};

function SuggestionCard({ suggestion, index }: { suggestion: AISuggestion; index: number }) {
  const [open, setOpen] = useState(false);
  const config = suggestionTypeConfig[suggestion.type] ?? { bg: 'bg-slate-100 text-slate-600', icon: '💡' };

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="text-base flex-shrink-0 mt-0.5">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', config.bg)}>
              {suggestion.type}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
            "{suggestion.original.slice(0, 120)}{suggestion.original.length > 120 ? '…' : ''}"
          </p>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />
          : <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-3 space-y-2.5 bg-slate-50 dark:bg-slate-800/30">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Original</p>
            <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-2.5 py-2 text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {suggestion.original}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Suggested</p>
            <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40 px-2.5 py-2 text-xs text-green-700 dark:text-green-300 leading-relaxed">
              {suggestion.suggested}
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300">{suggestion.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Grammar Category Summary ─────────────────────────────────────────────────

function GrammarSummary({ issues }: { issues: GrammarIssue[] }) {
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = { error: 0, warning: 0, suggestion: 0 };

  for (const issue of issues) {
    byCategory[issue.rule.category] = (byCategory[issue.rule.category] || 0) + 1;
    const sev = issue.severity ?? 'warning';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }

  const categories = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-3 rounded-lg border border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/30">
      <div className="flex items-center gap-3 flex-wrap">
        {bySeverity.error > 0 && (
          <span className="inline-flex items-center gap-1 text-xs">
            <XCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="font-semibold text-red-600 dark:text-red-400">{bySeverity.error}</span>
            <span className="text-slate-400">error{bySeverity.error !== 1 ? 's' : ''}</span>
          </span>
        )}
        {bySeverity.warning > 0 && (
          <span className="inline-flex items-center gap-1 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-semibold text-amber-600 dark:text-amber-400">{bySeverity.warning}</span>
            <span className="text-slate-400">warning{bySeverity.warning !== 1 ? 's' : ''}</span>
          </span>
        )}
        {bySeverity.suggestion > 0 && (
          <span className="inline-flex items-center gap-1 text-xs">
            <Info className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-semibold text-blue-600 dark:text-blue-400">{bySeverity.suggestion}</span>
            <span className="text-slate-400">suggestion{bySeverity.suggestion !== 1 ? 's' : ''}</span>
          </span>
        )}
      </div>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map(([cat, count]) => (
            <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
              {cat} <span className="font-semibold">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  'Extracting text and tokenising',
  'Running grammar & spelling check',
  'Computing grammar score',
  'Scoring AI content likelihood',
  'Calculating readability (Flesch)',
  'Generating writing tips',
];

export default function AnalysisPanel({
  analysis,
  isAnalyzing,
  onAnalyze,
  documentStatus,
  expanded = false,
}: Props) {
  const [activeSection, setActiveSection] = useState<'overview' | 'grammar' | 'suggestions'>('overview');
  const [grammarFilter, setGrammarFilter] = useState<'all' | 'error' | 'warning' | 'suggestion'>('all');

  if (isAnalyzing) {
    return (
      <div className="card flex flex-col items-center justify-center gap-5 py-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600 dark:text-brand-400" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-900 dark:text-white">Running AI Analysis…</p>
          <p className="mt-1 text-xs text-slate-400">Grammar check · AI scoring · Writing tips</p>
        </div>
        <div className="w-full space-y-2 max-w-xs">
          {LOADING_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className={cn(
                'h-1.5 w-1.5 rounded-full flex-shrink-0',
                i === 0 ? 'bg-brand-500 animate-pulse'
                : i === 1 ? 'bg-brand-400 animate-pulse'
                : 'bg-slate-200 dark:bg-slate-700'
              )} />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="card flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
          <BarChart2 className="h-7 w-7 text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">No analysis yet</p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs">
            Run AI analysis to get a grammar score, detect AI content, and receive writing tips
          </p>
        </div>
        <button onClick={onAnalyze} className="btn-primary">
          <Play className="h-4 w-4" /> Run Analysis
        </button>
      </div>
    );
  }

  const sortedIssues = [...analysis.grammarIssues].sort((a, b) => {
    const order: Record<string, number> = { error: 0, warning: 1, suggestion: 2 };
    return (order[a.severity ?? 'warning'] ?? 1) - (order[b.severity ?? 'warning'] ?? 1);
  });
  const filteredSortedIssues = grammarFilter === 'all'
    ? sortedIssues
    : sortedIssues.filter((i) => (i.severity ?? 'warning') === grammarFilter);

  const errorCount = analysis.grammarIssues.filter((i) => i.severity === 'error').length;
  const warningCount = analysis.grammarIssues.filter((i) => i.severity === 'warning').length;
  const grammarScore = analysis.grammarScore ?? 0;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="card p-2">
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'overview',     label: 'Scores',                                      icon: BarChart2 },
            { id: 'grammar',      label: `Grammar (${analysis.grammarIssues.length})`,  icon: AlertTriangle },
            { id: 'suggestions',  label: `Tips (${analysis.suggestions.length})`,       icon: Lightbulb },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as typeof activeSection)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium transition-all',
                activeSection === tab.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.id === 'overview' ? 'Scores' : tab.id === 'grammar' ? analysis.grammarIssues.length : analysis.suggestions.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview ── */}
      {activeSection === 'overview' && (
        <div className="card space-y-5">
          {/* Writing quality scores */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Writing Quality</p>
            <div className="flex items-center justify-around">
              <ScoreCircle value={grammarScore}                    label="Grammar"      color={positiveScoreColor(grammarScore)} />
              <ScoreCircle value={analysis.readabilityScore ?? 0}  label="Readability"  color={positiveScoreColor(analysis.readabilityScore ?? 0)} />
            </div>
            <div className={cn(
              'mt-3 rounded-lg px-3 py-2 text-xs text-center',
              grammarScore >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              : grammarScore >= 55 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            )}>
              <strong>Grammar: {grammarScoreLabel(grammarScore)}</strong>
              {errorCount > 0
                ? ` — ${errorCount} critical error${errorCount !== 1 ? 's' : ''} to fix`
                : warningCount > 0
                ? ` — ${warningCount} warning${warningCount !== 1 ? 's' : ''} to review`
                : ' — Clean writing!'}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Content detection scores */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Content Detection</p>
            <div className="flex items-center justify-around">
              <ScoreCircle
                value={analysis.aiLikelihoodScore < 0 ? -1 : analysis.aiLikelihoodScore}
                label="AI Likelihood"
                color={scoreColor(analysis.aiLikelihoodScore)}
              />
              <ScoreCircle
                value={analysis.plagiarismScore}
                label="Plagiarism"
                color={scoreColor(analysis.plagiarismScore)}
              />
            </div>
            {analysis.aiLikelihoodScore >= 0 && (
              <div className={cn(
                'mt-3 rounded-lg px-3 py-2 text-xs text-center',
                analysis.aiLikelihoodScore >= 70 ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                : analysis.aiLikelihoodScore >= 40 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
              )}>
                <strong>AI Likelihood: {scoreLabel(analysis.aiLikelihoodScore, 'ai')}</strong> —{' '}
                {analysis.aiLikelihoodScore >= 70
                  ? 'High probability this content was AI-generated.'
                  : analysis.aiLikelihoodScore >= 40
                  ? 'Some AI patterns detected. Review for authenticity.'
                  : 'Content appears mostly human-written.'}
              </div>
            )}
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Words',          value: analysis.wordCount.toLocaleString(),        icon: BookOpen },
              { label: 'Sentences',      value: analysis.sentenceCount.toLocaleString(),     icon: MessageSquare },
              { label: 'Grammar Issues', value: analysis.grammarIssues.length,              icon: AlertTriangle },
              { label: 'Writing Tips',   value: analysis.suggestions.length,                icon: Lightbulb },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <stat.icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onAnalyze} className="btn-secondary w-full text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Re-run Analysis
          </button>
        </div>
      )}

      {/* ── Grammar ── */}
      {activeSection === 'grammar' && (
        <div className="card space-y-3">
          {analysis.grammarIssues.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-semibold text-slate-900 dark:text-white">No grammar issues found!</p>
              <p className="text-xs text-slate-400">Your writing is grammatically clean.</p>
            </div>
          ) : (
            <>
              <GrammarSummary issues={analysis.grammarIssues} />

              {/* Severity filter */}
              <div className="flex gap-1 flex-wrap">
                {(['all', 'error', 'warning', 'suggestion'] as const).map((f) => {
                  const count = f === 'all'
                    ? analysis.grammarIssues.length
                    : analysis.grammarIssues.filter((i) => (i.severity ?? 'warning') === f).length;
                  if (f !== 'all' && count === 0) return null;
                  return (
                    <button
                      key={f}
                      onClick={() => setGrammarFilter(f)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-all',
                        grammarFilter === f
                          ? f === 'error'      ? 'bg-red-600 text-white'
                            : f === 'warning'   ? 'bg-amber-500 text-white'
                            : f === 'suggestion'? 'bg-blue-500 text-white'
                            : 'bg-brand-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      {f} ({count})
                    </button>
                  );
                })}
              </div>

              <div className={cn('space-y-2', expanded ? '' : 'max-h-[28rem] overflow-y-auto pr-1')}>
                {filteredSortedIssues.map((issue, i) => (
                  <GrammarIssueCard key={i} issue={issue} />
                ))}
                {filteredSortedIssues.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">No {grammarFilter} issues found.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Suggestions / Tips ── */}
      {activeSection === 'suggestions' && (
        <div className="card space-y-3">
          {analysis.suggestions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-semibold text-slate-900 dark:text-white">No suggestions</p>
              <p className="text-xs text-slate-400">Your document looks great!</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-2.5 bg-slate-50 dark:bg-slate-800/30">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tip Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(suggestionTypeConfig)
                    .filter(([type]) => analysis.suggestions.some((s) => s.type === type))
                    .map(([type, cfg]) => (
                      <span key={type} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', cfg.bg)}>
                        {cfg.icon} {type}
                      </span>
                    ))}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {analysis.suggestions.length} tip{analysis.suggestions.length !== 1 ? 's' : ''} — click each to expand
              </p>
              <div className="space-y-2">
                {analysis.suggestions.map((sug, i) => (
                  <SuggestionCard key={i} suggestion={sug} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
