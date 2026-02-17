import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  searchPlayersByKeywords,
  searchPlayersByName,
} from '../api/ffbad';
import { NetworkError, ServerError, FFBaDError } from '../api/errors';
import { useDebounce } from './useDebounce';
import type { LicenceSearchResponse } from '../api/schemas';

// ============================================================
// Types
// ============================================================

/** Single player result from FFBaD search API */
type PlayerResult = Extract<
  LicenceSearchResponse['Retour'],
  Array<unknown>
>[number];

interface UsePlayerSearchReturn {
  /** Current raw query string */
  query: string;
  /** Update the query (connected to TextInput) */
  setQuery: (q: string) => void;
  /** Search results (empty until 3+ chars typed and API responds) */
  results: PlayerResult[];
  /** True while waiting for API response */
  isLoading: boolean;
  /** Translated error message, or null */
  error: string | null;
  /** Reset results and query */
  clearResults: () => void;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Detect whether the user is searching by licence number or name.
 * Pure digits (possibly with spaces) = licence search.
 */
function isLicenceQuery(query: string): boolean {
  return /^\d[\d\s]*$/.test(query.trim());
}

// ============================================================
// Hook
// ============================================================

export function usePlayerSearch(): UsePlayerSearchReturn {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Track current debounced query to detect stale responses
  const activeQueryRef = useRef(debouncedQuery);
  activeQueryRef.current = debouncedQuery;

  useEffect(() => {
    // Guard: minimum 3 characters
    if (debouncedQuery.length < 3) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const currentQuery = debouncedQuery;

    async function performSearch() {
      setIsLoading(true);
      setError(null);

      try {
        const response = isLicenceQuery(currentQuery)
          ? await searchPlayersByKeywords(currentQuery.trim())
          : await searchPlayersByName(currentQuery.trim());

        if (cancelled) return;

        // Stale check: only update if this is still the active query
        if (activeQueryRef.current !== currentQuery) return;

        // FFBaD API returns string Retour on no results (e.g., "No Result")
        if (typeof response.Retour === 'string') {
          setResults([]);
        } else {
          setResults(response.Retour);
        }
      } catch (err) {
        if (cancelled) return;
        if (activeQueryRef.current !== currentQuery) return;

        if (err instanceof NetworkError) {
          setError(t('auth.networkError'));
        } else if (err instanceof ServerError) {
          setError(t('auth.serverError'));
        } else if (err instanceof FFBaDError) {
          setError(t('search.error'));
        } else {
          setError(t('search.error'));
        }
        setResults([]);
      } finally {
        if (!cancelled && activeQueryRef.current === currentQuery) {
          setIsLoading(false);
        }
      }
    }

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, t]);

  const clearResults = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return { query, setQuery, results, isLoading, error, clearResults };
}
