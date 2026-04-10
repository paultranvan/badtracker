import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../../src/auth/context';
import {
  useMatchHistory,
  type MatchItem,
  type TournamentSection,
  type DisciplineGroup,
  type DisciplineFilter,
  type DisciplineStats,
} from '../../../src/hooks/useMatchHistory';
import { DetailMatchCard, DonutChart } from '../../../src/components';

// ============================================================
// Constants
// ============================================================

const HEADER_MAX_HEIGHT = 210;
const HEADER_COLLAPSE_DISTANCE = HEADER_MAX_HEIGHT;

const DISCIPLINE_FILTERS: Array<{
  key: DisciplineFilter;
  labelKey: string;
}> = [
  { key: 'all', labelKey: 'matchHistory.all' },
  { key: 'simple', labelKey: 'matchHistory.simple' },
  { key: 'double', labelKey: 'matchHistory.double' },
  { key: 'mixte', labelKey: 'matchHistory.mixte' },
];

const DISC_LABELS: Record<string, string> = {
  simple: 'matchHistory.simple',
  double: 'matchHistory.double',
  mixte: 'matchHistory.mixte',
};

const DISC_LETTERS: Record<string, string> = {
  simple: 'S',
  double: 'D',
  mixte: 'M',
};

const DISC_SOLID_COLORS: Record<string, string> = {
  simple: '#3b82f6',
  double: '#10b981',
  mixte: '#f59e0b',
};

// ============================================================
// Flat list item types for the two-level accordion
// ============================================================

type RenderItem =
  | { type: 'tournament'; tournament: TournamentSection; key: string }
  | { type: 'discipline'; tournament: TournamentSection; discipline: DisciplineGroup; key: string }
  | { type: 'match'; match: MatchItem; discipline: DisciplineGroup; tournament: TournamentSection; key: string };

// ============================================================
// Main Screen
// ============================================================

