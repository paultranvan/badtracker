# Clickable Insights → Filtered Match List

## Goal

From the dashboard's Insights section, tapping any card reveals the matches that back that statistic (e.g., tapping "Best Partner" lists every match played with that partner).

As part of this change, move the **Discipline Balance** card out of the dashboard: it does not represent a match subset, it belongs next to the other per-discipline stats on the Matches tab, and it should respect the Matches tab's season filter.

## Scope

**In scope**
- Make 8 insight cards clickable and navigate to a filtered match list
- Add a new stack route for the filtered match screen
- Remove the Discipline Balance card from the dashboard
- Add a Discipline Balance bar to the Matches tab, honoring the active season filter

**Out of scope**
- Bottom sheets / inline expansions
- Passing match arrays through route state or AsyncStorage
- Changes to the dashboard's other sections (greeting, quick stats, rankings, recent matches)

## Part 1 — Move Discipline Balance to the Matches tab

### Remove from dashboard

- `src/utils/insights.ts` — delete `computeDisciplineBalance` and the `disciplineBalance` field from `InsightsData` + `computeAllInsights`
- `src/components/InsightsSection.tsx` — delete `DisciplineBalanceCard` and the `hasAny` check line that includes `disciplineBalance`
- i18n — leave `insights.disciplineBalance` / `simpleCount` / `doubleCount` / `mixteCount` keys (they'll be reused on the Matches tab)

### Add to Matches tab

- New component `DisciplineBalanceBar` (can live inline in `app/(app)/(tabs)/matches.tsx` or as a small exported component under `src/components/`)
- Reads `disciplineCounts` from `useMatchHistory` — **already season-filtered**: when the user changes season (including "All seasons"), the bar updates automatically
- Placement: inside `StatsHeader`, directly below the per-discipline W/L pills row, so the user sees both "how often I play each discipline" (distribution) and "how well I do in each" (win rate) together
- Visual: a compact horizontal stacked bar (reuse the styling from the existing `DisciplineBalanceCard` — same colors as `DISC_SOLID_COLORS`: simple blue, double green, mixte orange). No card wrapper — fits into the existing gradient header.
- Hidden when the total count is 0 (no matches for the active filters)

## Part 2 — Clickable insights

### Insight identifier fields

Add a stable identifier to three `InsightsData` entries so the filter screen doesn't rely on name matching (risk of name collisions):

```ts
bestPartner: { name: string; licence: string; matchCount: number; winRate: number } | null;
nemesis:     { name: string; licence: string; wins: number; losses: number } | null;
mostPlayed:  { name: string; licence: string; matchCount: number; lastDate: string } | null;
```

- `bestPartner.licence` — from `partnerLicence` in the winning partner's grouped stats
- `nemesis.licence` — from `opponentLicence` in the grouped stats
- `mostPlayed.licence` — from `PersonLicence` on the winning `OpponentListItem` (the opponent list exposes both `PersonId` and `PersonLicence`)

`bestTournament.name` is already a usable identifier (tournament names are the grouping key).

### Filter helper

New helper in `src/utils/insights.ts`:

```ts
export type InsightType =
  | 'winStreak'
  | 'recentForm'
  | 'biggestUpset'
  | 'cpphMomentum'
  | 'bestTournament'
  | 'bestPartner'
  | 'nemesis'
  | 'mostPlayed';

export function getMatchesForInsight(
  type: InsightType,
  matches: MatchItem[],      // must be desc-sorted (same invariant as compute*)
  insights: InsightsData
): MatchItem[];
```

**Filter rules**

| Type | Returned matches |
|---|---|
| `winStreak` | The contiguous subset of matches forming the longest win streak (re-walk the list, record start/end indices of the max streak, slice it out) |
| `recentForm` | First 5 matches (desc) with `isWin !== undefined` |
| `biggestUpset` | The single match identified by the biggest rank gap won — re-walk using `rankIndex`, return `[bestMatch]` |
| `cpphMomentum` | First 10 matches with `pointsImpact != null && pointsImpact !== 0` |
| `bestTournament` | `matches.filter(m => m.tournament === insights.bestTournament.name)` |
| `bestPartner` | `matches.filter(m => m.partnerLicence === insights.bestPartner.licence)` |
| `nemesis` | `matches.filter(m => m.opponentLicence === insights.nemesis.licence)` |
| `mostPlayed` | `matches.filter(m => m.opponentLicence === insights.mostPlayed.licence)` |

The helper returns matches in the same order as input (desc by date). If the insight is `null` (no data), it returns `[]`.

**Note on nemesis/mostPlayed and doubles:** `computeNemesis` and the filter both match on `opponentLicence` only — `opponent2Licence` is not considered. This mirrors the existing `computeNemesis` logic. Keep the behaviors consistent.

### New route: `insight-matches/[type]`

```
app/(app)/insight-matches/[type].tsx
```

Registered in `app/(app)/_layout.tsx` as a new `Stack.Screen`:

```tsx
<Stack.Screen
  name="insight-matches/[type]"
  options={{
    headerShown: true,
    headerTitle: t('insightMatches.title'),
    headerBackTitle: '',
  }}
/>
```

The screen:

1. Reads `type` from `useLocalSearchParams` and narrows it to `InsightType`; invalid values render an empty state and a back affordance
2. Calls `useDashboardData()` to get `allDetailMatches` + `detailsLoading` (cached — near-instant on second visit)
3. Calls `useInsights(allDetailMatches, detailsLoading)` to get the insight entity identifiers
4. Computes `getMatchesForInsight(type, allDetailMatches, insights)`
5. Renders:
   - **Header block** — label, title, subtitle mirroring the card the user tapped (e.g., "Meilleur partenaire / Jean Dupont / 5 matchs · 80% victoires"). This keeps the visual link between card and screen obvious.
   - **Match list** — `FlatList` of `DetailMatchCard`. Passes `playerName` from session (same pattern as the matches tab).
   - **Loading state** — spinner while `detailsLoading === true` and no matches are available yet
   - **Empty state** — i18n string "No matches for this insight" (defensive; shouldn't happen in practice because an insight only exists when matches back it)

### Clickable insight cards

In `src/components/InsightsSection.tsx`:

- Wrap each of the 8 insight cards (`WinStreakCard`, `RecentFormCard`, `BiggestUpsetCard`, `CpphMomentumCard`, `FullWidthCard` × 4) in a `Pressable` with `router.push(`/insight-matches/${type}`)`
- Add a subtle pressed opacity/scale (match the existing ranking-card pattern in `app/(app)/(tabs)/index.tsx`)
- The `Card` component inside stays unchanged

Implementation approach: wrap the existing card JSX at the call site in `InsightsSection` inside a `Pressable` — no changes to the sub-components. The `FullWidthCard` and the 2-column grid cards all rely on `Card`'s rounded background + shadow, and `Pressable` can host that without touching internal layout.

### i18n

Add a new namespace block (both `fr.json` and `en.json`):

```json
"insightMatches": {
  "title": "Matchs",
  "empty": "Aucun match à afficher"
}
```

The header block on the filtered screen reuses the existing `insights.*` keys the dashboard cards already use (`bestPartner`, `partnerStats`, etc.) — no duplicate strings.

## Files touched

**Modified**
- `src/utils/insights.ts` — remove `disciplineBalance`; add `licence` fields; add `getMatchesForInsight` + `InsightType`
- `src/components/InsightsSection.tsx` — remove Discipline Balance card; wrap cards in Pressable with navigation
- `app/(app)/_layout.tsx` — register new stack screen
- `app/(app)/(tabs)/matches.tsx` — add Discipline Balance bar to StatsHeader
- `src/i18n/locales/fr.json`, `src/i18n/locales/en.json` — new `insightMatches.*` keys
- `src/hooks/useInsights.ts` — no changes expected (only if the identifier plumbing needs it)

**Created**
- `app/(app)/insight-matches/[type].tsx` — new filtered match list screen

## Non-goals / deliberate simplifications

- No new caching layer. `useDashboardData` already provides 24h persistent cache; the insight-matches screen calls the hook and reuses the same data.
- No change to the compute functions' signatures beyond adding the `licence` identifier. They still return the same shapes plus one field.
- No context / store / redux for cross-screen data sharing.
- No animations beyond the existing pressed feedback.
