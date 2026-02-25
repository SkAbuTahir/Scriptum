'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Upload, File, X, CheckCircle2, Cloud } from 'lucide-react';

interface AceFileUploadProps {
  accept?: Record<string, string[]>;
  maxSize?: number;
  onFile: (file: File) => void;
  onClear: () => void;
  file: File | null;
  disabled?: boolean;
  className?: string;
}

export function AceFileUpload({
  accept,
  maxSize,
  onFile,
  onClear,
  file,
  disabled,
  className,
}: AceFileUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile],
  );

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    setError(rejections[0]?.errors[0]?.message ?? 'File not accepted');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept,
    maxSize,
    maxFiles: 1,
    disabled,
  });

  const fmt = (b: number) =>
    b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <div className={cn('w-full', className)}>
      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/20 dark:bg-indigo-950/20 px-5 py-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
              <File className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
              <p className="text-xs text-slate-500">{fmt(file.size)}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="ml-1 shrink-0 rounded-lg p-1 text-slate-400 transition hover:text-slate-700 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div
              {...getRootProps()}
              className={cn(
                'group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-all duration-200',
                isDragActive
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20'
                  : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-indigo-500/40',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
            <input {...getInputProps()} />

            {/* Animated icon */}
            <motion.div
              animate={isDragActive ? { scale: 1.15 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors',
                isDragActive
                  ? 'bg-indigo-100 dark:bg-indigo-900/40'
                  : 'bg-slate-100 group-hover:bg-indigo-100 dark:bg-white/5 dark:group-hover:bg-indigo-900/30',
              )}
            >
              {isDragActive ? (
                <Cloud className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Upload className="h-7 w-7 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
              )}
            </motion.div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isDragActive ? 'Drop it here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-slate-400">DOCX, PDF, TXT — up to {fmt(maxSize ?? 25 * 1024 * 1024)}</p>
            </div>

            {/* Hover shimmer */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.07),transparent_70%)]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-red-500"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
