import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from '../services/api.js';

/**
 * Generic data-fetching hook against the real API.
 * `fetcher` receives an AbortSignal-friendly axios promise factory.
 */
export function useApi(fetcher, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mounted.current && id === requestId.current) setData(result);
      return result;
    } catch (err) {
      if (mounted.current && id === requestId.current) setError(getApiError(err));
      return null;
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { if (immediate) run(); }, [run, immediate]);

  return { data, loading, error, refetch: run, setData };
}

/** Debounce any fast-changing value (used for search inputs). */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Close-on-outside-click + Escape helper for dropdowns/modals. */
export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onPointer = (event) => { if (ref.current && !ref.current.contains(event.target)) handler(); };
    const onKey = (event) => { if (event.key === 'Escape') handler(); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [ref, handler, active]);
}
