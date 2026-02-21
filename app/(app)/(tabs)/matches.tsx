import {
  View,
  Text,
  SectionList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useMatchHistory,
  type MatchItem,
  type MatchSection,
  type DisciplineFilter,
} from '../../../src/hooks/useMatchHistory';

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

// ============================================================
// Main Screen
// ============================================================

export default function MatchHistoryScreen() {
  const { t } = useTranslation();
  const scrollY = useSharedValue(0);

  const {
    sections,
    allMatches,
    stats,
    disciplineCounts,
    availableSeasons,
    activeDiscipline,
    activeSeason,
    isLoading,
    isRefreshing,
    error,
    setDiscipline,
    setSeason,
    refresh,
  } = useMatchHistory();

  // Scroll handler — updates shared value for Reanimated UI-thread animation
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

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

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------
  if (error && allMatches.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t(error)}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={() => refresh()}
        >
          <Text style={styles.retryText}>{t('common.retry')}</Text>
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
    <View style={styles.container}>
      {/* Collapsible Stats Header */}
      <Animated.View
        style={[styles.statsHeader, headerAnimatedStyle]}
      >
        <StatsHeader stats={stats} t={t} />
      </Animated.View>

      {/* Discipline Filter Chips — only show when discipline data is available */}
      {(disciplineCounts.simple > 0 || disciplineCounts.double > 0 || disciplineCounts.mixte > 0) && (
        <View style={styles.filtersRow}>
          {DISCIPLINE_FILTERS.map(({ key, labelKey }) => {
            const count = disciplineCounts[key];
            const isActive = activeDiscipline === key;
            return (
              <Pressable
                key={key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setDiscipline(key)}
              >
                <Text
                  style={[styles.chipText, isActive && styles.chipTextActive]}
                >
                  {t(labelKey)} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Season Picker */}
      {availableSeasons.length > 0 && (
        <View style={styles.seasonRow}>
          <Text style={styles.seasonLabel}>{t('matchHistory.season')} :</Text>
          <Pressable
            style={[styles.chip, activeSeason === null && styles.chipActive]}
            onPress={() => setSeason(null)}
          >
            <Text
              style={[
                styles.chipText,
                activeSeason === null && styles.chipTextActive,
              ]}
            >
              {t('matchHistory.allSeasons')}
            </Text>
          </Pressable>
          {availableSeasons.map((season) => {
            const isActive = activeSeason === season;
            return (
              <Pressable
                key={season}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSeason(season)}
              >
                <Text
                  style={[styles.chipText, isActive && styles.chipTextActive]}
                >
                  {season}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Match List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <TournamentHeader section={section} t={t} />
        )}
        renderItem={({ item }) => <MatchCard match={item} t={t} />}
        stickySectionHeadersEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        }
        contentContainerStyle={styles.listContent}
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
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function StatsHeader({ stats, t }: StatsHeaderProps) {
  return (
    <View style={styles.statsContent}>
      <Text style={styles.statsTitle}>{t('matchHistory.statsHeader')}</Text>

      {/* Win rate percentage */}
      <Text style={styles.statsWinRate}>
        {t('matchHistory.winRate', { rate: stats.winPercentage })}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBarFill,
            {
              width:
                stats.total > 0
                  ? (`${stats.winPercentage}%` as unknown as number)
                  : 0,
            },
          ]}
        />
      </View>

      {/* Win / Loss counts */}
      <View style={styles.statsCountRow}>
        <Text style={styles.statsWins}>
          {t('matchHistory.wins', { count: stats.wins })}
        </Text>
        <Text style={styles.statsLosses}>
          {t('matchHistory.losses', { count: stats.losses })}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Tournament Section Header
// ============================================================

interface TournamentHeaderProps {
  section: MatchSection;
  t: (key: string) => string;
}

function TournamentHeader({ section, t }: TournamentHeaderProps) {
  const title = section.title || t('matchHistory.tournamentUnknown');
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {title}
      </Text>
      {section.date ? (
        <Text style={styles.sectionDate}>{section.date}</Text>
      ) : null}
    </View>
  );
}

// ============================================================
// Match Card Sub-component (inline details, no accordion)
// ============================================================

interface MatchCardProps {
  match: MatchItem;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function MatchCard({ match, t }: MatchCardProps) {
  const disciplineLetter =
    match.discipline === 'simple' ? 'S'
      : match.discipline === 'double' ? 'D'
        : match.discipline === 'mixte' ? 'M'
          : '';

  const resultBadge = match.isWin === true
    ? { style: styles.badgeWin, text: t('matchHistory.victory') }
    : match.isWin === false
      ? { style: styles.badgeLoss, text: t('matchHistory.defeat') }
      : { style: styles.badgeUnknown, text: '?' };

  const pointsText = match.pointsImpact != null
    ? (match.pointsImpact >= 0 ? `+${match.pointsImpact.toFixed(1)}` : match.pointsImpact.toFixed(1)) + ' pts'
    : null;
  const pointsStyle = match.pointsImpact != null && match.pointsImpact >= 0
    ? styles.pointsPositive
    : styles.pointsNegative;

  return (
    <View style={styles.matchCard}>
      {/* Row 1: discipline badge + round + result badge */}
      <View style={styles.matchCardHeader}>
        <View style={styles.matchCardHeaderLeft}>
          {disciplineLetter ? (
            <View style={styles.disciplineBadge}>
              <Text style={styles.disciplineBadgeText}>{disciplineLetter}</Text>
            </View>
          ) : null}
          {match.round ? (
            <Text style={styles.matchRound} numberOfLines={1}>{match.round}</Text>
          ) : null}
        </View>
        <View style={[styles.badge, resultBadge.style]}>
          <Text style={styles.badgeText}>{resultBadge.text}</Text>
        </View>
      </View>

      {/* Row 2: Players */}
      <View style={styles.matchCardPlayers}>
        {match.partner ? (
          <Text style={styles.playerText} numberOfLines={1}>
            {t('matchHistory.partner', { name: match.partner })}
          </Text>
        ) : null}
        {match.opponent ? (
          <View style={styles.vsRow}>
            <Text style={styles.vsText}>{t('matchHistory.vs')} </Text>
            <Pressable
              onPress={() => {
                if (match.opponentLicence) router.push(`/player/${match.opponentLicence}`);
              }}
            >
              <Text
                style={match.opponentLicence ? styles.opponentLink : styles.opponentText}
                numberOfLines={1}
              >
                {match.opponent}
                {match.opponent2 ? ` / ${match.opponent2}` : ''}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Row 3: Scores + points */}
      <View style={styles.matchCardFooter}>
        {match.setScores && match.setScores.length > 0 ? (
          <Text style={styles.setScoresText}>{match.setScores.join('  ')}</Text>
        ) : match.score ? (
          <Text style={styles.setScoresText}>{match.score}</Text>
        ) : null}
        {pointsText ? (
          <Text style={pointsStyle}>{pointsText}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  listContent: {
    paddingBottom: 32,
  },

  // Stats Header
  statsHeader: {
    overflow: 'hidden',
    backgroundColor: '#eff6ff',
  },
  statsContent: {
    padding: 16,
    paddingBottom: 12,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  statsWinRate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 4,
  },
  statsCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsWins: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  statsLosses: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },

  // Filter Chips
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },

  // Season Row
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  seasonLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    flex: 1,
    marginRight: 8,
  },
  sectionDate: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Match Card
  matchCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  matchCardPlayers: {
    marginBottom: 4,
  },
  playerText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 2,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vsText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  opponentText: {
    fontSize: 14,
    color: '#374151',
  },
  opponentLink: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  matchCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  setScoresText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  pointsPositive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  pointsNegative: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },

  // Badge
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeWin: {
    backgroundColor: '#dcfce7',
  },
  badgeLoss: {
    backgroundColor: '#fee2e2',
  },
  badgeUnknown: {
    backgroundColor: '#f3f4f6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },

  // Discipline badge
  disciplineBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disciplineBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
  },

  // Match round
  matchRound: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Empty state
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },

  // Error
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonPressed: {
    backgroundColor: '#1d4ed8',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
