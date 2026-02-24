'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, AnalysisResult } from '@/types';
import { documentApi, analysisApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface UseDocumentReturn {
  document: Document | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  analysis: AnalysisResult | null;
  refresh: () => Promise<void>;
  analyze: () => Promise<void>;
  updateContent: (cleanedText: string) => Promise<void>;
}

export function useDocument(documentId: string): UseDocumentReturn {
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const refresh = useCallback(async () => {
    if (!documentId) return;
    try {
      setIsLoading(true);
      setError(null);
      const doc = await documentApi.get(documentId);
      setDocument(doc);

      // If document was previously analyzed, reconstruct analysis state from it
      if (doc.analysisRunAt && doc.aiScore !== null) {
        setAnalysis({
          documentId: doc._id,
          aiLikelihoodScore: doc.aiScore ?? 0,
          plagiarismScore: doc.plagiarismScore ?? 0,
          readabilityScore: doc.readabilityScore ?? 0,
          grammarIssues: doc.grammarIssues,
          suggestions: doc.suggestions,
          wordCount: doc.wordCount,
          sentenceCount: 0,
          analyzedAt: doc.analysisRunAt,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load document';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const analyze = useCallback(async () => {
    if (!documentId) return;
    setIsAnalyzing(true);
    const toastId = toast.loading('Running AI analysis…');
    try {
      const result = await analysisApi.analyze(documentId);
      setAnalysis(result);
      toast.success('Analysis complete', { id: toastId });
      // Refresh doc to get updated status
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      toast.error(msg, { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  }, [documentId, refresh]);

  const updateContent = useCallback(async (cleanedText: string) => {
    if (!documentId) return;
    try {
      await documentApi.update(documentId, { cleanedText });
      setDocument((prev) => prev ? { ...prev, cleanedText } : prev);
      toast.success('Document saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    }
  }, [documentId]);

  return { document, isLoading, isAnalyzing, error, analysis, refresh, analyze, updateContent };
}
