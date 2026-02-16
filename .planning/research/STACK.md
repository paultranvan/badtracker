# Technology Stack

**Project:** BadTracker
**Researched:** 2026-02-16
**Confidence:** HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React Native | 0.83.x | Cross-platform mobile framework | Industry standard for cross-platform mobile, excellent community support, mature ecosystem |
| Expo SDK | 54.x (stable) | Development framework and build tooling | Simplifies development workflow, provides managed native modules, enables OTA updates via EAS Update, eliminates need for native code knowledge |
| TypeScript | 5.0+ | Type safety | Built-in Expo support, catches bugs at compile time, improves IDE autocomplete, required for Expo Router typed routes |
| Expo Router | Latest | File-based routing | File-based routing matches Next.js patterns, built on React Navigation 7, provides automatic deep linking, type-safe navigation, recommended for all new Expo projects |

**Rationale for Expo:** Start with Expo managed workflow because you have no backend and Android-first focus benefits from Expo's simplified build process. Can always eject later if native modules are needed. SDK 54 is current stable (SDK 55 beta available but use stable for production).

**New Architecture Note:** SDK 55+ requires New Architecture (legacy frozen June 2025). SDK 54 supports both but defaults to New Architecture. Stick with SDK 54 stable for now, plan migration to SDK 55 when it's stable (likely Q2 2026).

### Data & State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| expo-sqlite | SDK 54 | Local database for match history, player data | Built-in Expo SDK package, supports complex queries better than AsyncStorage, FTS support for player search, Drizzle ORM compatibility, provides localStorage-compatible key-value store |
| TanStack Query | 5.90.x | Server state management (REST API caching) | Industry standard for server state (formerly React Query), automatic caching/refetching/invalidation, works out-of-box with React Native, handles AppState focus/blur for mobile, reduces boilerplate vs manual fetch caching |
| Zustand | 5.x | Client state management | Lightweight (1KB), zero boilerplate vs Redux, no Context Provider needed, granular updates prevent re-renders, perfect for UI state (filters, selected player, etc) |

**Caching Strategy:**
- **TanStack Query:** Cache REST API responses (match history, rankings) with configurable staleness
- **expo-sqlite:** Persist user favorites, offline match data, player watchlist
- **Zustand:** UI state only (current screen, filters, search query)

**Why NOT AsyncStorage alone:** While AsyncStorage works for simple key-value storage, your app needs relational data (matches linked to players, ranking history time series). SQLite provides proper querying, indexing, and FTS for player name search.

### HTTP & Networking

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Fetch API | Built-in | REST API requests to api.ffbad.org | Native browser/React Native API, no bundle size overhead, sufficient for REST APIs, automatic with TanStack Query, React Native official recommendation |

**Why NOT Axios:** Fetch is React Native's official recommendation (per docs). TanStack Query abstracts HTTP details anyway. Axios adds 52KB bundle size for features you won't need (interceptors unnecessary with TanStack Query, automatic JSON parsing with fetch + TanStack Query). Fetch is faster (no library overhead) and built-in.

### Charts & Data Visualization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-native-gifted-charts | 1.4.x+ | Line charts (ranking evolution), bar charts (stats) | Simple API, smooth animations, 3D/gradient effects, clickable/scrollable, actively maintained (updated April 2025), lower learning curve than Victory Native, perfect for ranking time series and match statistics |

**Alternatives Considered:**
- **Victory Native:** Higher downloads (244K/week vs 87K/week) but more complex API, overkill for line/bar charts
- **react-native-graph (Skia):** Excellent performance but limited chart types, better for real-time streaming data
- **Recharts:** Web-only, not React Native compatible

