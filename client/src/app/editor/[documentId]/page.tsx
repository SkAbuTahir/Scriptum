'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AnalysisPanel from '@/components/AnalysisPanel';
import { useDocument } from '@/hooks/useDocument';
import {
  Save, BarChart2, Loader2, Tv2, ExternalLink,
  ChevronLeft, FileText, AlertCircle, RefreshCw,
} from 'lucide-react';
import { formatWordCount, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function EditorPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const documentId = params.documentId;

  const { document, isLoading, isAnalyzing, error, analysis, analyze, updateContent } =
    useDocument(documentId);

  const [editorText, setEditorText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'analysis'>('edit');

  // Populate editor once doc loads
  useEffect(() => {
    if (document && !isDirty) {
      setEditorText(document.cleanedText);
    }
  }, [document, isDirty]);

  const handleTextChange = (value: string) => {
    setEditorText(value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateContent(editorText);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const wordCount = editorText.trim().split(/\s+/).filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium">{error || 'Document not found'}</p>
        <Link href="/dashboard" className="btn-secondary">
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Editor toolbar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/dashboard" className="btn-ghost p-2">
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {document.originalFileName}
            </p>
            <p className="text-xs text-slate-400">{formatWordCount(wordCount)}</p>
          </div>

          {/* Tabs (mobile) */}
          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-zinc-800 md:hidden">
            <button
              onClick={() => setActiveTab('edit')}
              className={cn('rounded px-3 py-1 text-xs font-medium transition-all',
                activeTab === 'edit' ? 'bg-brand-600 text-white' : 'text-slate-500')}
            >
              Edit
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={cn('rounded px-3 py-1 text-xs font-medium transition-all',
                activeTab === 'analysis' ? 'bg-brand-600 text-white' : 'text-slate-500')}
            >
              Analysis
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <button onClick={handleSave} disabled={isSaving} className="btn-primary py-1.5 px-3 text-xs">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
            )}
            <button
              onClick={analyze}
              disabled={isAnalyzing}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BarChart2 className="h-3.5 w-3.5" />
              )}
              {isAnalyzing ? 'Analysing…' : 'Analyse'}
            </button>
            <Link
              href={`/teleprompter/${documentId}`}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <Tv2 className="h-3.5 w-3.5" /> Teleprompter
            </Link>
            <Link
              href={`/export/${documentId}`}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Export
            </Link>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="animate-page-in mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        {/* Left – Editor */}
        <div className={cn('flex flex-1 flex-col', activeTab === 'analysis' && 'hidden md:flex')}>
          <div className="card flex flex-1 flex-col p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <FileText className="h-4 w-4" /> Document Editor
              </div>
              {isDirty && (
                <span className="text-xs text-amber-500">● Unsaved changes</span>
              )}
            </div>
            <textarea
              className="flex-1 resize-none bg-white p-6 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100"
              style={{ minHeight: 'calc(100vh - 280px)' }}
              value={editorText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Your document content appears here. Edit freely…"
              spellCheck
            />
          </div>
        </div>

        {/* Right – Analysis */}
        <div className={cn(
          'w-full md:w-96 flex-shrink-0',
          activeTab === 'edit' && 'hidden md:block'
        )}>
          <AnalysisPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            onAnalyze={analyze}
            documentStatus={document.status}
          />
        </div>
      </div>
    </div>
  );
}
