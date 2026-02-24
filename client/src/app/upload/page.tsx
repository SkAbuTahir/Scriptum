'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone, FileRejection } from 'react-dropzone';
import { uploadApi } from '@/lib/api';
import Navbar from '@/components/Navbar';
import {
  Upload, FileType, FileText, File, Youtube,
  CheckCircle2, AlertCircle, Loader2, ArrowRight,
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

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    const err = fileRejections[0]?.errors[0]?.message || 'File not accepted';
    setError(err);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleUpload = async () => {
    setError(null);
    setIsUploading(true);
    setProgress(0);

    try {
      let result;
      if (mode === 'youtube') {
        if (!youtubeUrl.trim()) {
          setError('Please enter a YouTube URL');
          return;
        }
        toast.loading('Fetching YouTube transcript…', { id: 'upload' });
        result = await uploadApi.uploadYouTube(youtubeUrl.trim());
      } else {
        if (!file) {
          setError('Please select a file');
          return;
        }
        result = await uploadApi.uploadFile(file, (p) => setProgress(p));
      }

      toast.success('Document processed successfully!', { id: 'upload' });
      router.push(`/editor/${result.documentId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      toast.error(msg, { id: 'upload' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <main className="animate-page-in mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Upload Content</h1>
          <p className="mt-2 text-slate-500">
            Upload a document or paste a YouTube link to get started
          </p>
        </div>

        {/* Mode toggle */}
        <div className="card mb-6 p-2">
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'file', label: 'Upload File', icon: Upload },
              { id: 'youtube', label: 'YouTube Link', icon: Youtube },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setMode(tab.id as UploadMode); setError(null); }}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
                  mode === tab.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload area */}
        <div className="card space-y-6">
          {mode === 'file' ? (
            <>
              <div
                {...getRootProps()}
                className={cn(
                  'cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all',
                  isDragActive
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                    : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800/50',
                  isUploading && 'pointer-events-none opacity-60'
                )}
              >
                <input {...getInputProps()} />

                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 dark:bg-green-900/30">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
                      <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <p className="text-xs text-slate-400">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                      <Upload className="h-7 w-7 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {isDragActive ? 'Drop file here' : 'Drag & drop or click to browse'}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Supports .docx, .pdf, .txt — Max 25MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Supported formats */}
              <div className="flex items-center justify-center gap-6">
                {[
                  { icon: FileType, label: '.docx', color: 'text-blue-500' },
                  { icon: File, label: '.pdf', color: 'text-red-500' },
                  { icon: FileText, label: '.txt', color: 'text-slate-500' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <f.icon className={`h-4 w-4 ${f.color}`} />
                    {f.label}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="yturl">YouTube Video URL</label>
                <div className="relative">
                  <Youtube className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="yturl"
                    type="url"
                    className="input pl-10"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    disabled={isUploading}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Video must have captions/subtitles enabled
                </p>
              </div>
            </div>
          )}

          {/* Progress */}
          {isUploading && mode === 'file' && progress > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert-error">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={isUploading || (mode === 'file' ? !file : !youtubeUrl.trim())}
            className="btn-primary w-full"
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
            ) : (
              <>Process Document <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
