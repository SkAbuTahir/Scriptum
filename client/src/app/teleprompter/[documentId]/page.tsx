'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import TeleprompterView from '@/components/Teleprompter';
import { useDocument } from '@/hooks/useDocument';
import { sanitize } from '@/lib/sanitize';
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react';

export default function TeleprompterPage() {
  const params = useParams<{ documentId: string }>();
  const { document, isLoading, error } = useDocument(params.documentId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p>{error || 'Document not found'}</p>
        <Link href="/dashboard" className="btn-secondary">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>
    );
  }

  const text = sanitize(document.cleanedText || document.rawText);

  return <TeleprompterView text={text} documentTitle={document.originalFileName} documentId={params.documentId} />;
}
