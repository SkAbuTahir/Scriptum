'use client';

import {
  AnalysisResult, GrammarIssue, AISuggestion, AnalysisProgress,
} from '@/types';
import { cn, scoreColor, positiveScoreColor, grammarScoreLabel, scoreLabel } from '@/lib/utils';
import {
  BarChart2, Loader2, AlertTriangle, CheckCircle2,
  Lightbulb, MessageSquare, BookOpen,
  ChevronDown, ChevronRight, XCircle, AlertCircle, Info,
  RefreshCw, ArrowRight, Brain, Mic2, BookMarked, Gauge, Sparkles, X,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface Props {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  onAnalyze: () => void;
  onCancelAnalyze?: () => void;
  documentStatus: string;
  expanded?: boolean;
}

function ScoreRing({
  value, label, sublabel, size = 'md', isDark,
}: { value: number; label: string; sublabel?: string; size?: 'sm'|'md'|'lg'; isDark: boolean }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimatedValue(Math.min(100, Math.max(0, value))), 100);
    return () => clearTimeout(t);
  }, [value]);
  const pct = animatedValue;
  const configs = { sm: { r: 20, dim: 48, sw: 4 }, md: { r: 26, dim: 60, sw: 5 }, lg: { r: 34, dim: 76, sw: 6 } };
  const { r, dim, sw } = configs[size];
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const ringColor = value >= 75 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  const trackColor = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = value >= 75 ? 'text-green-500' : value >= 50 ? 'text-amber-500' : 'text-red-500';
  const textSize = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn('relative', size === 'lg' ? 'h-[76px] w-[76px]' : size === 'sm' ? 'h-12 w-12' : 'h-[60px] w-[60px]')}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${dim} ${dim}`}>
          <circle cx={dim/2} cy={dim/2} r={r} fill="none" strokeWidth={sw} stroke={trackColor} />
          <circle cx={dim/2} cy={dim/2} r={r} fill="none" strokeWidth={sw} stroke={ringColor}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center font-bold', textSize, textColor)}>
          {value < 0 ? '—' : `${Math.round(value)}`}
        </span>
      </div>
      <p className={cn('text-center text-xs font-semibold', isDark ? 'text-slate-200' : 'text-slate-700')}>{label}</p>
      {sublabel && <p className="text-center text-[10px] text-slate-500">{sublabel}</p>}
    </div>
  );
}

function ProgressScreen({ progress, onCancel, isDark }: { progress: AnalysisProgress; onCancel?: () => void; isDark: boolean }) {
  const pct = progress.total > 0 ? Math.round((progress.step / progress.total) * 100) : 0;
  const r = 52; const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const steps = [
    'Extracting document text','Running grammar check','Computing grammar score',
    'Scoring AI content likelihood','Generating writing suggestions',
    'Analysing writing tone','Computing tone confidence','Readability & vocabulary','Finalising results',
  ];
  return (
    <div className={cn('rounded-2xl border p-6 flex flex-col items-center gap-6', isDark ? 'bg-[#0f0f1a] border-indigo-900/40' : 'bg-white border-indigo-100')}>
      <div className="relative h-[120px] w-[120px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" stroke={isDark ? '#1e1b4b' : '#e0e7ff'} />
          <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" stroke="url(#progressGrad)"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-black', isDark ? 'text-white' : 'text-slate-900')}>{pct}%</span>
          <span className="text-[10px] text-slate-500">complete</span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className={cn('text-base font-bold flex items-center gap-2 justify-center', isDark ? 'text-white' : 'text-slate-900')}>
          <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />{progress.label}
        </p>
        <p className="text-xs text-slate-500">Step {progress.step} of {progress.total}</p>
      </div>
      <div className="w-full space-y-1.5 max-w-xs">
        {steps.slice(0, progress.total).map((step, i) => {
          const done = i < progress.step; const active = i === progress.step;
          return (
            <div key={step} className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all',
              done ? (isDark ? 'bg-indigo-950/40 text-indigo-300' : 'bg-indigo-50 text-indigo-600')
              : active ? (isDark ? 'bg-indigo-900/30 text-white' : 'bg-indigo-100 text-indigo-800')
              : (isDark ? 'text-slate-600' : 'text-slate-300'))}>
              {done
                ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                : active
                  ? <Loader2 className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400 animate-spin" />
                  : <div className={cn('h-3.5 w-3.5 rounded-full border flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-300')} />}
              {step}
            </div>
          );
        })}
      </div>
      <div className={cn('w-full rounded-full h-1.5', isDark ? 'bg-slate-800' : 'bg-slate-200')}>
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
          style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
      {onCancel && (
        <button onClick={onCancel} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
          isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-950/30' : 'text-slate-500 hover:text-red-600 hover:bg-red-50')}>
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      )}
    </div>
  );
}

const severityConfig = {
  error:      { label: 'Error',      icon: XCircle,     className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' },
  warning:    { label: 'Warning',    icon: AlertCircle, className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
  suggestion: { label: 'Suggestion', icon: Info,        className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' },
} as const;

function GrammarIssueCard({ issue, isDark }: { issue: GrammarIssue; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const sev = (issue.severity ?? 'warning') as keyof typeof severityConfig;
  const { label: sevLabel, icon: SevIcon, className: sevClass } = severityConfig[sev] ?? severityConfig.warning;
  return (
    <div className={cn('rounded-xl border p-3 transition-all',
      sev === 'error' ? (isDark ? 'border-red-900/40 bg-red-950/20' : 'border-red-100 bg-red-50/40')
      : sev === 'suggestion' ? (isDark ? 'border-blue-900/40 bg-blue-950/20' : 'border-blue-100 bg-blue-50/40')
      : (isDark ? 'border-amber-900/40 bg-amber-950/20' : 'border-amber-100 bg-amber-50/40'))}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium', sevClass)}>
              <SevIcon className="h-3 w-3" /> {sevLabel}
            </span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}>{issue.rule.category}</span>
          </div>
          <p className={cn('text-sm font-medium leading-snug', isDark ? 'text-slate-100' : 'text-slate-800')}>{issue.shortMessage || issue.message}</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className={cn('mt-2.5 space-y-2 border-t pt-2.5', isDark ? 'border-slate-700' : 'border-slate-200')}>
          {issue.shortMessage && issue.shortMessage !== issue.message && (
            <p className={cn('text-xs', isDark ? 'text-slate-300' : 'text-slate-600')}>{issue.message}</p>
          )}
          <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
            <span className={cn('font-medium', isDark ? 'text-slate-300' : 'text-slate-600')}>Rule: </span>{issue.rule.description || issue.rule.id}
          </p>
          {issue.context && (
            <div className={cn('rounded-lg px-2.5 py-1.5 text-xs font-mono leading-relaxed', isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}>…{issue.context}…</div>
          )}
          {issue.replacements.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-slate-400 font-medium">Suggested fixes:</p>
              <div className="flex flex-wrap gap-1">
                {issue.replacements.slice(0, 5).map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 rounded bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-xs text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <ArrowRight className="h-2.5 w-2.5" /> {r}
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

function SuggestionCard({ suggestion, isDark }: { suggestion: AISuggestion; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const config = suggestionTypeConfig[suggestion.type] ?? { bg: 'bg-slate-100 text-slate-600', icon: '💡' };
  return (
    <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-white')}>
      <button onClick={() => setOpen((o) => !o)} className={cn('flex w-full items-start gap-3 p-3 text-left transition-colors', isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}>
        <span className="text-base flex-shrink-0 mt-0.5">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', config.bg)}>{suggestion.type}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
            "{suggestion.original.slice(0, 120)}{suggestion.original.length > 120 ? '…' : ''}"
          </p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />}
      </button>
      {open && (
        <div className={cn('border-t p-3 space-y-2.5', isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-100 bg-slate-50')}>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Original</p>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-2.5 py-2 text-xs text-red-700 dark:text-red-300 leading-relaxed">{suggestion.original}</div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Suggested</p>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40 px-2.5 py-2 text-xs text-green-700 dark:text-green-300 leading-relaxed">{suggestion.suggested}</div>
          </div>
          <div className="flex items-start gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className={cn('text-xs', isDark ? 'text-slate-300' : 'text-slate-600')}>{suggestion.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TonePanel({ analysis, isDark }: { analysis: AnalysisResult; isDark: boolean }) {
  const tone = analysis.toneAnalysis;
  if (!tone) return <div className="py-8 text-center text-xs text-slate-400">Tone analysis not available. Re-run analysis to generate it.</div>;
  const toneColors: Record<string, string> = {
    formal: 'bg-indigo-500', conversational: 'bg-emerald-500', persuasive: 'bg-orange-500',
    technical: 'bg-cyan-500', narrative: 'bg-pink-500', instructional: 'bg-violet-500',
  };
  const toneDescriptions: Record<string, string> = {
    formal: 'Structured and professional language', conversational: 'Friendly and approachable style',
    persuasive: 'Convincing and argument-driven', technical: 'Precise and domain-specific',
    narrative: 'Storytelling and descriptive', instructional: 'Step-based and directive',
  };
  const sortedScores = Object.entries(tone.scores).sort(([, a], [, b]) => b - a);
  return (
    <div className="space-y-5">
      <div className={cn('rounded-xl border p-4', isDark ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50 border-indigo-200')}>
        <div className="flex items-center gap-3">
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', isDark ? 'bg-indigo-900/60' : 'bg-indigo-100')}>
            <Mic2 className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Dominant Tone</p>
            <p className={cn('text-lg font-bold capitalize', isDark ? 'text-white' : 'text-slate-900')}>{tone.dominant}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-500">Confidence</p>
            <p className="text-base font-bold text-indigo-500">{Math.round(tone.confidence * 100)}%</p>
          </div>
        </div>
        {tone.description && <p className={cn('mt-3 text-sm leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')}>{tone.description}</p>}
      </div>
      <div className="space-y-2.5">
        <p className={cn('text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>Tone Breakdown</p>
        {sortedScores.map(([toneName, score]) => {
          const pct = Math.round(score * 100);
          return (
            <div key={toneName} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={cn('text-xs capitalize font-medium', isDark ? 'text-slate-300' : 'text-slate-700')}>{toneName}</span>
                <span className="text-xs text-slate-500">{pct}%</span>
              </div>
              <div className={cn('h-2 w-full rounded-full', isDark ? 'bg-slate-800' : 'bg-slate-200')}>
                <div className={cn('h-full rounded-full transition-all duration-700', toneColors[toneName] ?? 'bg-slate-500')} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-slate-500">{toneDescriptions[toneName] ?? ''}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VocabPanel({ analysis, isDark }: { analysis: AnalysisResult; isDark: boolean }) {
  const vocab = analysis.vocabularyStats;
  return (
    <div className="space-y-5">
      <div>
        <p className={cn('text-xs font-semibold uppercase tracking-wide mb-3', isDark ? 'text-slate-400' : 'text-slate-500')}>Readability</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Reading Time', value: analysis.readingTimeMinutes != null ? `~${analysis.readingTimeMinutes} min` : '—', icon: BookOpen },
            { label: 'Grade Level',  value: analysis.fleschGradeLevel ?? '—', icon: BookMarked },
            { label: 'Avg Sentence', value: analysis.avgSentenceLength != null ? `${analysis.avgSentenceLength} wds` : '—', icon: MessageSquare },
          ].map((stat) => (
            <div key={stat.label} className={cn('rounded-xl border p-3 flex items-start gap-2.5', isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', isDark ? 'bg-indigo-900/40' : 'bg-indigo-50')}>
                <stat.icon className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <p className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-slate-900')}>{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {vocab ? (
        <>
          <div>
            <p className={cn('text-xs font-semibold uppercase tracking-wide mb-3', isDark ? 'text-slate-400' : 'text-slate-500')}>Vocabulary Stats</p>
            {[
              { label: 'Vocabulary Richness', value: vocab.richness,          description: 'Unique concepts and ideas per passage' },
              { label: 'Unique Word Ratio',   value: vocab.uniqueWordRatio,   description: 'Fraction of distinct words used' },
              { label: 'Complex Word Ratio',  value: vocab.complexWordRatio,  description: 'Words with 3+ syllables' },
            ].map((metric) => {
              const pct = Math.round(metric.value * 100);
              const color = pct >= 60 ? 'bg-green-500' : pct >= 35 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={metric.label} className="mb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xs font-semibold', isDark ? 'text-slate-300' : 'text-slate-700')}>{metric.label}</span>
                    <span className="text-xs text-slate-500">{pct}%</span>
                  </div>
                  <div className={cn('h-2.5 rounded-full', isDark ? 'bg-slate-800' : 'bg-slate-200')}>
                    <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500">{metric.description}</p>
                </div>
              );
            })}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className={cn('rounded-xl border p-3', isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}>
                <p className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-slate-900')}>{vocab.avgWordLength.toFixed(1)}</p>
                <p className="text-[10px] text-slate-500">Avg Word Length (chars)</p>
              </div>
              <div className={cn('rounded-xl border p-3', isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}>
                <p className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-slate-900')}>{Math.round(vocab.richness * 100)}/100</p>
                <p className="text-[10px] text-slate-500">Richness Score</p>
              </div>
            </div>
          </div>
          {vocab.topWords?.length > 0 && (
            <div>
              <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2', isDark ? 'text-slate-400' : 'text-slate-500')}>Most Frequent Words</p>
              <div className="flex flex-wrap gap-1.5">
                {vocab.topWords.slice(0, 15).map(({ word, count }) => (
                  <span key={word} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                    isDark ? 'bg-indigo-950/50 text-indigo-300 border border-indigo-800/40' : 'bg-indigo-50 text-indigo-700 border border-indigo-100')}>
                    {word}<span className="rounded-full bg-indigo-500/20 px-1 text-[10px]">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="py-4 text-center text-xs text-slate-400">Vocabulary data not available. Re-run analysis to generate it.</p>
      )}
    </div>
  );
}

type TabId = 'overview' | 'grammar' | 'suggestions' | 'tone' | 'vocab';

function AnalysisPanel({ analysis, isAnalyzing, analysisProgress, onAnalyze, onCancelAnalyze, documentStatus, expanded = false }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [grammarFilter, setGrammarFilter] = useState<'all'|'error'|'warning'|'suggestion'>('all');

  // Memoized, sorted, and formatted data for consistency
  const sortedIssues = useMemo(() => {
    if (!analysis?.grammarIssues) return [];
    const order: Record<string, number> = { error: 0, warning: 1, suggestion: 2 };
    return [...analysis.grammarIssues].sort((a, b) => {
      const sevA = order[a.severity ?? 'warning'] ?? 1;
      const sevB = order[b.severity ?? 'warning'] ?? 1;
      // If same severity, sort by message for determinism
      if (sevA === sevB) return (a.message || '').localeCompare(b.message || '');
      return sevA - sevB;
    });
  }, [analysis]);

  const filteredIssues = useMemo(() => {
    if (grammarFilter === 'all') return sortedIssues;
    return sortedIssues.filter((i) => (i.severity ?? 'warning') === grammarFilter);
  }, [sortedIssues, grammarFilter]);

  const errorCount = useMemo(() => analysis?.grammarIssues?.filter((i) => i.severity === 'error').length ?? 0, [analysis]);
  const warningCount = useMemo(() => analysis?.grammarIssues?.filter((i) => i.severity === 'warning').length ?? 0, [analysis]);
  const grammarScore = analysis?.grammarScore ?? 0;

  // Memoize sorted suggestions for consistency
  const sortedSuggestions = useMemo(() => {
    if (!analysis?.suggestions) return [];
    return [...analysis.suggestions].sort((a, b) => (a.type || '').localeCompare(b.type || '') || (a.original || '').localeCompare(b.original || ''));
  }, [analysis]);

  // Memoize sorted topWords for vocab
  const sortedTopWords = useMemo(() => {
    if (!analysis?.vocabularyStats?.topWords) return [];
    return [...analysis.vocabularyStats.topWords].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  }, [analysis]);

  // Format numbers consistently
  const formatNum = (n: number | undefined | null, digits = 2) =>
    n == null || isNaN(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });

  // Fallbacks for all fields
  const wordCount = analysis?.wordCount ?? 0;
  const grammarIssuesCount = analysis?.grammarIssues?.length ?? 0;
  const suggestionsCount = analysis?.suggestions?.length ?? 0;
  const readingTime = analysis?.readingTimeMinutes != null ? `~${formatNum(analysis.readingTimeMinutes, 1)} min` : '—';
  const gradeLevel = analysis?.fleschGradeLevel != null ? formatNum(analysis.fleschGradeLevel, 1) : '—';
  const dominantTone = analysis?.toneAnalysis?.dominant ?? '—';
  const aiLikelihoodScore = analysis?.aiLikelihoodScore ?? -1;
  const readabilityScore = analysis?.readabilityScore ?? 0;
  const vocabRichness = analysis?.vocabularyStats ? Math.round((analysis.vocabularyStats.richness ?? 0) * 100) : 0;

  // Last analyzed timestamp/hash (if available)
  const lastAnalyzed = analysis?.lastAnalyzed ? new Date(analysis.lastAnalyzed).toLocaleString() : null;
  const contentHash = analysis?.contentHash ?? null;

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'overview',    label: 'Overview',   icon: Gauge },
    { id: 'grammar',     label: 'Grammar',    icon: AlertTriangle, badge: grammarIssuesCount },
    { id: 'suggestions', label: 'Tips',       icon: Lightbulb,     badge: suggestionsCount },
    { id: 'tone',        label: 'Tone',       icon: Mic2 },
    { id: 'vocab',       label: 'Vocab',      icon: BookMarked },
  ];

  const cardClass = cn('rounded-2xl border', isDark ? 'bg-[#0f0f1a] border-slate-800' : 'bg-white border-slate-100');
  const subCardClass = cn('rounded-xl border p-4', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100');

  if (isAnalyzing && analysisProgress) return <ProgressScreen progress={analysisProgress} onCancel={onCancelAnalyze} isDark={isDark} />;

  if (isAnalyzing) return (
    <div className={cn('rounded-2xl border flex flex-col items-center justify-center gap-5 py-14', isDark ? 'bg-[#0f0f1a] border-indigo-900/40' : 'bg-white border-indigo-100')}>
      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      <p className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>Initialising analysis engine…</p>
      {onCancelAnalyze && <button onClick={onCancelAnalyze} className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1"><X className="h-3.5 w-3.5" /> Cancel</button>}
    </div>
  );

  if (!analysis) return (
    <div className={cn('rounded-2xl border flex flex-col items-center justify-center gap-6 py-16 text-center', isDark ? 'bg-[#0f0f1a] border-slate-800' : 'bg-white border-slate-100')}>
      <div className={cn('h-16 w-16 rounded-2xl flex items-center justify-center', isDark ? 'bg-indigo-950/60' : 'bg-indigo-50')}>
        <Brain className="h-8 w-8 text-indigo-400" />
      </div>
      <div>
        <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-slate-900')}>No analysis yet</p>
        <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">Run the premium AI analyser to get grammar scores, AI detection, tone analysis, vocabulary stats and writing tips.</p>
      </div>
      <button onClick={onAnalyze} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm">
        <Sparkles className="h-4 w-4" /> Run Premium Analysis
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={cn(cardClass, 'p-2')}>
        <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap',
                activeTab === tab.id ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')}>
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  activeTab === tab.id ? 'bg-white/20 text-white' : (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'))}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className={cn(cardClass, 'p-5 space-y-6')}>
          <div>
            <p className={cn('text-xs font-semibold uppercase tracking-widest mb-4', isDark ? 'text-slate-500' : 'text-slate-400')}>Writing Quality</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ScoreRing value={grammarScore} label="Grammar" sublabel={grammarScoreLabel(grammarScore)} isDark={isDark} />
              <ScoreRing value={readabilityScore} label="Readability" isDark={isDark} />
              <ScoreRing value={aiLikelihoodScore < 0 ? 0 : aiLikelihoodScore} label="AI Likelihood"
                sublabel={aiLikelihoodScore >= 0 ? scoreLabel(aiLikelihoodScore, 'ai') : undefined} isDark={isDark} />
              <ScoreRing value={vocabRichness} label="Vocab Richness" isDark={isDark} />
            </div>
          </div>
          <div className={cn('h-px', isDark ? 'bg-slate-800' : 'bg-slate-100')} />
          <div>
            <p className={cn('text-xs font-semibold uppercase tracking-widest mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>Document Stats</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Words',          value: wordCount.toLocaleString(), icon: BookOpen,      color: 'text-indigo-400' },
                { label: 'Grammar Issues', value: grammarIssuesCount,          icon: AlertTriangle, color: errorCount > 0 ? 'text-red-400' : 'text-green-400' },
                { label: 'Writing Tips',   value: suggestionsCount,            icon: Lightbulb,     color: 'text-amber-400' },
                { label: 'Reading Time',   value: readingTime,                 icon: BookMarked,    color: 'text-cyan-400' },
                { label: 'Grade Level',    value: gradeLevel,                  icon: Gauge,         color: 'text-violet-400' },
                { label: 'Dominant Tone',  value: dominantTone,                icon: Mic2,          color: 'text-pink-400' },
              ].map((stat) => (
                <div key={stat.label} className={cn(subCardClass, 'flex items-center gap-2.5')}>
                  <stat.icon className={cn('h-4 w-4 flex-shrink-0', stat.color)} />
                  <div className="min-w-0">
                    <p className={cn('text-sm font-bold truncate capitalize', isDark ? 'text-white' : 'text-slate-900')}>{stat.value}</p>
                    <p className="text-[10px] text-slate-500">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {aiLikelihoodScore >= 0 && (
            <div className={cn('rounded-xl border p-3 text-xs',
              aiLikelihoodScore >= 70 ? (isDark ? 'bg-red-950/30 border-red-900/40 text-red-300' : 'bg-red-50 border-red-200 text-red-700')
              : aiLikelihoodScore >= 40 ? (isDark ? 'bg-amber-950/30 border-amber-900/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700')
              : (isDark ? 'bg-green-950/30 border-green-900/40 text-green-300' : 'bg-green-50 border-green-200 text-green-700'))}>
              <strong>AI Likelihood: {scoreLabel(aiLikelihoodScore, 'ai')}</strong>{' — '}
              {aiLikelihoodScore >= 70 ? 'High probability this content was AI-generated.'
                : aiLikelihoodScore >= 40 ? 'Some AI patterns detected. Review for authenticity.'
                : 'Content appears mostly human-written.'}
            </div>
          )}
          <div className={cn('rounded-xl border p-3 text-xs',
            grammarScore >= 80 ? (isDark ? 'bg-green-950/30 border-green-900/40 text-green-300' : 'bg-green-50 border-green-200 text-green-700')
            : grammarScore >= 55 ? (isDark ? 'bg-amber-950/30 border-amber-900/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700')
            : (isDark ? 'bg-red-950/30 border-red-900/40 text-red-300' : 'bg-red-50 border-red-200 text-red-700'))}>
            <strong>Grammar: {grammarScoreLabel(grammarScore)}</strong>
            {errorCount > 0 ? ` — ${errorCount} critical error${errorCount !== 1 ? 's' : ''} found`
              : warningCount > 0 ? ` — ${warningCount} warning${warningCount !== 1 ? 's' : ''} to review`
              : ' — Writing looks clean!'}
          </div>
          {(lastAnalyzed || contentHash) && (
            <div className="text-xs text-slate-400 mt-2">
              {lastAnalyzed && <span>Last analyzed: {lastAnalyzed}</span>}
              {lastAnalyzed && contentHash && <span> &nbsp;|&nbsp; </span>}
              {contentHash && <span>Hash: <span className="font-mono">{contentHash}</span></span>}
            </div>
          )}
          <button onClick={onAnalyze} className={cn('w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all border',
            isDark ? 'border-indigo-800/50 text-indigo-400 hover:bg-indigo-950/50' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50')}>
            <RefreshCw className="h-4 w-4" /> Re-run Analysis
          </button>
        </div>
      )}

      {activeTab === 'grammar' && (
        <div className={cn(cardClass, 'p-4 space-y-3')}>
          {grammarIssuesCount === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-slate-900')}>No grammar issues!</p>
              <p className="text-xs text-slate-500">Your writing is grammatically clean.</p>
            </div>
          ) : (
            <>
              <div className={cn(subCardClass, 'flex flex-wrap gap-3')}>
                {[
                  { key: 'error',      icon: XCircle,     color: 'text-red-500',   count: errorCount },
                  { key: 'warning',    icon: AlertCircle, color: 'text-amber-500', count: warningCount },
                  { key: 'suggestion', icon: Info,        color: 'text-blue-500',  count: analysis.grammarIssues.filter((i) => i.severity === 'suggestion').length },
                ].filter((s) => s.count > 0).map((s) => (
                  <span key={s.key} className={cn('inline-flex items-center gap-1 text-xs', isDark ? 'text-slate-300' : 'text-slate-700')}>
                    <s.icon className={cn('h-3.5 w-3.5', s.color)} />
                    <span className="font-bold">{s.count}</span>
                    <span className="text-slate-500 capitalize">{s.key}{s.count !== 1 ? 's' : ''}</span>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['all','error','warning','suggestion'] as const).map((f) => {
                  const count = f === 'all' ? grammarIssuesCount : analysis.grammarIssues.filter((i) => (i.severity ?? 'warning') === f).length;
                  if (f !== 'all' && count === 0) return null;
                  return (
                    <button key={f} onClick={() => setGrammarFilter(f)}
                      className={cn('rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all',
                        grammarFilter === f ? (f === 'error' ? 'bg-red-600 text-white' : f === 'warning' ? 'bg-amber-500 text-white' : f === 'suggestion' ? 'bg-blue-500 text-white' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white')
                        : (isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'))}>
                      {f} ({count})
                    </button>
                  );
                })}
              </div>
              <div className={cn('space-y-2', expanded ? '' : 'max-h-[28rem] overflow-y-auto pr-1')}>
                {filteredIssues.map((issue, i) => <GrammarIssueCard key={i} issue={issue} isDark={isDark} />)}
                {filteredIssues.length === 0 && <p className="py-6 text-center text-xs text-slate-400">No {grammarFilter} issues found.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className={cn(cardClass, 'p-4 space-y-3')}>
          {suggestionsCount === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-slate-900')}>No suggestions</p>
              <p className="text-xs text-slate-500">Your document looks great!</p>
            </div>
          ) : (
            <>
              <div className={cn(subCardClass, 'flex flex-wrap gap-1.5')}>
                {Object.entries(suggestionTypeConfig).filter(([type]) => sortedSuggestions.some((s) => s.type === type)).map(([type, cfg]) => (
                  <span key={type} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs', cfg.bg)}>{cfg.icon} {type}</span>
                ))}
              </div>
              <p className="text-xs text-slate-500">{suggestionsCount} writing tip{suggestionsCount !== 1 ? 's' : ''} — click to expand</p>
              <div className="space-y-2">
                {sortedSuggestions.map((sug, i) => <SuggestionCard key={i} suggestion={sug} isDark={isDark} />)}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'tone' && <div className={cn(cardClass, 'p-5')}><TonePanel analysis={analysis} isDark={isDark} /></div>}
      {activeTab === 'vocab' && (
        <div className={cn(cardClass, 'p-5')}>
          {/* Pass sortedTopWords to VocabPanel if needed for deterministic display */}
          <VocabPanel analysis={{ ...analysis, vocabularyStats: { ...analysis.vocabularyStats, topWords: sortedTopWords } }} isDark={isDark} />
        </div>
      )}
    </div>
  );
}

export default AnalysisPanel;
