# Pitfalls Research

**Domain:** Mobile apps consuming third-party sports federation APIs
**Researched:** 2026-02-16
**Confidence:** MEDIUM

React Native apps consuming external sports federation APIs (like FFBaD) face domain-specific challenges beyond standard API integration. This research documents critical mistakes that lead to rewrites, poor UX, or production incidents.

---

## Critical Pitfalls

### Pitfall 1: Hardcoded Credentials in App Bundle

**What goes wrong:**
API credentials (license numbers, passwords, API keys) stored directly in source code or .env files get bundled into the app binary. Attackers regularly decompile mobile apps to extract these credentials, gaining unauthorized access to federation data or user accounts.

**Why it happens:**
Developers treat mobile apps like web apps, assuming client-side code is protected. React Native's JavaScript bundle is easily extractable from both iOS and Android builds using common tools.

**How to avoid:**
- Use Expo SecureStore (backed by iOS Keychain/Android Keystore) for storing user credentials after authentication
- Never bundle API keys or secrets with the app
- For user authentication credentials (license number + password), only store after user login, encrypted via SecureStore
- The FFBaD API uses login/password authentication - these must go through SecureStore, not AsyncStorage or environment variables

**Warning signs:**
- Finding credentials in source code or .env files
- Using AsyncStorage for sensitive data
- No encryption layer for stored authentication tokens
- Credentials committed to version control

**Phase to address:**
Phase 1 (Foundation/Authentication) - Security architecture must be correct from day one. Migration later requires wiping all user credentials.

