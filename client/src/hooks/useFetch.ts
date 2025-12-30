import { useState, useEffect } from 'react';
import api from '../services/api';

interface UseFetchOptions {
  initialFetch?: boolean;
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFetch<T = any>(
  url: string,
  options: UseFetchOptions = { initialFetch: true }
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<T>(url);
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.initialFetch) {
      fetchData();
    }
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}
