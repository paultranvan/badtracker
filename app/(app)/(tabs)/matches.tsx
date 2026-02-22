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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../../src/auth/context';
import {
  useMatchHistory,
  type MatchItem,
  type TournamentSection,
  type DisciplineGroup,
  type DisciplineFilter,
} from '../../../src/hooks/useMatchHistory';
import { DetailMatchCard } from '../../../src/components';

// ============================================================
// Constants
// ============================================================

const HEADER_MAX_HEIGHT = 140;
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
            <View className="py-4 items-center">
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
    <View className="flex-1 bg-white">
      {/* Collapsible Stats Header */}
      <Animated.View
        className="overflow-hidden bg-primary-bg"
        style={headerAnimatedStyle}
      >
        <StatsHeader stats={stats} t={t} />
      </Animated.View>

      {/* Discipline Filter Chips */}
      <View className="flex-row gap-2 px-4 py-2.5 border-b border-gray-100">
        {DISCIPLINE_FILTERS.map(({ key, labelKey }) => {
          const count = disciplineCounts[key];
          const isActive = activeDiscipline === key;
          const isDisabled = key !== 'all' && count === 0;
          return (
            <Pressable
              key={key}
              className={`px-3 py-1.5 rounded-full border ${
                isActive ? 'bg-primary border-primary' :
                isDisabled ? 'bg-gray-50 border-gray-100' :
                'bg-white border-gray-200'
              }`}
              onPress={() => !isDisabled && setDiscipline(key)}
              disabled={isDisabled}
            >
              <Text className={`text-[13px] font-medium ${
                isActive ? 'text-white' :
                isDisabled ? 'text-gray-300' :
                'text-gray-700'
              }`}>
                {t(labelKey)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Season Picker */}
      {availableSeasons.length > 0 && (
        <View className="border-b border-gray-100">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' }}
          >
            <Text className="text-[13px] font-medium text-muted">{t('matchHistory.season')} :</Text>
            <Pressable
              className={`px-3 py-1.5 rounded-full border ${activeSeason === null ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
              onPress={() => setSeason(null)}
            >
              <Text className={`text-[13px] font-medium ${activeSeason === null ? 'text-white' : 'text-gray-700'}`}>
                {t('matchHistory.allSeasons')}
              </Text>
            </Pressable>
            {availableSeasons.map((season) => {
              const isActive = activeSeason === season;
              return (
                <Pressable
                  key={season}
                  className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                  onPress={() => setSeason(season)}
                >
                  <Text className={`text-[13px] font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
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
        contentContainerStyle={{ paddingBottom: 32 }}
        extraData={detailCache}
        onScroll={handleScroll}
      />
    </View>
  );
}

// ============================================================
// Stats Header Sub-component
// ============================================================

interface StatsHeaderProps {
  stats: { wins: number; losses: number; total: number; winPercentage: number };
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function StatsHeader({ stats, t }: StatsHeaderProps) {
  return (
    <View className="p-4 pb-3">
      <Text className="text-[14px] font-semibold text-gray-700 mb-2">
        {t('matchHistory.statsHeader')}
      </Text>
      <Text className="text-[36px] font-bold text-primary mb-2">
        {t('matchHistory.winRate', { rate: stats.winPercentage })}
      </Text>
      {/* Progress bar */}
      <View className="h-2 bg-loss-bg rounded-full overflow-hidden mb-2">
        <View
          className="h-full bg-win rounded-full"
          style={{ width: stats.total > 0 ? `${stats.winPercentage}%` : 0 }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[14px] font-semibold text-win">
          {t('matchHistory.wins', { count: stats.wins })}
        </Text>
        <Text className="text-[14px] font-semibold text-loss">
          {t('matchHistory.losses', { count: stats.losses })}
        </Text>
      </View>
    </View>
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
  const pointsColor = pts > 0 ? 'text-win' : pts < 0 ? 'text-loss' : 'text-gray-400';

  return (
    <Pressable
      className="flex-row justify-between items-center px-4 py-2.5 bg-slate-50 border-l-[3px] border-l-primary border-b border-b-gray-200 active:bg-slate-100"
      onPress={onToggle}
    >
      <Text className="text-body font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
        {title}
      </Text>
      <View className="flex-row items-center gap-2">
        {tournament.date ? (
          <Text className="text-caption text-muted">{tournament.date}</Text>
        ) : null}
        {pointsText ? (
          <Text className={`text-caption font-semibold ${pointsColor}`} style={{ fontVariant: ['tabular-nums'] }}>
            {pointsText}
          </Text>
        ) : null}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#64748b"
        />
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

  const discColors: Record<string, string> = { simple: 'bg-blue-100', double: 'bg-emerald-100', mixte: 'bg-amber-100' };
  const discTextColors: Record<string, string> = { simple: 'text-singles', double: 'text-doubles', mixte: 'text-mixed' };
  const discBg = discColors[disc] ?? 'bg-gray-200';
  const discText = discTextColors[disc] ?? 'text-gray-500';

  const pts = discipline.points;
  const pointsText = pts !== 0 ? (pts > 0 ? `+${pts.toFixed(1)}` : pts.toFixed(1)) + ' pts' : '';
  const pointsColor = pts > 0 ? 'text-win' : pts < 0 ? 'text-loss' : 'text-gray-400';

  return (
    <Pressable
      className="flex-row justify-between items-center pl-8 pr-4 py-2 bg-white border-b border-b-gray-100 active:bg-gray-50"
      onPress={onToggle}
    >
      <View className="flex-row items-center gap-2 flex-1">
        <View className={`w-6 h-6 rounded-full items-center justify-center ${discBg}`}>
          <Text className={`text-[11px] font-bold ${discText}`}>{letter}</Text>
        </View>
        <Text className="text-[14px] font-medium text-gray-800">{t(labelKey)}</Text>
        {wins > 0 && (
          <View className="bg-win/20 px-1.5 py-0.5 rounded">
            <Text className="text-[11px] font-semibold text-win">{wins}W</Text>
          </View>
        )}
        {losses > 0 && (
          <View className="bg-loss/20 px-1.5 py-0.5 rounded">
            <Text className="text-[11px] font-semibold text-loss">{losses}L</Text>
          </View>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        {pointsText ? (
          <Text className={`text-caption font-semibold ${pointsColor}`} style={{ fontVariant: ['tabular-nums'] }}>
            {pointsText}
          </Text>
        ) : null}
        {isLoading ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : (
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#94a3b8"
          />
        )}
      </View>
    </Pressable>
  );
}

