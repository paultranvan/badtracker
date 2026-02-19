# Phase 5: Ranking Visualization - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual line charts showing CPPH ranking/points evolution over time, plus milestone markers showing when rank changed. This is the key differentiator from the FFBaD official app. Dashboard ranking cards (Phase 3) navigate here on tap. Charts must handle 52+ weeks of data smoothly.

</domain>

<decisions>
## Implementation Decisions

### Milestone timeline
- Milestone markers displayed directly on the chart line (dots/pins at the exact point rank changed)
- Markers are non-interactive — no tap action, information is visible on the marker itself
- Each marker shows the new rank label reached (e.g., "P10"), not the full transition
- Show markers for both promotions AND demotions — full picture of rank changes

### Multi-discipline view
- All disciplines overlaid on the same chart as different colored lines
- Tappable legend to toggle individual discipline lines on/off
- NC (unranked) disciplines shown as a flat line at 0
- Milestone markers appear for all visible disciplines, color-coded to match their respective line

### Claude's Discretion
- Chart appearance: line style, colors per discipline, axis labels, grid lines, data point density
- Chart interactions: zoom, pan, tap data point for value tooltip, time range selection
- Chart library selection (react-native-chart-kit, victory-native, react-native-skia, etc.)
- Loading states and animation when chart renders
- How rank boundary lines (horizontal dotted lines showing P12/P11/P10 thresholds) are handled, if at all
- Time axis formatting and granularity

</decisions>

<specifics>
## Specific Ideas

- The overlaid multi-discipline chart lets players quickly see which discipline is progressing fastest
- Tappable legend is important — competitive players often focus on one discipline and want to isolate it
- Showing rank drops alongside promotions gives an honest view of progression — players respect that

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-ranking-visualization*
*Context gathered: 2026-02-19*
