'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import AnalysisPanel from '@/components/AnalysisPanel';
import { useDocument } from '@/hooks/useDocument';
import { ChevronLeft, Loader2, AlertCircle, Edit3 } from 'lucide-react';

export default function AnalysisPage() {
  const params = useParams<{ documentId: string }>();
  const { document, isLoading, isAnalyzing, error, analysis, analyze } = useDocument(params.documentId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p>{error || 'Document not found'}</p>
        <Link href="/dashboard" className="btn-secondary"><ChevronLeft className="h-4 w-4" /> Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-6">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard" className="hover:text-brand-600">Dashboard</Link>
          <span>/</span>
          <Link href={`/editor/${params.documentId}`} className="hover:text-brand-600">Editor</Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-300">Analysis</span>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Content Analysis</h1>
            <p className="mt-1 truncate text-sm text-slate-500">{document.originalFileName}</p>
          </div>
          <Link href={`/editor/${params.documentId}`} className="btn-secondary">
            <Edit3 className="h-4 w-4" /> Open Editor
          </Link>
        </div>

        <AnalysisPanel
          analysis={analysis}
          isAnalyzing={isAnalyzing}
          onAnalyze={analyze}
          documentStatus={document.status}
          expanded
        />
      </main>
    </div>
  );
}
