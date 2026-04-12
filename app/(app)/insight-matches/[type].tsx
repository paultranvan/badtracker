import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSession } from '../../../src/auth/context';
import { useDashboardData } from '../../../src/hooks/useDashboardData';
import { useInsights } from '../../../src/hooks/useInsights';
import { DetailMatchCard, FullWidthCard, type FullWidthCardProps } from '../../../src/components';
import {
  getMatchesForInsight,
  INSIGHT_TYPES,
  type InsightType,
  type InsightsData,
} from '../../../src/utils/insights';
import type { MatchItem } from '../../../src/utils/matchHistory';

const INSIGHT_BG: Record<InsightType, string> = {
  winStreak: '#fef3c7',
  recentForm: '#f1f5f9',
  biggestUpset: '#dcfce7',
  cpphMomentum: '#f1f5f9',
  bestTournament: '#fef3c7',
  bestPartner: '#dbeafe',
  mostPlayedPartner: '#e0e7ff',
  nemesis: '#fee2e2',
  mostDefeated: '#fef3c7',
  mostPlayed: '#f0fdf4',
  rankingProjection: '#dbeafe',
  seasonComparison: '#dcfce7',
};

function isValidInsightType(x: string | undefined): x is InsightType {
  return !!x && (INSIGHT_TYPES as readonly string[]).includes(x);
}

function getHeaderProps(
  type: InsightType,
  insights: InsightsData,
  matches: MatchItem[],
  t: TFunction
): FullWidthCardProps | null {
  const bgColor = INSIGHT_BG[type];
  switch (type) {
    case 'winStreak': {
      const ws = insights.winStreak;
      return ws
        ? {
            emoji: '🔥',
            bgColor,
            label: t('insights.longestStreak'),
            title: `${ws.count}`,
            subtitle: t('insights.consecutiveWins'),
          }
        : null;
    }
    case 'recentForm': {
      const rf = insights.recentForm;
      return rf
        ? {
            emoji: '📊',
            bgColor,
            label: t('insights.recentForm'),
            title: t('insights.lastNMatches', { count: rf.results.length }),
            subtitle: '',
          }
        : null;
    }
    case 'biggestUpset': {
      const bu = insights.biggestUpset;
      return bu
        ? {
            emoji: '💥',
            bgColor,
            label: t('insights.biggestUpset'),
            title: t('insights.vsRank', { rank: bu.opponentRank }),
            subtitle: t('insights.youWere', { rank: bu.playerRank }),
          }
        : null;
    }
    case 'cpphMomentum': {
      const cm = insights.cpphMomentum;
      if (!cm) return null;
      const sign = cm.total >= 0 ? '+' : '';
      return {
        emoji: cm.total >= 0 ? '↑' : '↓',
        bgColor,
        label: t('insights.cpphMomentum'),
        title: `${sign}${cm.total.toFixed(1)}`,
        subtitle: t('insights.lastNMatches', { count: cm.matchCount }),
      };
    }
    case 'bestTournament': {
      const bt = insights.bestTournament;
      return bt
        ? {
            emoji: '🏆',
            bgColor,
            label: t('insights.bestTournament'),
            title: bt.name,
            subtitle: t('insights.tournamentStats', {
              wins: bt.wins,
              losses: bt.losses,
              rate: bt.winRate,
            }),
          }
        : null;
    }
    case 'bestPartner': {
      const bp = insights.bestPartner;
      return bp
        ? {
            emoji: '🤝',
            bgColor,
            label: t('insights.bestPartner'),
            title: bp.name,
            subtitle: t('insights.partnerStats', {
              count: bp.matchCount,
              rate: bp.winRate,
            }),
          }
        : null;
    }
    case 'mostPlayedPartner': {
      const mpp = insights.mostPlayedPartner;
      return mpp
        ? {
            emoji: '👯',
            bgColor,
            label: t('insights.mostPlayedPartner'),
            title: mpp.name,
            subtitle: t('insights.mostPlayedPartnerStats', {
              count: mpp.matchCount,
              rate: mpp.winRate,
            }),
          }
        : null;
    }
    case 'nemesis': {
      const n = insights.nemesis;
      return n
        ? {
            emoji: '⚔️',
            bgColor,
            label: t('insights.nemesis'),
            title: n.name,
            subtitle: t('insights.nemesisStats', { wins: n.wins, losses: n.losses }),
          }
        : null;
    }
    case 'mostDefeated': {
      const md = insights.mostDefeated;
      return md
        ? {
            emoji: '🎯',
            bgColor,
            label: t('insights.mostDefeated'),
            title: md.name,
            subtitle: t('insights.mostDefeatedStats', { wins: md.wins, losses: md.losses }),
          }
        : null;
    }
    case 'mostPlayed': {
      const mp = insights.mostPlayed;
      return mp
        ? {
            emoji: '🔄',
            bgColor,
            label: t('insights.mostPlayed'),
            title: mp.name,
            subtitle: t('insights.mostPlayedStats', {
              count: mp.matchCount,
              date: mp.lastDate,
            }),
          }
        : null;
    }
    case 'rankingProjection': {
      const rp = insights.rankingProjection;
      return rp
        ? {
            emoji: '🎯',
            bgColor,
            label: t('insights.rankingProjectionDetailTitle'),
            title: t('insights.rankingProjectionTitle', {
              rank: rp.nextRank,
              wins: rp.estimatedWins,
            }),
            subtitle: t('insights.rankingProjectionDetailSubtitle', {
              count: matches.length,
              discipline: t(`player.${rp.discipline}`),
            }),
          }
        : null;
    }
    case 'seasonComparison': {
      const sc = insights.seasonComparison;
      if (!sc) return null;
      const emoji = sc.isBetter ? '📈' : '📉';
      const sign = sc.winRateDelta >= 0 ? '+' : '';
      return {
        emoji,
        bgColor,
        label: t('insights.seasonComparison'),
        title: t('insights.seasonWinRateDelta', { delta: `${sign}${sc.winRateDelta}` }),
        subtitle: t('insights.seasonMatchCount', {
          current: sc.currentMatchCount,
          last: sc.lastMatchCount,
        }),
      };
    }
  }
}

export default function InsightMatchesScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const params = useLocalSearchParams<{ type: string }>();
  const type = params.type;
  const isValid = isValidInsightType(type);

  const { allDetailMatches, detailsLoading, profile } = useDashboardData();
  const insights = useInsights(allDetailMatches, detailsLoading, profile?.rankings);

  const playerName = session ? `${session.prenom} ${session.nom}` : undefined;

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

  const filteredMatches = getMatchesForInsight(type, allDetailMatches, insights);
  const headerProps = getHeaderProps(type, insights, filteredMatches, t);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: t('insightMatches.title') }} />
      <FlatList
        data={filteredMatches}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          headerProps ? (
            <View className="px-3 pt-3 pb-2">
              <FullWidthCard {...headerProps} />
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