export default function MatchHistoryScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const playerName = session ? `${session.prenom} ${session.nom}` : undefined;
  const scrollY = useSharedValue(0);

  // Level 1: expanded tournaments (show discipline rows)
  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  // Level 2: expanded disciplines (show match cards) — key format: "tournament:discipline"
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  const toggleTournament = (tournament: TournamentSection) => {
    const title = tournament.title || t('matchHistory.tournamentUnknown');
    const wasExpanded = expandedTournaments.has(title);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTournaments((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
        // Collapse all disciplines within this tournament
        setExpandedDisciplines((dp) => {
          const nextDp = new Set(dp);
          for (const key of dp) {
            if (key.startsWith(`${title}:`)) nextDp.delete(key);
          }
          return nextDp;
        });
      } else {
        next.add(title);
      }
      return next;
    });

    // Pre-load details for all disciplines when expanding
    if (!wasExpanded) {
      for (const disc of tournament.disciplines) {
        loadDetails(title, disc);
      }
    }
  };

  const toggleDiscipline = (tournamentTitle: string, disc: DisciplineGroup) => {
    const key = `${tournamentTitle}:${disc.discipline}`;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDisciplines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Trigger lazy detail loading
        loadDetails(tournamentTitle, disc);
      }
      return next;
    });
  };

  const {
    tournaments,
    allMatches,
    stats,
    disciplineStats,
    isStatsSettled,
    disciplineCounts,
    availableSeasons,
    activeDiscipline,
    activeSeason,
    isLoading,
    isRefreshing,
    error,
    detailCache,
    loadingDetails,
    setDiscipline,
    setSeason,
    refresh,
    loadDetails,
  } = useMatchHistory();

  // Build flat list of render items based on expand state
  const renderItems: RenderItem[] = [];
  for (const tournament of tournaments) {
    const tKey = tournament.title || t('matchHistory.tournamentUnknown');
    renderItems.push({ type: 'tournament', tournament, key: `t:${tKey}` });

    if (expandedTournaments.has(tKey)) {
      for (const disc of tournament.disciplines) {
        const dKey = `${tKey}:${disc.discipline}`;
        renderItems.push({ type: 'discipline', tournament, discipline: disc, key: `d:${dKey}` });

        if (expandedDisciplines.has(dKey)) {
          // Use detail-enriched matches if available, otherwise basic matches
          const detailMatches = detailCache.get(dKey);
          const matches = detailMatches ?? disc.matches;
          for (const match of matches) {
            renderItems.push({
              type: 'match',
              match,
              discipline: disc,
              tournament,
              key: `m:${dKey}:${match.id}`,
            });
          }
          // Show spinner if details are still loading
          if (loadingDetails.has(dKey) && !detailMatches) {
            renderItems.push({
              type: 'match',
              match: { id: `loading-${dKey}`, _isLoadingPlaceholder: true } as MatchItem & { _isLoadingPlaceholder?: boolean },
              discipline: disc,
              tournament,
              key: `m:${dKey}:loading`,
            });
          }
        }
      }
    }
  }

  // Scroll handler
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_DISTANCE],
      [HEADER_MAX_HEIGHT, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_DISTANCE / 2],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const renderItem = useCallback(({ item }: { item: RenderItem }) => {
    switch (item.type) {
      case 'tournament':
        return (
          <TournamentHeader
            tournament={item.tournament}
            t={t}
            isExpanded={expandedTournaments.has(item.tournament.title || t('matchHistory.tournamentUnknown'))}
            onToggle={() => toggleTournament(item.tournament)}
          />
        );
      case 'discipline':
        return (
          <DisciplineRow
            discipline={item.discipline}
            tournament={item.tournament}
            t={t}
            isExpanded={expandedDisciplines.has(`${item.tournament.title || t('matchHistory.tournamentUnknown')}:${item.discipline.discipline}`)}
            isLoading={loadingDetails.has(`${item.tournament.title || t('matchHistory.tournamentUnknown')}:${item.discipline.discipline}`)}
            onToggle={() => toggleDiscipline(item.tournament.title || t('matchHistory.tournamentUnknown'), item.discipline)}
            detailCache={detailCache}
          />
        );
      case 'match': {
        const m = item.match as MatchItem & { _isLoadingPlaceholder?: boolean };
        if (m._isLoadingPlaceholder) {
          return (
            <View className="ml-7 mr-3 mb-1 py-4 items-center bg-gray-50 rounded-lg">
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          );
        }
        return <DetailMatchCard match={item.match} playerName={playerName} />;
      }
    }
  }, [expandedTournaments, expandedDisciplines, loadingDetails, detailCache, t, playerName]);

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------
  if (error && allMatches.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-body text-loss text-center mb-4">{t(error)}</Text>
        <Pressable
          className="bg-primary px-6 py-2.5 rounded-lg active:bg-primary-dark"
          onPress={() => refresh()}
        >
          <Text className="text-white text-body font-semibold">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Empty state message
  // ----------------------------------------------------------
  const emptyMessage =
    allMatches.length === 0
      ? t('matchHistory.noMatches')
      : t('matchHistory.noMatchesForFilter');

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <View className="flex-1 bg-surface">
      {/* Collapsible Stats Header */}
      <Animated.View
        className="overflow-hidden"
        style={headerAnimatedStyle}
      >
        <StatsHeader
          stats={stats}
          isStatsSettled={isStatsSettled}
          t={t}
          disciplineStats={disciplineStats}
          disciplineCounts={disciplineCounts}
        />
      </Animated.View>

      {/* Discipline Filter Chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#ffffff' }}>
        {DISCIPLINE_FILTERS.map(({ key, labelKey }) => {
          const count = disciplineCounts[key];
          const isActive = activeDiscipline === key;
          const isDisabled = key !== 'all' && count === 0;
          return (
            <Pressable
              key={key}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: isActive ? '#2563eb' : isDisabled ? '#f9fafb' : '#f8fafc',
              }}
              onPress={() => !isDisabled && setDiscipline(key)}
              disabled={isDisabled}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isActive ? '#ffffff' : isDisabled ? '#d1d5db' : '#4b5563',
                }}
              >
                {t(labelKey)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Season Picker */}
      {availableSeasons.length > 0 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {t('matchHistory.season')}
            </Text>
            <Pressable
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: activeSeason === null ? '#2563eb' : '#f8fafc',
              }}
              onPress={() => setSeason(null)}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: activeSeason === null ? '#ffffff' : '#4b5563' }}>
                {t('matchHistory.allSeasons')}
              </Text>
            </Pressable>
            {availableSeasons.map((season) => {
              const isActive = activeSeason === season;
              return (
                <Pressable
                  key={season}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: isActive ? '#2563eb' : '#f8fafc',
                  }}
                  onPress={() => setSeason(season)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#ffffff' : '#4b5563' }}>
                    {season}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Match List */}
      <Animated.FlatList
        data={renderItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <Text className="text-body text-gray-400 italic text-center py-10 px-6">{emptyMessage}</Text>
        }
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
        extraData={detailCache}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
    </View>
  );
}

