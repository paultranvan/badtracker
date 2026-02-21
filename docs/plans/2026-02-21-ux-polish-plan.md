# UX Visual Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the app from a functional prototype into a polished modern sport app by introducing NativeWind, a shared component library, and screen-by-screen visual upgrades.

**Architecture:** NativeWind v4 replaces all `StyleSheet.create()` blocks with Tailwind utility classes. A shared theme in `tailwind.config.ts` centralizes colors, typography, and spacing. Reusable components (`Card`, `Badge`, `StatCard`, `PlayerRow`, `MatchCard`) are extracted into `src/components/`. Each screen is migrated individually — no layout changes, purely visual.

**Tech Stack:** NativeWind v4, TailwindCSS, expo-linear-gradient (already installed), react-native-reanimated (already installed)

**Important:** No test framework is configured. Skip TDD steps. Verify changes visually on the emulator (`emulator-5554`). After each task, run `npx tsc --noEmit` to ensure type safety.

---

## Phase 1: NativeWind Foundation

### Task 1: Install NativeWind and configure build tooling

**Files:**
- Modify: `package.json`
- Modify: `babel.config.js`
- Modify: `metro.config.js`
- Modify: `tsconfig.json`
- Create: `global.css`
- Create: `tailwind.config.ts`
- Create: `nativewind-env.d.ts`

**Step 1: Install NativeWind + TailwindCSS**

```bash
npx expo install nativewind tailwindcss
```

**Step 2: Create `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1e40af',
          light: '#93c5fd',
          bg: '#eff6ff',
          surface: '#f0f7ff',
        },
        win: {
          DEFAULT: '#16a34a',
          bg: '#dcfce7',
        },
        loss: {
          DEFAULT: '#dc2626',
          bg: '#fee2e2',
        },
        singles: '#3b82f6',
        doubles: '#10b981',
        mixed: '#f59e0b',
        surface: '#f8fafc',
        muted: '#64748b',
      },
      fontSize: {
        display: ['28px', { lineHeight: '34px', fontWeight: '700' }],
        title: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '22px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**Step 3: Create `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Update `babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-worklets/plugin', // Must be last
    ],
  };
};
```

**Step 5: Update `metro.config.js`**

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
  },
});

module.exports = withNativeWind(config, { input: './global.css' });
```

**Step 6: Create `nativewind-env.d.ts`**

```typescript
/// <reference types="nativewind/types" />
```

**Step 7: Update `tsconfig.json`** — add the NativeWind env reference

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["nativewind-env.d.ts"]
}
```

**Step 8: Import global.css in root layout**

Add to the top of `app/_layout.tsx`:

```typescript
import '../global.css';
```

**Step 9: Verify build compiles**

```bash
npx tsc --noEmit
```

Then restart the dev server and verify the app loads on the emulator.

**Step 10: Commit**

```bash
git add -A && git commit -m "feat: install NativeWind v4 and configure build tooling"
```

---

### Task 2: Create shared theme and reusable components

**Files:**
- Create: `src/components/Card.tsx`
- Create: `src/components/Badge.tsx`
- Create: `src/components/StatCard.tsx`
- Create: `src/components/SectionHeader.tsx`
- Create: `src/components/PlayerRow.tsx`
- Create: `src/components/MatchCard.tsx`
- Create: `src/components/index.ts` (barrel export)

**Step 1: Create `src/components/Card.tsx`**

Elevated surface with shadow and rounded corners.

```tsx
import { View } from 'react-native';
import type { ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <View
      className={`rounded-xl bg-white shadow-sm shadow-black/10 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
```

**Step 2: Create `src/components/Badge.tsx`**

Colored pill for win/loss/discipline.

```tsx
import { View, Text } from 'react-native';

type BadgeVariant = 'win' | 'loss' | 'unknown' | 'singles' | 'doubles' | 'mixed';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  win: { bg: 'bg-win-bg', text: 'text-win' },
  loss: { bg: 'bg-loss-bg', text: 'text-loss' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-500' },
  singles: { bg: 'bg-blue-100', text: 'text-singles' },
  doubles: { bg: 'bg-emerald-100', text: 'text-doubles' },
  mixed: { bg: 'bg-amber-100', text: 'text-mixed' },
};

