'use client';

import {
  AnalysisResult, GrammarIssue, AnalysisProgress,
} from '@/types';
import { cn, scoreColor, positiveScoreColor, grammarScoreLabel, scoreLabel } from '@/lib/utils';
import {
  Loader2, AlertTriangle, CheckCircle2,
  Lightbulb, BookOpen,
  ChevronDown, ChevronRight, XCircle, AlertCircle, Info,
  RefreshCw, ArrowRight, Brain, Mic2, BookMarked, Gauge, Sparkles, X,
  Bot, Shield, ShieldAlert, ScanSearch, Save, FileCheck2, Hash, Clock, BarChart3,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface Props {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisProgress?: AnalysisProgress | null;
  onAnalyze: () => void;
  onCancelAnalyze?: () => void;
  onSave?: () => void;
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

function TonePanel({ analysis, isDark }: { analysis: AnalysisResult; isDark: boolean }) {
  const tone = analysis.toneAnalysis;
  if (!tone) return null;
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
  );
}

type TabId = 'overview' | 'plag' | 'grammar' | 'tone';

function AnalysisPanel({ analysis, isAnalyzing, analysisProgress, onAnalyze, onCancelAnalyze, onSave, documentStatus, expanded = false }: Props) {
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

  // Format numbers consistently
  const formatNum = (n: number | undefined | null, digits = 2) =>
    n == null || isNaN(n) ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });

  // Fallbacks for all fields
  const wordCount = analysis?.wordCount ?? 0;
  const sentenceCount = analysis?.sentenceCount ?? 0;
  const grammarIssuesCount = analysis?.grammarIssues?.length ?? 0;
  const readingTime = analysis?.readingTimeMinutes != null ? `~${formatNum(analysis.readingTimeMinutes, 1)} min` : '—';
  const gradeLevel = analysis?.fleschGradeLevel ?? '—';
  const avgSentenceLength = analysis?.avgSentenceLength != null ? `${formatNum(analysis.avgSentenceLength, 1)} wds` : '—';
  const dominantTone = analysis?.toneAnalysis?.dominant ?? '—';
  const toneConfidence = analysis?.toneAnalysis?.confidence != null ? Math.round(analysis.toneAnalysis.confidence * 100) : 0;
  const aiLikelihoodScore = analysis?.aiLikelihoodScore ?? -1;
  const readabilityScore = analysis?.readabilityScore ?? 0;
  const aiVerdict = aiLikelihoodScore >= 70 ? 'Likely AI-Generated' : aiLikelihoodScore >= 40 ? 'Possibly AI-Assisted' : aiLikelihoodScore >= 0 ? 'Appears Human-Written' : '—';

  // Last analyzed timestamp
  const lastAnalyzed = analysis?.analyzedAt ? new Date(analysis.analyzedAt).toLocaleString() : null;

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'plag',     label: 'AI / Plag', icon: ShieldAlert, badge: aiLikelihoodScore >= 0 ? aiLikelihoodScore : undefined },
    { id: 'grammar',  label: 'Grammar',   icon: AlertTriangle, badge: grammarIssuesCount },
    { id: 'tone',     label: 'Tone',      icon: Mic2 },
  ];

  const cardClass = cn('rounded-2xl border', isDark ? 'bg-[#0f0f1a] border-slate-800' : 'bg-white border-slate-100');
  const subCardClass = cn('rounded-xl border p-4', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100');

  if (isAnalyzing && analysisProgress) return <ProgressScreen progress={analysisProgress} onCancel={onCancelAnalyze} isDark={isDark} />;

  if (isAnalyzing) return (
    <div className={cn('rounded-2xl border overflow-hidden', isDark ? 'bg-[#0f0f1a] border-indigo-900/40' : 'bg-white border-indigo-100')}>
      {/* Animated header bar */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] animate-[shimmer_1.5s_linear_infinite]" />
      <div className="flex flex-col items-center gap-6 py-10 px-6">
        {/* Pulsing brain icon */}
        <div className="relative">
          <div className={cn('h-16 w-16 rounded-2xl flex items-center justify-center', isDark ? 'bg-indigo-950/60' : 'bg-indigo-50')}>
            <Brain className="h-8 w-8 text-indigo-400 animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-indigo-500" />
          </span>
        </div>
        <div className="text-center space-y-1.5">
          <p className={cn('text-base font-bold', isDark ? 'text-white' : 'text-slate-900')}>Analysing your document…</p>
          <p className="text-xs text-slate-500">Running grammar check, AI detection, tone analysis and readability scoring</p>
        </div>
        {/* Skeleton cards */}
        <div className="w-full space-y-3 max-w-sm">
          {['AI Detection', 'Grammar Check', 'Tone Analysis', 'Readability'].map((label, i) => (
            <div key={label} className={cn('rounded-xl border p-3 flex items-center gap-3', isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50')}>
              <div className={cn('h-8 w-8 rounded-lg flex-shrink-0', isDark ? 'bg-slate-800' : 'bg-slate-200',
                'animate-pulse')} style={{ animationDelay: `${i * 0.15}s` }} />
              <div className="flex-1 space-y-1.5">
                <div className={cn('h-2.5 rounded-full', isDark ? 'bg-slate-700' : 'bg-slate-200', 'animate-pulse')
                } style={{ width: `${55 + i * 10}%`, animationDelay: `${i * 0.15}s` }} />
                <div className={cn('h-2 rounded-full', isDark ? 'bg-slate-800' : 'bg-slate-100', 'animate-pulse')
                } style={{ width: '40%', animationDelay: `${i * 0.15 + 0.1}s` }} />
              </div>
              <Loader2 className="h-4 w-4 flex-shrink-0 text-indigo-400 animate-spin" style={{ animationDelay: `${i * 0.1}s` }} />
            </div>
          ))}
        </div>
        {onCancelAnalyze && (
          <button onClick={onCancelAnalyze} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-950/30' : 'text-slate-500 hover:text-red-600 hover:bg-red-50')}>
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        )}
      </div>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );

  if (!analysis) return (
    <div className={cn('rounded-2xl border flex flex-col items-center justify-center gap-6 py-16 text-center', isDark ? 'bg-[#0f0f1a] border-slate-800' : 'bg-white border-slate-100')}>
      <div className={cn('h-16 w-16 rounded-2xl flex items-center justify-center', isDark ? 'bg-indigo-950/60' : 'bg-indigo-50')}>
        <Brain className="h-8 w-8 text-indigo-400" />
      </div>
      <div>
        <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-slate-900')}>No analysis yet</p>
        <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">Run the AI analyser to get grammar scores, AI/plagiarism detection, tone analysis, and readability metrics.</p>
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
          {/* Score rings */}
          <div>
            <p className={cn('text-xs font-semibold uppercase tracking-widest mb-4', isDark ? 'text-slate-500' : 'text-slate-400')}>Writing Quality Scores</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ScoreRing value={grammarScore} label="Grammar" sublabel={grammarScoreLabel(grammarScore)} isDark={isDark} />
              <ScoreRing value={readabilityScore} label="Readability" isDark={isDark} />
              <ScoreRing value={aiLikelihoodScore < 0 ? 0 : aiLikelihoodScore} label="AI Likelihood"
                sublabel={aiLikelihoodScore >= 0 ? scoreLabel(aiLikelihoodScore, 'ai') : undefined} isDark={isDark} />
              <ScoreRing value={toneConfidence} label="Tone Confidence" isDark={isDark} />
            </div>
          </div>

          <div className={cn('h-px', isDark ? 'bg-slate-800' : 'bg-slate-100')} />

          {/* Document stats */}
          <div>
            <p className={cn('text-xs font-semibold uppercase tracking-widest mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>Document Stats</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Words',           value: wordCount.toLocaleString(),     icon: Hash,     color: 'text-indigo-400' },
                { label: 'Sentences',        value: sentenceCount.toLocaleString(), icon: BookOpen, color: 'text-blue-400' },
                { label: 'Reading Time',     value: readingTime,                    icon: Clock,    color: 'text-cyan-400' },
                { label: 'Grade Level',      value: gradeLevel,                     icon: BarChart3, color: 'text-violet-400' },
                { label: 'Avg Sentence Len', value: avgSentenceLength,              icon: Gauge,    color: 'text-amber-400' },
                { label: 'Dominant Tone',    value: dominantTone,                   icon: Mic2,     color: 'text-pink-400' },
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

          <div className={cn('h-px', isDark ? 'bg-slate-800' : 'bg-slate-100')} />

          {/* Quick status summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className={cn('rounded-xl border p-3 text-center',
              aiLikelihoodScore >= 70 ? (isDark ? 'border-red-900/40 bg-red-950/20' : 'border-red-200 bg-red-50')
              : aiLikelihoodScore >= 40 ? (isDark ? 'border-amber-900/40 bg-amber-950/20' : 'border-amber-200 bg-amber-50')
              : (isDark ? 'border-green-900/40 bg-green-950/20' : 'border-green-200 bg-green-50'))}>
              <Bot className={cn('h-4 w-4 mx-auto mb-1',
                aiLikelihoodScore >= 70 ? 'text-red-400' : aiLikelihoodScore >= 40 ? 'text-amber-400' : 'text-green-400')} />
              <p className={cn('text-[10px] font-semibold',
                aiLikelihoodScore >= 70 ? (isDark ? 'text-red-300' : 'text-red-700')
                : aiLikelihoodScore >= 40 ? (isDark ? 'text-amber-300' : 'text-amber-700')
                : (isDark ? 'text-green-300' : 'text-green-700'))}>{aiVerdict}</p>
            </div>
            <div className={cn('rounded-xl border p-3 text-center',
              grammarScore >= 80 ? (isDark ? 'border-green-900/40 bg-green-950/20' : 'border-green-200 bg-green-50')
              : grammarScore >= 55 ? (isDark ? 'border-amber-900/40 bg-amber-950/20' : 'border-amber-200 bg-amber-50')
              : (isDark ? 'border-red-900/40 bg-red-950/20' : 'border-red-200 bg-red-50'))}>
              <FileCheck2 className={cn('h-4 w-4 mx-auto mb-1',
                grammarScore >= 80 ? 'text-green-400' : grammarScore >= 55 ? 'text-amber-400' : 'text-red-400')} />
              <p className={cn('text-[10px] font-semibold',
                grammarScore >= 80 ? (isDark ? 'text-green-300' : 'text-green-700')
                : grammarScore >= 55 ? (isDark ? 'text-amber-300' : 'text-amber-700')
                : (isDark ? 'text-red-300' : 'text-red-700'))}>
                {grammarIssuesCount === 0 ? 'No Issues' : `${grammarIssuesCount} issue${grammarIssuesCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className={cn('rounded-xl border p-3 text-center', isDark ? 'border-indigo-900/40 bg-indigo-950/20' : 'border-indigo-200 bg-indigo-50')}>
              <Mic2 className="h-4 w-4 mx-auto mb-1 text-indigo-400" />
              <p className={cn('text-[10px] font-semibold capitalize', isDark ? 'text-indigo-300' : 'text-indigo-700')}>{dominantTone}</p>
            </div>
          </div>

          {lastAnalyzed && (
            <p className="text-[11px] text-slate-500 text-center">Last analysed: {lastAnalyzed}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={onAnalyze} className={cn('flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all border',
              isDark ? 'border-indigo-800/50 text-indigo-400 hover:bg-indigo-950/50' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50')}>
              <RefreshCw className="h-4 w-4" /> Re-run
            </button>
            {onSave && (
              <button onClick={onSave} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-sm">
                <Save className="h-4 w-4" /> Save Analysis
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'plag' && (
        <div className={cn(cardClass, 'p-5 space-y-5')}>
          {/* Score hero */}
          <div className={cn('rounded-xl border p-5 flex flex-col items-center gap-4',
            aiLikelihoodScore >= 70 ? (isDark ? 'bg-red-950/30 border-red-900/40' : 'bg-red-50 border-red-200')
            : aiLikelihoodScore >= 40 ? (isDark ? 'bg-amber-950/30 border-amber-900/40' : 'bg-amber-50 border-amber-200')
            : (isDark ? 'bg-green-950/30 border-green-900/40' : 'bg-green-50 border-green-200'))}>
            <ScoreRing value={aiLikelihoodScore < 0 ? 0 : aiLikelihoodScore} label="AI Likelihood" size="lg"
              sublabel={aiLikelihoodScore >= 0 ? scoreLabel(aiLikelihoodScore, 'ai') : undefined} isDark={isDark} />
            <div className={cn('flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold',
              aiLikelihoodScore >= 70 ? (isDark ? 'bg-red-900/50 text-red-200' : 'bg-red-100 text-red-700')
              : aiLikelihoodScore >= 40 ? (isDark ? 'bg-amber-900/50 text-amber-200' : 'bg-amber-100 text-amber-700')
              : (isDark ? 'bg-green-900/50 text-green-200' : 'bg-green-100 text-green-700'))}>
              <Bot className="h-3.5 w-3.5" />{aiVerdict}
            </div>
          </div>

          {/* What the score means */}
          <div className={cn('rounded-xl border p-4 space-y-1', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100')}>
            <p className={cn('text-[10px] font-bold uppercase tracking-widest', isDark ? 'text-slate-500' : 'text-slate-400')}>Score Guide</p>
            {[
              { range: '0 – 39', label: 'Human-Written', color: 'text-green-500' },
              { range: '40 – 69', label: 'Possibly AI-Assisted', color: 'text-amber-500' },
              { range: '70 – 100', label: 'Likely AI-Generated', color: 'text-red-500' },
            ].map(({ range, label, color }) => (
              <div key={range} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{range}</span>
                <span className={cn('text-xs font-semibold', color)}>{label}</span>
              </div>
            ))}
          </div>

          {/* Detection reasoning */}
          {analysis.aiReasoning ? (
            <div className={cn('rounded-xl border p-4', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100')}>
              <div className="flex items-center gap-2 mb-2.5">
                <ScanSearch className="h-4 w-4 text-indigo-400" />
                <p className={cn('text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>Detection Analysis</p>
              </div>
              <p className={cn('text-sm leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-700')}>{analysis.aiReasoning}</p>
            </div>
          ) : null}

          {/* Humanization tips */}
          {analysis.humanizationTips && analysis.humanizationTips.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                <p className={cn('text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>How to Humanize This Content</p>
              </div>
              <div className="space-y-2">
                {analysis.humanizationTips.map((tip, i) => (
                  <div key={i} className={cn('flex items-start gap-3 rounded-xl border p-3',
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100')}>
                    <span className={cn('flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5',
                      isDark ? 'bg-indigo-900/60 text-indigo-300' : 'bg-indigo-100 text-indigo-600')}>{i + 1}</span>
                    <p className={cn('text-xs leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-700')}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* De-plagiarize strategies */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-400" />
              <p className={cn('text-xs font-semibold uppercase tracking-wide', isDark ? 'text-slate-400' : 'text-slate-500')}>How to Remove AI / Plagiarism</p>
            </div>
            <div className="space-y-2">
              {[
                { icon: '✍️', title: 'Rewrite in your own voice', desc: 'Paraphrase every paragraph from scratch rather than editing AI output. Use your natural sentence rhythms and vocabulary.' },
                { icon: '👤', title: 'Add first-person perspective', desc: 'Insert personal observations, "I found that…", "In my experience…". AI rarely uses genuine first-person POV.' },
                { icon: '📖', title: 'Use concrete examples', desc: 'Replace vague generalisations with specific real-world examples, numbers, dates, or named sources you actually know.' },
                { icon: '✂️', title: 'Vary sentence structure', desc: 'Deliberately mix short punchy sentences with longer compound ones. Break the uniform rhythm AI tends to produce.' },
                { icon: '🗣️', title: 'Use contractions & idioms', desc: 'Write "don\'t" instead of "do not", add colloquial phrases. AI defaults to overly formal constructions.' },
                { icon: '🔗', title: 'Cite unique sources', desc: 'Quote experts, cite studies, or reference real conversations. This proves originality and adds verifiable context.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className={cn('flex items-start gap-3 rounded-xl border p-3',
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100')}>
                  <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                  <div className="min-w-0">
                    <p className={cn('text-xs font-semibold mb-0.5', isDark ? 'text-slate-200' : 'text-slate-800')}>{title}</p>
                    <p className={cn('text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-600')}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {aiLikelihoodScore < 0 && (
            <div className="py-10 text-center">
              <Shield className="h-10 w-10 mx-auto mb-3 text-slate-400" />
              <p className="text-sm text-slate-400">AI detection not available.</p>
              <p className="text-xs text-slate-500 mt-1">Re-run analysis to generate detection results.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'grammar' && (
        <div className={cn(cardClass, 'p-4 space-y-4')}>
          {/* Grammar score header */}
          <div className={cn('rounded-xl border p-4 flex items-center gap-5',
            grammarScore >= 80 ? (isDark ? 'border-green-900/40 bg-green-950/20' : 'border-green-200 bg-green-50')
            : grammarScore >= 55 ? (isDark ? 'border-amber-900/40 bg-amber-950/20' : 'border-amber-200 bg-amber-50')
            : (isDark ? 'border-red-900/40 bg-red-950/20' : 'border-red-200 bg-red-50'))}>
            <ScoreRing value={grammarScore} label="Grammar" sublabel={grammarScoreLabel(grammarScore)} isDark={isDark} />
            <div className="flex-1 space-y-2">
              {[
                { icon: XCircle,     color: 'text-red-500',   label: 'Errors',      count: errorCount },
                { icon: AlertCircle, color: 'text-amber-500', label: 'Warnings',    count: warningCount },
                { icon: Info,        color: 'text-blue-500',  label: 'Suggestions', count: analysis.grammarIssues.filter((i) => i.severity === 'suggestion').length },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <s.icon className={cn('h-3.5 w-3.5 flex-shrink-0', s.color)} />
                  <div className={cn('flex-1 h-1.5 rounded-full overflow-hidden', isDark ? 'bg-slate-800' : 'bg-slate-200')}>
                    <div className={cn('h-full rounded-full', s.color.replace('text-', 'bg-'))}
                      style={{ width: `${Math.min(100, (s.count / Math.max(grammarIssuesCount, 1)) * 100)}%`, transition: 'width 0.7s ease' }} />
                  </div>
                  <span className={cn('text-xs font-bold w-5 text-right', isDark ? 'text-slate-300' : 'text-slate-700')}>{s.count}</span>
                  <span className="text-[10px] text-slate-500 w-16">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {grammarIssuesCount === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
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

      {activeTab === 'tone' && (
        <div className={cn(cardClass, 'p-5 space-y-5')}>
          {analysis.toneAnalysis ? (
            <>
              {/* Tone hero card */}
              <div className={cn('rounded-xl border p-5 flex items-center gap-5', isDark ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50 border-indigo-200')}>
                <ScoreRing value={toneConfidence} label="Confidence" size="lg" isDark={isDark} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Dominant Tone</p>
                  <p className={cn('text-2xl font-black capitalize', isDark ? 'text-white' : 'text-slate-900')}>{analysis.toneAnalysis.dominant}</p>
                  {analysis.toneAnalysis.description && (
                    <p className={cn('text-xs leading-relaxed mt-1.5', isDark ? 'text-slate-400' : 'text-slate-600')}>{analysis.toneAnalysis.description}</p>
                  )}
                </div>
              </div>
              <TonePanel analysis={analysis} isDark={isDark} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Mic2 className="h-10 w-10 text-slate-400" />
              <p className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>Tone data not available</p>
              <p className="text-xs text-slate-500">Re-run analysis to detect writing tone.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnalysisPanel;
