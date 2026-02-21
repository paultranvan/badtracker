# Tournament Section Accordion — Design

## Goal

When tapping a tournament section header in the Matches tab, expand to show detailed match cards with full player names, set-by-set scores, partner info, and points impact.

## Behavior

- Tapping a tournament section header toggles collapsed/expanded state
- Chevron icon on header right rotates (down=collapsed, up=expanded)
- All sections start collapsed
- Multiple sections can be open simultaneously
- Smooth animation via LayoutAnimation

## Expanded Match Card Layout

```
┌─────────────────────────────────────────────┐
│ [D] Round: Poule 1                        W │
│                                             │
│ Partner: John Doe                           │
│ vs  Opponent Name / Opponent2 Name          │
│                                             │
│ 21-15   21-18                       +26 pts │
└─────────────────────────────────────────────┘
```

- Discipline badge (S/D/M) with color
- Round info
- Win/Loss badge
- Partner name (doubles/mixed only)
- Opponent names linked to player profile
- Individual set scores displayed prominently
- Points impact

## Data

All fields already available in `MatchItem`: `setScores`, `partner`, `opponent`, `opponent2`, `opponentLicence`, `round`, `discipline`, `pointsImpact`, `score`. No new API calls needed.

## State

Local `expandedSections` state (Set of section titles) in matches screen. Toggle on header press.

## Files

- `app/(app)/(tabs)/matches.tsx` — Add accordion state, chevron to TournamentHeader, expand/collapse logic, enhanced MatchCardItem for expanded view

## Approach

Single-file change. Tournament section accordion using LayoutAnimation for smooth expand/collapse. Collapsed view remains identical to current compact cards.
