import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Types
// ============================================================

export interface BookmarkedPlayer {
  licence: string;
  nom: string;
  prenom: string;
  personId?: string;
  rankings: {
    simple?: string; // classement string e.g. "P11"
    double?: string;
    mixte?: string;
  };
  bookmarkedAt: number; // Date.now() timestamp
}

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = 'badtracker_bookmarks';

// ============================================================
// Storage functions
// ============================================================

/**
 * Load all bookmarked players from AsyncStorage.
 * Returns an empty array on error or if nothing stored yet.
 */
export async function loadBookmarks(): Promise<BookmarkedPlayer[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    return JSON.parse(raw) as BookmarkedPlayer[];
  } catch {
    return [];
  }
}

/**
 * Persist all bookmarked players to AsyncStorage.
 * Fire-and-forget: errors are silently caught (matching useClubSearch.ts pattern).
 */
export async function saveBookmarks(bookmarks: BookmarkedPlayer[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // Silently ignore storage errors — bookmarks still work in-memory for the session
  }
}

/**
 * Returns a new bookmarks array with updated rankings for the given licence.
 * Used for passive ranking refresh when visiting a bookmarked player's profile.
 * Does not mutate the original array.
 */
export function updateBookmarkRankings(
  licence: string,
  rankings: BookmarkedPlayer['rankings'],
  all: BookmarkedPlayer[]
): BookmarkedPlayer[] {
  return all.map((b) =>
    b.licence === licence ? { ...b, rankings } : b
  );
}

/**
 * Returns a new bookmarks array with personId set for the given licence.
 * Only updates if the bookmark exists and doesn't already have a personId.
 */
export function updateBookmarkPersonId(
  licence: string,
  personId: string,
  all: BookmarkedPlayer[]
): BookmarkedPlayer[] {
  return all.map((b) =>
    b.licence === licence && !b.personId ? { ...b, personId } : b
  );
}
