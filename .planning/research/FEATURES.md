# Feature Research

**Domain:** Badminton stats tracker (federation-based)
**Researched:** 2026-02-16
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Player search (by name/license) | Standard in all federation apps - FFBaD official app has this | LOW | FFBaD API provides search endpoints |
| Match history display | Core value proposition - users want to see past results | LOW | List view with filters by date, discipline, opponent |
| Ranking display (current) | Users check app primarily to see "where am I now" | LOW | Single API call, simple display |
| Ranking progression over time | Users want to track improvement/decline trends | MEDIUM | Requires storing historical snapshots or fetching time-series data |
| Player profile view | Context for any player - club, current ranking, disciplines played | LOW | Standard detail screen pattern |
| Tournament results | Users want context for matches - which tournament, when, what round | LOW | Match data includes tournament metadata |
| Discipline filtering | Badminton has 3 disciplines (simple/double/mixte) - must separate | LOW | Standard filter UI pattern |
| Offline viewing of cached data | Mobile users lose connectivity, expect last-loaded data to persist | MEDIUM | Local storage strategy, React Native AsyncStorage or SQLite |
| Pull-to-refresh | Mobile standard for data apps - users expect manual refresh control | LOW | Standard React Native gesture |

### Differentiators (Competitive Advantage)

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Ranking progression visualization (charts/graphs) | FFBaD official app shows text lists - graphs make trends obvious at a glance | MEDIUM | Line charts for CPPH over time. Use Victory Native or similar |
| Player "following" / bookmarks | Competitive players track rivals, club members follow teammates | LOW | Local list of followed player IDs, dedicated tab |
| Head-to-head comparison | "How do I stack up against player X?" - direct stat comparison | MEDIUM | Compare rankings, win rates, common opponents |
| Club leaderboards | Players compare themselves to clubmates more than global rankings | MEDIUM | Filter players by club, rank by CPPH or win % |
| Match insights / patterns | "You win 75% of your simple matches but 40% of doubles" - actionable insights | HIGH | Requires aggregation logic, statistical analysis |
| Weekly ranking change notifications | CPPH updates weekly - proactive "You moved up 3 places!" alerts | MEDIUM | Background job + local notifications (v1 explicitly excludes push) |
| Timeline view of ranking milestones | Visualize when user hit NC, P12, P10 etc - gamification of progression | MEDIUM | Parse ranking changes, detect threshold crossings |
| Export match history | Players want CSV/PDF for personal records or coach review | MEDIUM | Generate export files, share via native share sheet |
| Dark mode | Mobile app standard, especially for stats apps used during commutes | LOW | React Native appearance API, theme provider |
| Opponent lookup from match history | Tap opponent name in match to view their full profile | LOW | Navigation link, API call for player details |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live match scoring | "Why can't I enter my match score?" | Out of scope - FFBaD data is authoritative, user input creates sync conflicts and data quality issues | Link to official tournament pages where data originates |
| Social features (comments, reactions) | "Let me comment on matches" | Moderation burden, toxicity risk, strays from core value (stats consumption) | Keep it read-only, focus on data quality over engagement metrics |
| Push notifications (v1) | "Notify me when my ranking updates!" | Requires backend infrastructure, costs, permission fatigue | Local notifications when app is opened and new data detected |
| Custom ranking calculations | "Calculate my ranking differently" | FFBaD CPPH is official - alternate calculations confuse users and undermine authority | Show official CPPH, add explainers for how it's calculated |
| Ads in free tier | "Monetize with ads" | Stats apps are reference tools - ads interrupt flow, users will abandon for FFBaD official app | Keep free, consider premium features later (exports, advanced insights) |
| Multi-federation support (v1) | "Support Belgian/Dutch federations too" | Scope creep, each federation has different APIs, data models, ranking systems | Focus on FFBaD excellence first, expand later if validated |
| Real-time data sync | "Update every minute!" | FFBaD data updates weekly (CPPH), unnecessary API load and battery drain | Explain weekly update cycle, smart refresh (check once/day, allow manual) |

## Feature Dependencies