export function Badge({ variant, label, size = 'md' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2.5 py-1';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-caption';

  return (
    <View className={`rounded-full ${bg} ${sizeClass}`}>
      <Text className={`${textSize} font-semibold ${text}`}>{label}</Text>
    </View>
  );
}
```

**Step 3: Create `src/components/StatCard.tsx`**

Hero number + label + optional icon for the dashboard stats row.

```tsx
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';

interface StatCardProps {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  highlight?: boolean;
}

export function StatCard({ value, label, icon, iconColor = '#1e40af', highlight }: StatCardProps) {
  return (
    <Card className={`flex-1 items-center py-4 px-2 ${highlight ? 'bg-primary-bg' : ''}`}>
      {icon && (
        <Ionicons name={icon} size={18} color={iconColor} style={{ marginBottom: 4 }} />
      )}
      <Text className="text-display text-primary-dark">{value}</Text>
      <Text className="text-[11px] text-muted mt-1 text-center">{label}</Text>
    </Card>
  );
}
```

**Step 4: Create `src/components/SectionHeader.tsx`**

Bold title with optional action link.

```tsx
import { View, Text, Pressable } from 'react-native';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-3 mt-1">
      <Text className="text-title text-gray-900">{title}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text className="text-body font-medium text-primary">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
```

**Step 5: Create `src/components/PlayerRow.tsx`**

Reusable player list item for search, bookmarks, and club leaderboard.

```tsx
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PlayerRowProps {
  name: string;
  club?: string;
  rank?: string;
  licence?: string;
  isBookmarked?: boolean;
  position?: number;
  isCurrentUser?: boolean;
  onPress?: () => void;
}

export function PlayerRow({
  name,
  club,
  rank,
  licence,
  isBookmarked,
  position,
  isCurrentUser,
  onPress,
}: PlayerRowProps) {
  return (
    <Pressable
      className={`flex-row items-center px-4 py-3 ${isCurrentUser ? 'bg-primary-bg border-l-[3px] border-l-primary' : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      {position != null && (
        <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Text className="text-caption font-bold text-gray-600">
            {position}
          </Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-body font-semibold text-gray-900" numberOfLines={1}>
          {name}
        </Text>
        {club && (
          <Text className="text-caption text-muted mt-0.5" numberOfLines={1}>
            {club}
          </Text>
        )}
        {licence && !club && (
          <Text className="text-[11px] text-gray-400 mt-0.5">{licence}</Text>
        )}
      </View>
      {rank && (
        <View className="bg-gray-100 rounded-md px-2 py-1 mr-2">
          <Text className="text-caption font-bold text-gray-700">{rank}</Text>
        </View>
      )}
      {isBookmarked && (
        <Ionicons name="star" size={16} color="#f59e0b" style={{ marginRight: 4 }} />
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </Pressable>
  );
}
```

**Step 6: Create `src/components/MatchCard.tsx`**

Match result card with colored left border for dashboard and matches.

```tsx
import { View, Text, Pressable } from 'react-native';
import { Badge } from './Badge';

interface MatchCardProps {
  isWin: boolean | null;
  badgeLabel: string;
  opponent: string;
  event?: string;
  score?: string;
  discipline?: string;
  onPress?: () => void;
}

export function MatchCard({
  isWin,
  badgeLabel,
  opponent,
  event,
  score,
  onPress,
}: MatchCardProps) {
  const borderColor = isWin === true
    ? 'border-l-win'
    : isWin === false
      ? 'border-l-loss'
      : 'border-l-gray-300';

  const variant = isWin === true ? 'win' : isWin === false ? 'loss' : 'unknown';

  return (
    <Pressable
      className={`flex-row items-center py-3 border-l-[3px] ${borderColor} pl-3 border-b border-b-gray-100`}
      style={({ pressed }) => ({ opacity: pressed && onPress ? 0.7 : 1 })}
      onPress={onPress}
    >
      <Badge variant={variant} label={badgeLabel} />
      <View className="flex-1 ml-3">
        <Text className="text-body font-medium text-gray-900" numberOfLines={1}>
          {opponent}
        </Text>
        {event && (
          <Text className="text-[12px] text-muted mt-0.5" numberOfLines={1}>
            {event}
          </Text>
        )}
      </View>
      {score && (
        <Text
          className={`text-body font-semibold ml-2 ${
            isWin === true ? 'text-win' : isWin === false ? 'text-loss' : 'text-muted'
          }`}
        >
          {score}
        </Text>
      )}
    </Pressable>
  );
}
```

**Step 7: Create barrel export `src/components/index.ts`**

```typescript
export { Card } from './Card';
export { Badge } from './Badge';
export { StatCard } from './StatCard';
export { SectionHeader } from './SectionHeader';
export { PlayerRow } from './PlayerRow';
export { MatchCard } from './MatchCard';
```

**Step 8: Verify types**

```bash
npx tsc --noEmit
```

**Step 9: Commit**

```bash
git add src/components/ && git commit -m "feat: add shared UI component library (Card, Badge, StatCard, PlayerRow, MatchCard)"
```

---

## Phase 2: Screen-by-Screen Migration

### Task 3: Migrate Dashboard (Home tab)

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx`

**Goal:** Replace all `StyleSheet.create()` styles with NativeWind classes and use the new shared components.

**Step 1: Rewrite the dashboard screen**

Replace the entire file content. Key changes:
- Use `StatCard` for the 3 stats (with icons: `trophy-outline`, `tennisball-outline` or `fitness-outline`, `analytics-outline`)
- Use `SectionHeader` for "Rankings" and "Recent Matches"
- Ranking cards: add discipline-colored top border using `border-t-[3px]` with inline color
- Use `MatchCard` for recent matches
- Remove the entire `StyleSheet.create()` block
- All layout via `className` props

Key class patterns:
- Container: `className="flex-1 bg-white"`
- Content: `className="p-4 pb-8"`
- Greeting: `className="text-title text-gray-700 mb-4"`
- Stats row: `className="flex-row gap-2 mb-5"`
- Ranking row: `className="flex-row gap-2 mb-5"`
- Ranking card: `Card` component with `className="flex-1 items-center p-3 border-t-[3px]"` and inline `style={{ borderTopColor }}` for discipline color
- Best card: additional `shadow-md` + `border-primary` classes

For the ranking card discipline colors, use inline `style` for the top border color since NativeWind doesn't know about `singles`/`doubles`/`mixed` as border colors:
```tsx
const disciplineColors = { simple: '#3b82f6', double: '#10b981', mixte: '#f59e0b' };
```

**Step 2: Verify on emulator**

```bash
npx tsc --noEmit
```

Then visually check the Home tab on the emulator.

**Step 3: Commit**

```bash
git add app/(app)/(tabs)/index.tsx && git commit -m "feat: migrate dashboard to NativeWind with shared components"
```

---

### Task 4: Migrate Settings screens

**Files:**
- Modify: `app/(app)/(tabs)/settings/index.tsx`
- Modify: `app/(app)/(tabs)/settings/bookmarks.tsx`

**Goal:** Fix the double "Settings" title, group items into sections, polish the layout.

**Step 1: Rewrite settings main screen**

Key changes:
- Remove the inner "Settings" heading (the tab header already shows the title)
- Group rows into sections: "Preferences" (language), "Data" (bookmarks, clear cache), "Account" (log out)
- Each section: `SectionHeader` with muted title
- Each row: `className="flex-row items-center py-4 px-4 border-b border-gray-100"`
- Language toggle: pill-style segmented control with `rounded-full` buttons
- Log out: text button at bottom, red text, no pink block

```tsx
// Language toggle segment example:
<View className="flex-row bg-gray-100 rounded-full p-1">
  <Pressable
    className={`flex-1 py-2 rounded-full items-center ${lang === 'fr' ? 'bg-primary' : ''}`}
    onPress={() => changeLanguage('fr')}
  >
    <Text className={`text-body font-medium ${lang === 'fr' ? 'text-white' : 'text-gray-600'}`}>
      Fran\u00E7ais
    </Text>
  </Pressable>
  {/* Same for English */}
</View>
```

**Step 2: Rewrite bookmarks screen**

Use `PlayerRow` component for each bookmark. Show rank badges per discipline in a row below the name.

**Step 3: Verify**

```bash
npx tsc --noEmit
```

Visual check on emulator.

**Step 4: Commit**

```bash
git add app/(app)/(tabs)/settings/ && git commit -m "feat: migrate settings & bookmarks to NativeWind"
```

---

### Task 5: Migrate Search tab + Player Profile

**Files:**
- Modify: `app/(app)/(tabs)/search.tsx`
- Modify: `app/(app)/player/[licence].tsx`

**Step 1: Rewrite search screen**

Key changes:
- Search input: pill-shaped with search icon inside (`Ionicons search` left-aligned)
  ```tsx
  <View className="flex-row items-center bg-gray-50 rounded-full px-4 py-2 mx-4 mt-2 border border-gray-200">
    <Ionicons name="search" size={18} color="#9ca3af" />
    <TextInput className="flex-1 ml-2 text-body" ... />
  </View>
  ```
- Empty state: show bookmarked players as quick-access `PlayerRow` cards under "Quick Access" section header
- Results: use `PlayerRow` component with name, club, bookmark star, chevron
- Offline state: `Card` with cloud icon and message

**Step 2: Rewrite player profile**

Key changes:
- Header: larger name (`text-[24px] font-bold`), tappable club link in primary color, licence in `text-caption text-gray-400`
- Bookmark toggle: animated fill/outline star, amber when active
- Ranking cards: same discipline-colored top border as dashboard, using `Card` component
- Add "View ranking evolution" link below ranking cards:
  ```tsx
  <Pressable className="flex-row items-center justify-center py-3 mt-2" onPress={...}>
    <Ionicons name="trending-up" size={18} color="#2563eb" />
    <Text className="text-body font-medium text-primary ml-2">View ranking evolution</Text>
  </Pressable>
  ```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

Visual check search + player profile on emulator.

**Step 4: Commit**

```bash
git add app/(app)/(tabs)/search.tsx app/(app)/player/ && git commit -m "feat: migrate search & player profile to NativeWind"
```

---

### Task 6: Migrate Matches tab

**Files:**
- Modify: `app/(app)/(tabs)/matches.tsx`

This is the most complex screen. Preserve the animated collapsible header behavior.

**Step 1: Rewrite matches screen**

Key changes:
- Stats header: keep `useAnimatedStyle` for collapse animation, but restyle internals:
  - Win rate as a large bold number (`text-[36px] font-bold text-primary`)
  - Horizontal progress bar: green/red split with rounded ends
  - Win/loss counts below the bar
- Season selector: pill-style chips with `rounded-full`, active chip filled primary
- Tournament section headers: `className="bg-slate-50 px-4 py-2.5 border-l-[3px] border-l-primary"` with bold name + muted date
- Match rows: use colored left border (win green, loss red), larger W/L circular badge, discipline pill badge, bold colored points
- Keep the accordion expansion with Reanimated for set scores detail

Key pattern for match rows:
```tsx
<View className={`flex-row items-start py-3 px-3 border-l-[3px] ${borderColor} border-b border-b-gray-50`}>
  <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${badgeBg}`}>
    <Text className="text-caption font-bold text-white">{badgeText}</Text>
  </View>
  {/* ... match content ... */}
</View>
```

Badge backgrounds for the circular W/L badge:
- Win: `bg-win` (filled green, white text)
- Loss: `bg-loss` (filled red, white text)
- Unknown: `bg-gray-300` (gray, white text)

**Step 2: Verify**

```bash
npx tsc --noEmit
```

Visual check on emulator — test scrolling, collapsing header, accordion expansion.

**Step 3: Commit**

```bash
git add app/(app)/(tabs)/matches.tsx && git commit -m "feat: migrate matches tab to NativeWind"
```

---

### Task 7: Migrate Club tab + Club detail

**Files:**
- Modify: `app/(app)/(tabs)/club.tsx`
- Modify: `app/(app)/club/[clubId].tsx`

**Step 1: Rewrite club tab**

Key changes:
- Club info card: `Card` with primary blue header strip
  ```tsx
  <Card className="mx-4 mt-4 overflow-hidden">
    <View className="h-1.5 bg-primary" />
    <View className="p-4">
      {/* Club name, address, contacts */}
    </View>
  </Card>
  ```
- Contact rows: proper tappable list items with icon + text + external link indicator
- Leaderboard: use `PlayerRow` for each member, with position circle badge
- Current user: `isCurrentUser` prop on `PlayerRow` for blue highlight
- Empty state ("Member listing not available"): centered icon + softer message text
- Club search: pill-shaped input matching the search tab style

**Step 2: Rewrite club detail `[clubId].tsx`**

Same treatment as the club tab but simpler (no search). Use `PlayerRow` for leaderboard.

**Step 3: Verify**

```bash
npx tsc --noEmit
```

Visual check Club tab and club detail on emulator.

**Step 4: Commit**

```bash
git add app/(app)/(tabs)/club.tsx app/(app)/club/ && git commit -m "feat: migrate club screens to NativeWind"
```

---

### Task 8: Migrate Sign-in screen

**Files:**
- Modify: `app/sign-in.tsx`

**Step 1: Rewrite sign-in**

Key changes:
- Center the form vertically with proper spacing
- App title: large bold text with primary color accent
- Subtitle: muted text below
- Inputs: `className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-body"` with error state `border-loss`
- Remember me: proper row layout with label and styled Switch
- Login button: full-width, primary blue with `rounded-xl`, `shadow-sm`
- Error message: `Card` with red left border and error text

**Step 2: Verify**

```bash
npx tsc --noEmit
```

Visual check the sign-in screen (log out first to see it).

**Step 3: Commit**

```bash
git add app/sign-in.tsx && git commit -m "feat: migrate sign-in screen to NativeWind"
```

---

### Task 9: Migrate Ranking Chart screen

**Files:**
- Modify: `app/(app)/ranking-chart.tsx`

**Step 1: Restyle ranking chart**

Key changes:
- Wrap the chart in a `Card` with padding
- Legend: discipline dots with `rounded-full` color badges, clearer toggle states (filled=visible, outlined=hidden)
- Title/subtitle: use `text-title` and `text-caption text-muted`
- Tooltip: `Card` with shadow and discipline-colored accent
- Keep all `react-native-gifted-charts` props as-is — only restyle the surrounding UI

**Step 2: Verify**

```bash
npx tsc --noEmit
```

Visual check chart screen on emulator.

**Step 3: Commit**

```bash
git add app/(app)/ranking-chart.tsx && git commit -m "feat: migrate ranking chart to NativeWind"
```

---

## Phase 3: Global Polish

### Task 10: Polish tab bar, loading states, and root layout

**Files:**
- Modify: `app/(app)/(tabs)/_layout.tsx`
- Modify: `app/_layout.tsx`

**Step 1: Style tab bar**

Add tab bar styling in `screenOptions`:
```tsx
<Tabs
  screenOptions={{
    tabBarActiveTintColor: '#2563eb',
    tabBarInactiveTintColor: '#9ca3af',
    tabBarStyle: {
      borderTopWidth: 1,
      borderTopColor: '#f3f4f6',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    headerStyle: {
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
    },
    headerTitleStyle: {
      fontWeight: '600',
      fontSize: 18,
    },
  }}
>
```

**Step 2: Polish root layout loading state**

Replace the plain `ActivityIndicator` in `AuthGate` with a branded loading view:
```tsx
<View className="flex-1 items-center justify-center bg-white">
  <Text className="text-display text-primary mb-4">BadTracker</Text>
  <ActivityIndicator size="large" color="#2563eb" />
</View>
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

Visual check tab bar shadow and loading states.

**Step 4: Commit**

```bash
git add app/_layout.tsx app/(app)/(tabs)/_layout.tsx && git commit -m "feat: polish tab bar and loading states"
```

---

### Task 11: Clean up — remove unused StyleSheet imports

**Files:**
- All migrated screen files

**Step 1: Scan and remove**

Go through each migrated file and ensure:
- `StyleSheet` import is removed (unless still needed for Reanimated animated styles)
- No leftover `const styles = StyleSheet.create(...)` blocks
- All `style={styles.xxx}` replaced with `className="..."`

Exception: `matches.tsx` may still need `StyleSheet` for `useAnimatedStyle` references — that's fine, keep it where needed.

**Step 2: Final type check**

```bash
npx tsc --noEmit
```

**Step 3: Visual regression check**

Walk through every screen on the emulator:
1. Home tab — stats, rankings, recent matches
2. Matches tab — scroll, collapse header, expand a match
3. Search tab — type a search, view results
4. Club tab — club info, leaderboard
5. Settings — language toggle, bookmarks, log out button
6. Player profile (from search)
7. Ranking chart (from dashboard)

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: clean up unused StyleSheet imports after NativeWind migration"
```

---

## Summary

| Task | Screen/Area | Scope |
|------|-------------|-------|
| 1 | Foundation | NativeWind install + config |
| 2 | Components | Shared component library |
| 3 | Dashboard | Home tab migration |
| 4 | Settings | Settings + bookmarks migration |
| 5 | Search | Search + player profile migration |
| 6 | Matches | Match history migration |
| 7 | Club | Club tab + club detail migration |
| 8 | Sign-in | Login screen migration |
| 9 | Chart | Ranking evolution chart migration |
| 10 | Global | Tab bar, loading, root layout |
| 11 | Cleanup | Remove unused StyleSheets, visual QA |

Each task is independently committable and verifiable. Tasks 3-9 can be done in any order after tasks 1-2.
