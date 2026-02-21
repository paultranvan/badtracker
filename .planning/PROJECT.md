# BadTracker

## What This Is

A native Android app for French badminton players (FFBaD-licensed) to track their match history, visualize ranking progression, and follow other players. Routes all data through a hidden WebView bridge to myffbad.fr, presenting it in a clean mobile experience.

## Core Value

French badminton players can instantly see their ranking evolution and match stats in a native mobile experience that makes myffbad.fr data actually useful.

## Requirements

### Validated

- Authenticate via FFBaD license number — v1.0
- Search for other players by name or license number — v1.0
- View player profiles with name, club, and rankings by discipline — v1.0
- View personal dashboard (ranking, recent matches, quick stats) — v1.0
- View full match history from FFBaD with discipline filters — v1.0
- See win/loss breakdown by discipline (simple, double, mixte) — v1.0
- See ranking/points evolution over time as a visual chart — v1.0
- See ranking milestones (when rank changed) — v1.0
- View club leaderboards with ranked club members — v1.0
- Bookmark other players for quick access — v1.0
- Local caching for performance and offline access — v1.0
- Offline indicator bar with auto-refresh on reconnect — v1.0

### Active

_No active requirements. Define next milestone to add new requirements._

### Out of Scope

- Live match scoring — app consumes FFBaD data, does not create it
- Push notifications — requires backend, deferred to future version
- Head-to-head comparisons — nice to have, not v1
- iOS build — Android-first, iOS later (React Native makes this easy to add)
- Backend server — direct API access with local storage
- Non-FFBaD players — only licensed French federation players

## Context

Shipped v1.0 with 8,565 LOC TypeScript across 116 files.
Tech stack: React Native (Expo SDK 54), expo-router, i18next, react-native-gifted-charts, react-native-webview.
Architecture: Hidden WebView bridge to myffbad.fr for all API calls (replaced initial direct Axios client).
Data flow: bridgeLogin/bridgeGet/bridgePost through WebView → myffbad.fr API → transform to app format.
Known tech debt: dead code in src/api/client.ts (legacy Axios client), player profile cache limited to bookmarked players.

## Constraints

- **Tech stack**: React Native with Expo SDK 54 — cross-platform, TypeScript
- **Data source**: myffbad.fr via hidden WebView bridge — no direct HTTP to FFBaD API
- **Platform**: Android (shipped), iOS deferred
- **No backend**: WebView bridge + local storage (AsyncStorage/SecureStore) for caching
- **Auth**: FFBaD license number + password → myffbad.fr login → personId + accessToken

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native + Expo | Cross-platform with JS/TS, large ecosystem, quick setup | Good |
| No backend for v1 | Keep architecture simple, direct API + local cache | Good |
| Android-first | User's primary platform, iOS trivial to add later | Good |
| WebView bridge to myffbad.fr | Proper session handling, avoids direct API auth issues | Good |
| SecureStore for credentials | Hardware-backed encryption, AFTER_FIRST_UNLOCK | Good |
| i18n with i18next | French default, English alternative, device detection | Good |
| react-native-gifted-charts | No Skia/Reanimated deps, SVG-based | Good |
| Cache-first-then-fetch pattern | Instant UI, offline support, auto-refresh | Good |
| Bookmarks tied to device not account | Persist across logout, no backend needed | Good |
| @react-native-community/netinfo | Real-time connectivity detection | Good |

---
*Last updated: 2026-02-21 after v1.0 milestone*
