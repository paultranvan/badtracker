import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDashboardData } from '../../../src/hooks/useDashboardData';
import { getRankLabel } from '../../../src/utils/rankings';
import { useSession } from '../../../src/auth/context';
import { StatCard, SectionHeader, MatchCard, Card } from '../../../src/components';

// ============================================================
// Discipline config
// ============================================================

const disciplineColors: Record<string, string> = {
  simple: '#3b82f6',
  double: '#10b981',
  mixte: '#f59e0b',
};

const disciplines: Array<{
  key: 'simple' | 'double' | 'mixte';
  translationKey: string;
}> = [
  { key: 'simple', translationKey: 'player.simple' },
  { key: 'double', translationKey: 'player.double' },
  { key: 'mixte', translationKey: 'player.mixte' },
];

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
      <View className="flex-1 items-center justify-center bg-white px-6">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------
  if (error && !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-[16px] text-loss text-center mb-4">{t(error)}</Text>
        <Pressable
          className="bg-primary px-6 py-2.5 rounded-lg active:bg-primary-dark"
          onPress={() => refresh()}
        >
          <Text className="text-white text-[16px] font-semibold">{t('common.retry')}</Text>
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
  // Ranking data
  // ----------------------------------------------------------
  const bestDiscipline = quickStats?.bestRanking?.discipline ?? null;

  // ----------------------------------------------------------
  // Dashboard content
  // ----------------------------------------------------------
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="p-4 pb-8"
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
      <Text className="text-title text-gray-700 mb-4">
        {t(greetingKey, { name: displayName })}
      </Text>

      {/* Quick Stats Row */}
      {quickStats ? (
        <View className="flex-row gap-2 mb-5">
          <StatCard
            value={quickStats.bestRanking ? quickStats.bestRanking.classement : t('dashboard.unranked')}
            label={t('dashboard.bestRanking')}
            icon="trophy-outline"
            iconColor="#d97706"
            highlight
          />
          <StatCard
            value={String(quickStats.matchCount)}
            label={t('dashboard.matchesPlayed')}
            icon="fitness-outline"
          />
          <StatCard
            value={`${quickStats.winRate}%`}
            label={t('dashboard.winRate')}
            icon="analytics-outline"
          />
        </View>
      ) : null}

      {/* Rankings Section */}
      <SectionHeader title={t('dashboard.rankings')} />
      <View className="flex-row gap-2 mb-5">
        {disciplines.map(({ key, translationKey }) => {
          const ranking = profile?.rankings[key];
          const classement = getRankLabel(ranking?.classement);
          const cpph = ranking?.cpph;
          const isBest = key === bestDiscipline;

          return (
            <Pressable
              key={key}
              className="flex-1"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              onPress={() => router.push('/ranking-chart')}
            >
              <Card
                className={`items-center p-3 border-t-[3px] ${isBest ? 'shadow-md' : ''}`}
                style={{ borderTopColor: disciplineColors[key] }}
              >
                <Text className="text-caption text-muted mb-1 uppercase">{t(translationKey)}</Text>
                <Text className={`text-[22px] font-bold mb-0.5 ${isBest ? 'text-primary' : 'text-gray-700'}`}>
                  {classement}
                </Text>
                {cpph != null && (
                  <Text className="text-caption text-muted">{cpph.toFixed(1)} pts</Text>
                )}
              </Card>
            </Pressable>
          );
        })}
      </View>

      {/* Recent Matches Section */}
      <SectionHeader title={t('dashboard.recentMatches')} />
      {recentMatches.length === 0 ? (
        <Text className="text-body text-gray-400 italic mb-4">{t('dashboard.noMatches')}</Text>
      ) : (
        <View className="mb-3">
          {recentMatches.map((match, index) => {
            let badgeLabel = '?';
            if (match.isWin === true) badgeLabel = t('dashboard.victory');
            else if (match.isWin === false) badgeLabel = t('dashboard.defeat');

            return (
              <MatchCard
                key={index}
                isWin={match.isWin}
                badgeLabel={badgeLabel}
                opponent={match.opponent ?? '-'}
                event={match.tournament}
                score={match.score}
              />
            );
          })}
          <Pressable
            className="py-3 items-center mt-1 active:opacity-60"
            onPress={() => router.push('/(app)/(tabs)/matches')}
          >
            <Text className="text-body font-medium text-primary">{t('dashboard.viewAllMatches')} {'\u203A'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
