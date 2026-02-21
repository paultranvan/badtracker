# UX Visual Polish Design — 2026-02-21

Visual polish pass for the entire app. Keep current layouts, upgrade the look and feel to a modern sport app aesthetic (Strava/FotMob-inspired). Introduce NativeWind (Tailwind for RN) and a small shared component library.

## Approach

NativeWind v4 + shared theme tokens + extracted reusable components. Convert screens from `StyleSheet.create()` to Tailwind utility classes. Screen-by-screen migration, no layout changes.

## 1. Foundation — NativeWind + Theme

### Setup
- Install `nativewind`, `tailwindcss`, `prettier-plugin-tailwindcss`
- Create `tailwind.config.ts` with custom tokens
- Create `global.css` with Tailwind directives
- Configure `metro.config.js` with `withNativeWind`
- Configure `babel.config.js` with NativeWind preset

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#1e40af` to `#3b82f6` | Primary actions, gradients |
| `win` | `#16a34a` | Win badges, positive stats |
| `loss` | `#dc2626` | Loss badges, negative stats |
| `singles` | `#3b82f6` | Singles discipline color |
| `doubles` | `#10b981` | Doubles discipline color |
| `mixed` | `#f59e0b` | Mixed discipline color |
| `surface` | `#f8fafc` | Card backgrounds |
| `muted` | `#64748b` | Secondary text |
| `bg` | `#ffffff` | Screen background |

### Typography Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `text-display` | 28px | Bold | Hero numbers (71%, D8) |
| `text-title` | 20px | Semibold | Section headers |
| `text-body` | 15px | Regular | Body text |
| `text-caption` | 12px | Medium | Labels, metadata |

### Shared Components

- **Card** — elevated surface, subtle shadow, rounded corners
- **Badge** — colored pill for win/loss/discipline
- **StatCard** — hero number + label + optional icon
- **SectionHeader** — bold title with optional action link
- **PlayerRow** — name, club, rank badge, bookmark star, chevron (reusable across search, club, bookmarks)
- **MatchCard** — colored left border, W/L badge, opponent, points, expandable detail

### Shadows & Depth
- Cards: `shadow-sm` (iOS shadow + Android elevation)
- Best/active ranking card: `shadow-md` with discipline-colored border
- Tab bar: subtle top shadow

## 2. Dashboard (Home)

### Hero Header
- Compact profile: bold name + club subtitle in muted text
- Initials avatar circle ("PD") in primary blue

### Stats Row
- Each StatCard gets subtle shadow + distinct icon:
  - Trophy + "D8" + "Best ranking" (gold accent)
  - Shuttlecock + "19" + "Matches played"
  - Target + "71%" + circular progress ring
- Best ranking card: light blue gradient background

### Ranking Cards
- Keep 3-column layout
- Discipline-colored top border (blue/green/amber)
- Larger, bolder rank name
- Progress bar for points-to-next-rank
- Best card: subtle glow/shadow in discipline color

### Recent Matches
- Colored left border (green=win, red=loss) instead of tiny badge
- Bolder point changes with color
- "View all matches" as a proper button

## 3. Matches Tab

### Tournament Section Headers
- Darker background (`bg-slate-100`), bold text, left accent border
- Date right-aligned with more contrast

### Match Rows
- 3px colored left border strip (green/red/gray)
- Larger circular W/L badge (filled, white text)
- Discipline badge (S/D/M pill) next to round info
- Bold colored points change, right-aligned
- Smoother accordion expansion with Reanimated

### Season Selector
- Pill-style selector, active season filled in primary blue

### Stats Header
- Win rate as horizontal progress bar (green/red split)
- Large bold percentage number

## 4. Search + Player Profile

### Search Tab
- Search input: search icon (left), rounded pill shape, subtle shadow
- Empty state: show bookmarked players as quick-access cards
- Results: `PlayerRow` component with name, club, best rank badge, bookmark star, chevron

### Player Profile
- Larger name, tappable club link, caption-style licence
- Animated bookmark toggle (filled amber vs outline)
- Ranking cards: discipline-colored top border (same as dashboard)
- "View ranking evolution" link below rankings
- "View matches" section for the player's match history

## 5. Club Tab

- Club info card: primary blue header strip at top
- Contact links: proper tappable rows with icons
- Leaderboard: `PlayerRow` component, position in circle badge
- Current user row: light blue highlight + "You" badge
- Empty state: proper icon + softer messaging

## 6. Settings

- Remove duplicate "Settings" title
- Group items: "Preferences", "Data", "Account" section headers
- Each row: icon + label + chevron/toggle
- Language: proper segmented control with animation
- Log out: text button at bottom (not large pink block)

## 7. Global Polish

- **Tab bar**: subtle top shadow, active icon gets primary fill
- **Loading**: branded shimmer/skeleton placeholders
- **Pull-to-refresh**: primary blue spinner
- **Screen transitions**: smooth push/pop (expo-router defaults)
- **Error states**: consistent card with icon + message + retry button