**Recommendation:** Use react-native-gifted-charts for ranking evolution line charts and win/loss bar charts. Provides sufficient customization without Victory Native complexity. If you later need advanced interactions, Victory Native is drop-in compatible.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-constants | SDK 54 | Access app config, API URLs | Environment-specific API endpoints, version info |
| expo-linking | SDK 54 | Deep linking | Share player profiles, handle ffbad.org deep links |
| date-fns | 4.x | Date manipulation | Format match dates, calculate ranking periods, lighter than Moment.js (no need for i18n complexity) |
| react-native-mmkv | 3.x | Ultra-fast key-value storage | If SQLite overhead too high for simple preferences, 30x faster than AsyncStorage |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| EAS Build | Cloud builds for Android APK | Free tier sufficient for solo dev, handles Android signing, no need for local Android Studio setup |
| EAS Update | Over-the-air updates | Push bug fixes without Google Play review, critical for demo/investor scenarios |
| expo-dev-client | Development builds with native modules | If you add any native modules, replaces Expo Go |
| ESLint + Prettier | Code quality | Use Expo's TypeScript defaults |
| @tanstack/react-query-devtools | Query debugging | Shows cache state, refetch timing, stale queries |

## Installation

```bash
# Create new Expo project with TypeScript
npx create-expo-app@latest badtracker --template blank-typescript

# Core dependencies (most from Expo SDK)
npx expo install expo-sqlite expo-constants expo-linking

# State management
npm install @tanstack/react-query zustand

# Charts
npm install react-native-gifted-charts react-native-svg

# Date handling
npm install date-fns

# Dev dependencies
npm install -D @tanstack/react-query-devtools
```

**Note:** `expo-router` is included by default in `create-expo-app@latest`. No need to install separately.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Framework | Expo managed workflow | React Native CLI (bare workflow) | No need for custom native modules, Expo simplifies Android builds, can eject later if needed |
| Routing | Expo Router | React Navigation 7 directly | Expo Router is React Navigation 7 with file-based routing and type inference, better DX, same underlying library |
| Server State | TanStack Query | Manual fetch + useEffect | TanStack Query eliminates boilerplate for caching, refetching, stale-while-revalidate, AppState integration |
| Client State | Zustand | Redux Toolkit / Context API | Zustand 1KB vs Redux 20KB+, no boilerplate, no Provider wrapper, Context causes re-render issues at scale |
| Database | expo-sqlite | AsyncStorage | AsyncStorage poor for relational data, no querying, no full-text search, SQLite better for match/player/ranking data |
| HTTP | Fetch API | Axios | React Native recommends Fetch, no bundle overhead, TanStack Query handles complexity, Axios features not needed |
| Charts | react-native-gifted-charts | Victory Native | Victory Native 3x complexity for same line/bar charts, react-native-gifted-charts simpler API, actively maintained |
| Dates | date-fns | Moment.js / Day.js | date-fns tree-shakeable (smaller bundle), functional API, Moment.js deprecated, Day.js similar but date-fns more popular |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| AsyncStorage for structured data | Poor performance with large datasets, no relational queries, no indexing, no full-text search | expo-sqlite with Drizzle ORM or raw SQL |
| Redux for UI state | 20KB+ bundle size, massive boilerplate (actions, reducers, middleware), overkill for client state | Zustand (1KB, zero boilerplate) |
| Axios | 52KB bundle overhead, features redundant with TanStack Query (interceptors, retries handled by TanStack), slower than native fetch | Fetch API (built-in, React Native recommended) |
| React Navigation 7 directly | More boilerplate than Expo Router, manual type definitions, manual deep linking config | Expo Router (superset of React Navigation with file-based routing) |
| Moment.js | Deprecated, large bundle (67KB), mutable API causes bugs | date-fns (tree-shakeable, immutable) |
| Expo Go for production | Limited to Expo SDK modules, can't add custom native modules, debugging limitations | EAS Build with expo-dev-client |
| Class components | Deprecated React pattern, no hooks support | Functional components with hooks |

## Stack Patterns by Variant

**If you need offline-first:**
- Use TanStack Query's `cacheTime: Infinity` for critical data
- Sync SQLite as source of truth on app start
- Implement background sync with `AppState` listener

