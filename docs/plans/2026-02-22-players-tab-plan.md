# Players Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Search tab into a "Players" tab that shows favourite players with rankings when idle, and search results when typing.

**Architecture:** Rename `search.tsx` → `players.tsx`, enhance `PlayerRow` with multi-rank pills, wire favourites from `useBookmarks()`, remove settings/bookmarks screen.

**Tech Stack:** React Native, Expo Router, NativeWind, i18next

---

### Task 1: Enhance PlayerRow with multi-rank pills

**Files:**
- Modify: `src/components/PlayerRow.tsx`

**Step 1: Add `ranks` prop to PlayerRow**

Add a new optional `ranks` prop alongside the existing `rank` prop. When `ranks` is provided, render coloured discipline pills instead of the single rank pill.

```tsx
// In PlayerRow.tsx, update the interface:

interface PlayerRowProps {
  name: string;
  club?: string;
  rank?: string;
  ranks?: { simple?: string; double?: string; mixte?: string };
  licence?: string;
  isBookmarked?: boolean;
  position?: number;
  isCurrentUser?: boolean;
  onPress?: () => void;
}
```

**Step 2: Add discipline colour map and render multi-rank pills**

Inside the component, before the `{rank && ...}` block, add handling for `ranks`:

```tsx
const disciplineColors: Record<string, string> = {
  simple: '#3b82f6',
  double: '#10b981',
  mixte: '#f59e0b',
};

// In the JSX, replace the single rank pill block with:
{ranks ? (
  <View className="flex-row mr-2">
    {ranks.simple && (
      <View className="rounded-md px-1.5 py-0.5 mr-1" style={{ backgroundColor: disciplineColors.simple + '20' }}>
        <Text className="text-[11px] font-bold" style={{ color: disciplineColors.simple }}>{ranks.simple}</Text>
      </View>
    )}
    {ranks.double && (
      <View className="rounded-md px-1.5 py-0.5 mr-1" style={{ backgroundColor: disciplineColors.double + '20' }}>
        <Text className="text-[11px] font-bold" style={{ color: disciplineColors.double }}>{ranks.double}</Text>
      </View>
    )}
    {ranks.mixte && (
      <View className="rounded-md px-1.5 py-0.5 mr-1" style={{ backgroundColor: disciplineColors.mixte + '20' }}>
        <Text className="text-[11px] font-bold" style={{ color: disciplineColors.mixte }}>{ranks.mixte}</Text>
      </View>
    )}
  </View>
) : rank ? (
  <View className="bg-gray-100 rounded-md px-2 py-1 mr-2">
    <Text className="text-caption font-bold text-gray-700">{rank}</Text>
  </View>
) : null}
```

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors (existing callers still pass `rank`, new `ranks` is optional)

**Step 4: Commit**

```bash
git add src/components/PlayerRow.tsx
git commit -m "feat: add multi-rank discipline pills to PlayerRow"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/fr.json`

**Step 1: Add players namespace to en.json**

Add after the `"search"` block:

```json
"players": {
  "tab": "Players",
  "noFavourites": "No favourite players yet",
  "searchOffline": "Search requires an internet connection"
}
```

Keep the existing `"search"` keys — they're still used for placeholder text etc. Just rename `search.tab` usage later.

**Step 2: Add players namespace to fr.json**

```json
"players": {
  "tab": "Joueurs",
  "noFavourites": "Aucun joueur favori",
  "searchOffline": "La recherche nécessite une connexion internet"
}
```

**Step 3: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/fr.json
git commit -m "feat: add players tab i18n keys"
```

---

### Task 3: Rename search.tsx → players.tsx and update tab layout

**Files:**
- Rename: `app/(app)/(tabs)/search.tsx` → `app/(app)/(tabs)/players.tsx`
- Modify: `app/(app)/(tabs)/_layout.tsx`

**Step 1: Rename the file**

```bash
git mv app/\(app\)/\(tabs\)/search.tsx app/\(app\)/\(tabs\)/players.tsx
```

**Step 2: Update tab layout**

In `app/(app)/(tabs)/_layout.tsx`, update the search tab entry:

Change the `<Tabs.Screen name="search" ...>` block to:

```tsx
<Tabs.Screen
  name="players"
  options={{
    title: t('players.tab'),
    tabBarLabel: t('players.tab'),
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="people-outline" size={size} color={color} />
    ),
  }}
/>
```

Also change the Club tab icon from `people-outline` to `shield-outline` to avoid duplicate icons:

```tsx
<Tabs.Screen
  name="club"
  options={{
    title: t('club.tab'),
    tabBarLabel: t('club.tab'),
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="shield-outline" size={size} color={color} />
    ),
  }}
/>
```

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/\(app\)/\(tabs\)/players.tsx app/\(app\)/\(tabs\)/_layout.tsx
git commit -m "feat: rename Search tab to Players tab"
```

---

### Task 4: Add favourites list to Players screen

**Files:**
- Modify: `app/(app)/(tabs)/players.tsx`

**Step 1: Rewrite the screen to show favourites when no search query**

