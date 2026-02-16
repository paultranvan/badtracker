# Project Research Summary

**Project:** BadTracker
**Domain:** React Native mobile app consuming federation sports API
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

BadTracker is a French badminton statistics tracker that consumes the FFBaD (French Badminton Federation) REST API to display player rankings, match history, and performance trends. Based on research, the recommended approach is an offline-first React Native app built with Expo managed workflow, using TanStack Query for server state management and local caching to provide instant data access even without connectivity. The app differentiates from the basic FFBaD official app through superior data visualization (charts showing ranking progression over time) and personalization features (player following, head-to-head comparisons).

The technology landscape is mature and well-documented. Expo SDK 54 (stable) provides managed builds and over-the-air updates without requiring native code knowledge. TanStack Query handles all API caching, background refetching, and offline support automatically. React Native Gifted Charts delivers ranking visualization with minimal learning curve. This stack eliminates 80% of typical Redux boilerplate while providing production-ready offline capabilities. The FFBaD API is comprehensive (70+ endpoints) with documented caching strategies (10min to 48h TTLs depending on data type), making client-side cache management straightforward.

The primary risks involve security (credential storage), API integration complexity (UTF-8 encoding, rate limiting, schema validation), and performance at scale (rendering 10,000+ player rankings). All critical risks have established mitigation patterns that must be implemented in Phase 1 (Foundation) - retrofitting security or cache architecture later is expensive and error-prone. The research identified 7 critical pitfalls that must be addressed from day one: hardcoded credentials, missing HTTPS enforcement, no cache invalidation strategy, ignoring rate limits, no schema validation, environment configuration leakage, and UTF-8 encoding inconsistencies.

## Key Findings

### Recommended Stack

Expo managed workflow with React Native 0.83.x provides the optimal balance of developer productivity and production readiness for this Android-first app with no backend infrastructure. The research strongly favors Expo over bare React Native CLI because you have no custom native modules, and Expo's managed build service (EAS Build) eliminates local Android Studio setup complexity. State management splits cleanly: TanStack Query owns all server data (automatic caching, refetching, offline persistence), while Zustand handles lightweight client state (bookmarks, UI preferences). This separation eliminates Redux boilerplate while providing production-grade caching.

**Core technologies:**
- **Expo SDK 54 (stable)**: Managed workflow with OTA updates via EAS — simplifies Android builds, provides native modules without ejecting, SDK 55 requires New Architecture but stick with 54 stable for production
- **TanStack Query 5.90.x**: Server state management with automatic caching — industry standard, handles AppState focus/blur for mobile, persistence to AsyncStorage for offline-first, eliminates manual fetch boilerplate
- **Zustand 5.x**: Client state management for bookmarks/preferences — 1KB lightweight, zero boilerplate vs Redux, granular updates prevent re-renders, persists to AsyncStorage
- **Expo Router**: File-based routing with type safety — superset of React Navigation 7, automatic deep linking, matches Next.js patterns, eliminates manual route configuration
- **expo-sqlite**: Local database for structured data — better than AsyncStorage for relational queries, supports full-text search for player names, Drizzle ORM compatible
- **Fetch API (built-in)**: HTTP requests to api.ffbad.org — React Native official recommendation, no bundle overhead vs Axios (52KB), TanStack Query abstracts complexity
- **react-native-gifted-charts 1.4.x+**: Line/bar charts for ranking evolution — simpler API than Victory Native, actively maintained, sufficient for time series and stats visualization

### Expected Features

The FFBaD official app provides authoritative data access but basic UX (text lists, minimal visualization). BadTracker differentiates on visualization quality (charts showing trends at a glance) and personalization (following rivals/teammates, head-to-head comparisons) while staying read-only to avoid user-generated content complexity.

