'use client';

import { useState, useEffect, useCallback } from 'react';
import { UsageStats } from '@/types';
import { userApi } from '@/lib/api';

interface UseUsageReturn {
  usage: UsageStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useUsage(): UseUsageReturn {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const stats = await userApi.getUsage();
      setUsage(stats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch usage';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, isLoading, error, refresh };
}
