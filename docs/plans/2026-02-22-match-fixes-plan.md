# Match History Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 bugs in match history: discipline misclassification, stale win/loss counts, duplicated matches, and verbose card UI.

**Architecture:** Four independent fixes in the data pipeline (`ffbad.ts` → `useMatchHistory.ts` → `matches.tsx`). Task 1 fixes discipline at the API layer. Task 2 adds de-duplication in the hook. Task 3 makes DisciplineRow compute live counts from detailCache. Task 4 redesigns MatchCard to a compact myffbad.fr-inspired layout.

**Tech Stack:** React Native (Expo 54), NativeWind/TailwindCSS, TypeScript

---

### Task 1: Fix discipline misclassification (mixed shown as double)

**Problem:** `mapDisciplineCode()` in `ffbad.ts:613-619` checks `includes('DOUBLE')` before `includes('MIXTE')`. Since "DOUBLE MIXTE" contains both strings, mixed always matches the DOUBLE rule first. Additionally, `expandWithDetail()` spreads `...item` which carries the wrong parent discipline into individual matches even when detail data has partner info proving it's mixed.

**Files:**
- Modify: `src/api/ffbad.ts:613-619` (reorder `mapDisciplineCode`)
- Modify: `src/api/ffbad.ts:568-587` (add `_detailDiscipline` in `expandWithDetail`)
- Modify: `src/api/ffbad.ts:661-666` (prefer `_detailDiscipline` in `transformResultItem`)

**Step 1: Fix `mapDisciplineCode` order — check MIXTE before DOUBLE**

In `src/api/ffbad.ts`, replace lines 613-619:

```typescript
function mapDisciplineCode(disc: string): string | undefined {
  const upper = disc.toUpperCase();
  if (upper.includes('SIMPLE')) return 'S';
  if (upper.includes('MIXTE')) return 'M';  // Must come before DOUBLE
  if (upper.includes('DOUBLE')) return 'D';
  return undefined;
}
```

**Step 2: Add `_detailDiscipline` to `expandWithDetail`**

In `src/api/ffbad.ts`, inside the `expandWithDetail` function, after extracting partner info (around line 544) and before the return block (line 568), add discipline detection logic. Replace the return block at lines 568-587:

```typescript
    // Detect actual discipline from player composition
    // If both sides have 2 players, it's doubles or mixed
    // If user has a partner, check gender-mix heuristic from API discipline field
    let detailDiscipline: string | undefined;
    const parentDisc = (item.discipline as string) ?? '';
    if (partner) {
      // Has partner = doubles or mixed. Check if API says MIXTE anywhere
      if (parentDisc.toUpperCase().includes('MIXTE') || parentDisc.toUpperCase().includes('MX')) {
        detailDiscipline = 'M';
      }
      // If parent says "DOUBLE MIXTE" (caught by MIXTE above), or "DOUBLE HOMMES"/"DOUBLE DAMES"
      // The mapDisciplineCode fix handles this, but we add an extra safety net:
      // If match.disciplineName contains MIXTE, override
      const discName = (match.disciplineName as string) ?? (match.discipline as string) ?? '';
      if (discName.toUpperCase().includes('MIXTE') || discName.toUpperCase().includes('MX')) {
        detailDiscipline = 'M';
      }
    }

    return {
      ...item,
      // Clear parent-level winPoint — it's the aggregate for the whole bracket,
      // not per-match. Use detail-level WinPoints instead (if available).
      winPoint: detailWinPoints ?? undefined,
      // Override discipline from detail if detected
      ...(detailDiscipline ? { _detailDiscipline: detailDiscipline } : {}),
      // Override with detail data
      _detailOpponent: opp1?.PersonName as string | undefined,
      _detailOpponentLicence: opp1?.PersonLicence as string | undefined,
      _detailOpponent2: opp2?.PersonName as string | undefined,
      _detailOpponent2Licence: opp2?.PersonLicence as string | undefined,
      _detailPartner: partner?.PersonName as string | undefined,
      _detailPartnerLicence: partner?.PersonLicence as string | undefined,
      _detailSetScores: setScoresStr,
      _detailScore: match.score as string | undefined,
      _detailRound: roundName,
      _detailIsWinner: userIsWinner,
      // Remove _detail to avoid passing raw data downstream
      _detail: undefined,
    };
```

