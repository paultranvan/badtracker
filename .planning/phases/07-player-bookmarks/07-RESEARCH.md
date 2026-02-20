# Phase 7: Player Bookmarks - Research

**Researched:** 2026-02-20
**Domain:** AsyncStorage persistence, React context/hook pattern, Expo Router navigation, icon toggle, toast feedback
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Bookmark action & location
- Star icon (filled/outline toggle) in the top-right of player profile header bar
- Not shown on user's own profile
- Brief toast message on toggle: "Player bookmarked" / "Bookmark removed"
- No confirmation needed for removing — instant toggle, can always re-add

#### Bookmarks list display
- Each row shows: player name + ranking for each discipline (simple, double, mixte)
- Sorted alphabetically by name
- Tapping a bookmarked player navigates to their profile (reuse /player/[licence])
- Empty state: simple "No bookmarks" message, no call to action

#### Bookmark persistence
- Stored locally (AsyncStorage) — no backend sync
- Bookmarks persist even after logout (tied to device, not account)
- No limit on number of bookmarks
- No pull-to-refresh on list — rankings show stored data, update when visiting each profile

#### Search integration
- Small star icon shown next to already-bookmarked players in search results
- No bookmark indicators on dashboard

### Claude's Discretion
- Where the bookmarks list lives in navigation (dedicated tab vs sub-screen — note: already 5 tabs: Home, Matches, Search, Club, Settings)
- Toast implementation approach
- Exact row layout and spacing for bookmark list items

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLYR-05 | User can bookmark other players for quick access | AsyncStorage persistence + useBookmarks hook + star toggle in player profile header |
| PLYR-06 | User can view a list of all their bookmarked players | Bookmarks list screen (navigation placement TBD) + FlatList sorted alphabetically |
| PLYR-07 | User can remove a player from their bookmarks | Toggle bookmark action (same star icon) — instant, no confirmation |
</phase_requirements>

---

## Summary

Phase 7 is a local-persistence feature with no network calls. The core work is: (1) a bookmark storage layer using AsyncStorage, (2) a shared hook/context making bookmark state accessible to multiple screens, (3) UI integration at three touch points (player profile header, search results list, bookmarks list screen), and (4) a toast feedback mechanism.

The entire feature stack (`@react-native-async-storage/async-storage`, `@expo/vector-icons` with Ionicons) is already installed — no new dependencies are required. The bookmark data structure is simple: a JSON-serialized array of bookmark objects keyed by a single AsyncStorage key. A React context wrapping the app provides shared, synchronous-after-load access to the bookmark set.

The main open question is navigation placement for the bookmarks list. There are already 5 tabs (Home, Matches, Search, Club, Settings), and adding a 6th is inadvisable on Android (Material Design hard limit). The recommended approach is to add bookmarks as a sub-screen inside Settings, using a nested Stack within the settings tab — the same pattern Expo Router officially documents for tabs with multiple screens. Alternatively, a header button inside Search tab to navigate to a bookmarks screen pushed onto the outer `(app)` Stack is also viable.

