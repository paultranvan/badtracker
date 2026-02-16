# Phase 1: Foundation & Security - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure, production-ready API client with authentication for FFBaD. User can log in with license number + password, session persists across restarts, credentials stored securely, and user can log out from settings. API client enforces HTTPS, handles rate limiting, and validates responses.

</domain>

<decisions>
## Implementation Decisions

### Login flow
- Login screen has 3 fields: license number, password, "remember me" toggle
- No client-side license number format validation — let the FFBaD API handle it
- French is the default language, with English as an option (FR/EN toggle)
- "Remember me" defaults to ON (most users want persistent login)

### Session lifecycle
- With "remember me" ON: silent auto-login on app restart — go straight to dashboard, re-authenticate in background, show login only if it fails
- With "remember me" OFF: session persists until app is force-closed, but credentials are not stored across restarts
- Token expiry during use: silently refresh in background using stored credentials — only redirect to login if refresh fails
- No maximum session duration — stay logged in indefinitely as long as credentials work

### Error presentation
- Per-action errors (not persistent banners) — show error only when a specific action fails
- Distinguish network errors from FFBaD server errors: "Pas de connexion internet" vs "Le serveur FFBaD est indisponible"
- Auto-retry silently 2-3 times on failure, then show manual "Réessayer" button if still failing
- Rate limiting is hidden from the user — silent exponential backoff, user just sees slightly slower loading

### Logout experience
- Logout button lives in settings/profile screen (not in navigation drawer)
- After logout: redirect to login screen
- On logout: clear credentials from secure storage but keep cached data (matches, rankings) for faster reload if same user re-logs in

### Claude's Discretion
- Wrong credentials error feedback style (inline vs toast)
- Logout confirmation dialog (yes/no)
- Loading states and transitions during login
- Exact retry timing and backoff strategy
- Splash/loading screen design during auto-login

</decisions>

<specifics>
## Specific Ideas

- App targets French FFBaD players — all default text in French, but include English as an alternative
- Login should feel fast and frictionless — silent background auth is preferred over visible loading states
- Error messages should be in the user's selected language (FR/EN)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-security*
*Context gathered: 2026-02-16*
