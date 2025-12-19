import { useState, useEffect } from 'react';
import { getSignedUrl } from '@/lib/storage';

/**
 * Hook to get a signed URL for a storage file.
 * Automatically refreshes the URL before it expires.
 */
export function useSignedUrl(
  filePath: string | null | undefined,
  expiresIn: number = 3600
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!filePath) {
      setSignedUrl(null);
      return;
    }

    let mounted = true;
    let refreshTimeout: NodeJS.Timeout;

    async function fetchSignedUrl() {
      setLoading(true);
      setError(null);

      try {
        const url = await getSignedUrl(filePath!, expiresIn);
        
        if (mounted) {
          setSignedUrl(url);
          setLoading(false);

          // Refresh the URL before it expires (at 80% of expiry time)
          if (url) {
            const refreshTime = expiresIn * 0.8 * 1000;
            refreshTimeout = setTimeout(fetchSignedUrl, refreshTime);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to get signed URL'));
          setLoading(false);
        }
      }
    }

    fetchSignedUrl();

    return () => {
      mounted = false;
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [filePath, expiresIn]);

  return { signedUrl, loading, error };
}