The screen logic:
- Import `useBookmarks`
- When `query` is empty (no active search): show sorted bookmarks list using `PlayerRow` with `ranks` prop
- When `query.length >= 3`: show search results (existing behaviour)
- When offline: show favourites, disable search input

Replace the full content of `players.tsx`:

```tsx
import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerSearch } from '@/hooks/usePlayerSearch';
import { useBookmarks } from '@/bookmarks/context';
import { useConnectivity } from '@/connectivity/context';
import { PlayerRow } from '@/components';
import type { BookmarkedPlayer } from '@/bookmarks/storage';

export default function PlayersScreen() {
  const { t } = useTranslation();
  const { query, setQuery, results, isLoading, error } = usePlayerSearch();
  const { bookmarks, isBookmarked } = useBookmarks();
  const { isConnected } = useConnectivity();

  const isSearching = query.length > 0;

  // Favourites sorted alphabetically
  const sortedBookmarks = useMemo(() => {
    return [...bookmarks].sort((a, b) => {
      const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
      const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [bookmarks]);

  // Render a search result row
  const renderSearchItem = useCallback(
    ({ item }: { item: (typeof results)[number] }) => (
      <PlayerRow
        name={`${item.Nom} ${item.Prenom}`}
        club={item.NomClub || undefined}
        licence={item.Licence}
        isBookmarked={isBookmarked(item.Licence)}
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: {
              licence: item.Licence,
              personId: item.personId ?? '',
              nom: item.Nom ?? '',
              prenom: item.Prenom ?? '',
              club: item.Club ?? '',
              nomClub: item.NomClub ?? '',
            },
          })
        }
      />
    ),
    [isBookmarked],
  );

  // Render a favourite player row
  const renderBookmarkItem = useCallback(
    ({ item }: { item: BookmarkedPlayer }) => (
      <PlayerRow
        name={`${item.nom} ${item.prenom}`}
        ranks={item.rankings}
        isBookmarked
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: { licence: item.licence },
          })
        }
      />
    ),
    [],
  );

  // Separator
  const separator = () => <View className="h-px bg-gray-100 mx-4" />;

  return (
    <View className="flex-1 bg-white">
      {/* Search input */}
      <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200">
        <View
          className={`flex-row items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-200 ${
            !isConnected ? 'opacity-50' : ''
          }`}
        >
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-body text-gray-900"
            placeholder={t('search.placeholder')}
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            editable={isConnected}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#d1d5db" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content area */}
      <View className="flex-1">
        {isSearching ? (
          // ---- Search mode ----
          isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-body text-loss text-center">{error}</Text>
            </View>
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.Licence}
              renderItem={renderSearchItem}
              ItemSeparatorComponent={separator}
              contentContainerStyle={{ paddingVertical: 8 }}
            />
          ) : query.length >= 3 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Ionicons name="search-outline" size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
              <Text className="text-body text-muted text-center">{t('search.noResults')}</Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-body text-gray-400 text-center">{t('search.minChars')}</Text>
            </View>
          )
        ) : (
          // ---- Favourites mode ----
          sortedBookmarks.length > 0 ? (
            <FlatList
              data={sortedBookmarks}
              keyExtractor={(item) => item.licence}
              renderItem={renderBookmarkItem}
              ItemSeparatorComponent={separator}
              contentContainerStyle={{ paddingVertical: 8 }}
            />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Ionicons name="star-outline" size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
              <Text className="text-body text-gray-400 text-center">{t('players.noFavourites')}</Text>
            </View>
          )
        )}
      </View>
    </View>
  );
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/\(app\)/\(tabs\)/players.tsx
git commit -m "feat: show favourite players on Players tab when not searching"
```

---

### Task 5: Remove Settings > Bookmarks screen

**Files:**
- Delete: `app/(app)/(tabs)/settings/bookmarks.tsx`
- Modify: `app/(app)/(tabs)/settings/index.tsx`

**Step 1: Delete bookmarks screen**

```bash
git rm app/\(app\)/\(tabs\)/settings/bookmarks.tsx
```

**Step 2: Remove bookmarks row from settings**

In `settings/index.tsx`, remove the bookmarks row (lines 89-99) — the `<Pressable>` that navigates to `/settings/bookmarks`. Also remove the `import { router } from 'expo-router';` since it's no longer needed (check if anything else uses it first).

After removal, the "Data" section should go directly from the section header to the "Clear cache" row.

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/\(app\)/\(tabs\)/settings/index.tsx
git commit -m "feat: remove bookmarks screen from settings (moved to Players tab)"
```

---

### Task 6: Final verification and cleanup

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean pass, no errors

**Step 2: Manual testing checklist**

Test on device/emulator:
- [ ] Players tab shows "Joueurs"/"Players" label with people icon
- [ ] Club tab has shield icon (no longer people icon)
- [ ] Empty favourites shows star icon + empty message
- [ ] Typing in search bar shows search results (same as before)
- [ ] Clearing search shows favourites again
- [ ] Each favourite shows up to 3 coloured rank pills (S=blue, D=green, M=amber)
- [ ] Tapping a favourite navigates to player profile
- [ ] Settings no longer shows bookmarks row
- [ ] Offline: favourites visible, search bar grayed out

**Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: players tab polish"
```