**Sources:**
- [How To Secure API Access in Mobile Apps](https://curity.medium.com/how-to-secure-api-access-in-mobile-apps-a072d764ae46)
- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [REST API Security Best Practices (2026)](https://www.levo.ai/resources/blogs/rest-api-security-best-practices)

---

### Pitfall 2: Missing HTTP → HTTPS Migration Strategy

**What goes wrong:**
Both iOS and Android block HTTP traffic by default as a security measure. Apps fail to connect to APIs when testing or if federation API endpoints aren't HTTPS-only. The FFBaD API has both api.ffbad.org and apitest.ffbad.org endpoints - developers must verify both use HTTPS.

**Why it happens:**
Developers enable HTTP globally during development (via iOS App Transport Security exceptions or Android cleartext traffic), then ship this configuration to production. Alternatively, test environments use HTTP URLs that break when deployed.

**How to avoid:**
- Verify all FFBaD endpoints (api.ffbad.org, apitest.ffbad.org, dev-api.ffbad.org) use HTTPS
- Never enable global HTTP exceptions in production builds
- Use environment-specific build configurations to separate dev/test/prod API endpoints
- Test with production security settings enabled before release

**Warning signs:**
- ATS (App Transport Security) exceptions in Info.plist
- android:usesCleartextTraffic="true" in AndroidManifest.xml
- HTTP URLs in configuration files
- Different networking behavior between development and production builds

**Phase to address:**
Phase 1 (Foundation) - API client configuration must enforce HTTPS from the start. Also relevant in environment configuration setup.

**Sources:**
- [React Native HTTP API Not Working While HTTPS Works](https://www.agilesoftlabs.com/blog/2026/01/react-native-http-api-not-working-while)
- [Security · React Native](https://reactnative.dev/docs/security)

---

### Pitfall 3: No Cache Invalidation Strategy for Federation Data

**What goes wrong:**
Sports data has different freshness requirements (rankings update weekly, match results update hourly, player profiles rarely change). Apps either cache too aggressively (showing stale rankings) or too little (hammering the API). The FFBaD API specifies caching from 10min to 48h depending on data type, but apps ignore these guidelines.

**Why it happens:**
Developers implement a single cache TTL for all endpoints, or rely on manual refresh without automatic invalidation. Federation APIs often lack proper HTTP caching headers (ETag, Cache-Control), forcing client-side cache management.

**How to avoid:**
- Implement data-specific cache TTLs matching FFBaD's documented caching strategy:
  - Rankings: 48h (recalculates weekly)
  - Match results: 10-60min depending on competition status
  - Player profiles: 24h
  - Live match data: No caching
- Use stale-while-revalidate pattern: show cached data immediately, fetch updates in background
- Implement cache invalidation triggers (user pull-to-refresh, app foreground, time-based)
- Store cache timestamp with data for explicit staleness checks

**Warning signs:**
- Users reporting outdated rankings/results
- Excessive API calls visible in network logs
- No cache TTL differentiation between data types
- Cache never invalidates unless app is reinstalled

**Phase to address:**
Phase 2 (Core Features) - Must be designed with the data fetching layer. Retrofit later requires refactoring all API calls.

**Sources:**
- [What is Cache Invalidation? Strategies & Techniques](https://www.ioriver.io/terms/cache-invalidation)
- [What are the best practices for invalidating and updating REST API caches?](https://www.linkedin.com/advice/3/what-best-practices-invalidating-updating-rest)
- [Caching Strategies in React Native](https://medium.com/@reactjsbd/caching-strategies-in-react-native-handling-offline-data-and-performance-on-android-devices-08901d6b0c7f)

---

### Pitfall 4: Ignoring Rate Limiting Until Production Incidents

**What goes wrong:**
Federation APIs implement rate limiting to protect infrastructure. Apps with multiple concurrent users suddenly hit rate limits, receiving 429 (Too Many Requests) errors. Users see error screens during normal usage, especially during peak times (tournament results posting).

**Why it happens:**
Development/testing uses single users making sequential requests. Rate limits only appear at scale. Apps don't implement client-side throttling, retry logic with exponential backoff, or request queuing.

**How to avoid:**
- Implement exponential backoff with jitter for retries:
  - First retry: 1-2s wait
  - Second retry: 2-4s wait
  - Third retry: 4-8s wait
  - Add random jitter to prevent thundering herd
- Handle 429 responses by reading Retry-After header
- Use request queuing for non-critical updates (analytics, background sync)
- Implement client-side throttling for user-triggered actions (search-as-you-type, rapid navigation)
- Test with realistic concurrent user scenarios

**Warning signs:**
- No retry logic in API client
- Immediate failures on network errors
- No handling of 429 status codes
- Missing Retry-After header parsing

**Phase to address:**
Phase 1 (Foundation) - Must be built into API client from start. Adding later risks inconsistent behavior across features.

**Sources:**
- [React Native Retry Logic — Making Your App Network Resilient](https://hemanthkollanur.medium.com/react-native-retry-logic-making-your-app-network-resilient-5b5fe68c457d)
- [How to Implement Retry Logic with Exponential Backoff in React](https://oneuptime.com/blog/post/2026-01-15-retry-logic-exponential-backoff-react/view)
- [429 Too Many Requests: Strategies for API Throttling](https://www.useanvil.com/blog/engineering/throttling-and-consuming-apis-with-429-rate-limits/)

---

### Pitfall 5: No Schema Validation on API Responses

**What goes wrong:**
Federation APIs evolve, sometimes changing response structure without notice. The FFBaD API returns "UTF-8 stdClass objects" - JavaScript receives these as plain objects without type safety. Null values, missing fields, or type changes cause runtime crashes with "Cannot read property 'name' of undefined" errors that TypeScript doesn't catch.

**Why it happens:**
TypeScript only validates at compile time. Runtime data from external APIs bypasses type checking. Developers assume API contracts remain stable, but federation APIs are maintained by separate teams with different release cycles.

**How to avoid:**
- Implement runtime schema validation with Zod or similar:
  ```typescript
  import { z } from 'zod';

  const PlayerSchema = z.object({
    licenceNumber: z.string(),
    name: z.string(),
    ranking: z.number().nullable(),
    club: z.string().optional()
  });

  const validateApiResponse = (data: unknown) => {
    return PlayerSchema.parse(data); // Throws if validation fails
  };
  ```
- Validate all API responses before using in UI
- Log validation failures to monitoring system
- Provide fallback UI for malformed data rather than crashing
- Add null safety checks even with TypeScript types

**Warning signs:**
- Runtime crashes from API data despite TypeScript types
- No validation layer between API and UI components
- Assuming API response structure is guaranteed
- Direct use of API responses without parsing/validation

**Phase to address:**
Phase 1 (Foundation) - Must be built into API client layer. Adding validation later means auditing every API call site.

**Sources:**
- [Ensuring Type Safety from API to UI with Schema Validation](https://leapcell.io/blog/ensuring-type-safety-from-api-to-ui-with-schema-validation)
- [How to Use Zod Schema Validation for a Type-Safe React App?](https://reliasoftware.com/blog/zod-schema-validation-react-tutorial)

---

### Pitfall 6: Environment Configuration Leakage

**What goes wrong:**
Production apps contain test/development API credentials or endpoints. Users accidentally hit test environments, or worse, test credentials are exposed in production builds allowing unauthorized access to production APIs.

**Why it happens:**
Developers use runtime environment switching (useful for testing) but include all environment configurations in production builds. Build-time configuration is more secure but less flexible.

**How to avoid:**
- Use build flavors/schemes to completely separate environments:
  - Development build: dev-api.ffbad.org only
  - Testing build: apitest.ffbad.org only
  - Production build: api.ffbad.org only
- Never include production credentials in dev/test builds
- Never include test credentials in production builds
- Use environment variables injected at build time via CI/CD
- For Expo: use app.config.js with environment-specific builds
- Remove runtime environment switchers from production builds

**Warning signs:**
- Multiple API endpoints in single build
- Runtime environment switching UI in production
- Test API keys in production code
- Single configuration file with all environments

**Phase to address:**
Phase 1 (Foundation) - Build configuration must separate environments from start. Changing later requires build system overhaul.

**Sources:**
- [API Environment & Version Management for Mobile Apps](https://ashutoshagarwal2014.medium.com/api-environment-version-management-for-mobile-apps-dev-staging-and-production-best-practices-474f37cc060d)
- [Switching App Environment at Runtime—A Counterargument](https://medium.com/kinandcartacreated/switching-app-environment-at-runtime-a-counterargument-3a798a421dcf)

---

### Pitfall 7: UTF-8 Encoding Inconsistencies

**What goes wrong:**
The FFBaD API explicitly returns "UTF-8 stdClass objects". French player names contain accented characters (é, è, à, ç). React Native handles UTF-8 differently on iOS vs Android, causing garbled characters, broken JSON parsing, or API rejection due to Content-Type header inconsistencies.

**Why it happens:**
React Native's fetch on Android automatically appends "charset=utf-8" to Content-Type headers, while iOS doesn't. Some APIs reject this. Large responses can be split into chunks, breaking multi-byte UTF-8 characters across boundaries.

**How to avoid:**
- Test with real French names containing accented characters from day one
- Verify API accepts "application/json; charset=utf-8" or explicitly set Content-Type without charset
- Handle response encoding explicitly rather than assuming UTF-8 default
- Test on both iOS and Android with same API calls
- Use fetch polyfill or axios for consistent behavior across platforms
- Validate that special characters survive round-trip (API → storage → display)

**Warning signs:**
- Garbled characters in player names
- Different rendering on iOS vs Android
- JSON parsing errors on chunked responses
- API rejecting requests from Android but not iOS

**Phase to address:**
Phase 1 (Foundation) - API client must handle encoding consistently. Character encoding bugs are difficult to debug in production.

**Sources:**
- [React-Native appends "charset=utf-8" to HTTP call Content-Type](https://github.com/facebook/react-native/issues/14445)
- [Fetch adds charset=utf-8 on Android but not on iOS](https://github.com/facebook/react-native/issues/8237)
- [A character encoding gotcha with React](https://chromakode.com/post/react-utf8/)

---

## Moderate Pitfalls

### Pitfall 8: Poor Offline Support Design

**What goes wrong:**
Sports apps are used during tournaments in venues with poor connectivity. Without offline support, users can't view cached match schedules, previous results, or rankings when network is unavailable.

**Why it happens:**
Offline support treated as optional feature added later rather than architectural decision from start.

**How to avoid:**
- Implement offline-first architecture with react-native-offline or similar
- Cache critical data (user profile, favorite players, recent rankings) for offline access
- Queue non-critical operations (analytics, preference updates) when offline
- Use NetInfo to detect connectivity changes
- Show clear offline indicators in UI
- Sync queued operations when connection restored

**Warning signs:**
- App unusable without network
- No offline indicators
- Data loss when connection drops mid-operation
- No request queuing for offline actions

**Phase to address:**
Phase 2 (Core Features) - Easier to build with offline-first from start, but can retrofit with refactoring.

**Sources:**
- [Handling Offline Mode in React Native](https://www.around25.com/blog/handling-offline-mode-in-react-native)
- [Building Offline-First React Native Apps with React Query and TypeScript](https://www.whitespectre.com/ideas/how-to-build-offline-first-react-native-apps-with-react-query-and-typescript/)
- [react-native-offline](https://github.com/rgommezz/react-native-offline)

---

### Pitfall 9: FlatList Performance Issues with Large Rankings

**What goes wrong:**
Badminton rankings contain thousands of players. Rendering entire ranking list causes memory issues, slow scrolling, and UI freezes. The FFBaD API may return complete ranking datasets without pagination.

**Why it happens:**
Developers render all data in a simple list without virtualization or pagination, assuming mobile can handle it like web.

**How to avoid:**
- Use FlatList with proper optimization:
  - Set `initialNumToRender` to reasonable value (20-50 items)
  - Implement `getItemLayout` for consistent item heights
  - Use `maxToRenderPerBatch` to control rendering chunks
  - Set `windowSize` to balance memory vs scroll performance
- Implement pagination with `onEndReached` for infinite scroll
- Memoize list item components with React.memo
- Use `keyExtractor` with stable IDs (license numbers)
- Consider filtering/search to reduce displayed items

**Warning signs:**
- Slow scrolling on ranking screens
- Memory warnings in development
- Long initial render time for rankings
- App crashes with large datasets

**Phase to address:**
Phase 2 (Core Features) - Build rankings with performance optimization from start. Refactoring later is complex.

**Sources:**
- [Large List Optimization Techniques with FlatList in React Native](https://gabrielvrl.medium.com/large-list-optimization-techniques-with-flatlist-in-react-native-ab7c651746a5)
- [React Native Performance Tips: Definitive Guide to FlatList](https://rafalnawojczyk.pl/blog/react-native/flatlist-performance)
- [How to Implement FlatList Optimization for Large Lists](https://oneuptime.com/blog/post/2026-01-15-react-native-flatlist-optimization/view)

---

### Pitfall 10: No API Version Handling Strategy

**What goes wrong:**
Federation APIs evolve with breaking changes. The FFBaD API has a documented Change_Log.php showing historical changes. Apps break when API updates without maintaining backward compatibility. Users on old app versions stop working.

**Why it happens:**
Developers assume APIs are stable, don't implement version detection or graceful degradation.

**How to avoid:**
- Check if FFBaD API supports versioning (URI-based like /v1/, /v2/)
- Implement version detection on app startup
- Gracefully degrade when new API features aren't available
- Monitor API changelog (https://api.ffbad.org/Change_Log.php)
- Plan for minimum 6-month deprecation window
- Show "update required" message for incompatible versions
- Consider maintaining compatibility with N-1 API version

**Warning signs:**
- No API version in requests
- No handling of deprecated endpoint responses
- No app version checking mechanism
- Unexpected API errors after federation updates

**Phase to address:**
Phase 1 (Foundation) - Version handling easier to add early. Later requires protocol for handling breaking changes.

**Sources:**
- [FFBaD API Change Log](https://api.ffbad.org/Change_Log.php)
- [REST API Versioning: How to Version a REST API?](https://restfulapi.net/versioning/)
- [Versioning Best Practices in REST API Design](https://www.speakeasy.com/api-design/versioning)

---

### Pitfall 11: Inadequate Error Handling and User Feedback

**What goes wrong:**
Network errors, API failures, rate limits, and authentication failures show generic "Something went wrong" messages. Users don't know if they should retry, wait, or contact support. Common federation API errors (invalid license number, expired credentials, tournament not found) lack specific handling.

**Why it happens:**
Developers implement single catch-all error handler without distinguishing error types or providing actionable feedback.

**How to avoid:**
- Implement error type discrimination:
  - 401 (Unauthorized): Credentials expired, re-authenticate
  - 403 (Forbidden): Invalid license/permissions
  - 404 (Not Found): Tournament/player doesn't exist
  - 429 (Rate Limited): "Too many requests, try again in Xs"
  - 500 (Server Error): "Federation API temporarily unavailable"
  - Network errors: "Check your connection"
- Provide specific, actionable error messages in French (primary language for FFBaD)
- Log detailed errors to monitoring system for debugging
- Implement retry UI for transient errors
- Show offline indicator for network issues

**Warning signs:**
- All errors show same generic message
- No differentiation between client/server/network errors
- No retry mechanism in UI
- Errors not logged for debugging

**Phase to address:**
Phase 1 (Foundation) - Error handling architecture from start. Comprehensive error handling difficult to retrofit.

**Sources:**
- [Resolving Common REST API Errors](https://www.digitalsamba.com/blog/troubleshooting-common-rest-api-errors)
- [Working with APIs in React Native: Best Practices](https://issuu.com/ampleworksoftware/docs/working_with_apis_in_react_native_best_practices/s/26473269)

---

## Minor Pitfalls

### Pitfall 12: Missing Request/Response Logging

**What goes wrong:**
Production issues are hard to debug without visibility into API interactions. Users report "app doesn't work" but developers can't reproduce or diagnose federation API problems.

**How to avoid:**
- Implement structured logging for API calls (excluding sensitive data)
- Log request URLs, status codes, error messages (not passwords/tokens)
- Use React Native's debugging tools with network inspection
- Integrate error monitoring (Sentry, Bugsnag) with API error context
- Implement request ID tracking for correlation

**Phase to address:**
Phase 1 (Foundation) - Logging infrastructure easiest to add early.

---

### Pitfall 13: Hardcoded French-Only UI

**What goes wrong:**
While FFBaD is French, badminton is international. Hardcoding French strings makes future internationalization painful.

**How to avoid:**
- Use i18n library (react-i18next, expo-localization) from start
- Even if only French initially, externalize strings for easy addition of English/other languages
- API may return French-only data (tournament names, club names) - keep separate from UI strings

**Phase to address:**
Phase 1 (Foundation) - i18n architecture easier to build early than retrofit.

---

### Pitfall 14: Testing Only with Personal License Data

**What goes wrong:**
Developers test only with their own license numbers, missing edge cases: players without rankings, junior players, multiple club affiliations, retired licenses.

**How to avoid:**
- Create test accounts across player categories using apitest.ffbad.org
- Test with various license types, rankings, and tournament histories
- Coordinate with FFBaD for test data access
- Test empty states (no matches, no ranking)

**Phase to address:**
Throughout all phases - Testing strategy, but particularly important in Phase 2 (Core Features).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| AsyncStorage for credentials | Simple implementation | Major security vulnerability | Never - use SecureStore |
| Single cache TTL for all data | Easy to implement | Stale rankings, excessive API calls | Never - data has different freshness |
| No schema validation | Faster development | Runtime crashes on API changes | Never for production |
| Enabling HTTP globally | Works during testing | Fails app store security review | Never for production builds |
| Skip offline support initially | Faster MVP | Poor UX in tournaments | Acceptable for MVP if architectural plan exists |
| No request queueing | Simpler code | Rate limit errors at scale | Acceptable for MVP, add before beta |
| Manual environment switching | Flexible during dev | Security risk in production | Only in debug builds, never production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FFBaD Authentication | Storing password in plaintext AsyncStorage | Use SecureStore for license+password after login |
| FFBaD Caching | Single cache TTL for all endpoints | Different TTLs: rankings 48h, matches 10-60min, profiles 24h |
| Environment Switching | Runtime switcher with all configs in production | Build-time separation: dev/test/prod as separate builds |
| UTF-8 Handling | Assuming platform handles encoding automatically | Explicit UTF-8 handling, test with accented characters |
| Rate Limiting | No retry logic | Exponential backoff with jitter, honor Retry-After |
| API Versioning | Ignore Change_Log.php | Monitor changelog, implement version detection |
| Response Parsing | Trust TypeScript types | Runtime schema validation with Zod |
| Large Rankings | Render all items | FlatList with virtualization, pagination |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering full rankings list | Slow scrolling, memory warnings | FlatList virtualization, pagination | >1000 players |
| No request deduplication | Multiple identical API calls | Cache recent requests, use query library | Multiple screens load same data |
| Excessive cache reads | Slow app startup | Lazy load cached data, index by key | >100MB cached data |
| No image caching | Repeated downloads of player photos | Use cached image component | When viewing rankings/profiles |
| Synchronous storage reads | UI freezes | Async reads with loading states | >10MB AsyncStorage |
| Heavy computation on main thread | UI jank, freezes | Move ranking calculations to background | Complex ranking filters |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Credentials in source code | Unauthorized API access, account compromise | SecureStore only, never commit credentials |
| HTTP in production | Man-in-the-middle attacks, data interception | HTTPS-only, enforce in build config |
| Missing certificate pinning | API spoofing | Consider certificate pinning for sensitive operations |
| Credentials in logs | Exposure in crash reports | Sanitize logs, never log passwords/tokens |
| Global HTTP exception | All traffic unencrypted | HTTPS enforcement, no global exceptions |
| Test credentials in prod build | Unauthorized access to test environment | Separate builds, build-time environment injection |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Generic error messages | Confusion, frustration | Specific, actionable errors in French |
| No offline indicator | Users think app is broken | Clear offline badge, explain connectivity |
| No loading states | App feels frozen | Skeleton screens, spinners with context |
| No pull-to-refresh | Can't manually update rankings | Standard pull-to-refresh on all lists |
| No empty states | Blank screens confusing | Helpful messages for no data scenarios |
| No retry mechanism | Dead ends on errors | Retry buttons for network/server errors |
| Stale data without indicator | Users trust wrong information | "Last updated X minutes ago" timestamps |
| No search/filter on rankings | Endless scrolling to find player | Search by name/club, filter by category |

---

## "Looks Done But Isn't" Checklist

- [ ] **Authentication:** Works with test credentials - verify SecureStore encryption, not just AsyncStorage
- [ ] **Caching:** Data updates eventually - verify cache invalidation triggers work (app foreground, pull-to-refresh)
- [ ] **Offline Mode:** Cached data displays - verify queue operations sync when connection restored
- [ ] **Rankings:** Displays in test - verify performance with full production dataset (10,000+ players)
- [ ] **Error Handling:** Shows error message - verify all error types (401, 403, 404, 429, 500, network) have specific handling
- [ ] **Rate Limiting:** Works in testing - verify exponential backoff with concurrent users
- [ ] **UTF-8:** Displays accented characters - verify round-trip (API → storage → display → API) preserves encoding
- [ ] **Environment Config:** Switches between test/prod - verify production build contains only production endpoints
- [ ] **API Versioning:** Works with current API - verify graceful handling when API version changes
- [ ] **Logging:** Errors visible in dev - verify production logging (Sentry/similar) captures API errors without exposing credentials

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Credentials in AsyncStorage | MEDIUM | 1. Add SecureStore migration, 2. Force re-authentication, 3. Clear AsyncStorage credentials |
| No schema validation | HIGH | 1. Audit all API call sites, 2. Add Zod schemas per endpoint, 3. Test edge cases, 4. Add error boundaries |
| HTTP enabled globally | LOW | 1. Remove ATS exceptions, 2. Update build config, 3. Re-submit to app stores |
| Single cache TTL | MEDIUM | 1. Refactor cache layer with TTL per endpoint, 2. Clear existing cache, 3. Test invalidation |
| Poor FlatList performance | MEDIUM | 1. Add virtualization props, 2. Memoize components, 3. Implement pagination |
| No offline support | HIGH | 1. Architect offline layer, 2. Refactor API calls, 3. Add queue system, 4. Extensive testing |
| Environment leakage | MEDIUM | 1. Separate build configs, 2. Remove runtime switcher, 3. Re-release all versions |
| UTF-8 issues | LOW | 1. Fix Content-Type handling, 2. Test with accented characters, 3. Verify both platforms |
| No rate limiting handling | LOW | 1. Add exponential backoff to API client, 2. Handle 429 responses, 3. Test concurrent users |
| Missing error handling | MEDIUM | 1. Add error discrimination, 2. Create error UI components, 3. Update all API call sites |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Hardcoded credentials | Phase 1 (Foundation) | Decompile APK/IPA, verify no credentials in bundle |
| HTTP/HTTPS issues | Phase 1 (Foundation) | Test with production security settings enabled |
| Cache invalidation | Phase 2 (Core Features) | Monitor API calls, verify cache respects TTLs |
| Rate limiting | Phase 1 (Foundation) | Load test with concurrent users, verify backoff |
| Schema validation | Phase 1 (Foundation) | Send malformed responses, verify graceful handling |
| Environment leakage | Phase 1 (Foundation) | Inspect production build, verify single environment |
| UTF-8 encoding | Phase 1 (Foundation) | Test French names on both platforms |
| Offline support | Phase 2 (Core Features) | Disable network, verify core features work |
| FlatList performance | Phase 2 (Core Features) | Load 10k+ items, measure FPS and memory |
| API versioning | Phase 1 (Foundation) | Simulate API version change, verify detection |
| Error handling | Phase 1 (Foundation) | Trigger all error types, verify specific messages |
| Request logging | Phase 1 (Foundation) | Check production logs capture API context |
| i18n architecture | Phase 1 (Foundation) | Verify strings externalized, not hardcoded |
| Diverse test data | All phases | Test with various license types and edge cases |

---

## Sources

**React Native & API Integration:**
- [Networking · React Native](https://reactnative.dev/docs/network)
- [How to Integrate Third-Party APIs with React Native](https://www.linkedin.com/advice/1/what-best-ways-integrate-third-party-apis-react-yptrf)
- [React Native API Integration Tutorial: Complete Guide 2025](https://reactnativeexample.com/react-native-api-integration-tutorial-complete-guide-2025/)
- [10 Mistakes to Avoid When Developing React Native Apps](https://www.f22labs.com/blogs/10-mistakes-to-avoid-when-developing-react-native-apps/)

**Security & Authentication:**
- [REST API Security Best Practices (2026)](https://www.levo.ai/resources/blogs/rest-api-security-best-practices)
- [How To Secure API Access in Mobile Apps](https://curity.medium.com/how-to-secure-api-access-in-mobile-apps-a072d764ae46)
- [Expo SecureStore Documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [React Native Security](https://reactnative.dev/docs/security)
- [react-native-keychain](https://github.com/oblador/react-native-keychain)

**Caching & Offline:**
- [Caching Strategies in React Native](https://medium.com/@reactjsbd/caching-strategies-in-react-native-handling-offline-data-and-performance-on-android-devices-08901d6b0c7f)
- [Building Offline-First React Native Apps with React Query and TypeScript](https://www.whitespectre.com/ideas/how-to-build-offline-first-react-native-apps-with-react-query-and-typescript/)
- [What is Cache Invalidation? Strategies & Techniques](https://www.ioriver.io/terms/cache-invalidation)
- [react-native-offline](https://github.com/rgommezz/react-native-offline)

**Performance & Rate Limiting:**
- [React Native Retry Logic — Making Your App Network Resilient](https://hemanthkollanur.medium.com/react-native-retry-logic-making-your-app-network-resilient-5b5fe68c457d)
- [429 Too Many Requests: Strategies for API Throttling](https://www.useanvil.com/blog/engineering/throttling-and-consuming-apis-with-429-rate-limits/)
- [Large List Optimization Techniques with FlatList in React Native](https://gabrielvrl.medium.com/large-list-optimization-techniques-with-flatlist-in-react-native-ab7c651746a5)
- [React Native Performance Tips: Definitive Guide to FlatList](https://rafalnawojczyk.pl/blog/react-native/flatlist-performance)

**Validation & Type Safety:**
- [Ensuring Type Safety from API to UI with Schema Validation](https://leapcell.io/blog/ensuring-type-safety-from-api-to-ui-with-schema-validation)
- [How to Use Zod Schema Validation for a Type-Safe React App?](https://reliasoftware.com/blog/zod-schema-validation-react-tutorial)

**Environment & Configuration:**
- [API Environment & Version Management for Mobile Apps](https://ashutoshagarwal2014.medium.com/api-environment-version-management-for-mobile-apps-dev-staging-and-production-best-practices-474f37cc060d)
- [Switching App Environment at Runtime—A Counterargument](https://medium.com/kinandcartacreated/switching-app-environment-at-runtime-a-counterargument-3a798a421dcf)

**API Versioning:**
- [REST API Versioning: How to Version a REST API?](https://restfulapi.net/versioning/)
- [Versioning Best Practices in REST API Design](https://www.speakeasy.com/api-design/versioning)

**Encoding & Character Issues:**
- [React-Native appends "charset=utf-8" to HTTP call Content-Type](https://github.com/facebook/react-native/issues/14445)
- [Fetch adds charset=utf-8 on Android but not on iOS](https://github.com/facebook/react-native/issues/8237)

**FFBaD API:**
- [FFBaD API Change Log](https://api.ffbad.org/Change_Log.php)
- [FFBaD API Test Environment](https://apitest.ffbad.org/)
- [FFBaD API Production](https://api.ffbad.org/)

**Sports Data & Real-time Sync:**
- [3 fundamentals for building realtime updates in sports, media, and entertainment apps](https://ably.com/blog/building-realtime-updates-in-sports-media-and-entertainment-apps)
- [Sports Data API Integration Guide](https://sportsdata.io/developers/integration-guide)

---

*Pitfalls research for: BadTracker - React Native mobile app consuming FFBaD API*
*Researched: 2026-02-16*
