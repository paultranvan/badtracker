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
    expandedMatchId,
    isLoading,
    isRefreshing,
    error,
    setDiscipline,
    setSeason,
    toggleMatchExpand,
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

      {/* Discipline Filter Chips */}
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
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            isExpanded={expandedMatchId === item.id}
            onToggle={() => toggleMatchExpand(item.id)}
            t={t}
          />
        )}
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
// Match Row Sub-component
// ============================================================

interface MatchRowProps {
  match: MatchItem;
  isExpanded: boolean;
  onToggle: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function MatchRow({ match, isExpanded, onToggle, t }: MatchRowProps) {
  // Badge
  let badgeStyle = styles.badgeUnknown;
  let badgeText = '?';
  if (match.isWin === true) {
    badgeStyle = styles.badgeWin;
    badgeText = t('matchHistory.victory');
  } else if (match.isWin === false) {
    badgeStyle = styles.badgeLoss;
    badgeText = t('matchHistory.defeat');
  }

  // Discipline letter
  const disciplineLetter =
    match.discipline === 'simple'
      ? 'S'
      : match.discipline === 'double'
        ? 'D'
        : match.discipline === 'mixte'
          ? 'M'
          : '';

  // Opponent display
  const opponentName = match.opponent ?? '-';
  const hasOpponentLink = !!match.opponentLicence;

  // Second opponent for doubles
  const opponent2 = match.opponent2;

  return (
    <Pressable onPress={onToggle} style={styles.matchRowContainer}>
      <View style={styles.matchRow}>
        {/* W/L Badge */}
        <View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>

        {/* Center: opponent, partner, round */}
        <View style={styles.matchInfo}>
          {/* Opponent name (tappable if licence available) */}
          {hasOpponentLink ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                router.push(`/player/${match.opponentLicence}`);
              }}
            >
              <Text style={styles.matchOpponentLink} numberOfLines={1}>
                {opponentName}
                {opponent2 ? ` / ${opponent2}` : ''}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.matchOpponent} numberOfLines={1}>
              {opponentName}
              {opponent2 ? ` / ${opponent2}` : ''}
            </Text>
          )}

          {/* Partner for doubles/mixed */}
          {match.partner ? (
            <Text style={styles.matchPartner} numberOfLines={1}>
              {t('matchHistory.partner', { name: match.partner })}
            </Text>
          ) : null}

          {/* Round */}
          {match.round ? (
            <Text style={styles.matchRound} numberOfLines={1}>
              {match.round}
            </Text>
          ) : null}
        </View>

        {/* Right: score + discipline badge */}
        <View style={styles.matchRight}>
          <Text style={styles.matchScore}>{match.score ?? '-'}</Text>
          {disciplineLetter ? (
            <View style={styles.disciplineBadge}>
              <Text style={styles.disciplineBadgeText}>
                {disciplineLetter}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Accordion Expanded Detail */}
      {isExpanded && (
        <View style={styles.expandedDetail}>
          {/* Set scores */}
          {match.setScores && match.setScores.length > 0 ? (
            <Text style={styles.detailText}>
              {t('matchHistory.setScores', {
                scores: match.setScores.join(', '),
              })}
            </Text>
          ) : null}

          {/* Points impact */}
          {match.pointsImpact != null ? (
            <Text
              style={[
                styles.detailText,
                match.pointsImpact >= 0
                  ? styles.detailPositive
                  : styles.detailNegative,
              ]}
            >
              {match.pointsImpact >= 0
                ? t('matchHistory.pointsGained', {
                    points: match.pointsImpact.toFixed(1),
                  })
                : t('matchHistory.pointsLost', {
                    points: match.pointsImpact.toFixed(1),
                  })}
            </Text>
          ) : null}

          {/* Tournament name */}
          {match.tournament ? (
            <Text style={styles.detailTournament}>{match.tournament}</Text>
          ) : null}

          {/* Duration */}
          {match.duration ? (
            <Text style={styles.detailText}>
              {t('matchHistory.duration', { duration: match.duration })}
            </Text>
          ) : null}

          {/* Date */}
          {match.date ? (
            <Text style={styles.detailDate}>{match.date}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
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

  // Match Row
  matchRowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  // Badge
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
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

  // Match Info (center)
  matchInfo: {
    flex: 1,
  },
  matchOpponent: {
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  matchOpponentLink: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '500',
  },
  matchPartner: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  matchRound: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // Match Right (score + discipline)
  matchRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  matchScore: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  disciplineBadge: {
    marginTop: 4,
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

  // Expanded Detail (Accordion)
  expandedDetail: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingLeft: 54, // Align with text after badge (28 badge + 10 margin + 16 padding)
    backgroundColor: '#f9fafb',
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 4,
    borderRadius: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  detailPositive: {
    color: '#16a34a',
    fontWeight: '600',
  },
  detailNegative: {
    color: '#dc2626',
    fontWeight: '600',
  },
  detailTournament: {
    fontSize: 13,
    color: '#2563eb',
    marginBottom: 4,
  },
  detailDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
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
