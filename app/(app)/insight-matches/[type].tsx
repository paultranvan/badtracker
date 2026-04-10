import { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSession } from '../../../src/auth/context';
import { useDashboardData } from '../../../src/hooks/useDashboardData';
import { useInsights } from '../../../src/hooks/useInsights';
import { DetailMatchCard } from '../../../src/components';
import {
  getMatchesForInsight,
  INSIGHT_TYPES,
  type InsightType,
  type InsightsData,
} from '../../../src/utils/insights';

interface HeaderInfo {
  emoji: string;
  label: string;
  title: string;
  subtitle: string;
}

function isValidInsightType(x: string | undefined): x is InsightType {
  return !!x && (INSIGHT_TYPES as readonly string[]).includes(x);
}

function getHeaderInfo(
  type: InsightType,
  insights: InsightsData,
  t: TFunction
): HeaderInfo | null {
  switch (type) {
    case 'winStreak':
      if (!insights.winStreak) return null;
      return {
        emoji: '🔥',
        label: t('insights.longestStreak'),
        title: `${insights.winStreak.count}`,
        subtitle: t('insights.consecutiveWins'),
      };
    case 'recentForm':
      if (!insights.recentForm) return null;
      return {
        emoji: '📊',
        label: t('insights.recentForm'),
        title: t('insights.lastNMatches', { count: insights.recentForm.results.length }),
        subtitle: '',
      };
    case 'biggestUpset':
      if (!insights.biggestUpset) return null;
      return {
        emoji: '💥',
        label: t('insights.biggestUpset'),
        title: t('insights.vsRank', { rank: insights.biggestUpset.opponentRank }),
        subtitle: t('insights.youWere', { rank: insights.biggestUpset.playerRank }),
      };
    case 'cpphMomentum': {
      if (!insights.cpphMomentum) return null;
      const total = insights.cpphMomentum.total;
      const sign = total >= 0 ? '+' : '';
      return {
        emoji: total >= 0 ? '↑' : '↓',
        label: t('insights.cpphMomentum'),
        title: `${sign}${total.toFixed(1)}`,
        subtitle: t('insights.lastNMatches', { count: insights.cpphMomentum.matchCount }),
      };
    }
    case 'bestTournament':
      if (!insights.bestTournament) return null;
      return {
        emoji: '🏆',
        label: t('insights.bestTournament'),
        title: insights.bestTournament.name,
        subtitle: t('insights.tournamentStats', {
          wins: insights.bestTournament.wins,
          losses: insights.bestTournament.losses,
          rate: insights.bestTournament.winRate,
        }),
      };
    case 'bestPartner':
      if (!insights.bestPartner) return null;
      return {
        emoji: '🤝',
        label: t('insights.bestPartner'),
        title: insights.bestPartner.name,
        subtitle: t('insights.partnerStats', {
          count: insights.bestPartner.matchCount,
          rate: insights.bestPartner.winRate,
        }),
      };
    case 'nemesis':
      if (!insights.nemesis) return null;
      return {
        emoji: '⚔️',
        label: t('insights.nemesis'),
        title: insights.nemesis.name,
        subtitle: t('insights.nemesisStats', {
          wins: insights.nemesis.wins,
          losses: insights.nemesis.losses,
        }),
      };
    case 'mostPlayed':
      if (!insights.mostPlayed) return null;
      return {
        emoji: '🔄',
        label: t('insights.mostPlayed'),
        title: insights.mostPlayed.name,
        subtitle: t('insights.mostPlayedStats', {
          count: insights.mostPlayed.matchCount,
          date: insights.mostPlayed.lastDate,
        }),
      };
  }
}

export default function InsightMatchesScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const params = useLocalSearchParams<{ type: string }>();
  const type = params.type;
  const isValid = isValidInsightType(type);

  const { allDetailMatches, detailsLoading } = useDashboardData();
  const insights = useInsights(allDetailMatches, detailsLoading);

  const playerName = session ? `${session.prenom} ${session.nom}` : undefined;

  const filteredMatches = useMemo(() => {
    if (!isValid || !insights) return [];
    return getMatchesForInsight(type as InsightType, allDetailMatches, insights);
  }, [isValid, type, allDetailMatches, insights]);

  const headerInfo = useMemo(() => {
    if (!isValid || !insights) return null;
    return getHeaderInfo(type as InsightType, insights, t);
  }, [isValid, type, insights, t]);

  if (!isValid) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Stack.Screen options={{ title: t('insightMatches.title') }} />
        <Text className="text-body text-gray-400 italic">{t('insightMatches.empty')}</Text>
      </View>
    );
  }

  if (!insights) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: t('insightMatches.title') }} />
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: t('insightMatches.title') }} />
      <FlatList
        data={filteredMatches}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          headerInfo ? (
            <View className="px-4 py-4 border-b border-gray-100">
              <Text className="text-caption text-muted uppercase mb-1">{headerInfo.label}</Text>
              <Text className="text-title font-bold text-gray-900 mb-0.5">
                {headerInfo.emoji} {headerInfo.title}
              </Text>
              {headerInfo.subtitle ? (
                <Text className="text-body text-muted">{headerInfo.subtitle}</Text>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text className="text-body text-gray-400 italic text-center py-10 px-6">
            {t('insightMatches.empty')}
          </Text>
        }
        renderItem={({ item }) => (
          <DetailMatchCard match={item} nested={false} playerName={playerName} />
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}
