'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { uploadApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { DotBackground } from '@/components/ui/backgrounds';
import { AceFileUpload } from '@/components/ui/ace-file-upload';
import { ShimmerButton } from '@/components/ui/ace-input';
import { MeteorCard } from '@/components/ui/meteor-card';
import {
  Youtube, ArrowRight, Loader2, AlertCircle, FileType, File as FileIcon, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type UploadMode = 'file' | 'youtube';

const ACCEPTED_TYPES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
};
const MAX_SIZE = 25 * 1024 * 1024;

const FORMAT_PILLS = [
  { icon: FileType,  label: '.docx', color: 'text-blue-500' },
  { icon: FileIcon,  label: '.pdf',  color: 'text-red-500'  },
  { icon: FileText,  label: '.txt',  color: 'text-slate-400' },
];

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode]           = useState<UploadMode>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile]           = useState<File | null>(null);
  const [progress, setProgress]   = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleUpload = async () => {
    setError(null);
    setIsUploading(true);
    setProgress(0);
    try {
      let result;
      if (mode === 'youtube') {
        if (!youtubeUrl.trim()) { setError('Please enter a YouTube URL'); return; }
        toast.loading('Fetching YouTube transcriptâ€¦', { id: 'upload' });
        result = await uploadApi.uploadYouTube(youtubeUrl.trim());
      } else {
        if (!file) { setError('Please select a file'); return; }
        result = await uploadApi.uploadFile(file, (p) => setProgress(p));
      }
      toast.success('Document processed!', { id: 'upload' });
      router.push(`/editor/${result.documentId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      toast.error(msg, { id: 'upload' });
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit = !isUploading && (mode === 'file' ? !!file : !!youtubeUrl.trim());

  return (
    <DotBackground className="flex min-h-screen flex-col items-center justify-start px-4 pb-32 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-xl"
      >
        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Upload Content
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Upload a document or paste a YouTube link to get started
          </p>
        </div>

        <MeteorCard meteors={6} className="w-full">
          <div className="space-y-6 p-2">

            {/* Mode tabs */}
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
              {(['file', 'youtube'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
                    mode === m
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                  )}
                >
                  {m === 'file'
                    ? <><FileText className="h-4 w-4" /> Upload File</>
                    : <><Youtube className="h-4 w-4" /> YouTube Link</>
                  }
                </button>
              ))}
            </div>

            {/* Upload area */}
            {mode === 'file' ? (
              <div className="space-y-4">
                <AceFileUpload
                  accept={ACCEPTED_TYPES}
                  maxSize={MAX_SIZE}
                  onFile={setFile}
                  onClear={() => setFile(null)}
                  file={file}
                  disabled={isUploading}
                />
                <div className="flex items-center justify-center gap-5">
                  {FORMAT_PILLS.map((f) => (
                    <div key={f.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <f.icon className={cn('h-3.5 w-3.5', f.color)} />
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  YouTube Video URL
                </label>
                <div className="relative">
                  <Youtube className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    className={cn(
                      'w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900',
                      'placeholder:text-slate-400 outline-none transition-all',
                      'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                      'dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30',
                    )}
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    disabled={isUploading}
                  />
                </div>
                <p className="text-xs text-slate-400">Video must have captions/subtitles enabled</p>
              </div>
            )}

            {/* Progress bar */}
            {isUploading && mode === 'file' && progress > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-1.5"
              >
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Uploadingâ€¦</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-950/20 dark:text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <ShimmerButton onClick={handleUpload} disabled={!canSubmit}>
              {isUploading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Processingâ€¦</>
                : <>Process Document <ArrowRight className="h-4 w-4" /></>
              }
            </ShimmerButton>
          </div>
        </MeteorCard>
      </motion.div>
    </DotBackground>
  );
}