**Primary recommendation:** Store bookmarks as a JSON array in AsyncStorage under a single key. Expose via React context (pattern matches SessionProvider already in the codebase). Use Ionicons `star` / `star-outline` for the toggle. Place the bookmarks list as a sub-screen nested inside Settings tab (Stack layout). Implement toast with `react-native-toast-message` added at root layout.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-native-async-storage/async-storage` | 2.2.0 (already installed) | Persist bookmark data across restarts | Only endorsed async KV store for React Native; already used in project |
| `@expo/vector-icons` (Ionicons) | ~15.x (bundled with expo) | `star` / `star-outline` icons | Already bundled by Expo, zero additional install; Ionicons has both filled and outline star variants |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-toast-message` | latest (^2.x) | Brief feedback toast on bookmark toggle | New install needed — imperative API, works well with Expo Router, lightweight |
| React Context + `useReducer`/`useState` | built-in | Share bookmark state across screens | Matches existing SessionProvider pattern in the codebase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-toast-message` | Custom `Animated` fade toast (no dep) | Custom approach is ~50 lines, no new dependency, but `react-native-toast-message` is battle-tested and handles edge cases (keyboard avoidance, stacking). Either is valid. |
| React Context | Zustand / Jotai | Overkill for a simple bookmarks array; React Context fits the codebase pattern. |
| AsyncStorage direct in components | Module-level singleton utility + context | Direct use in components scatters storage logic; a dedicated utility mirrors how `useClubSearch.ts` already uses AsyncStorage. |

**Installation (if choosing react-native-toast-message):**
```bash
npm install react-native-toast-message
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   └── useBookmarks.ts          # new: bookmark hook consuming context
├── bookmarks/
│   └── storage.ts               # new: AsyncStorage read/write for bookmarks
│   └── context.tsx              # new: BookmarksProvider + useBookmarks context
app/
├── _layout.tsx                  # modified: add <Toast /> if using react-native-toast-message
├── (app)/
│   ├── (tabs)/
│   │   ├── settings/
│   │   │   ├── _layout.tsx      # new: Stack navigator for settings sub-screens
│   │   │   ├── index.tsx        # renamed from settings.tsx: add "Bookmarks" row
│   │   │   └── bookmarks.tsx    # new: bookmarks list screen
│   │   ├── search.tsx           # modified: show star on bookmarked results
│   │   └── _layout.tsx          # modified: settings tab now points to settings/ folder
│   └── player/
│       └── [licence].tsx        # modified: add star toggle in header area
```

### Pattern 1: Bookmark Storage Utility

**What:** Thin AsyncStorage wrapper — load all bookmarks, save all bookmarks.
**When to use:** Called only by the BookmarksContext on mount and on every mutation.

```typescript
// Source: @react-native-async-storage/async-storage docs
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = 'badtracker_bookmarks';

export interface BookmarkedPlayer {
  licence: string;
  nom: string;
  prenom: string;
  rankings: {
    simple?: string;   // classement string, e.g. "P11"
    double?: string;
    mixte?: string;
  };
  bookmarkedAt: number; // Date.now() for stable ordering fallback
}

export async function loadBookmarks(): Promise<BookmarkedPlayer[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveBookmarks(bookmarks: BookmarkedPlayer[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    // Storage errors are silent — bookmarks remain in-memory this session
  }
}
```

### Pattern 2: BookmarksContext (matches SessionProvider pattern)

**What:** React context providing the bookmark set and mutation functions to all screens.
**When to use:** Wrap at the `(app)` layout level, or root layout level (bookmarks persist across logout per spec).

```typescript
// Source: mirrors src/auth/context.tsx pattern already in codebase
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadBookmarks, saveBookmarks, type BookmarkedPlayer } from '../bookmarks/storage';

interface BookmarksContextType {
  bookmarks: BookmarkedPlayer[];
  isBookmarked: (licence: string) => boolean;
  addBookmark: (player: BookmarkedPlayer) => Promise<void>;
  removeBookmark: (licence: string) => Promise<void>;
  isLoaded: boolean;
}

const BookmarksContext = createContext<BookmarksContextType | null>(null);

export function useBookmarks(): BookmarksContextType {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarks must be used within BookmarksProvider');
  return ctx;
}

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<BookmarkedPlayer[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadBookmarks().then((loaded) => {
      setBookmarks(loaded);
      setIsLoaded(true);
    });
  }, []);

  const addBookmark = useCallback(async (player: BookmarkedPlayer) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.licence === player.licence)) return prev;
      const next = [...prev, player];
      saveBookmarks(next); // fire-and-forget
      return next;
    });
  }, []);

  const removeBookmark = useCallback(async (licence: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.licence !== licence);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (licence: string) => bookmarks.some((b) => b.licence === licence),
    [bookmarks]
  );

  return (
    <BookmarksContext.Provider value={{ bookmarks, isBookmarked, addBookmark, removeBookmark, isLoaded }}>
      {children}
    </BookmarksContext.Provider>
  );
}
```

### Pattern 3: Star Icon Toggle in Player Profile Header

**What:** Pressable star icon in the header area, filled when bookmarked, outline when not.
**When to use:** In the existing `app/(app)/player/[licence].tsx` component, inside or above the existing `styles.header` View. Not shown when viewing own profile.

```typescript
// Source: Ionicons icon names verified from installed glyphmap
// @expo/vector-icons is bundled with expo (expo depends on @expo/vector-icons ^15.0.3)
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../../src/auth/context';
import { useBookmarks } from '../../../src/bookmarks/context';

