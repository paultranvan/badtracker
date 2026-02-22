# Ranking Chart Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the ranking evolution chart visually polished — smooth Bezier curves, visible rank-change indicators with labels, and working X-axis date labels.

**Architecture:** Three targeted edits in the chart rendering logic of `ranking-chart.tsx`. The data layer (`rankingChart.ts`, `useRankingEvolution.ts`) already provides milestones and date labels — no changes needed there.

**Tech Stack:** react-native-gifted-charts (LineChart with `dataSet` multi-line mode), NativeWind for styling.

---

### Task 1: Remove step chart and enable smooth Bezier curves

**Files:**
- Modify: `app/(app)/ranking-chart.tsx:192-195` (LineChart props)
- Modify: `app/(app)/ranking-chart.tsx:81-89` (dataset construction)

**Step 1: Remove `stepChart` prop from LineChart**

In the `<LineChart>` JSX (line ~195), delete the `stepChart` prop entirely.

Before:
```tsx
<LineChart
  dataSet={dataSets}
  height={280}
  stepChart
```

After:
```tsx
<LineChart
  dataSet={dataSets}
  height={280}
```

**Step 2: Add `curved` config to each dataset**

In the `dataSets` useMemo (line ~81-89), add curve properties to the returned dataset object:

Before:
```tsx
return {
  data,
  color: d.color,
  thickness: 2,
  hideDataPoints: true,
  dataPointsColor: d.color,
  startFillColor: `${d.color}15`,
  endFillColor: `${d.color}05`,
};
```

After:
```tsx
return {
  data,
  color: d.color,
  thickness: 2,
  hideDataPoints: true,
  dataPointsColor: d.color,
  startFillColor: `${d.color}15`,
  endFillColor: `${d.color}05`,
  curved: true,
  curvature: 0.15,
};
```

**Step 3: Verify on emulator**

Run: `npx expo start` and navigate to the ranking chart screen.
Expected: Lines should be smooth curves instead of staircase steps.

**Step 4: Commit**

```bash
git add app/(app)/ranking-chart.tsx
git commit -m "feat: switch ranking chart from step to smooth Bezier curves"
```

---

### Task 2: Add rank change milestone indicators with labels

**Files:**
- Modify: `app/(app)/ranking-chart.tsx:61-78` (data point mapping in dataSets useMemo)

**Step 1: Update the milestone data point rendering**

Replace the existing milestone block (lines ~67-76) with enhanced rendering that includes a label showing the new rank:

Before:
```tsx
if (point.isMilestone) {
  item.showDataPoint = true;
  item.dataPointRadius = 7;
  item.customDataPoint = () => (
    <View
      className="w-3.5 h-3.5 rounded-full border-2 border-white"
      style={{ backgroundColor: d.color }}
    />
  );
}
```

After:
```tsx
if (point.isMilestone) {
  item.showDataPoint = true;
  item.dataPointRadius = 6;
  item.dataPointsHeight = 14;
  item.dataPointsWidth = 14;
  item.customDataPoint = () => (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: d.color,
        borderWidth: 2.5,
        borderColor: '#ffffff',
      }}
    />
  );
  item.dataPointLabelComponent = () => (
    <View
      style={{
        backgroundColor: d.color,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '700' }}>
        {point.rank}
      </Text>
    </View>
  );
  item.dataPointLabelShiftY = -24;
  item.dataPointLabelShiftX = -10;
}
```

Make sure `Text` is imported from `react-native` (already is at line 4).

**Step 2: Verify on emulator**

Expected: At each rank change, a colored dot appears on the curve with a small colored tag above showing the new rank (e.g., "D9", "P10").

**Step 3: Commit**

```bash
git add app/(app)/ranking-chart.tsx
git commit -m "feat: add rank change milestone dots with rank labels on chart"
```

---

### Task 3: Fix X-axis date labels

**Files:**
- Modify: `app/(app)/ranking-chart.tsx:61-65` (label thinning in data point mapping)
- Modify: `app/(app)/ranking-chart.tsx:192-210` (LineChart props for label styling)

**Step 1: Thin out X-axis labels to prevent overlap**

In the `dataSets` useMemo, before the `d.points.map(...)` call, calculate the label interval. Then inside the map, only set `label` on every Nth point:

Before:
```tsx
const data = d.points.map((point) => {
  const item: Record<string, unknown> = {
    value: point.value - yAxisOffset,
    label: point.label,
  };
```

After:
```tsx
const labelInterval = Math.max(1, Math.ceil(d.points.length / 6));
const data = d.points.map((point, idx) => {
  const item: Record<string, unknown> = {
    value: point.value - yAxisOffset,
    label: idx % labelInterval === 0 ? point.label : '',
  };
```

**Step 2: Improve X-axis label styling on the LineChart**

Update the `xAxisLabelTextStyle` prop on `<LineChart>`:

Before:
```tsx
xAxisLabelTextStyle={{ color: '#6b7280', fontSize: 10 }}
```

After:
```tsx
xAxisLabelTextStyle={{ color: '#6b7280', fontSize: 9, width: 50, textAlign: 'center' }}
labelsExtraHeight={20}
```

**Step 3: Verify on emulator**

Expected: ~6 evenly spaced date labels visible on the X-axis without overlapping. Labels like "Sep '25", "Jan '26".

**Step 4: Commit**

```bash
git add app/(app)/ranking-chart.tsx
git commit -m "fix: thin out and style X-axis date labels on ranking chart"
```

---

### Task 4: Final verification and TypeScript check

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Visual verification on emulator**

Check all three improvements together:
- Smooth curves (not steps)
- Milestone dots with rank labels at each rank change
- Clean, readable X-axis date labels

**Step 3: Test edge cases**

- Toggle disciplines on/off — chart should re-render correctly
- Pull to refresh — chart should reload with same improvements
- If only one discipline has data — curve + milestones still work