**Step 3: Prefer `_detailDiscipline` in `transformResultItem`**

In `src/api/ffbad.ts`, replace lines 661-666:

```typescript
  // Map discipline from API (e.g. "SIMPLE HOMMES" → "S", "DOUBLE HOMMES" → "D", "MIXTE" → "M")
  // Prefer detail-level discipline override if available (fixes mixed-as-double misclassification)
  const detailDisc = raw._detailDiscipline as string | undefined;
  const rawDisc = raw.discipline as string | null;
  const discipline = detailDisc
    ?? (rawDisc ? mapDisciplineCode(rawDisc) : undefined)
    ?? inferDisciplineFromName(raw.name as string | undefined, raw.subName as string | undefined);
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/api/ffbad.ts
git commit -m "fix: correct mixed discipline misclassified as double"
```

---

### Task 2: De-duplicate matches in `loadDetails`

**Problem:** `loadDetails()` in `useMatchHistory.ts:269-281` filters `rawResultItems` by tournament name + discipline. Multiple raw items can reference the same bracket (same `bracketId` + `disciplineId` + `date`), causing `getMatchDetailsForBrackets` to expand the same bracket multiple times, producing duplicate matches.

**Files:**
- Modify: `src/hooks/useMatchHistory.ts:268-283` (deduplicate raw items before API call)

**Step 1: Add deduplication after filtering raw items**

In `src/hooks/useMatchHistory.ts`, replace lines 282-283 (after the `rawItems` filter closes and before `if (rawItems.length === 0)`):

```typescript
      });

      // Deduplicate raw items by bracket identity (date + bracketId + disciplineId)
      // Multiple raw items can reference the same bracket, causing duplicate expansion
      const seen = new Set<string>();
      const uniqueRawItems = rawItems.filter((item) => {
        const date = (item.date as string) ?? '';
        const bracketId = String(item.bracketId ?? '');
        const disciplineId = String(item.disciplineId ?? '');
        const key = `${date}|${bracketId}|${disciplineId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniqueRawItems.length === 0) return discipline.matches;