// Inside PlayerProfileScreen, after player data loads:
const { session } = useSession();
const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();

const isOwnProfile = session?.licence === player.licence;
const bookmarked = isBookmarked(player.licence);

const handleBookmarkToggle = async () => {
  if (bookmarked) {
    await removeBookmark(player.licence);
    // show toast: "Bookmark removed"
  } else {
    await addBookmark({
      licence: player.licence,
      nom: player.nom,
      prenom: player.prenom,
      rankings: {
        simple: player.rankings.simple?.classement,
        double: player.rankings.double?.classement,
        mixte: player.rankings.mixte?.classement,
      },
      bookmarkedAt: Date.now(),
    });
    // show toast: "Player bookmarked"
  }
};

// In the header View, positioned top-right:
{!isOwnProfile && (
  <Pressable onPress={handleBookmarkToggle} hitSlop={8}>
    <Ionicons
      name={bookmarked ? 'star' : 'star-outline'}
      size={24}
      color={bookmarked ? '#f59e0b' : '#9ca3af'}
    />
  </Pressable>
)}
```

### Pattern 4: Toast Implementation

**Option A — react-native-toast-message (recommended for reliability):**

Mount `<Toast />` once at root layout, call imperatively anywhere:
```typescript
// app/_layout.tsx — add at end of RootLayout return:
import Toast from 'react-native-toast-message';
// ...
return (
  <SessionProvider>
    <BookmarksProvider>
      <RootNavigator />
      <Toast />
    </BookmarksProvider>
  </SessionProvider>
);

// At call site:
import Toast from 'react-native-toast-message';
Toast.show({ type: 'success', text1: t('bookmarks.added'), visibilityTime: 2000 });
Toast.show({ type: 'info', text1: t('bookmarks.removed'), visibilityTime: 2000 });
```

**Option B — Custom lightweight toast (no new dependency):**

~40-line component using `Animated.Value` + `setTimeout`. Simpler dependency graph but requires more implementation work. Appropriate if the team wants to avoid a new package.

### Pattern 5: Navigation Placement for Bookmarks List

**Recommended: Nested Stack inside Settings tab**

This is the only viable approach that avoids a 6th tab (hard limit is 5 on Android from Material Design). The pattern is officially documented in Expo Router nesting navigators guide.

File structure change: rename `(tabs)/settings.tsx` → `(tabs)/settings/index.tsx`, add `(tabs)/settings/_layout.tsx` as a Stack, add `(tabs)/settings/bookmarks.tsx`.

```typescript
// app/(app)/(tabs)/settings/_layout.tsx
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SettingsLayout() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('common.settings'), headerShown: false }} />
      <Stack.Screen name="bookmarks" options={{ title: t('bookmarks.title'), headerBackTitle: '' }} />
    </Stack>
  );
}
```

Settings index screen gets a "Bookmarks" row that navigates to `/settings/bookmarks`.

**Alternative: Push bookmarks onto the outer (app) Stack**

The `(app)/_layout.tsx` already defines a Stack with player, ranking-chart, and club screens. A `bookmarks` screen could be added at this level and pushed from any tab using `router.push('/bookmarks')`. This avoids restructuring the settings tab but puts bookmarks as a "detail screen" rather than a section under settings. Either approach is valid; the nested-in-settings approach makes it more discoverable.

### Pattern 6: Star Indicator in Search Results

**What:** Small star icon next to bookmarked players in the FlatList in `search.tsx`.
**When to use:** Conditionally render a star icon in the player result row, right-aligned.

```typescript
// In search.tsx renderItem, add to the Pressable row:
const { isBookmarked } = useBookmarks();