**Must have (table stakes):**
- Player search by name/license — core discovery, FFBaD API provides search endpoints
- Match history display — core value proposition with filters by date/discipline/opponent
- Current ranking display — primary use case "where am I now"
- Ranking progression over time — users track improvement/decline trends
- Player profile view — context for any player (club, ranking, disciplines)
- Discipline filtering — badminton has 3 disciplines (simple/double/mixte), must separate
- Offline cached viewing — mobile users expect last-loaded data to persist without connectivity
- Dark mode — mobile standard for stats apps

**Should have (competitive):**
- Ranking progression visualization (charts) — differentiator vs FFBaD's text lists, makes trends obvious
- Player following/bookmarks — competitive players track rivals, club members follow teammates
- Head-to-head comparison — direct stat comparison for "how do I stack up against player X"
- Club leaderboards — players compare to clubmates more than global rankings
- Export match history — CSV/PDF for personal records or coach review
- Weekly ranking change notifications — local notifications (not push), re-engagement when CPPH updates

**Defer (v2+):**
- Social features (comments, reactions) — moderation burden, strays from core stats value
- Live match scoring — FFBaD data is authoritative, user input creates sync conflicts
- Custom ranking calculations — FFBaD CPPH is official, alternates confuse users
- Multi-federation support — scope creep, focus on FFBaD excellence first
- Real-time data sync — FFBaD updates weekly (CPPH), unnecessary API load

### Architecture Approach

React Native apps consuming external REST APIs follow a layered architecture separating UI, data fetching, state management, and persistence. The 2026 ecosystem has converged on TanStack Query for server state (replacing Redux/manual fetch patterns), Zustand for client state, and AsyncStorage persistence with query cache. This eliminates 80% of Redux boilerplate while providing offline-first capabilities through automatic cache persistence. The architecture splits state clearly: TanStack Query owns all API data (player profiles, rankings, matches) with automatic background refetching and staleness detection, while Zustand manages client-only state (auth status, bookmarks, UI preferences).

**Major components:**
1. **Data Layer (TanStack Query + Zustand)** — TanStack Query handles all server state with automatic caching/refetching/offline persistence, Zustand manages lightweight client state (bookmarks, theme)
2. **Service Layer (API Client + Storage)** — Centralized Axios/Fetch client with interceptors for auth token injection, request/response logging, error handling; expo-secure-store for credentials, AsyncStorage for cache
3. **UI Layer (Expo Router + Components)** — File-based routing matches Next.js patterns, screens consume data hooks (never call APIs directly), reusable components decoupled from business logic
4. **Persistence Layer** — TanStack Query persists cache to AsyncStorage automatically, Zustand middleware persists bookmarks/preferences, expo-secure-store encrypts auth tokens

### Critical Pitfalls

Research identified 7 critical pitfalls that lead to rewrites, security incidents, or production failures if not addressed in Phase 1 (Foundation). All have established mitigation patterns but require architectural decisions from day one.

1. **Hardcoded credentials in app bundle** — API credentials stored in source code or .env get bundled into app binary; attackers decompile mobile apps to extract credentials. **Avoid:** Use expo-secure-store (iOS Keychain/Android Keystore) for user credentials after authentication, never bundle API keys in app, FFBaD license+password must go through SecureStore not AsyncStorage.

2. **Missing HTTPS enforcement** — iOS and Android block HTTP by default; enabling HTTP globally during dev then shipping to production breaks security. **Avoid:** Verify all FFBaD endpoints use HTTPS (api.ffbad.org, apitest.ffbad.org), never enable global HTTP exceptions in production, use environment-specific configs to separate dev/test/prod.

3. **No cache invalidation strategy** — Sports data has different freshness (rankings weekly, matches hourly, profiles rarely); single TTL causes stale rankings or excessive API calls. **Avoid:** Implement data-specific TTLs (rankings 48h, matches 10-60min, profiles 24h per FFBaD docs), use stale-while-revalidate (show cached, refetch background), trigger invalidation on app foreground/pull-to-refresh.