```

Also update line 289 to use `uniqueRawItems`:

```typescript
        const detailed = await getMatchDetailsForBrackets(uniqueRawItems, personId);
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useMatchHistory.ts
git commit -m "fix: deduplicate bracket items before detail expansion"
```

---

### Task 3: Dynamic win/loss counts in DisciplineRow

**Problem:** `DisciplineGroup.wins`/`.losses` are computed at grouping time from bracket-level items (1 item per bracket = always 1 win or 1 loss per bracket). After `loadDetails()` expands brackets into individual matches, the actual counts differ. The UI still shows the stale bracket-level counts.

**Files:**
- Modify: `app/(app)/(tabs)/matches.tsx:449-511` (pass detailCache to DisciplineRow, compute live counts)

**Step 1: Pass `detailCache` to `DisciplineRow`**

In `matches.tsx`, update the `DisciplineRowProps` interface (line 449) to add `detailCache`:

```typescript
interface DisciplineRowProps {
  discipline: DisciplineGroup;
  tournament: TournamentSection;
  t: (key: string) => string;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  detailCache: Map<string, MatchItem[]>;
}
```

**Step 2: Update `DisciplineRow` to compute live counts**

In `DisciplineRow` component (line 458), update the function signature and add live count computation:

```typescript
function DisciplineRow({ discipline, tournament, t, isExpanded, isLoading, onToggle, detailCache }: DisciplineRowProps) {
  const disc = discipline.discipline;
  const letter = DISC_LETTERS[disc] ?? '?';
  const labelKey = DISC_LABELS[disc] ?? disc;

  // Compute live win/loss from detailCache if available (after expansion)
  const tKey = tournament.title || 'Unknown tournament';
  const detailKey = `${tKey}:${disc}`;
  const detailMatches = detailCache.get(detailKey);
  const wins = detailMatches
    ? detailMatches.filter((m) => m.isWin === true).length
    : discipline.wins;
  const losses = detailMatches
    ? detailMatches.filter((m) => m.isWin === false).length
    : discipline.losses;
```

Replace all references to `discipline.wins` and `discipline.losses` in the component JSX with the local `wins` and `losses` variables.

**Step 3: Pass `detailCache` in the renderItem callback**

In the `renderItem` callback (around line 209), add `detailCache` prop:

```typescript
        return (
          <DisciplineRow
            discipline={item.discipline}
            tournament={item.tournament}
            t={t}
            isExpanded={expandedDisciplines.has(`${item.tournament.title || t('matchHistory.tournamentUnknown')}:${item.discipline.discipline}`)}
            isLoading={loadingDetails.has(`${item.tournament.title || t('matchHistory.tournamentUnknown')}:${item.discipline.discipline}`)}
            onToggle={() => toggleDiscipline(item.tournament.title || t('matchHistory.tournamentUnknown'), item.discipline)}
            detailCache={detailCache}
          />
        );
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/(app)/(tabs)/matches.tsx
git commit -m "fix: compute win/loss counts dynamically from detail cache"
```

---

### Task 4: Compact match card redesign

**Problem:** Current MatchCard is verbose — large padded container with colored background, W/L badge, separate lines for date/round, partner, opponent, and scores. Design calls for a compact myffbad.fr-inspired layout with two stacked team rows, inline scores, and minimal chrome.

**Files:**
- Modify: `app/(app)/(tabs)/matches.tsx:512-649` (replace MatchCard + ScoreboardRow)

**Step 1: Replace MatchCard with compact layout**

Replace the entire `MatchCard` component and `ScoreboardRow` component (lines 512-649) with:

```typescript
// ============================================================
// Match Card (level 3 — compact myffbad.fr-inspired)
// ============================================================

interface MatchCardProps {
  match: MatchItem;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function MatchCard({ match }: MatchCardProps) {
  const isWin = match.isWin === true;
  const isLoss = match.isWin === false;

  // Border and indicator colors
  const borderColor = isWin ? 'border-l-win' : isLoss ? 'border-l-loss' : 'border-l-gray-300';
  const emoji = isWin ? '\ud83d\udc4d' : isLoss ? '\ud83d\udc4e' : '';
  const emojiColor = isWin ? 'text-win' : 'text-loss';

  // Points display
  const pointsText = match.pointsImpact != null && match.pointsImpact !== 0
    ? `~${match.pointsImpact > 0 ? '+' : ''}${match.pointsImpact.toFixed(1)}`
    : null;
  const pointsColor = match.pointsImpact != null && match.pointsImpact >= 0 ? 'text-win' : 'text-loss';

  // Parse set scores
  const scores = splitSetScores(match);

  // Build team names
  // User team: partner + user (for doubles/mixed), or just user (singles)
  const userTeamName = match.partner ? match.partner : null;

  // Opponent team
  const opponentName = match.opponent
    ? match.opponent + (match.opponent2 ? `  /  ${match.opponent2}` : '')
    : null;

  return (
    <View className={`ml-10 mr-3 border-l-[3px] ${borderColor} border-b border-b-gray-100`}>
      <View className="px-3 py-2">
        {/* Header: Round + Points */}
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-[12px] text-muted" numberOfLines={1}>
            {match.round ?? match.date ?? ''}
          </Text>
          {pointsText ? (
            <Text className={`text-[12px] font-semibold ${pointsColor}`} style={{ fontVariant: ['tabular-nums'] }}>
              {pointsText}
            </Text>
          ) : null}
        </View>

        {/* User team row */}
        <View className="flex-row items-center justify-between mb-0.5">
          <View className="flex-row items-center flex-1 mr-2">
            {userTeamName ? (
              <Text className={`text-[13px] ${isWin ? 'font-bold text-gray-900' : 'text-gray-700'} flex-1`} numberOfLines={1}>
                {userTeamName}
              </Text>
            ) : (
              <Text className={`text-[13px] ${isWin ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                {'\u2022 You'}
              </Text>
            )}
          </View>
          {/* User scores */}
          {scores ? (
            <View className="flex-row gap-1">
              {scores.map((s, i) => (
                <Text
                  key={i}
                  className={`text-[13px] w-5 text-center ${s.userWonSet ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {s.userScore}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Opponent team row */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            {opponentName ? (
              match.opponentLicence ? (
                <Pressable className="flex-1" onPress={() => router.push(`/player/${match.opponentLicence}`)}>
                  <Text className={`text-[13px] ${isLoss ? 'font-bold text-gray-900' : 'text-gray-700'}`} numberOfLines={1}>
                    {opponentName}
                  </Text>
                </Pressable>
              ) : (
                <Text className={`text-[13px] ${isLoss ? 'font-bold text-gray-900' : 'text-gray-700'} flex-1`} numberOfLines={1}>
                  {opponentName}
                </Text>
              )
            ) : (
              <Text className="text-[13px] text-gray-400">-</Text>
            )}
            {/* Win/loss emoji */}
            {emoji ? (
              <Text className={`text-[13px] ml-1.5 ${emojiColor}`}>{emoji}</Text>
            ) : null}
          </View>
          {/* Opponent scores */}
          {scores ? (
            <View className="flex-row gap-1">
              {scores.map((s, i) => (
                <Text
                  key={i}
                  className={`text-[13px] w-5 text-center ${!s.userWonSet ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {s.opponentScore}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Duration (if available) */}
        {match.duration ? (
          <Text className="text-[11px] text-muted mt-0.5 self-end">{match.duration}</Text>
        ) : null}
      </View>
    </View>
  );
}
```

**Step 2: Remove unused ScoreboardRow component**

The old `ScoreboardRow` and `ScoreboardRowProps` (lines 618-649) are no longer needed — they are replaced by the inline score columns in the new `MatchCard`. Delete them entirely.

**Step 3: Clean up unused imports**

In the imports section, `SplitScore` is no longer needed as a named type import (it's still used internally via `splitSetScores` return type). Check if any other imports became unused.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/(app)/(tabs)/matches.tsx
git commit -m "feat: compact match card with emoji indicators and inline scores"
```

---

### Task 5: Visual verification on emulator

**Files:** None (verification only)

**Step 1: Launch app and navigate to Matches tab**

Start the Expo dev server and open on the emulator. Navigate to the Matches tab.

**Step 2: Verify discipline classification**

Find a tournament that had mixed matches (e.g., "Verri'Bad 2026"). Check that:
- The discipline shows as "Mixed" (not "Doubles")
- The Mixed filter chip count is correct

**Step 3: Verify win/loss counts**

Expand a tournament, then expand a discipline. Check that:
- Before expansion: bracket-level counts shown (may be 1W)
- After expansion (detail loaded): counts update to reflect actual individual matches

**Step 4: Verify no duplicate matches**

After expanding a discipline group, verify each match appears only once. No repeated opponent/score rows.

**Step 5: Verify compact card layout**

Check that match cards show:
- Two rows (user team on top, opponent on bottom)
- Winner row in bold
- 👍/👎 emoji with green/red color
- Scores right-aligned in columns
- Points in top-right with `~` prefix
- Left border strip green/red
- Compact — less vertical space than before
