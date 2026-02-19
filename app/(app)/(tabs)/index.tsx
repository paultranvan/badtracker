import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDashboardData } from '../../../src/hooks/useDashboardData';
import type { MatchPreview } from '../../../src/hooks/useDashboardData';
import { getRankGaps, getRankLabel } from '../../../src/utils/rankings';
import { useSession } from '../../../src/auth/context';

// ============================================================
// Main Dashboard Screen
// ============================================================

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const {
    profile,
    recentMatches,
    quickStats,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = useDashboardData();

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
  if (error && !profile) {
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
  // Greeting
  // ----------------------------------------------------------
  const displayName = session?.prenom || session?.nom || '';
  const hasRecentWin = recentMatches.length > 0 && recentMatches[0].isWin === true;
  const greetingKey = hasRecentWin ? 'dashboard.greetingWin' : 'dashboard.greeting';

  // ----------------------------------------------------------
  // Ranking data for cards
  // ----------------------------------------------------------
  const disciplines: Array<{
    key: 'simple' | 'double' | 'mixte';
    translationKey: string;
  }> = [
    { key: 'simple', translationKey: 'player.simple' },
    { key: 'double', translationKey: 'player.double' },
    { key: 'mixte', translationKey: 'player.mixte' },
  ];

  const bestDiscipline = quickStats?.bestRanking?.discipline ?? null;

  // ----------------------------------------------------------
  // Dashboard content
  // ----------------------------------------------------------
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          colors={['#2563eb']}
          tintColor="#2563eb"
        />
      }
    >
      {/* Greeting */}
      <Text style={styles.greeting}>
        {t(greetingKey, { name: displayName })}
      </Text>

      {/* Quick Stats Row */}
      {quickStats ? (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {quickStats.bestRanking
                ? quickStats.bestRanking.classement
                : t('dashboard.unranked')}
            </Text>
            <Text style={styles.statLabel}>{t('dashboard.bestRanking')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{quickStats.matchCount}</Text>
            <Text style={styles.statLabel}>{t('dashboard.matchesPlayed')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{quickStats.winRate}%</Text>
            <Text style={styles.statLabel}>{t('dashboard.winRate')}</Text>
          </View>
        </View>
      ) : null}

      {/* Rankings Section */}
      <Text style={styles.sectionTitle}>{t('dashboard.rankings')}</Text>
      <View style={styles.rankingRow}>
        {disciplines.map(({ key, translationKey }) => {
          const ranking = profile?.rankings[key];
          const classement = getRankLabel(ranking?.classement);
          const cpph = ranking?.cpph;
          const gaps = getRankGaps(cpph, classement);
          const isBest = key === bestDiscipline;

          return (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.rankingCard,
                isBest && styles.rankingCardBest,
                pressed && styles.rankingCardPressed,
              ]}
              onPress={() => {
                router.push('/ranking-chart');
              }}
            >
              <Text style={styles.rankingDiscipline}>{t(translationKey)}</Text>
              <Text
                style={[
                  styles.rankingClassement,
                  isBest && styles.rankingClassementBest,
                ]}
              >
                {classement}
              </Text>
              {cpph != null ? (
                <Text style={styles.rankingCpph}>{cpph.toFixed(1)} pts</Text>
              ) : null}
              {gaps.toNext != null && gaps.nextRank ? (
                <Text style={styles.rankingGap}>
                  {t('dashboard.pointsToNext', {
                    points: Math.ceil(gaps.toNext),
                    rank: gaps.nextRank,
                  })}
                </Text>
              ) : null}
              {gaps.toPrev != null && gaps.prevRank ? (
                <Text style={styles.rankingGapDown}>
                  {t('dashboard.pointsAbovePrev', {
                    points: Math.floor(gaps.toPrev),
                    rank: gaps.prevRank,
                  })}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Recent Matches Section */}
      <Text style={styles.sectionTitle}>{t('dashboard.recentMatches')}</Text>
      {recentMatches.length === 0 ? (
        <Text style={styles.noMatches}>{t('dashboard.noMatches')}</Text>
      ) : (
        <View style={styles.matchesContainer}>
          {recentMatches.map((match, index) => (
            <MatchRow key={index} match={match} t={t} />
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.viewAllLink,
              pressed && styles.viewAllLinkPressed,
            ]}
            onPress={() => {
              router.push('/(app)/(tabs)/matches');
            }}
          >
            <Text style={styles.viewAllText}>
              {t('dashboard.viewAllMatches')} {'\u203A'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// ============================================================
// Match Row Sub-component
// ============================================================

interface MatchRowProps {
  match: MatchPreview;
  t: (key: string) => string;
}

function MatchRow({ match, t }: MatchRowProps) {
  // Determine badge style based on win/loss/unknown
  let badgeStyle = styles.badgeUnknown;
  let badgeText = '?';

  if (match.isWin === true) {
    badgeStyle = styles.badgeWin;
    badgeText = t('dashboard.victory');
  } else if (match.isWin === false) {
    badgeStyle = styles.badgeLoss;
    badgeText = t('dashboard.defeat');
  }

  return (
    <View style={styles.matchRow}>
      <View style={[styles.badge, badgeStyle]}>
        <Text style={styles.badgeText}>{badgeText}</Text>
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchOpponent} numberOfLines={1}>
          {match.opponent ?? '-'}
        </Text>
        {match.event ? (
          <Text style={styles.matchEvent} numberOfLines={1}>
            {match.event}
          </Text>
        ) : null}
      </View>
      <Text style={styles.matchScore}>{match.score ?? '-'}</Text>
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
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },

  // Greeting
  greeting: {
    fontSize: 20,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 16,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },

  // Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
    marginTop: 4,
  },

  // Ranking Cards
  rankingRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  rankingCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  rankingCardBest: {
    borderColor: '#2563eb',
    backgroundColor: '#f0f7ff',
  },
  rankingCardPressed: {
    opacity: 0.7,
  },
  rankingDiscipline: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  rankingClassement: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 2,
  },
  rankingClassementBest: {
    color: '#2563eb',
  },
  rankingCpph: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  rankingGap: {
    fontSize: 10,
    color: '#16a34a',
    textAlign: 'center',
  },
  rankingGapDown: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },

  // Matches
  matchesContainer: {
    marginBottom: 12,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
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
  matchInfo: {
    flex: 1,
  },
  matchOpponent: {
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  matchEvent: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  matchScore: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginLeft: 8,
  },

  // No matches
  noMatches: {
    fontSize: 15,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 16,
  },

  // View all link
  viewAllLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllLinkPressed: {
    opacity: 0.6,
  },
  viewAllText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '500',
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