4. **Ignoring rate limiting** — Federation APIs protect infrastructure with rate limits; apps hit 429 errors at scale without client-side throttling or backoff. **Avoid:** Implement exponential backoff with jitter (1-2s, 2-4s, 4-8s retries), handle 429 by reading Retry-After header, test with concurrent users before launch.

5. **No schema validation on API responses** — TypeScript validates compile-time but runtime API data bypasses type checking; FFBaD returns "UTF-8 stdClass objects" as plain JavaScript objects causing "Cannot read property of undefined" crashes. **Avoid:** Implement runtime schema validation with Zod on all API responses, log validation failures to monitoring, provide fallback UI for malformed data.

6. **Environment configuration leakage** — Production apps contain test credentials or endpoints; users hit test environments or test credentials expose production APIs. **Avoid:** Use build flavors to separate environments completely (dev/test/prod as separate builds), never include production credentials in dev builds, inject environment variables at build time via CI/CD, remove runtime environment switchers from production.

7. **UTF-8 encoding inconsistencies** — FFBaD API returns UTF-8 with French accented characters; React Native handles UTF-8 differently on iOS vs Android (Android appends charset=utf-8, iOS doesn't), causing garbled characters or API rejection. **Avoid:** Test with real French names from day one, verify API accepts "application/json; charset=utf-8" or set Content-Type without charset explicitly, validate special characters survive round-trip (API → storage → display).

## Implications for Roadmap

Based on architectural dependencies and pitfall mitigation requirements, the recommended phase structure prioritizes foundation (secure API client, auth, caching architecture) before features, then builds core features in parallel once foundation is stable, followed by differentiation features that require working data layer.

### Phase 1: Foundation & Security
**Rationale:** All future features depend on secure, properly-configured API client. Critical pitfalls (credentials, HTTPS, rate limiting, schema validation, UTF-8, environment config) must be addressed before any features ship. Retrofitting security or cache architecture later requires refactoring all API calls and potentially forcing user re-authentication.

**Delivers:**
- Expo project setup with TypeScript, folder structure, navigation shell
- API client with interceptors for auth, error handling, rate limiting with exponential backoff
- TanStack Query configuration with query key factory pattern
- expo-secure-store for credentials (not AsyncStorage)
- Environment-specific build configs (dev/test/prod separated)
- Runtime schema validation with Zod on API responses
- UTF-8 handling tested with French accented characters on both platforms
- Basic authentication flow (login/logout)

**Addresses features:**
- Player search (validates API client works)
- Authentication required for FFBaD API access

**Avoids pitfalls:**
- Pitfall 1: Hardcoded credentials — SecureStore from day one
- Pitfall 2: HTTP/HTTPS — HTTPS enforcement in build config
- Pitfall 4: Rate limiting — Exponential backoff in API client
- Pitfall 5: Schema validation — Zod validation layer
- Pitfall 6: Environment leakage — Separate build flavors
- Pitfall 7: UTF-8 encoding — Explicit handling, cross-platform testing

**Research needs:** None — well-documented patterns in STACK.md and ARCHITECTURE.md

### Phase 2: Core Data Features
**Rationale:** With secure foundation in place, core features (player profiles, rankings, match history) can be built in parallel. These are table stakes features that prove basic value proposition. Cache invalidation strategy must be implemented here (different TTLs per data type) as defined in Pitfall 3.

**Delivers:**
- Player profile screen with current ranking, club, disciplines
- Match history display with filters (date, discipline, opponent)
- Current ranking display with CPPH and rank category
- Discipline filtering throughout app
- Data-specific cache TTLs (rankings 48h, matches 10-60min, profiles 24h)
- Pull-to-refresh on all data screens
- Loading states and error boundaries with specific error messages

**Addresses features:**
- Player profile view (table stakes)
- Match history display (table stakes)
- Current ranking display (table stakes)
- Discipline filtering (table stakes)

**Uses stack:**
- TanStack Query with differentiated cache TTLs
- expo-sqlite for local data if needed (or AsyncStorage sufficient)
- Expo Router for screen navigation

**Avoids pitfalls:**
- Pitfall 3: Cache invalidation — Data-specific TTLs per FFBaD docs
- Pitfall 11: Inadequate error handling — Specific messages per error type (401, 403, 404, 429, 500)

**Research needs:** None — standard CRUD patterns with TanStack Query

### Phase 3: Offline-First & Visualization
**Rationale:** Core features work, now enhance UX with offline support and differentiation through visualization. Offline support easier to add now with architecture in place. Charts differentiate from FFBaD official app (text lists only).

**Delivers:**
- TanStack Query persistence to AsyncStorage (offline-first)
- Network status monitoring with NetInfo, synced to TanStack Query onlineManager
- Offline indicator banner when no connectivity
- Ranking progression chart (line chart showing CPPH over time)
- Player bookmarks/following with Zustand + persistence
- Dark mode support

**Addresses features:**
- Offline cached viewing (table stakes)
- Ranking progression chart (competitive differentiator)
- Player following/bookmarks (competitive differentiator)
- Dark mode (table stakes)

**Uses stack:**
- TanStack Query persistence plugin
- react-native-gifted-charts for ranking visualization
- Zustand with AsyncStorage middleware for bookmarks
- NetInfo for connectivity monitoring

**Avoids pitfalls:**
- Pitfall 8: Poor offline support — Offline-first architecture with cache persistence
- Pitfall 9: FlatList performance — Virtualization for rankings (if needed)

**Research needs:** Phase-specific research for chart library integration (react-native-gifted-charts vs Victory Native trade-offs)

### Phase 4: Advanced Features
**Rationale:** Differentiation features that require working data layer and proven core features. These provide competitive advantage but aren't table stakes. Can be built incrementally based on user feedback.

**Delivers:**
- Head-to-head player comparison
- Club leaderboards (filter players by club, rank by CPPH)
- Timeline of ranking milestones (visualize when user hit NC, P12, P10)
- Export match history to CSV/PDF
- Weekly ranking change notifications (local notifications, not push)

**Addresses features:**
- Head-to-head comparison (competitive differentiator)
- Club leaderboards (competitive differentiator)
- Timeline milestones (competitive differentiator)
- Export match history (competitive differentiator)
- Weekly ranking notifications (competitive differentiator)

**Uses stack:**
- TanStack Query for aggregations
- expo-notifications for local notifications
- File system API for CSV/PDF export

**Avoids pitfalls:**
- Pitfall 9: FlatList performance — Pagination for large leaderboards
- Pitfall 14: Testing only with personal data — Test with various license types

**Research needs:** Phase-specific research for notification scheduling patterns and file export libraries

### Phase 5: Polish & Optimization
**Rationale:** Core functionality complete, now refine UX and performance based on real usage patterns. Performance optimizations wait until bottlenecks are proven.

**Delivers:**
- Match insights/patterns (aggregation logic for stats)
- Optimistic updates for bookmarks
- Performance profiling and optimization (FlatList virtualization if needed)
- Analytics integration (crash reporting, performance monitoring)
- Comprehensive error handling with retry UI
- Loading skeleton screens

**Addresses features:**
- Match insights/patterns (competitive differentiator, high complexity)

**Uses stack:**
- TanStack Query optimistic updates
- FlashList if FlatList performance insufficient
- Sentry or similar for production monitoring

**Avoids pitfalls:**
- Pitfall 12: Missing logging — Production error monitoring with context

**Research needs:** Phase-specific research for analytics integration and performance profiling tools

### Phase Ordering Rationale

- **Phase 1 must come first:** All critical pitfalls addressed in foundation (security, HTTPS, rate limiting, schema validation, UTF-8, environment config). These are architectural decisions that can't be retrofitted easily. Authentication blocks access to FFBaD API.

- **Phase 2 builds on Phase 1:** Core features require secure API client from Phase 1. Can be developed in parallel (player profiles, rankings, match history don't depend on each other). Cache invalidation strategy implemented here prevents stale data issues.

- **Phase 3 enhances Phase 2:** Offline support and visualization require working data fetching from Phase 2. TanStack Query persistence is enhancement, not blocker. Charts need data from rankings/match history.

- **Phase 4 and 5 iterative:** Advanced features and polish can be ordered based on user feedback. Head-to-head comparisons require match history data. Performance optimization waits until bottlenecks are proven with real usage.

- **Dependency-driven:** Architecture research (ARCHITECTURE.md "Build Order Recommendations") explicitly recommends this sequence based on technical dependencies. Foundation → Authentication → Core Features → Enhanced UX → Polish matches industry best practices.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Offline-First & Visualization):** Chart library integration specifics — react-native-gifted-charts API details, data transformation for CPPH time series, performance with large datasets (100+ data points)
- **Phase 4 (Advanced Features):** Notification scheduling patterns — Expo TaskManager for background fetch, local notification best practices, weekly ranking change detection logic
- **Phase 4 (Advanced Features):** File export implementation — CSV generation library selection, PDF rendering options (react-native-pdf vs alternatives), native share sheet integration

**Phases with standard patterns (skip phase research):**
- **Phase 1 (Foundation & Security):** Well-documented Expo + TanStack Query setup, covered comprehensively in STACK.md and ARCHITECTURE.md
- **Phase 2 (Core Data Features):** Standard CRUD with TanStack Query, established patterns in ARCHITECTURE.md
- **Phase 5 (Polish & Optimization):** Standard React Native optimization techniques, profiling tools well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified with official Expo/React Native docs, TanStack Query docs, multiple 2025-2026 sources. SDK versions confirmed from Expo changelog (54 stable as of Feb 2026). Library choices cross-verified with recent comparisons. |
| Features | MEDIUM | FFBaD official app feature set documented via app stores. Competitor analysis limited (niche domain). Table stakes identified from general sports stats apps. Differentiators inferred from user needs but not validated with target users. |
| Architecture | HIGH | Standard React Native patterns verified with official docs and multiple authoritative sources (2026). TanStack Query + Zustand pattern is current best practice. Offline-first architecture well-documented. Project structure matches industry recommendations. |
| Pitfalls | MEDIUM | Critical pitfalls verified with multiple sources (security, encoding, rate limiting). FFBaD-specific issues inferred from API documentation (UTF-8, caching strategy). Production incidents documented in React Native community. Some domain-specific risks inferred rather than observed. |

**Overall confidence:** HIGH

The core technical recommendations (stack, architecture) are high confidence — verified with official documentation and current 2026 best practices. Feature prioritization is medium confidence — based on competitor analysis and general sports app patterns but not validated with actual FFBaD users. All critical pitfalls have documented mitigation strategies, though some FFBaD-specific risks are inferred from API docs rather than production experience.

### Gaps to Address

**Gap: FFBaD API authentication specifics** — Research references "license number + password" for FFBaD API authentication but didn't find detailed authentication flow documentation. During Phase 1 implementation, need to validate actual auth endpoints, token format, refresh mechanism.

**Gap: FFBaD API rate limits** — Research recommends rate limiting mitigation but didn't find documented rate limits for api.ffbad.org. During Phase 1, test to discover actual limits (requests per minute/hour), or coordinate with FFBaD for official limits.

**Gap: Chart performance with large datasets** — Research recommends react-native-gifted-charts but didn't benchmark with actual ranking datasets. During Phase 3, test with realistic data sizes (52 weeks of CPPH data, 100+ data points) to verify performance. May need Victory Native XL (Skia-based) if performance insufficient.

**Gap: User validation of features** — Research identified table stakes vs differentiators based on competitor analysis, but didn't validate with actual competitive badminton players. During Phase 2, consider user testing with target audience to validate feature priorities (head-to-head comparison vs club leaderboards vs timeline milestones).

**Gap: FFBaD API response schemas** — Research recommends Zod schema validation but didn't document actual FFBaD API response structures. During Phase 1, document response schemas from actual API calls to create comprehensive Zod schemas. FFBaD API docs reference "UTF-8 stdClass objects" but format needs validation.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- Expo Documentation (docs.expo.dev) — SQLite features, New Architecture timeline, TypeScript configuration, Navigation guidance
- React Native Documentation (reactnative.dev) — Official Fetch recommendation, security best practices, networking
- TanStack Query Documentation (tanstack.com/query) — React Native integration, AppState handling, persistence patterns
- FFBaD API (api.ffbad.org, apitest.ffbad.org) — API endpoints, Change_Log.php for version history

**Expo Ecosystem:**
- Expo SDK 54 Release (expo.dev/changelog/sdk-54) — Current stable version, New Architecture status
- Expo Router Documentation — File-based routing, type safety
- Expo SecureStore Documentation — iOS Keychain/Android Keystore integration

### Secondary (MEDIUM confidence)

**Technology Stack (2025-2026 sources):**
- "React Native Best Practices 2026" (esparkinfo.com) — Performance optimization, Expo recommendations
- "SQLite in React Native Guide" (oneuptime.com, Jan 2026) — SQLite vs AsyncStorage comparison
- "React Native Charting Libraries Comparison 2026" (blog.stackademic.com) — react-native-gifted-charts vs Victory Native analysis
- "Axios vs Fetch 2026" (iproyal.com) — Performance comparison, bundle size analysis
- "TanStack Query Server State Guide" (oneuptime.com, Jan 2026) — Current version, React Native patterns
- "React Navigation 7 vs Expo Router 2025" (viewlytics.ai) — Feature comparison

**Architecture & Patterns (2026 sources):**
- "React Native Offline First App Development" (relevant.software)
- "How to Structure Large-Scale React Native Applications" (oneuptime.com, Jan 2026)
- "State Management Nx React Native/Expo Apps with TanStack Query and Redux" (nx.dev)
- "React State Management in 2025: What You Actually Need" (developerway.com)
- "How to organize Expo app folder structure for clarity and scalability" (expo.dev/blog)

**Security & Best Practices:**
- "How To Secure API Access in Mobile Apps" (curity.medium.com)
- "REST API Security Best Practices (2026)" (levo.ai)
- "React Native Security" (reactnative.dev/docs/security)
- "25 React Native Best Practices for High Performance Apps 2026" (esparkinfo.com)

**Pitfalls & Common Mistakes:**
- "React Native HTTP API Not Working While HTTPS Works" (agilesoftlabs.com, Jan 2026)
- "React-Native appends charset=utf-8 to HTTP call Content-Type" (github.com/facebook/react-native/issues/14445)
- "React Native Retry Logic — Making Your App Network Resilient" (hemanthkollanur.medium.com)
- "Ensuring Type Safety from API to UI with Schema Validation" (leapcell.io)
- "10 Mistakes to Avoid When Developing React Native Apps" (f22labs.com)

**Performance & Optimization:**
- "Large List Optimization Techniques with FlatList in React Native" (gabrielvrl.medium.com)
- "React Native Performance Tips: Definitive Guide to FlatList" (rafalnawojczyk.pl)
- "How to Implement FlatList Optimization for Large Lists" (oneuptime.com, Jan 2026)

**Feature Research:**
- FFBaD Official App (play.google.com) — Current feature set, UX patterns
- RacketStats, GoodShot, various badminton/racket sports apps — Competitor feature analysis
- "10 Essential Features to Look for in a Sports Team Performance App" (sportsfirst.net)
- "7 Dash Apps Bringing AI & ML to Sports Analytics" (medium.com/plotly)

### Tertiary (LOW confidence, needs validation)

- "An Avalanche of Racket Sports Apps" (racketbusiness.com) — Industry trends
- "10 Best Sports Apps Ranked in 2026" (zegocloud.com) — General sports app patterns
- Various app store listings and reviews — Feature expectations

---

*Research completed: 2026-02-16*
*Ready for roadmap: yes*
