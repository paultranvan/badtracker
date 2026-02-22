import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Constants
// ============================================================

/**
 * Prefix for all cache keys. Distinct from:
 * - 'badtracker_bookmarks' (Phase 7 bookmarks storage)
 * - 'badtracker_language' (i18n language preference)
 *
 * Key patterns:
 * - badtracker_cache:dashboard:{licence}   — user's dashboard data
 * - badtracker_cache:matches:{licence}     — user's match history
 * - badtracker_cache:ranking:{licence}     — user's ranking evolution
 * - badtracker_cache:club:{clubId}         — club leaderboard
 * - badtracker_cache:player:{licence}      — bookmarked player profile
 */
export const CACHE_PREFIX = 'badtracker_cache:';

// ============================================================
// Cache operations
// ============================================================

/**
 * Read a cached value by key. Returns null on cache miss or error.
 * Key is automatically prefixed with CACHE_PREFIX.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write a value to cache. Fire-and-forget — errors are silently caught.
 * Key is automatically prefixed with CACHE_PREFIX.
 */
export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
  } catch {
    // Silently ignore — cache is best-effort
  }
}

// ============================================================
// TTL cache operations
// ============================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Read a cached value by key, returning null if expired or missing.
 * TTL is in milliseconds.
 */
export async function cacheGetWithTTL<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (raw === null) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry.timestamp || Date.now() - entry.timestamp > ttlMs) {
      // Expired — remove asynchronously
      AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`).catch(() => {});
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Write a value to cache with a timestamp for TTL checks.
 */
export async function cacheSetWithTTL<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Silently ignore — cache is best-effort
  }
}

// ============================================================
// Cache clearing
// ============================================================

/**
 * Clear ALL cache entries (keys starting with CACHE_PREFIX).
 * Does NOT touch bookmarks ('badtracker_bookmarks') or language ('badtracker_language').
 */
export async function cacheClear(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Silently ignore
  }
}

/**
 * Clear cache entries for a specific user licence.
 * Removes keys containing the licence string (dashboard, matches, ranking, player).
 */
export async function cacheClearForUser(licence: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userCacheKeys = allKeys.filter(
      (k) => k.startsWith(CACHE_PREFIX) && k.includes(licence)
    );
    if (userCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(userCacheKeys);
    }
  } catch {
    // Silently ignore
  }
}
