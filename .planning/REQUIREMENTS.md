# Requirements: BadTracker

**Defined:** 2026-02-16
**Core Value:** French badminton players can instantly see their ranking evolution and match stats in a native mobile experience that makes myffbad.fr data actually useful.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can log in with FFBaD license number and password
- [ ] **AUTH-02**: User session persists across app restarts without re-entering credentials
- [ ] **AUTH-03**: User credentials are stored securely using device keychain (SecureStore)
- [ ] **AUTH-04**: User can log out from any screen in the app

### Player Data

- [ ] **PLYR-01**: User can search for players by name
- [ ] **PLYR-02**: User can search for players by license number
- [ ] **PLYR-03**: User can view a player's profile showing name, club, and current rankings by discipline
- [ ] **PLYR-04**: User can tap an opponent name in match history to navigate to their profile
- [ ] **PLYR-05**: User can bookmark other players for quick access
- [ ] **PLYR-06**: User can view a list of all their bookmarked players
- [ ] **PLYR-07**: User can remove a player from their bookmarks

### Match History

- [ ] **MTCH-01**: User can view their full match history pulled from FFBaD
- [ ] **MTCH-02**: User can filter match history by discipline (simple, double, mixte)
- [ ] **MTCH-03**: User can see match details including date, opponent, score, tournament name, and round
- [ ] **MTCH-04**: User can pull-to-refresh to update match data from FFBaD
- [ ] **MTCH-05**: User can see win/loss breakdown statistics per discipline

### Rankings & Stats

- [ ] **RANK-01**: User can see their current CPPH ranking value and category per discipline
- [ ] **RANK-02**: User can see a visual line chart of ranking/points evolution over time
- [ ] **RANK-03**: User can see a timeline of ranking milestones (when they reached NC, P12, P10, etc.)
- [ ] **RANK-04**: User can view club leaderboards showing rankings of players in their club

### Dashboard

- [ ] **DASH-01**: User sees a personal dashboard on app launch showing current ranking, recent matches, and quick stats
- [ ] **DASH-02**: User can navigate to detailed sections (matches, rankings, bookmarks) from dashboard

### Infrastructure

- [ ] **INFR-01**: App caches previously loaded data locally for offline viewing
- [ ] **INFR-02**: App shows a clear indicator when displaying cached/offline data vs live data

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Insights

- **INST-01**: User can see match insights and patterns (e.g., "75% win rate in simple, 40% in doubles")
- **INST-02**: User can compare head-to-head record against a specific opponent

### UX Enhancements

- **UXEN-01**: App supports dark mode
- **UXEN-02**: User can export match history as CSV or PDF
- **UXEN-03**: User receives local notification when ranking changes are detected on app open

### Notifications

- **NOTF-01**: User receives push notification when a bookmarked player's ranking changes
- **NOTF-02**: User receives push notification when new match results are posted

### Platform

- **PLAT-01**: App available on iOS App Store
- **PLAT-02**: App available as Progressive Web App

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Live match scoring | App consumes FFBaD data only — no data creation, avoids sync conflicts |
| Social features (comments, reactions) | Moderation burden, toxicity risk, strays from core stats value |
| Backend server | v1 is direct FFBaD API + local cache — simpler architecture |
| Multi-federation support | Each federation has different APIs/data models — focus on FFBaD excellence first |
| Custom ranking calculations | FFBaD CPPH is official — alternate calculations confuse users |
| Real-time data sync | FFBaD updates weekly — aggressive polling wastes battery and API quota |
| iOS build (v1) | Android-first, iOS trivial to add later with React Native |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| PLYR-01 | — | Pending |
| PLYR-02 | — | Pending |
| PLYR-03 | — | Pending |
| PLYR-04 | — | Pending |
| PLYR-05 | — | Pending |
| PLYR-06 | — | Pending |
| PLYR-07 | — | Pending |
| MTCH-01 | — | Pending |
| MTCH-02 | — | Pending |
| MTCH-03 | — | Pending |
| MTCH-04 | — | Pending |
| MTCH-05 | — | Pending |
| RANK-01 | — | Pending |
| RANK-02 | — | Pending |
| RANK-03 | — | Pending |
| RANK-04 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| INFR-01 | — | Pending |
| INFR-02 | — | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after initial definition*
