import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatWordCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k words`;
  return `${count} words`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'stroke-red-500 text-red-600';
  if (score >= 40) return 'stroke-amber-400 text-amber-500';
  return 'stroke-emerald-500 text-emerald-600';
}

/** Grammar/readability score: higher is better */
export function positiveScoreColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-500 text-emerald-600';
  if (score >= 55) return 'stroke-amber-400 text-amber-500';
  return 'stroke-red-500 text-red-600';
}

export function grammarScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 35) return 'Poor';
  return 'Needs Work';
}

export function scoreLabel(score: number, type: 'ai' | 'plagiarism' | 'readability'): string {
  if (type === 'readability') {
    if (score >= 70) return 'Easy';
    if (score >= 50) return 'Medium';
    return 'Difficult';
  }
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = globalThis.document.createElement('a');
    a.href = url;
    a.download = filename;
    globalThis.document.body.appendChild(a);
    a.click();
    globalThis.document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (err) {
    console.error('Download failed:', err);
    throw err;
  }
}

export function sourceTypeLabel(sourceType: string): string {
  const map: Record<string, string> = {
    docx: 'Word Document',
    pdf: 'PDF',
    txt: 'Plain Text',
    youtube: 'YouTube',
  };
  return map[sourceType] || sourceType.toUpperCase();
}

export function statusBadgeColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    analyzed: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    ready: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}