```
Player Profile Display
    └──requires──> FFBaD API Integration
                       └──requires──> API Authentication

Match History
    └──requires──> Player Profile Display (to show context)
    └──enhances──> Ranking Progression (matches explain ranking changes)

Ranking Progression Visualization
    └──requires──> Historical Ranking Data Storage
    └──requires──> Chart Library Integration

Player Following
    └──requires──> Local Storage (AsyncStorage/SQLite)
    └──enhances──> Dashboard (show followed players' recent results)

Head-to-Head Comparison
    └──requires──> Match History (both players)
    └──requires──> Statistical Aggregation Logic

Offline Viewing
    └──requires──> Local Data Cache Strategy
    └──conflicts──> Real-time Sync (cache staleness)

Weekly Ranking Notifications
    └──requires──> Background Fetch (Expo Task Manager)
    └──requires──> Local Notifications Setup
    └──enhances──> Ranking Progression (users return when notified)

Export Match History
    └──requires──> Match History Data
    └──requires──> File Generation (CSV/PDF library)
```

### Dependency Notes

- **Player Profile Display requires FFBaD API Integration:** Can't show player data without authenticated API access to FFBaD endpoints
- **Match History enhances Ranking Progression:** Showing matches alongside ranking chart explains why ranking changed (tournament win = spike up)
- **Offline Viewing conflicts with Real-time Sync:** Cached data can be stale - must communicate freshness clearly to users
- **Player Following enhances Dashboard:** Following creates a personalized feed - "recent results for my bookmarked players"

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the concept.

- [ ] **Player search by name/license** - Core discovery mechanism, users find themselves and others
- [ ] **Player profile view** - Shows current ranking, club, disciplines - baseline information
- [ ] **Match history display** - List of past matches with date, opponent, result, tournament
- [ ] **Current ranking display** - CPPH value and rank category (NC, P12, etc.)
- [ ] **Ranking progression chart** - Simple line graph showing CPPH over last 12 months
- [ ] **Player following/bookmarks** - Save favorite players for quick access
- [ ] **Offline cached viewing** - Last-loaded data persists for offline use
- [ ] **Discipline filtering** - Separate simple/double/mixte throughout the app
- [ ] **Dark mode** - Mobile standard, improves usability

**MVP Rationale:** These features provide immediate value (see my stats, track improvement, follow rivals) without backend complexity. All data comes from FFBaD API, no user-generated content, no server requirements beyond API proxy if needed.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Head-to-head comparison** - Trigger: Users ask "how do I compare to X?" in feedback
- [ ] **Club leaderboards** - Trigger: Club-based usage patterns emerge in analytics
- [ ] **Timeline of ranking milestones** - Trigger: Users engage with progression chart, want milestone highlights
- [ ] **Export match history** - Trigger: Users request personal records for coaches/journals
- [ ] **Weekly ranking change notifications** - Trigger: User retention drops, need re-engagement mechanism
- [ ] **Match insights/patterns** - Trigger: v1 feels too "passive" - users want actionable takeaways

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Club directory/discovery** - Why defer: Nice-to-have, not core stats value
- [ ] **Tournament calendar integration** - Why defer: Requires additional API endpoints, out of core flow
- [ ] **Multi-player comparison (3+)** - Why defer: Complex UI, unclear use case until head-to-head validates
- [ ] **Custom alerts (player X moved up, tournament Y results posted)** - Why defer: Requires backend notification service
- [ ] **Social sharing (share match result card to social media)** - Why defer: Vanity feature, doesn't improve core stats experience
- [ ] **Player notes/annotations** - Why defer: Edge case for coaches, adds data management complexity

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Player search | HIGH | LOW | P1 |
| Player profile view | HIGH | LOW | P1 |
| Match history display | HIGH | LOW | P1 |
| Current ranking display | HIGH | LOW | P1 |
| Ranking progression chart | HIGH | MEDIUM | P1 |
| Player following | MEDIUM | LOW | P1 |
| Offline cached viewing | HIGH | MEDIUM | P1 |
| Discipline filtering | HIGH | LOW | P1 |
| Dark mode | MEDIUM | LOW | P1 |
| Pull-to-refresh | MEDIUM | LOW | P1 |
| Head-to-head comparison | MEDIUM | MEDIUM | P2 |
| Club leaderboards | MEDIUM | MEDIUM | P2 |
| Timeline milestones | LOW | MEDIUM | P2 |
| Export match history | LOW | MEDIUM | P2 |
| Weekly ranking notifications | MEDIUM | MEDIUM | P2 |
| Match insights/patterns | HIGH | HIGH | P2 |
| Opponent profile lookup | MEDIUM | LOW | P2 |
| Tournament calendar | LOW | MEDIUM | P3 |
| Multi-player comparison | LOW | HIGH | P3 |
| Social sharing | LOW | MEDIUM | P3 |
| Player notes | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (table stakes + key differentiators)
- P2: Should have, add when possible (validates differentiation)
- P3: Nice to have, future consideration (scope creep risk)

## Competitor Feature Analysis