**If you add custom native module:**
- Eject from managed workflow OR use expo-dev-client (prebuild)
- expo-dev-client recommended (keeps Expo benefits, adds native flexibility)
- Follow Expo config plugin pattern for native modules

**If you target Web later:**
- Expo Router enables web routing automatically
- expo-sqlite has web polyfill (uses IndexedDB)
- Charts may need web-specific library (Recharts for web, react-native-gifted-charts for mobile)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Expo SDK 54 | React Native 0.76.x | SDK 54 stable, SDK 55 beta requires New Architecture |
| Expo Router | React Navigation 7.x | Expo Router built on RN 7, uses same APIs underneath |
| TanStack Query 5.x | React 18.x+ | Requires React 18 for Suspense support |
| TypeScript 5.0+ | Expo SDK 54 | Required for Expo Router typed routes |
| react-native-gifted-charts | react-native-svg | SVG required peer dependency, install via `npx expo install` |

## TypeScript Configuration

**Expo handles TypeScript setup automatically.** When you create project with `--template blank-typescript`:

- `tsconfig.json` pre-configured with React Native + Expo settings
- `app.config.ts` (instead of .js) enables type-safe config
- Expo Router generates types automatically from file structure
- Use `baseUrl: "."` in `tsconfig.json` for absolute imports

**Path aliases example:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/components/*": ["components/*"],
      "@/api/*": ["services/api/*"]
    }
  }
}
```

## Sources

**HIGH Confidence (Official Documentation):**
- [Expo Documentation - SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) - expo-sqlite features, key-value store, encryption
- [Expo Documentation - New Architecture](https://docs.expo.dev/guides/new-architecture/) - SDK 55 New Architecture requirement, SDK 54 default
- [React Native Documentation - Networking](https://reactnative.dev/docs/network) - Official Fetch recommendation
- [Expo Documentation - TypeScript](https://docs.expo.dev/guides/typescript/) - TypeScript configuration, path aliases
- [Expo Documentation - Navigation](https://docs.expo.dev/develop/app-navigation/) - Expo Router vs React Navigation guidance
- [TanStack Query - React Native](https://tanstack.com/query/latest/docs/framework/react/react-native) - React Native integration, AppState handling

**MEDIUM Confidence (Recent Articles + Official Sources):**
- [React Native Best Practices 2026](https://www.esparkinfo.com/blog/react-native-best-practices) - Performance optimization, Expo recommendations
- [SQLite in React Native Guide (Jan 2026)](https://oneuptime.com/blog/post/2026-01-15-react-native-sqlite/view) - SQLite vs AsyncStorage comparison
- [React Native Charting Libraries Comparison 2026](https://blog.stackademic.com/my-top-10-react-native-chart-libraries-heading-into-2026-46e115e3be38) - react-native-gifted-charts vs Victory Native
- [Axios vs Fetch 2026](https://iproyal.com/axios-vs-fetch/) - Performance comparison, bundle size analysis
- [Zustand State Management Guide](https://trio.dev/7-top-react-state-management-libraries/) - Zustand vs Redux comparison
- [React Navigation 7 vs Expo Router 2025](https://viewlytics.ai/blog/react-navigation-7-vs-expo-router) - Feature comparison, type safety
- [TanStack Query Server State Guide (Jan 2026)](https://oneuptime.com/blog/post/2026-01-15-react-native-tanstack-query/view) - Current version, React Native patterns
- [Expo SDK 54 Release](https://expo.dev/changelog/sdk-54) - SDK version timeline, New Architecture status

**Research Notes:**
- SDK versions verified from official Expo changelog (54 stable, 55 beta as of Feb 2026)
- TanStack Query version 5.90.21 (published 5 days before research date)
- All library recommendations cross-verified with multiple 2025-2026 sources
- React Native New Architecture migration timeline confirmed from official Expo docs

---
*Stack research for: React Native Expo mobile app with REST API, local caching, charting*
*Researched: 2026-02-16*
*Confidence: HIGH - All core recommendations verified with official documentation and recent sources*
