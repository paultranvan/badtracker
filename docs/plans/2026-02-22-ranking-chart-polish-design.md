# Ranking Chart Polish Design

## Goal
Improve the ranking evolution chart with three visual fixes: smooth curves, rank change indicators, and working X-axis labels.

## Changes

### 1. Smooth Bezier curves
- Remove `stepChart` prop from `<LineChart>`
- Add `curved: true`, `curvature: 0.2`, `curveType: CurveType.CUBIC` to each dataset in `dataSets`
- Lines will smoothly interpolate between rank data points instead of hard steps

### 2. Rank change indicators (colored dot + label)
- For milestone points (`isMilestone === true`):
  - `showDataPoint: true`, `dataPointRadius: 5`
  - `customDataPoint`: colored circle (discipline color) with white border
  - `dataPointLabelComponent`: small tag showing the new rank (e.g., "D9") positioned above the dot
  - `dataPointLabelShiftY: -20` to offset label above point
- Non-milestone points: data points stay hidden (existing behavior)
- Uses react-native-gifted-charts per-item customization (no overlay hack)

### 3. Fix X-axis date labels
- Thin out labels: show only ~6 labels across the axis (every Nth point, N = ceil(points.length / 6))
- Set empty string for intermediate points' `label` field
- Add `xAxisLabelTextStyle` with `fontSize: 9`, `color: '#6b7280'`
- Add `labelsExtraHeight: 20` to give labels room below the chart

## Files changed
- `app/(app)/ranking-chart.tsx` — all three fixes are in the chart rendering logic

## Not changed
- `src/utils/rankingChart.ts` — data transformation is fine as-is (milestones already detected)
- `src/hooks/useRankingEvolution.ts` — data fetching is fine as-is
