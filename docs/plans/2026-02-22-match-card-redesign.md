# Match Card Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Commit and verify the current match card improvements: tennis-style scoreboard for set scores, Interclub discipline inference fix, and defensive Array.isArray guards.

**Architecture:** The match card in `matches.tsx` already has all changes in place — ScoreboardRow component for split set scores, restored original card elements (W/L badge, discipline badge, vs prefix). The `splitSetScores()` utility in `matchHistory.ts` parses "21-17" format into per-team score objects. The `inferDisciplineFromName` regex in `ffbad.ts` now handles Interclub patterns (SH1, DD2, MX1).

**Tech Stack:** React Native (Expo SDK 54), NativeWind/Tailwind, react-native-reanimated, TypeScript

---

### Task 1: Verify TypeScript compilation

All three files (`matches.tsx`, `matchHistory.ts`, `ffbad.ts`) have uncommitted changes. Verify they compile cleanly before committing.

**Files:**
- Check: `app/(app)/(tabs)/matches.tsx`
- Check: `src/utils/matchHistory.ts`
- Check: `src/api/ffbad.ts`

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (exit 0)

**Step 2: If errors, fix them**

Fix any type errors in the changed files. Re-run `npx tsc --noEmit` until clean.

---

### Task 2: Commit the utility layer changes

Commit the `SplitScore` type, `splitSetScores()` function, and `Array.isArray` guards in `matchHistory.ts`.

**Files:**
- Commit: `src/utils/matchHistory.ts`

**Step 1: Review the diff**

Run: `git diff src/utils/matchHistory.ts`

Verify these changes are present:
- `SplitScore` interface with `userScore`, `opponentScore`, `userWonSet`
- `splitSetScores()` function that parses `match.setScores` or falls back to `match.score`
- `Array.isArray` guard in `groupByTournament`
- `Array.isArray` guard in `filterByDiscipline`

**Step 2: Commit**

```bash
git add src/utils/matchHistory.ts
git commit -m "feat: add splitSetScores utility and defensive guards

Add SplitScore interface and splitSetScores() function for parsing
set scores into per-team values for scoreboard display.

Add Array.isArray guards in groupByTournament and filterByDiscipline
to handle stale cached data gracefully.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Commit the Interclub discipline inference fix

**Files:**
- Commit: `src/api/ffbad.ts`

**Step 1: Review the diff**

Run: `git diff src/api/ffbad.ts`

Verify the `inferDisciplineFromName` regex update:
- `\bSH\d?\b` and `\bSD\d?\b` for singles (matches SH, SH1, SD, SD2)
- `\bDH\d?\b` and `\bDD\d?\b` for doubles
- `\bMX\d?\b` and `\bDMX\d?\b` for mixed

**Step 2: Commit**

```bash
git add src/api/ffbad.ts
git commit -m "fix: improve Interclub discipline inference regex

Update inferDisciplineFromName to match Interclub notation patterns
like SH1, SD2, DH1, DD2, MX1, DMX1 with optional trailing digit.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Commit the match card scoreboard redesign

**Files:**
- Commit: `app/(app)/(tabs)/matches.tsx`

**Step 1: Review the diff**

Run: `git diff app/(app)/(tabs)/matches.tsx`

Verify these changes:
- Import of `splitSetScores` and `SplitScore` from matchHistory utils
- `ScoreboardRow` sub-component with dark/light score boxes
- `MatchCardItem` uses `splitSetScores()` — when scores exist, renders two ScoreboardRows (user + opponent); otherwise falls back to original inline score display
- `opponentName` computed once and reused
- All original card elements preserved (W/L badge, discipline badge, vs prefix, partner line)

**Step 2: Commit**

```bash
git add app/(app)/(tabs)/matches.tsx
git commit -m "feat: add tennis-style scoreboard to match cards

When set scores are available, display them as a two-row scoreboard
with dark/light score boxes indicating won/lost sets. Falls back to
original inline score display when no set scores are parsed.

Extracts opponentName computation to avoid duplication.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Emulator verification

Verify the match cards render correctly on the Android emulator.

**Step 1: Start dev server**

Run: `npx expo start`

**Step 2: Open app on emulator**

Launch the app on `emulator-5554`. Navigate to the Matches tab.

**Step 3: Verify match cards**

Check that:
- Match cards show discipline badge (S/D/M circle), round text, W/L badge
- Partner line shows for doubles/mixed
- Opponent name shows with "vs" prefix
- Opponent name is blue/tappable when licence is available
- Points impact shows colored (+/- pts)
- Score line shows when available
- Left border is green (win), red (loss), or gray (unknown)

**Step 4: Verify filters**

- Tap discipline filter chips (All, Simple, Double, Mixte)
- Tap season filter chips
- Verify list updates correctly

---

## Verification Summary

1. `npx tsc --noEmit` passes
2. Three clean atomic commits (utility, API fix, UI)
3. Emulator: match cards display all info correctly
4. Emulator: filters work