| Feature | FFBaD Official App | RacketStats (Tennis) | GoodShot (Badminton) | BadTracker Approach |
|---------|-------------------|----------------------|----------------------|---------------------|
| Player search | Yes (by license/name/club) | N/A (self-tracking) | N/A (self-tracking) | Same as FFBaD, core feature |
| Match history | Yes (text list) | Yes (user-entered) | No (AI shot tracking only) | Same as FFBaD, better UX/filtering |
| Ranking display | Yes (current CPPH) | No (not federation-based) | No | Same as FFBaD |
| Ranking progression | Text list of past weeks | N/A | Weekly/monthly/yearly stats | **DIFFERENTIATOR:** Visual charts vs FFBaD text |
| Player following | No | N/A | N/A | **DIFFERENTIATOR:** Bookmark rivals/teammates |
| Visualizations | Minimal | 44+ stat charts | Shot speed graphs | **DIFFERENTIATOR:** CPPH timeline, win rate charts |
| Offline mode | Unknown | Cloud sync | Watch-based | Standard mobile expectation |
| Head-to-head | No | No | No | **DIFFERENTIATOR:** Compare with rivals |
| Dark mode | Unknown | Not mentioned | Not mentioned | Mobile standard |
| Social features | No | No | No | Explicitly avoiding (anti-feature) |

**Key Insight:** FFBaD official app is authoritative but basic (text lists, minimal visualization). BadTracker differentiates on **visualization quality** and **personalization** (following, comparisons) while staying read-only (no user-generated content complexity).

## Sources

### Badminton Apps
- [Badminton Score - Track Points (App Store)](https://apps.apple.com/us/app/badminton-score-track-points/id6473635854)
- [Badminton Scorer (Google Play)](https://play.google.com/store/apps/details?id=com.sportscoreboards.badmintonscorer&hl=en_US)
- [GoodShot - Badminton Tracker (App Store)](https://apps.apple.com/us/app/goodshot-badminton-tracker/id1622183934)
- [Smashspeed: Badminton Tracker (App Store)](https://apps.apple.com/us/app/smashspeed-badminton-tracker/id6748543435)
- [Badminton Umpire Score Keeper (Google Play)](https://play.google.com/store/apps/details?id=com.lahiruchandima.badmintonumpire&hl=en_US)

### Racket Sports Apps
- [RacketStats](https://www.racketstats.com/)
- [An Avalanche of Racket Sports Apps](https://racketbusiness.com/p/an-avalanche-of-racket-sports-apps)
- [Racket Sports Tech for August 2025](https://racketbusiness.com/p/racket-sports-tech-for-august-2025-86eb0f6017bf7d36)

### Player Ranking Apps
- [RacketPal (Google Play)](https://play.google.com/store/apps/details?id=com.racketpal&hl=en_US)
- [Elo Challenge (App Store)](https://apps.apple.com/us/app/elo-challenge/id969911354)
- [Rankedin](https://www.rankedin.com/)

### FFBaD-Specific
- [FFBaD Official App (Google Play)](https://play.google.com/store/apps/details?id=org.ffbad&hl=en_US)
- [FFBaD Chrome Stats](https://chrome-stats.com/d/org.ffbad)
- [Le classement au badminton (etoilebad.fr)](https://www.etoilebad.fr/conseils/classement-badminton.php)

### Sports Stats Best Practices
- [10 Essential Features to Look for in a Sports Team Performance App](https://www.sportsfirst.net/post/10-essential-features-to-look-for-in-a-sports-team-performance-app)
- [Developing a Sports Stats App like TheScore](https://ideausher.com/blog/developing-aports-stats-app-like-thescore/)
- [Sports Stats Tracking App Development](https://ideausher.com/blog/sports-stats-tracking-app-development/)

### Visualization
- [Visualize sports data - Flourish](https://flourish.studio/resources/sports/)
- [7 Dash Apps Bringing AI & ML to Sports Analytics](https://medium.com/plotly/7-dash-apps-bringing-ai-ml-to-sports-analytics-cb6e7c993064)

### Sports App Trends 2026
- [10 Best Sports Apps Ranked in 2026](https://www.zegocloud.com/blog/sports-app)
- [Sports App Marketing in 2026](https://asoworld.com/blog/the-future-of-sports-apps-marketing-in-2026-what-to-expect-next/)
- [10 Best Sports Apps: Here's What Makes Them Great](https://infostride.com/sports-apps/)

---
*Feature research for: BadTracker (French badminton stats tracker)*
*Researched: 2026-02-16*