// Inside resultItem Pressable:
{isBookmarked(item.Licence) && (
  <Ionicons name="star" size={14} color="#f59e0b" style={{ marginLeft: 4 }} />
)}
```

### Pattern 7: Bookmarks List Screen

```typescript
// app/(app)/(tabs)/settings/bookmarks.tsx (or /bookmarks.tsx at app level)
import { FlatList, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useBookmarks } from '../../../../src/bookmarks/context';

export default function BookmarksScreen() {
  const { bookmarks } = useBookmarks();
  const { t } = useTranslation();

  // Sort alphabetically by nom then prenom
  const sorted = [...bookmarks].sort((a, b) => {
    const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
    const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (sorted.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('bookmarks.empty')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.licence}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/player/[licence]', params: { licence: item.licence } })}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.name}>{item.nom} {item.prenom}</Text>
          <View style={styles.rankings}>
            {item.rankings.simple && <Text style={styles.rank}>{t('player.simple')}: {item.rankings.simple}</Text>}
            {item.rankings.double && <Text style={styles.rank}>{t('player.double')}: {item.rankings.double}</Text>}
            {item.rankings.mixte  && <Text style={styles.rank}>{t('player.mixte')}: {item.rankings.mixte}</Text>}
          </View>
        </Pressable>
      )}
    />
  );
}
```

### Anti-Patterns to Avoid

- **Calling AsyncStorage on every render:** Load once in context on mount, mutate via context functions. Components only read from context state.
- **Storing PlayerProfile objects directly:** Only store what's needed for display (name, classement per discipline, licence). Full profile is fetched fresh when user taps into a player.
- **Showing bookmark icon before player data loads:** Guard the icon render behind `player !== null`. The icon should only appear after the profile has loaded and the own-profile check can be made.
- **No `isLoaded` guard on bookmarks:** If the BookmarksContext has not yet loaded from AsyncStorage, `isBookmarked()` will return `false` for all players. Render the star icon without an explicit loaded guard — this just means the icon shows outline until AsyncStorage resolves (typically < 20ms). Acceptable UX.
- **Mutating bookmarks inside a sort:** Always spread before sorting (`[...bookmarks].sort(...)`) — `Array.sort` mutates in place and will cause subtle state bugs if the context array reference is sorted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon with filled/outline states | Custom SVG bookmark icon | Ionicons `star` / `star-outline` | Already bundled with Expo; no new dependency; consistent with platform look |
| Toast notification | Manual `Animated` + `setTimeout` overlay | `react-native-toast-message` | Handles keyboard avoidance, stacking, positioning — 20 edge cases for free |
| Alphabetical sort with locale | `a.nom.localeCompare(b.nom)` (might not handle accents) | `String.localeCompare()` — it's fine here | For French names with accents, `localeCompare()` without locale arg still handles accented chars correctly on both iOS and Android |

**Key insight:** All required storage, icon, and navigation primitives already exist in the installed package set. The only potentially new dependency is a toast library.

---

## Common Pitfalls

### Pitfall 1: Settings Tab Restructuring Breaks the Tab Entry

**What goes wrong:** When converting `settings.tsx` to `settings/index.tsx` + `settings/_layout.tsx`, the `(tabs)/_layout.tsx` Tabs.Screen `name="settings"` must stay the same — it now refers to the folder, not the file. If renamed, the tab breaks.

**Why it happens:** Expo Router file-system routing: a folder `settings/` with `_layout.tsx` and `index.tsx` maps to the same route as a file `settings.tsx`. The Tabs.Screen `name` property should remain `"settings"`.

**How to avoid:** After the file rename/create, verify the tab still renders by checking that `name="settings"` in `(tabs)/_layout.tsx` is unchanged. The existing Tabs.Screen config requires no modification.

**Warning signs:** "No route named 'settings'" error, or settings tab showing blank screen.

### Pitfall 2: Bookmark Data Staleness on Profile Navigate-Back

**What goes wrong:** User visits player profile, toggles bookmark, navigates back to bookmarks list — the list shows stale data (old name or ranking).

**Why it happens:** Bookmarks store snapshot data at bookmark-time. Rankings evolve. The spec explicitly says "rankings show stored data, update when visiting each profile."

**How to avoid:** When user navigates to a player profile from the bookmarks list and the profile loads successfully, update the stored bookmark's ranking data. This is an optional "refresh bookmark on visit" step — update the bookmark's `rankings` object after `getPlayerProfile` resolves, if the player is already bookmarked.

**Warning signs:** Bookmarked player shows "P10" but profile shows "P11" after a ranking update.

### Pitfall 3: Own-Profile Star Icon Shown on Dashboard Player

**What goes wrong:** The spec says "not shown on user's own profile." The check requires `session.licence === player.licence`. The session licence is a string; ensure strict string comparison (no numeric coercion).

**Why it happens:** FFBaD licences are numeric strings. `session.licence` may be stored as a string `"12345678"` while the `player.licence` field from the API is also a string — but verify both are compared as strings.

**How to avoid:** Always use `=== ` string comparison, never `==`. Both the session context (`UserSession.licence: string`) and `PlayerProfile.licence: string` are typed as strings — safe.

### Pitfall 4: Toast Positioned Behind Native Modal or Tab Bar

**What goes wrong:** `react-native-toast-message`'s default `position: 'top'` is fine. `position: 'bottom'` can be occluded by the tab bar.

**Why it happens:** Toast renders at window level but tab bar sits above it in z-order on some platforms.

**How to avoid:** Use `position: 'top'` (the default) for bookmark toasts. Optionally use a `topOffset` matching the safe area. Alternatively, render toast at bottom with a `bottomOffset` that clears the tab bar.

### Pitfall 5: AsyncStorage Error Swallowed Silently

**What goes wrong:** If AsyncStorage write fails (storage full, permissions, etc.), the in-memory state is updated but the disk write is lost. Next app restart loses the bookmark.

**Why it happens:** The `saveBookmarks` call is fire-and-forget in the context.

**How to avoid:** This is an acceptable tradeoff per the project's existing pattern (see `useClubSearch.ts` which also silently swallows storage errors). Optionally, catch errors in `saveBookmarks` and log to console in dev mode. Do not surface storage errors to users for bookmarks — it is too rare and too disruptive.

---

## Code Examples

Verified patterns from official sources:

### AsyncStorage — Save and Load JSON Array
```typescript
// Source: @react-native-async-storage/async-storage docs (Context7)
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = 'badtracker_bookmarks';

