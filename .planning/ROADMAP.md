# Roadmap: BadTracker

## Overview

BadTracker delivers a native mobile experience for French badminton players to track rankings and match history from FFBaD data. We start with foundation-first (secure API client, authentication) to avoid critical security and architecture pitfalls, then build core data features (player discovery, dashboard, match history), enhance with visualization (ranking charts), add social features (bookmarks, club leaderboards), and finally implement offline support for performance and reliability.

## Phases

- [x] **Phase 1: Foundation & Security** - Secure API client, authentication, environment setup (completed 2026-02-16)
- [x] **Phase 2: Player Discovery** - Search players, view profiles (completed 2026-02-17)
- [x] **Phase 3: Personal Dashboard** - User's own stats and rankings (completed 2026-02-17)
- [x] **Phase 4: Match History** - Full match tracking with filters (completed 2026-02-19)
- [ ] **Phase 5: Ranking Visualization** - Charts showing ranking progression over time
- [ ] **Phase 6: Club Features** - Club leaderboards
- [ ] **Phase 7: Player Bookmarks** - Follow and track other players
- [ ] **Phase 8: Offline Support** - Cache and offline viewing

## Phase Details

### Phase 1: Foundation & Security
**Goal**: Secure, production-ready API client with authentication that avoids critical pitfalls (credentials, HTTPS, rate limiting, schema validation, UTF-8, environment config)
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can log in with FFBaD license number and password
  2. User credentials are stored securely using device keychain (never in plain AsyncStorage)
  3. User session persists across app restarts without re-entering credentials
  4. User can log out from any screen and credentials are cleared from secure storage
  5. API client enforces HTTPS, handles rate limiting with exponential backoff, and validates responses with runtime schema checks
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Expo project scaffolding, routing, and FR/EN i18n
- [ ] 01-02-PLAN.md — FFBaD API client with HTTPS, Zod validation, retry logic
- [ ] 01-03-PLAN.md — Authentication flow (SecureStore, login, protected routes, logout)
- [ ] 01-04-PLAN.md — Integration validation and end-to-end verification

### Phase 2: Player Discovery
**Goal**: Users can search for and view any FFBaD player's profile
**Depends on**: Phase 1 (authentication required for API access)
**Requirements**: PLYR-01, PLYR-02, PLYR-03, PLYR-04
**Success Criteria** (what must be TRUE):
  1. User can search for players by name and see relevant results
  2. User can search for players by license number and find exact match
  3. User can tap a search result to view player's profile showing name, club, and current rankings by discipline
  4. User can tap an opponent name in match history to navigate directly to that player's profile
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Player search screen with live debounce, auto-detect name vs licence
- [x] 02-02-PLAN.md — Player profile screen with rankings by discipline, dynamic route navigation

### Phase 3: Personal Dashboard
**Goal**: User sees their own ranking and quick stats on app launch
**Depends on**: Phase 1 (authentication required for personal data)
**Requirements**: DASH-01, DASH-02, RANK-01
**Success Criteria** (what must be TRUE):
  1. User sees a personal dashboard on app launch showing current ranking, recent matches, and quick stats
  2. User can see their current CPPH ranking value and category per discipline (simple, double, mixte)
  3. User can navigate to detailed sections (matches, rankings, bookmarks) from dashboard
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Dashboard data layer: ranking utilities, data hook, i18n strings
- [ ] 03-02-PLAN.md — Dashboard UI: greeting, quick stats, ranking cards, recent matches, pull-to-refresh

### Phase 4: Match History
**Goal**: Complete match tracking with filters and statistics
**Depends on**: Phase 1 (authentication required for match data)
**Requirements**: MTCH-01, MTCH-02, MTCH-03, MTCH-04, MTCH-05
**Success Criteria** (what must be TRUE):
  1. User can view their full match history pulled from FFBaD
  2. User can filter match history by discipline (simple, double, mixte)
  3. User can see match details including date, opponent, score, tournament name, and round
  4. User can pull-to-refresh to update match data from FFBaD
  5. User can see win/loss breakdown statistics per discipline
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Match history data layer: schema expansion, utility functions, data hook, i18n strings
- [ ] 04-02-PLAN.md — Match history screen UI: SectionList, filter chips, collapsible stats, accordion detail, tab navigation

### Phase 5: Ranking Visualization
**Goal**: Visual charts showing ranking progression over time (key differentiator from FFBaD official app)
**Depends on**: Phase 3 (ranking data available)
**Requirements**: RANK-02, RANK-03
**Success Criteria** (what must be TRUE):
  1. User can see a visual line chart of ranking/points evolution over time
  2. User can see a timeline of ranking milestones (when they reached NC, P12, P10, etc.)
  3. Charts display smoothly with 52+ weeks of CPPH data without performance degradation
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Data layer: chart library, ranking evolution schema, chart utilities, evolution hook, i18n
- [ ] 05-02-PLAN.md — Chart screen UI: multi-line chart, tappable legend, milestone markers, dashboard navigation

### Phase 6: Club Features
**Goal**: Club-specific leaderboards and context
**Depends on**: Phase 2 (player profiles available)
**Requirements**: RANK-04
**Success Criteria** (what must be TRUE):
  1. User can view club leaderboards showing rankings of players in their club
  2. Club leaderboards update when user pulls to refresh
**Plans**: TBD

Plans:
- [ ] TBD (plans created during /gsd:plan-phase 6)

### Phase 7: Player Bookmarks
**Goal**: Follow and track other players for quick access
**Depends on**: Phase 2 (player discovery working)
**Requirements**: PLYR-05, PLYR-06, PLYR-07
**Success Criteria** (what must be TRUE):
  1. User can bookmark other players from their profile screen
  2. User can view a list of all their bookmarked players
  3. User can remove a player from their bookmarks
  4. Bookmarks persist across app restarts
**Plans**: TBD

Plans:
- [ ] TBD (plans created during /gsd:plan-phase 7)

### Phase 8: Offline Support
**Goal**: Local caching for performance and offline access to previously loaded data
**Depends on**: All data features (Phases 2-7) exist
**Requirements**: INFR-01, INFR-02
**Success Criteria** (what must be TRUE):
  1. App caches previously loaded data locally for offline viewing
  2. App shows a clear indicator when displaying cached/offline data vs live data
  3. User can view cached player profiles, matches, and rankings when offline
  4. App automatically refreshes stale data when connectivity returns
**Plans**: TBD

Plans:
- [ ] TBD (plans created during /gsd:plan-phase 8)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Security | 4/4 | Complete    | 2026-02-16 |
| 2. Player Discovery | 2/2 | Complete | 2026-02-17 |
| 3. Personal Dashboard | 2/2 | Complete | 2026-02-17 |
| 4. Match History | 2/2 | Complete | 2026-02-19 |
| 5. Ranking Visualization | 0/2 | Planned | - |
| 6. Club Features | 0/TBD | Not started | - |
| 7. Player Bookmarks | 0/TBD | Not started | - |
| 8. Offline Support | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-16*
*Last updated: 2026-02-19*
