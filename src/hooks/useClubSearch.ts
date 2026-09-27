import { useState, useEffect } from 'react';
import { searchClubs } from '../api/ffbad';
import { useDebounce } from './useDebounce';

// ============================================================
// Types
// ============================================================

export interface ClubSearchResult {
  id: string;
  name: string;
}

export interface ClubSearchState {
  clubs: ClubSearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => void;
}

// ============================================================
// Hook
// ============================================================

/**
 * Club search backed by myffbad.fr's server-side club search.
 *
 * - Only queries when the input is 3+ characters (matches player search pattern)
 * - useDebounce (300ms) on the query to avoid a request per keystroke
 */
export function useClubSearch(): ClubSearchState {
  const [searchQuery, setSearchQuery] = useState('');
  const [clubs, setClubs] = useState<ClubSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setClubs([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    searchClubs(debouncedQuery)
      .then((results) => {
        if (!cancelled) setClubs(results);
      })
      .catch(() => {
        if (!cancelled) setError('club.loadError');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return {
    clubs,
    isLoading,
    error,
    search: setSearchQuery,
  };
}
