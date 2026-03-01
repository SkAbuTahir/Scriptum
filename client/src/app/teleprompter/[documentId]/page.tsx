'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import TeleprompterEngine from '@/components/TeleprompterEngine';
import { useDocument } from '@/hooks/useDocument';
import { sanitize } from '@/lib/sanitize';
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react';

export default function TeleprompterPage() {
  const params = useParams<{ documentId: string }>();
  const { document, isLoading, error } = useDocument(params.documentId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070f]">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07070f] text-white">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-white/50">{error || 'Document not found'}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] px-4 py-2 text-sm font-medium text-white/50 transition-colors hover:border-white/[0.12] hover:text-white/80"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>
    );
  }

  const script = sanitize(document.cleanedText || document.rawText);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#07070f]">
      {/* Back nav */}
      <div className="flex items-center gap-2 border-b border-white/[0.04] bg-[#07070f] px-4 py-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/25 transition-colors hover:bg-white/[0.04] hover:text-white/50"
        >
          <ChevronLeft className="h-3 w-3" /> Dashboard
        </Link>
      </div>

      {/* Engine — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <TeleprompterEngine
          script={script}
          documentTitle={document.originalFileName}
        />
      </div>
    </div>
  );
}

