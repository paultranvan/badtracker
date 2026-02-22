# Players Tab Design

## Summary

Transform the Search tab into a "Players" tab that combines player search with a favourites list. When no search query is active, the screen shows bookmarked players with their rankings. Typing a search query replaces favourites with search results. Reuses existing `PlayerRow` component and `useBookmarks` context.

## Decisions

- **Approach:** Rename `search.tsx` → `players.tsx` (Approach B)
- **Layout:** Search bar at top, favourites list below (no section headers)
- **Ranking display:** Show all 3 discipline rankings as coloured pills (S/D/M)
- **Offline:** Show favourites from local storage; disable search bar
- **Settings bookmarks:** Remove entirely (replaced by Players tab)

## Screen Layout

```
┌────────────────────────────┐
│  🔍 Search players...      │  ← search bar (same as today)
├────────────────────────────┤
│                            │
│  ★ DUPONT Jean             │  ← PlayerRow with 3 rank pills
│    Club ABC   P11 D9 M12   │
│  ─────────────────────────  │
│  ★ MARTIN Marie            │
│    Club XYZ   P10 D8       │
│                            │
│  If no favourites:         │
│  ★ star-outline icon       │
│  "No favourite players yet"│
└────────────────────────────┘
```

When user types ≥3 chars → search results replace favourites.
Clear search → favourites reappear.

## Changes

### 1. Rename file

- `app/(app)/(tabs)/search.tsx` → `app/(app)/(tabs)/players.tsx`

### 2. Tab bar (`_layout.tsx`)

- Tab name: `"search"` → `"players"`
- Icon: `people-outline`
- Label/title: `t('players.tab')`
- Club tab icon: change from `people-outline` to `shield-outline` (to avoid duplicate icons)

### 3. PlayerRow enhancement

Add `ranks?: { simple?: string; double?: string; mixte?: string }` prop alongside existing `rank` prop:
- When `ranks` is provided: render up to 3 small coloured pills (blue for simple, green for double, amber for mixte)
- When only `rank` is provided: render single pill (backward compatible)
- Discipline colours match dashboard: `#3b82f6` (S), `#10b981` (D), `#f59e0b` (M)

### 4. Players screen logic

- No query active → show `bookmarks` from `useBookmarks()`, sorted alphabetically
- Each bookmark rendered as `PlayerRow` with `ranks` prop populated from `BookmarkedPlayer.rankings`
- Empty bookmarks → empty state with star icon + "No favourite players yet"
- Offline → search bar disabled/grayed, favourites still shown
- Query active → search results (existing behaviour)

### 5. Remove Settings > Bookmarks

- Delete `app/(app)/(tabs)/settings/bookmarks.tsx`
- Remove navigation item from `settings/index.tsx`

### 6. i18n

New keys:
- `players.tab` → EN: "Players" / FR: "Joueurs"
- `players.noFavourites` → EN: "No favourite players yet" / FR: "Aucun joueur favori"

Removed: `search.tab` (replaced by `players.tab`)
