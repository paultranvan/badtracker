import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react';
import {
  loadBookmarks,
  saveBookmarks,
  updateBookmarkRankings,
} from './storage';
import type { BookmarkedPlayer } from './storage';

// ============================================================
// Types
// ============================================================

interface BookmarksContextType {
  bookmarks: BookmarkedPlayer[];
  isBookmarked: (licence: string) => boolean;
  addBookmark: (player: BookmarkedPlayer) => Promise<void>;
  removeBookmark: (licence: string) => Promise<void>;
  updateStoredRankings: (licence: string, rankings: BookmarkedPlayer['rankings']) => void;
  isLoaded: boolean;
}

// ============================================================
// Context
// ============================================================

const BookmarksContext = createContext<BookmarksContextType | null>(null);

/**
 * Hook to access bookmark state. Must be used within BookmarksProvider.
 */
export function useBookmarks(): BookmarksContextType {
  const ctx = useContext(BookmarksContext);
  if (!ctx) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return ctx;
}

// ============================================================
// Provider
// ============================================================

export function BookmarksProvider({ children }: PropsWithChildren) {
  const [bookmarks, setBookmarks] = useState<BookmarkedPlayer[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // ----------------------------------------------------------
  // Load bookmarks from storage on mount
  // Note: Bookmarks are tied to device, not account — persist across logout
  // ----------------------------------------------------------
  useEffect(() => {
    loadBookmarks().then((loaded) => {
      setBookmarks(loaded);
      setIsLoaded(true);
    });
  }, []);

  // ----------------------------------------------------------
  // Add a bookmark (no-op if already bookmarked by licence)
  // ----------------------------------------------------------
  const addBookmark = useCallback(async (player: BookmarkedPlayer): Promise<void> => {
    setBookmarks((prev) => {
      const alreadyExists = prev.some((b) => b.licence === player.licence);
      if (alreadyExists) return prev;
      const next = [...prev, player];
      // Fire-and-forget persist
      saveBookmarks(next);
      return next;
    });
  }, []);

  // ----------------------------------------------------------
  // Remove a bookmark by licence
  // ----------------------------------------------------------
  const removeBookmark = useCallback(async (licence: string): Promise<void> => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.licence !== licence);
      // Fire-and-forget persist
      saveBookmarks(next);
      return next;
    });
  }, []);

  // ----------------------------------------------------------
  // Check if a player is bookmarked
  // ----------------------------------------------------------
  const isBookmarked = useCallback(
    (licence: string): boolean => {
      return bookmarks.some((b) => b.licence === licence);
    },
    [bookmarks]
  );

  // ----------------------------------------------------------
  // Update stored rankings snapshot for a bookmarked player
  // Called passively when visiting a bookmarked player's profile
  // ----------------------------------------------------------
  const updateStoredRankings = useCallback(
    (licence: string, rankings: BookmarkedPlayer['rankings']): void => {
      setBookmarks((prev) => {
        const next = updateBookmarkRankings(licence, rankings, prev);
        // Fire-and-forget persist
        saveBookmarks(next);
        return next;
      });
    },
    []
  );

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <BookmarksContext.Provider
      value={{ bookmarks, isBookmarked, addBookmark, removeBookmark, updateStoredRankings, isLoaded }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}
