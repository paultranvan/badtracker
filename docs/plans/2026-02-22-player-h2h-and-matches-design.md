# Player Head-to-Head & Full Match History

## Problem

When tapping a player from the club leaderboard, the profile screen only shows rankings and club info. Users want to see:
1. Their personal history with that player — matches played **against** and **together**
2. That player's full match history (same accordion UI as the user's Matches tab)

## Solution

Add two new features to the player profile screen:
1. **Head-to-Head section** — split into "Against" and "Together" tabs with rich stats and match list
2. **"See all matches" button** — opens a full match history screen (identical to the user's Matches tab) for any player

## Head-to-Head Section

### Layout

Added below the Rankings section on the player profile screen. Hidden when viewing your own profile (`isOwnProfile`).

Two-tab segment control:

- **Against** — matches where you were opponents
- **Together** — matches where you were partners (doubles/mixed only)

Each tab shows:
- Aggregate W-L count with win rate bar (green/red split)
- Per-discipline breakdown in mini-cards with discipline colors
- Chronological match list
- Last played date

### Visual Design

**Segment control:**
- Two pills: `⚔️ Against (4)` / `🤝 Together (7)` — count shown inline
- Active pill: filled primary blue, white text
- Inactive pill: gray border, muted text

**Summary card (Against tab):**

```
┌─────────────────────────────────────────┐
│  ⚔️  Against Paul TRAN-VAN             │
│                                         │
│       3W · 1L                           │  large, green W / red L
│  ████████████░░░░  75%                  │  green/red split bar
│                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐            │
│  │S 2-0│  │D 1-1│  │M 0-0│            │  discipline mini-cards
│  │blue │  │green│  │amber│            │  with discipline colors
│  └─────┘  └─────┘  └─────┘            │
│                                         │
│  Last played: 18 Feb 2026              │
└─────────────────────────────────────────┘
```

**Summary card (Together tab):**

```
┌─────────────────────────────────────────┐
│  🤝  Together with Paul TRAN-VAN        │
│                                         │
│       5W · 2L                           │
│  ████████████░░░░░░  71%                │
│                                         │
│  ┌─────┐  ┌─────┐                      │
│  │D 3-1│  │M 2-1│                      │  no Singles (can't play together)
│  │green│  │amber│                      │
│  └─────┘  └─────┘                      │
│                                         │
│  Last played: 18 Feb 2026              │
└─────────────────────────────────────────┘
```

**Match list items:**
- Left border colored by discipline (blue=S, green=D, amber=M)
- Win: green accent + checkmark badge. Loss: red accent + cross badge
- Shows: date, tournament name, score, points gained/lost
- Against tab: "vs Paul TRAN-VAN"
- Together tab: "with Paul TRAN-VAN vs [opponents]"

**Empty states:**
- Against with 0 matches: `⚔️ You've never faced each other`
- Together with 0 matches: `🤝 You've never teamed up`

## Full Match History Screen

### Route

```
app/(app)/player/[licence]/matches.tsx
```

Stack screen pushed from the player profile. Header shows `[Player Name] · Matches` with back button.

### UI

Identical to the user's Matches tab:

- `StatsHeader` with collapsible win rate bar
- Discipline filter chips with counts: All / Singles / Doubles / Mixed
- Season picker (horizontal scroll)
- Two-level accordion: Tournament > Discipline > `DetailMatchCard`
- Lazy detail loading with spinners
- Pull-to-refresh

### What's different from user's Matches tab

- Screen title shows player's name (not "Matches")
- No tab bar (stack screen)
- Data from refactored `useMatchHistory(personId)` instead of session

### "See all matches" button

At the bottom of the player profile, below the H2H section:

```
┌─────────────────────────────────────────┐
│  📋  See all matches ›                  │  full-width, primary color
└─────────────────────────────────────────┘
```

Always visible (even for own profile — navigates to Matches tab in that case).

## Data Layer

### New API function: `getPlayerOpposition`

Location: `src/api/ffbad.ts`

```
GET /api/person/{myPersonId}/playerOpposition/{theirPersonId}
```

- Uses logged-in user's personId and target player's personId
- Zod schema with `.passthrough()` (response shape to be discovered)
- Returns raw data, hook transforms it

Fallback: if API doesn't return enough detail, scan user's cached match details where `opponentLicence` or `partnerLicence` matches the target player's licence.

### Refactor: `getResultsByLicence`

```typescript
// Before: getResultsByLicence(licence: string)
// After:  getResultsByLicence(licence: string, personId?: number)
```

When `personId` is provided, use it directly for `/api/person/{personId}/result/Decade` instead of requiring `licence === session.licence`.

### Refactor: `useMatchHistory`

```typescript
// Before: useMatchHistory()
// After:  useMatchHistory(personId?: number)
```

- No `personId`: behaves as today (backward compatible, uses session)
- With `personId`: fetches that player's results and details

### New hook: `useHeadToHead`

Location: `src/hooks/useHeadToHead.ts`

```typescript
function useHeadToHead(theirPersonId: number | null): {
  against: H2HStats | null;
  together: H2HStats | null;
  matches: H2HMatch[];
  isLoading: boolean;
  error: string | null;
}

interface H2HStats {
  wins: number;
  losses: number;
  winRate: number;
  byDiscipline: Record<'simple' | 'double' | 'mixte', { wins: number; losses: number }>;
  lastPlayed: string | null;
  matchCount: number;
}

interface H2HMatch {
  date: string;
  tournament: string;
  discipline: 'simple' | 'double' | 'mixte';
  isWin: boolean;
  score: string;
  points: number | null;
  relation: 'against' | 'together';
  opponents?: string;  // for "together": who you played against
}
```

**Data flow:**
1. Call `getPlayerOpposition(myPersonId, theirPersonId)`
2. Parse into against/together buckets based on response data
3. If API response insufficient: scan user's cached match details where `opponentLicence` or `partnerLicence` matches
4. Compute aggregates (W-L, per-discipline, win rate) from match list

### Caching

| Key | TTL | Contents |
|-----|-----|----------|
| `h2h:{myPersonId}:{theirPersonId}` | 5 min | Opposition data |
| `matches:{personId}` | 5 min | Result list (reuses existing) |
| `matches-raw:{personId}` | 5 min | Raw API items for lazy loading |
| `detail:{personId}:*` | 24 hours | Match details (reuses existing) |

### Route params flow

```
Club Leaderboard → /player/[licence]?personId=12345
                          ↓
                   Player Profile (H2H section fetches opposition data)
                          ↓
                   /player/[licence]/matches?personId=12345
                          (full match history with accordion)
```

`personId` is available from `LeaderboardEntry.personId` (club tab) and from search results (`searchResult.personId`). Threaded through route params.

## What Changes

| File | Change |
|------|--------|
| `src/api/ffbad.ts` | Add `getPlayerOpposition()`, refactor `getResultsByLicence` to accept `personId` |
| `src/hooks/useHeadToHead.ts` | New hook |
| `src/hooks/useMatchHistory.ts` | Add optional `personId` param |
| `app/(app)/player/[licence].tsx` | Add H2H section + "See all matches" button |
| `app/(app)/player/[licence]/matches.tsx` | New screen (reuses match history UI) |
| `app/(app)/(tabs)/club.tsx` | Pass `personId` in route params when navigating |
| `src/i18n/locales/fr.json` | New i18n keys for H2H section |
| `src/i18n/locales/en.json` | New i18n keys for H2H section |

## What Stays

- Existing Matches tab — untouched, `useMatchHistory()` with no args still works
- Existing player profile layout — H2H and button appended below
- All existing cache keys — backward compatible
- `DetailMatchCard` component — reused as-is
- Match history accordion components — reused as-is
