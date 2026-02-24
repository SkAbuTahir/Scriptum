'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { documentApi } from '@/lib/api';
import { DocumentSummary } from '@/types';
import { formatRelativeTime, formatWordCount, sourceTypeLabel, statusBadgeColor, cn } from '@/lib/utils';
import {
  FileText, Upload, Plus, Trash2, BarChart2,
  FileType, Youtube, File, Loader2, BookOpen,
  ChevronRight, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';

const sourceIcon = (type: string) => {
  switch (type) {
    case 'docx': return FileType;
    case 'pdf': return File;
    case 'youtube': return Youtube;
    default: return FileText;
  }
};

function SkeletonRow() {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="skeleton h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-48 rounded" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
      <div className="hidden sm:flex items-center gap-2">
        <div className="skeleton h-7 w-14 rounded-lg" />
        <div className="skeleton h-7 w-16 rounded-lg" />
        <div className="skeleton h-7 w-8 rounded-lg" />
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="skeleton h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="space-y-2">
        <div className="skeleton h-5 w-12 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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

  const stats = [
    { label: 'Total Documents', value: total, icon: FileText },
    { label: 'Analyzed', value: documents.filter((d) => d.status === 'analyzed' || d.status === 'ready').length, icon: BarChart2 },
    { label: 'Total Words', value: formatWordCount(documents.reduce((s, d) => s + (d.wordCount || 0), 0)), icon: BookOpen, raw: true },
    { label: 'Unique Sources', value: new Set(documents.map((d) => d.sourceType)).size, icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />

      <main className="animate-page-in mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isLoading
                ? 'Loading your workspace…'
                : total > 0
                ? `${total} document${total !== 1 ? 's' : ''} in your workspace`
                : 'Your workspace is empty — upload your first document to get started'}
            </p>
          </div>
          <Link href="/upload" className="btn-primary flex-shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Document</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : stats.map((stat) => (
                <div key={stat.label} className="stat-card">
                  <div className="stat-icon">
                    <stat.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-none text-slate-900 dark:text-white">
                      {stat.raw ? stat.value : stat.value}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">{stat.label}</p>
                  </div>
                </div>
              ))}
        </div>

        {/* Document list */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : documents.length === 0 ? (
            /* Empty state */
            <div className="card flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/50">
                <Upload className="h-9 w-9 text-brand-500" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                No documents yet
              </h3>
              <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-500">
                Upload a Word doc, PDF, plain text file, or paste a YouTube link to get started with AI analysis.
              </p>
              <Link href="/upload" className="btn-primary">
                <Plus className="h-4 w-4" /> Upload your first document
              </Link>
            </div>
          ) : (
            documents.map((doc) => {
              const Icon = sourceIcon(doc.sourceType);
              return (
                <div
                  key={doc._id}
                  onClick={() => router.push(`/editor/${doc._id}`)}
                  className="card-hover group flex cursor-pointer items-center gap-3 p-4"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/editor/${doc._id}`)}
                >
                  {/* Source icon */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-colors group-hover:bg-brand-50 dark:bg-slate-700 dark:group-hover:bg-brand-950/60">
                    <Icon className="h-5 w-5 text-slate-500 transition-colors group-hover:text-brand-600 dark:text-slate-400 dark:group-hover:text-brand-400" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300 transition-colors">
                        {doc.originalFileName}
                      </p>
                      <span className={cn('badge flex-shrink-0', statusBadgeColor(doc.status))}>
                        {doc.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      <span>{sourceTypeLabel(doc.sourceType)}</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">{formatWordCount(doc.wordCount)}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(doc.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions — always visible, icon-only on small screens */}
                  <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/editor/${doc._id}`); }}
                      className="btn-ghost hidden items-center gap-1.5 py-1.5 px-2.5 text-xs sm:inline-flex"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
                      className="btn-ghost hidden items-center gap-1.5 py-1.5 px-2.5 text-xs sm:inline-flex"
                      title="Analyse"
                    >
                      <BarChart2 className="h-3.5 w-3.5" /> Analyse
                    </button>
                    {/* Mobile icon-only actions */}
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/editor/${doc._id}`); }}
                      className="btn-ghost p-2 sm:hidden"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/analysis/${doc._id}`); }}
                      className="btn-ghost p-2 sm:hidden"
                      title="Analyse"
                    >
                      <BarChart2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, doc._id, doc.originalFileName)}
                      disabled={deletingId === doc._id}
                      className="btn-ghost p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 disabled:opacity-40"
                      title="Delete"
                    >
                      {deletingId === doc._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                    <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 hidden sm:block" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