// ============================================================
// Stats Header Sub-component
// ============================================================

interface StatsHeaderProps {
  stats: { wins: number; losses: number; total: number; winPercentage: number };
  isStatsSettled: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  disciplineStats: DisciplineStats;
  disciplineCounts: Record<DisciplineFilter, number>;
}

interface DisciplineStatPillProps {
  discipline: 'simple' | 'double' | 'mixte';
  wins: number;
  losses: number;
}

function DisciplineStatPill({ discipline, wins, losses }: DisciplineStatPillProps) {
  const total = wins + losses;
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const letter = DISC_LETTERS[discipline] ?? '?';
  const color = DISC_SOLID_COLORS[discipline] ?? '#9ca3af';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 8,
        flex: 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>{letter}</Text>
      </View>
      <View>
        <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>{pct}%</Text>
        <Text style={{ color: '#94a3b8', fontSize: 10 }}>{wins}W / {losses}L</Text>
      </View>
    </View>
  );
}

function DisciplineBalanceBar({
  counts,
}: {
  counts: Record<DisciplineFilter, number>;
}) {
  const simple = counts.simple;
  const dbl = counts.double;
  const mixte = counts.mixte;
  const total = simple + dbl + mixte;
  if (total === 0) return null;

  const sPct = Math.round((simple / total) * 100);
  const dPct = Math.round((dbl / total) * 100);
  const mPct = 100 - sPct - dPct;

  return (
    <View style={{ marginTop: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          gap: 3,
          height: 18,
          borderRadius: 9,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {simple > 0 && (
          <View
            style={{
              flex: sPct,
              backgroundColor: DISC_SOLID_COLORS.simple,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>S {sPct}%</Text>
          </View>
        )}
        {dbl > 0 && (
          <View
            style={{
              flex: dPct,
              backgroundColor: DISC_SOLID_COLORS.double,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>D {dPct}%</Text>
          </View>
        )}
        {mixte > 0 && (
          <View
            style={{
              flex: mPct,
              backgroundColor: DISC_SOLID_COLORS.mixte,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600' }}>M {mPct}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatsHeader({ stats, isStatsSettled, t, disciplineStats, disciplineCounts }: StatsHeaderProps) {
  return (
    <LinearGradient colors={['#1e293b', '#0f172a']} style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 12, flex: 1 }}>
        {/* Top row: Donut + text stats */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <DonutChart
            percentage={isStatsSettled ? stats.winPercentage : 0}
            size={90}
            strokeWidth={8}
            winColor="#22c55e"
            lossColor="rgba(239,68,68,0.3)"
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: '#94a3b8',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {t('matchHistory.statsHeader')}
            </Text>
            {isStatsSettled ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#22c55e' }}>
                    {stats.wins}W
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#ef4444' }}>
                    {stats.losses}L
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#64748b' }}>
                  {stats.total} {t('matchHistory.totalMatches')}
                </Text>
              </>
            ) : (
              <ActivityIndicator size="small" color="#94a3b8" style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
            )}
          </View>
        </View>

        {/* Per-discipline pills */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <DisciplineStatPill
            discipline="simple"
            wins={disciplineStats.simple.wins}
            losses={disciplineStats.simple.losses}
          />
          <DisciplineStatPill
            discipline="double"
            wins={disciplineStats.double.wins}
            losses={disciplineStats.double.losses}
          />
          <DisciplineStatPill
            discipline="mixte"
            wins={disciplineStats.mixte.wins}
            losses={disciplineStats.mixte.losses}
          />
        </View>

        {/* Discipline balance bar */}
        <DisciplineBalanceBar counts={disciplineCounts} />
      </View>
    </LinearGradient>
  );
}

// ============================================================
// Tournament Section Header (level 1)
// ============================================================

interface TournamentHeaderProps {
  tournament: TournamentSection;
  t: (key: string) => string;
  isExpanded: boolean;
  onToggle: () => void;
}

function TournamentHeader({ tournament, t, isExpanded, onToggle }: TournamentHeaderProps) {
  const title = tournament.title || t('matchHistory.tournamentUnknown');
  const pts = tournament.totalPoints;
  const pointsText = pts !== 0 ? (pts > 0 ? `+${pts.toFixed(1)}` : pts.toFixed(1)) + ' pts' : '';

  // Left accent bar color: green for positive, red for negative, gray for zero
  const accentColor = (() => {
    if (pts === 0) return '#d1d5db';
    const absPts = Math.abs(pts);
    const opacity = Math.min(0.4 + (absPts / 100) * 0.6, 1.0);
    if (pts > 0) return `rgba(22, 163, 74, ${opacity})`;
    return `rgba(220, 38, 38, ${opacity})`;
  })();

  // Collect unique discipline dots
  const disciplineDots = tournament.disciplines.map((d) => ({
    key: d.discipline,
    color: DISC_SOLID_COLORS[d.discipline] ?? '#9ca3af',
  }));

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        marginHorizontal: 12,
        marginTop: 8,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        overflow: 'hidden',
        // Shadow
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row' }}>
        {/* Left accent bar */}
        <View style={{ width: 4, backgroundColor: accentColor }} />

        {/* Content */}
        <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
          {/* Title + date area */}
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 }}>
              {tournament.date ? (
                <Text style={{ fontSize: 12, color: '#64748b' }}>{tournament.date}</Text>
              ) : null}
              {/* Discipline preview dots */}
              {disciplineDots.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                  {disciplineDots.map((dot) => (
                    <View
                      key={dot.key}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: dot.color,
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Points badge */}
          {pointsText ? (
            <View
              style={{
                backgroundColor: pts > 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 99,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: pts > 0 ? '#16a34a' : '#dc2626',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {pointsText}
              </Text>
            </View>
          ) : null}

          {/* Animated chevron */}
          <Animated.View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
            <Ionicons name="chevron-down" size={16} color="#94a3b8" />
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

// ============================================================
// Discipline Row (level 2)
// ============================================================

interface DisciplineRowProps {
  discipline: DisciplineGroup;
  tournament: TournamentSection;
  t: (key: string) => string;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  detailCache: Map<string, MatchItem[]>;
}

function DisciplineRow({ discipline, tournament, t, isExpanded, isLoading, onToggle, detailCache }: DisciplineRowProps) {
  const disc = discipline.discipline;
  const letter = DISC_LETTERS[disc] ?? '?';
  const labelKey = DISC_LABELS[disc] ?? disc;
  const discColor = DISC_SOLID_COLORS[disc] ?? '#9ca3af';

  // Compute live win/loss from detailCache if available (after expansion)
  const tKey = tournament.title || t('matchHistory.tournamentUnknown');
  const detailKey = `${tKey}:${disc}`;
  const detailMatches = detailCache.get(detailKey);
  const wins = detailMatches
    ? detailMatches.filter((m) => m.isWin === true).length
    : discipline.wins;
  const losses = detailMatches
    ? detailMatches.filter((m) => m.isWin === false).length
    : discipline.losses;

  const total = wins + losses;
  const winRatio = total > 0 ? wins / total : 0;

  const pts = discipline.points;
  const pointsText = pts !== 0 ? (pts > 0 ? `+${pts.toFixed(1)}` : pts.toFixed(1)) + ' pts' : '';

  return (
    <Pressable
      onPress={onToggle}
      className="ml-7 mr-3 flex-row items-center px-3 py-2.5 border-t border-gray-100 bg-white active:bg-gray-50"
    >
      {/* Discipline badge */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: discColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>{letter}</Text>
      </View>

      {/* Label + mini win-rate bar */}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#1f2937', marginBottom: 3 }}>
          {t(labelKey)}
        </Text>
        {total > 0 && (
          <View>
            {/* Mini win-rate bar */}
            <View
              style={{
                width: 56,
                height: 4,
                borderRadius: 99,
                backgroundColor: 'rgba(220,38,38,0.2)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: Math.round(winRatio * 56),
                  height: 4,
                  borderRadius: 99,
                  backgroundColor: '#16a34a',
                }}
              />
            </View>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
              {wins}W · {losses}L
            </Text>
          </View>
        )}
      </View>

      {/* Points pill */}
      {pointsText ? (
        <View
          style={{
            backgroundColor: pts > 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 99,
            marginRight: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: pts > 0 ? '#16a34a' : '#dc2626',
              fontVariant: ['tabular-nums'],
            }}
          >
            {pointsText}
          </Text>
        </View>
      ) : null}

      {/* Loading / chevron */}
      {isLoading ? (
        <ActivityIndicator size="small" color="#2563eb" />
      ) : (
        <Animated.View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
          <Ionicons name="chevron-down" size={14} color="#94a3b8" />
        </Animated.View>
      )}
    </Pressable>
  );
}