const save = async (data: unknown[]) => {
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(data));
  } catch { /* silent */ }
};

const load = async (): Promise<unknown[]> => {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
```

### Ionicons Star Toggle
```typescript
// Source: Ionicons glyphmap verified in installed package
// /node_modules/expo/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json
import { Ionicons } from '@expo/vector-icons';

<Ionicons
  name={isBookmarked ? 'star' : 'star-outline'}
  size={24}
  color={isBookmarked ? '#f59e0b' : '#9ca3af'}
/>
```

### react-native-toast-message — Show Toast
```typescript
// Source: react-native-toast-message docs (Context7)
import Toast from 'react-native-toast-message';

Toast.show({
  type: 'success',
  text1: 'Joueur ajouté aux favoris',
  visibilityTime: 2000,
  position: 'top',
});
```

### BookmarksProvider at Root Layout
```typescript
// app/_layout.tsx — modified to wrap with BookmarksProvider
import Toast from 'react-native-toast-message';
import { BookmarksProvider } from '../src/bookmarks/context';

export default function RootLayout() {
  return (
    <SessionProvider>
      <BookmarksProvider>
        <RootNavigator />
        <Toast />
      </BookmarksProvider>
    </SessionProvider>
  );
}
```

### Settings Tab Restructure — Nested Stack Layout
```typescript
// app/(app)/(tabs)/settings/_layout.tsx
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SettingsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: '' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="bookmarks" options={{ title: t('bookmarks.title') }} />
    </Stack>
  );
}
// The existing (tabs)/_layout.tsx Tabs.Screen name="settings" stays unchanged.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AsyncStorage` via `react-native` core | `@react-native-async-storage/async-storage` separate package | React Native 0.59 | Already using correct package in this project |
| `react-native-vector-icons` (manual linking) | `@expo/vector-icons` (bundled by Expo) | Expo SDK ~46 | No separate install needed; icons just work |
| Separate toasts per screen | Single `<Toast />` at root + imperative API | n/a | One mount point, call from anywhere |

