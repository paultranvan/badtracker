# Club Leaderboard Redesign

## Problem

The current club leaderboard has several shortcomings:
1. Club info (address, mail, etc.) takes too much space
2. Only shows rank categories (P10, D7) without CPPH points
3. Sorting uses rank buckets instead of actual points (players with same rank aren't properly ordered)
4. Missing player category (junior, senior, veteran) and sex emoji
5. Data source (search API) provides no CPPH points

## Solution

Switch the data source from `/api/search/` (text search by club initials) to `/api/search/tops` (ranked player listing by club `instanceId`). Fetch all 6 gendered disciplines in parallel, merge by licence, and display richer per-player data.

## Data Layer

### New API: `getClubTops(clubId: number)`

Location: `src/api/ffbad.ts`

Calls `POST /api/search/tops` for disciplines 1-6 in parallel:
- 1=Simple Hommes, 2=Simple Dames, 3=Double Hommes, 4=Double Dames, 5=Mixte Hommes, 6=Mixte Dames
- Body: `{ discipline, dateFrom: new Date().toISOString(), top: 500, instanceId: clubId, isFirstLoad: false, sort: "nom-ASC" }`
- Merges all 6 response arrays by `licence` into unified player records

### New `LeaderboardEntry` type

Location: `src/utils/clubLeaderboard.ts`

```typescript
interface DisciplineRanking {
  subLevel: string       // "D9", "P10", "-"
  rate: number | null    // CPPH points, null if unranked
  rank: number           // position within this discipline nationally
}

interface LeaderboardEntry {
  licence: string
  personId: number
  name: string           // full name from API ("Paul TRAN-VAN")
  category: string       // "Senior", "Veteran 1", "Junior 2", etc.
  sex: 'M' | 'F'        // inferred: disciplines 1,3,5 = M; 2,4,6 = F
  simple: DisciplineRanking | null
  double: DisciplineRanking | null
  mixte: DisciplineRanking | null
  bestRate: number | null
  bestSubLevel: string
  bestDiscipline: 'simple' | 'double' | 'mixte' | null
  position: number       // assigned after sorting
}
```

### Sorting

Sort by `rate` (descending), not by rank bucket. When a discipline filter is active, sort by that discipline's rate. When "All", sort by `bestRate`. Players with `rate: null` sort last.

## UI Changes

### Club Header (minor)

Club name in header remains clickable to toggle info card. Info card collapsed by default (already the case). No structural changes.

### Player Row

```
#4  M  Paul TRAN-VAN              V1    1100 pts
       D9 . 1100   D9 . 956   P10 . 804
       ~~~~~~~~    --------   --------
       (sort)
```

- **Line 1:** Position | sex emoji (man/woman) | Full name | Category abbreviation (muted) | Best/active rate right-aligned
- **Line 2:** 3 rank pills showing `subLevel . rate`. The pill used as sort criteria gets a bold left border. Non-sort pills are lighter.
- Players with `rate: null` show "-" with no points

Category abbreviations: Senior -> Sen, Veteran N -> VN, Junior N -> JN, Minime N -> MN, Cadet N -> CN, Benjamin N -> BN, Poussin N -> PN, Minibad -> Mini

## Filter Behavior

Discipline filter: All / Simple / Double / Mixte (unchanged).
Gender filter: All / Hommes / Femmes (unchanged).

Combined logic:
- Discipline + Gender determines which discipline's `rate` to sort by
- Simple + Men = SH (discipline 1), Simple + Women = SD (discipline 2), etc.
- "All" + gender = best rate across all disciplines for visible players
- Position numbers recalculated after every filter change

Sort indicator: the rank pill matching the active sort discipline gets bold left border. In "All" mode, the pill matching the player's best discipline gets the indicator.

## Hook & Caching

`useClubLeaderboard` keeps its current interface but switches internally to `getClubTops`.

Fetch flow:
1. On mount: read cache `club-tops:${clubId}`
2. If cached: display immediately, check TTL
3. If TTL expired or no cache: fetch all 6 disciplines in parallel, merge, update state + cache
4. Pull-to-refresh: always fetch fresh
5. Connectivity restore: auto-refresh

Error handling: partial success (some disciplines fail) is fine, use whatever data is available. Error state only if all 6 fail.

## Removals

- `getClubLeaderboard()` in ffbad.ts (paginated search loop + user injection workaround)
- `normalizeToLeaderboard()` in clubLeaderboard.ts
- `getRankSortIndex()` in clubLeaderboard.ts
- `getDisplayRank()` in clubLeaderboard.ts
- Old `LeaderboardEntry` type

## What Stays

- `filterByGender()` (checks `sex` field)
- `sortLeaderboardByDiscipline()` (rewritten to sort by `rate`)
- `ClubDisciplineFilter` / `ClubGenderFilter` types
- `getClubInfo()` for club detail card
- `useClubSearch` hook (unchanged)
- Cache infrastructure (`cacheGet`/`cacheSet`)
