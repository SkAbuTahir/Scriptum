'use client';

import { AnalysisResult, GrammarIssue, AISuggestion } from '@/types';
import { cn, scoreColor, scoreLabel } from '@/lib/utils';
import {
  BarChart2, Loader2, AlertTriangle, CheckCircle2,
  Lightbulb, Zap, MessageSquare, BookOpen,
  ChevronDown, ChevronRight, Play,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  documentStatus: string;
  expanded?: boolean;
}

function ScoreCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-16 w-16">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5"
            className="stroke-slate-100 dark:stroke-slate-700" />
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="5"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn('transition-all duration-700', color)} />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-bold', color)}>
          {value < 0 ? '—' : `${pct}`}
        </span>
      </div>
      <p className="text-center text-xs text-slate-500">{label}</p>
    </div>
  );
}

function GrammarIssueCard({ issue }: { issue: GrammarIssue }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{issue.message}</p>
          <p className="mt-0.5 text-xs text-slate-400">{issue.rule.category}</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">
          <p className="text-xs text-slate-500"><span className="font-medium">Context:</span> …{issue.context}…</p>
          {issue.replacements.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {issue.replacements.slice(0, 4).map((r, i) => (
                <span key={i} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: AISuggestion }) {
  const typeColors: Record<string, string> = {
    rewrite: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    simplify: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    expand: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    tone: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  };

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-start gap-2">
        <span className={cn('badge flex-shrink-0 capitalize', typeColors[suggestion.type] || 'bg-slate-100 text-slate-600')}>
          {suggestion.type}
        </span>
      </div>
      <blockquote className="mt-2 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500 dark:border-slate-600 dark:text-slate-400">
        {suggestion.original.slice(0, 100)}…
      </blockquote>
      <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-200">{suggestion.suggested}</p>
      <p className="mt-1 text-xs text-slate-400">{suggestion.reason}</p>
    </div>
  );
}

export default function AnalysisPanel({ analysis, isAnalyzing, onAnalyze, documentStatus, expanded = false }: Props) {
  const [activeSection, setActiveSection] = useState<'overview' | 'grammar' | 'suggestions'>('overview');

  if (isAnalyzing) {
    return (
      <div className="card flex flex-col items-center justify-center gap-4 py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600 dark:text-brand-400" />
        </div>
        <div className="text-center">
          <p className="font-medium">Running AI analysis…</p>
          <p className="mt-1 text-xs text-slate-400">Grammar check, AI scoring, suggestions</p>
        </div>
        <div className="w-full space-y-2">
          {['Grammar check', 'AI likelihood scoring', 'Generating suggestions'].map((step, i) => (
            <div key={step} className="flex items-center gap-2 text-xs text-slate-400">
              <div className={cn('h-1.5 w-1.5 rounded-full', i === 0 ? 'bg-brand-500 animate-pulse' : 'bg-slate-200 dark:bg-slate-700')} />
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
          <p className="font-medium text-slate-900 dark:text-white">No analysis yet</p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs">
            Run AI analysis to check grammar, detect AI content, and get improvement suggestions
          </p>
        </div>
        <button onClick={onAnalyze} className="btn-primary">
          <Play className="h-4 w-4" /> Run Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="card p-2">
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'overview', label: 'Scores', icon: BarChart2 },
            { id: 'grammar', label: `Grammar (${analysis.grammarIssues.length})`, icon: AlertTriangle },
            { id: 'suggestions', label: `Tips (${analysis.suggestions.length})`, icon: Lightbulb },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as typeof activeSection)}
              className={cn(
                'flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all',
                activeSection === tab.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'overview' ? 'Scores' : tab.id === 'grammar' ? analysis.grammarIssues.length : analysis.suggestions.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {activeSection === 'overview' && (
        <div className="card space-y-6">
          {/* Score circles */}
          <div className="flex items-center justify-around py-2">
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
            <ScoreCircle
              value={analysis.readabilityScore}
              label="Readability"
              color="stroke-blue-500 text-blue-600"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Words', value: analysis.wordCount.toLocaleString(), icon: BookOpen },
              { label: 'Sentences', value: analysis.sentenceCount.toLocaleString(), icon: MessageSquare },
              { label: 'Grammar Issues', value: analysis.grammarIssues.length, icon: AlertTriangle },
              { label: 'AI Score', value: analysis.aiLikelihoodScore < 0 ? 'N/A' : `${analysis.aiLikelihoodScore}%`, icon: Zap },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <stat.icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI Likelihood interpretation */}
          {analysis.aiLikelihoodScore >= 0 && (
            <div className={cn(
              'rounded-lg p-3 text-sm',
              analysis.aiLikelihoodScore >= 70
                ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                : analysis.aiLikelihoodScore >= 40
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
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

          <button onClick={onAnalyze} className="btn-secondary w-full text-xs">
            <Zap className="h-3.5 w-3.5" /> Re-run Analysis
          </button>
        </div>
      )}

      {/* Grammar */}
      {activeSection === 'grammar' && (
        <div className="card space-y-3">
          {analysis.grammarIssues.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-medium text-slate-900 dark:text-white">No grammar issues found!</p>
              <p className="text-xs text-slate-400">Your writing is grammatically clean.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400">{analysis.grammarIssues.length} issue{analysis.grammarIssues.length !== 1 ? 's' : ''} found</p>
              <div className={cn('space-y-2', expanded ? '' : 'max-h-96 overflow-y-auto')}>
                {analysis.grammarIssues.map((issue, i) => (
                  <GrammarIssueCard key={i} issue={issue} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Suggestions */}
      {activeSection === 'suggestions' && (
        <div className="card space-y-3">
          {analysis.suggestions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-medium text-slate-900 dark:text-white">No suggestions</p>
              <p className="text-xs text-slate-400">Your document looks good!</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400">{analysis.suggestions.length} suggestion{analysis.suggestions.length !== 1 ? 's' : ''}</p>
              <div className="space-y-2">
                {analysis.suggestions.map((sug, i) => (
                  <SuggestionCard key={i} suggestion={sug} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