**Deprecated/outdated:**
- `AsyncStorage` from `'react-native'`: removed; use `@react-native-async-storage/async-storage`
- `react-native-vector-icons` with manual linking: use `@expo/vector-icons` in Expo projects

---

## Open Questions

1. **Navigation placement: nested-in-Settings vs outer-Stack level**
   - What we know: 5 tabs already exist; Android caps at 5 tabs; Expo Router supports both patterns
   - What's unclear: User hasn't confirmed preference; "Claude's Discretion" applies
   - Recommendation: **Nested Stack inside Settings tab.** It groups bookmarks logically under settings (a preferences-like area), avoids any tab bar change, and follows Expo Router's nesting-navigators pattern exactly. The settings index screen gets a "Bookmarks" list item row navigating to `/settings/bookmarks`.

2. **Toast library vs. custom implementation**
   - What we know: `react-native-toast-message` is well-maintained (High reputation, 92.8 benchmark), no native modules needed. Custom is ~40 lines but misses edge cases.
   - What's unclear: Project appetite for adding new npm package
   - Recommendation: **Use `react-native-toast-message`.** The project already has several external packages; one more for a commonly needed UI primitive is reasonable. If zero new deps is a hard constraint, implement a custom `useToast` hook with `Animated`.

3. **Bookmark update on profile visit**
   - What we know: Spec says "rankings show stored data, update when visiting each profile" — somewhat ambiguous
   - What's unclear: Does this mean "only accurate after a visit" (passive) or "automatically update stored bookmark when visiting" (active)
   - Recommendation: **Implement passive update.** When a bookmarked player's profile is successfully loaded, silently update the bookmark's `rankings` snapshot in context + storage. This makes the bookmarks list accurate after each profile visit without any explicit user action.

---

## Sources

### Primary (HIGH confidence)
- `/react-native-async-storage/async-storage` (Context7) — setItem, getItem, JSON serialization patterns
- `/calintamas/react-native-toast-message` (Context7) — install, Toast.show(), root setup
- Ionicons glyphmap: `/home/paul/dev/perso/sport/badtracker/node_modules/expo/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json` — verified `star`, `star-outline`, `bookmark`, `bookmark-outline` all present
- Existing codebase: `src/auth/context.tsx` (context pattern), `src/i18n/index.ts` (AsyncStorage usage pattern), `src/hooks/useClubSearch.ts` (AsyncStorage caching pattern), `app/(app)/_layout.tsx` (Stack with named screens), `app/(app)/(tabs)/_layout.tsx` (5-tab structure)

### Secondary (MEDIUM confidence)
- Expo Router nesting navigators docs (WebFetch) — confirmed nested Stack inside Tab pattern with file structure
- WebSearch: Android 5-tab Material Design limit — consistent across multiple sources

### Tertiary (LOW confidence)
- react-native-toast-message with Expo Router root layout placement: confirmed from Context7 snippets + GitHub issue thread (multiple sources agree `<Toast />` goes at end of root return)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed or well-documented; Ionicons icon names verified from installed files
- Architecture: HIGH — patterns directly mirror existing codebase conventions (SessionProvider, useClubSearch AsyncStorage usage)
- Navigation placement: MEDIUM — recommended approach (nested Stack in Settings) is documented; final choice is Claude's discretion per CONTEXT.md
- Toast implementation: MEDIUM — library approach is documented; custom alternative not benchmarked in this project context
- Pitfalls: HIGH — all derived from reading actual code and known React Native patterns

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable ecosystem — AsyncStorage, vector-icons, expo-router patterns change slowly)
