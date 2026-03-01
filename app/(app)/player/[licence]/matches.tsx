import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useMatchHistory,
  type MatchItem,
  type TournamentSection,
  type DisciplineGroup,
  type DisciplineFilter,
} from '../../../../src/hooks/useMatchHistory';
import { DetailMatchCard } from '../../../../src/components';

// ============================================================
// Stats Header
// ============================================================

function StatsHeader({ wins, losses, isSettled }: { wins: number; losses: number; isSettled: boolean }) {
  const { t } = useTranslation();
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <View className="mx-4 mt-4 mb-3 p-4 bg-primary-bg rounded-xl">
      <Text className="text-caption font-semibold text-gray-500 mb-1">{t('matchHistory.statsHeader')}</Text>
      {isSettled ? (
        <Text className="text-display text-primary">{t('matchHistory.winRate', { rate: winRate })}</Text>
      ) : (
        <ActivityIndicator size="small" color="#2563eb" style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
      )}
      <View className="flex-row h-2.5 rounded-full overflow-hidden bg-white mt-2">
        {isSettled && wins > 0 && (
          <View style={{ flex: wins }} className="bg-win rounded-l-full" />
        )}
        {isSettled && losses > 0 && (
          <View style={{ flex: losses }} className="bg-loss rounded-r-full" />
        )}
      </View>
      {isSettled && (
        <View className="flex-row justify-between mt-1">
          <Text className="text-caption font-semibold text-win">{t('matchHistory.wins', { count: wins })}</Text>
          <Text className="text-caption font-semibold text-loss">{t('matchHistory.losses', { count: losses })}</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Tournament Header
// ============================================================

function TournamentHeader({
  title,
  date,
  points,
  isExpanded,
  onToggle,
}: {
  title: string;
  date: string;
  points: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const pointsStr = points >= 0 ? `+${points.toFixed(1)} pts` : `${points.toFixed(1)} pts`;
  const pointsColor = points >= 0 ? 'text-win' : 'text-loss';

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 bg-white border-l-[3px] border-l-primary"
      onPress={onToggle}
    >
      <View className="flex-1">
        <Text className="text-body font-semibold text-gray-900" numberOfLines={1}>{title}</Text>
      </View>
      <Text className="text-caption text-muted mx-2">{date}</Text>
      <Text className={`text-caption font-bold ${pointsColor} mr-1`}>{pointsStr}</Text>
      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
    </Pressable>
  );
}

// ============================================================
// Discipline Row
// ============================================================

function DisciplineRow({
  discipline,
  wins,
  losses,
  points,
  isExpanded,
  isLoading,
  onToggle,
}: {
  discipline: 'simple' | 'double' | 'mixte';
  wins: number;
  losses: number;
  points: number;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const letter = discipline === 'simple' ? 'S' : discipline === 'double' ? 'D' : 'M';
  const color = discipline === 'simple' ? '#3b82f6' : discipline === 'double' ? '#10b981' : '#f59e0b';
  const bgColor = discipline === 'simple' ? '#dbeafe' : discipline === 'double' ? '#d1fae5' : '#fef3c7';
  const pointsStr = points >= 0 ? `+${points.toFixed(1)} pts` : `${points.toFixed(1)} pts`;
  const pointsColor = points >= 0 ? 'text-win' : 'text-loss';

  return (
    <Pressable
      className="flex-row items-center px-4 py-2.5 ml-3 bg-white"
      onPress={onToggle}
    >
      <View className="w-7 h-7 rounded-md items-center justify-center mr-2.5" style={{ backgroundColor: bgColor }}>
        <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{letter}</Text>
      </View>
      <Text className="text-body text-gray-700 capitalize">
        {discipline === 'mixte' ? t('matchHistory.mixte') : discipline === 'double' ? t('matchHistory.double') : t('matchHistory.simple')}
      </Text>
      <View className="flex-row items-center ml-2 gap-1">
        <View className="bg-win-bg rounded-full px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-win">{wins}W</Text>
        </View>
        <View className="bg-loss-bg rounded-full px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-loss">{losses}L</Text>
        </View>
      </View>
      <View className="flex-1" />
      <Text className={`text-caption font-bold ${pointsColor} mr-1`}>{pointsStr}</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color="#9ca3af" />
      ) : (
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#9ca3af" />
      )}
    </Pressable>
  );
}

// ============================================================
// Main Screen
// ============================================================

export default function PlayerMatchesScreen() {
  const { licence, personId, nom } = useLocalSearchParams<{
    licence: string;
    personId: string;
    nom?: string;
  }>();
  const { t } = useTranslation();
  const playerName = nom ?? licence ?? '';

  const {
    tournaments,
    detailCache,
    loadingDetails,
    loadDetails,
    activeDiscipline,
    setDiscipline,
    stats,
    isStatsSettled,
    isLoading,
    isRefreshing,
    refresh,
  } = useMatchHistory(personId);

  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  const toggleTournament = useCallback((title: string) => {
    setExpandedTournaments((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
        // Pre-load all disciplines when expanding
        const tournament = tournaments.find((t) => t.title === title);
        if (tournament) {
          for (const dg of tournament.disciplines) {
            const key = `${title}:${dg.discipline}`;
            if (!detailCache.has(key)) {
              loadDetails(title, dg);
            }
          }
        }
      }
      return next;
    });
  }, [tournaments, detailCache, loadDetails]);

  const toggleDiscipline = useCallback((key: string, tournamentTitle: string, dg: DisciplineGroup) => {
    setExpandedDisciplines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!detailCache.has(key)) {
          loadDetails(tournamentTitle, dg);
        }
      }
      return next;
    });
  }, [detailCache, loadDetails]);

  // Build flat render items
  const renderItems = useMemo(() => {
    const items: Array<{ type: string; key: string; data: unknown }> = [];

    for (const tournament of tournaments) {
      items.push({ type: 'tournament', key: `t:${tournament.title}`, data: tournament });

      if (expandedTournaments.has(tournament.title)) {
        for (const dg of tournament.disciplines) {
          const dKey = `${tournament.title}:${dg.discipline}`;
          items.push({ type: 'discipline', key: `d:${dKey}`, data: { ...dg, tournamentTitle: tournament.title, dKey } });

          if (expandedDisciplines.has(dKey)) {
            const detailMatches = detailCache.get(dKey);
            if (detailMatches) {
              for (const match of detailMatches) {
                items.push({ type: 'match', key: `m:${match.id}`, data: { match } });
              }
            } else if (loadingDetails.has(dKey)) {
              items.push({ type: 'loading', key: `l:${dKey}`, data: null });
            }
          }
        }
      }
    }

    return items;
  }, [tournaments, expandedTournaments, expandedDisciplines, detailCache, loadingDetails]);

  const renderItem = useCallback(({ item }: { item: { type: string; key: string; data: unknown } }) => {
    switch (item.type) {
      case 'tournament': {
        const t = item.data as TournamentSection;
        return (
          <TournamentHeader
            title={t.title}
            date={t.date}
            points={t.totalPoints}
            isExpanded={expandedTournaments.has(t.title)}
            onToggle={() => toggleTournament(t.title)}
          />
        );
      }
      case 'discipline': {
        const d = item.data as DisciplineGroup & { tournamentTitle: string; dKey: string };
        return (
          <DisciplineRow
            discipline={d.discipline}
            wins={d.wins}
            losses={d.losses}
            points={d.points}
            isExpanded={expandedDisciplines.has(d.dKey)}
            isLoading={loadingDetails.has(d.dKey)}
            onToggle={() => toggleDiscipline(d.dKey, d.tournamentTitle, d)}
          />
        );
      }
      case 'match': {
        const { match } = item.data as { match: MatchItem };
        return <DetailMatchCard match={match} playerName={playerName} />;
      }
      case 'loading':
        return (
          <View className="py-4 items-center">
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        );
      default:
        return null;
    }
  }, [expandedTournaments, expandedDisciplines, loadingDetails, toggleTournament, toggleDiscipline, playerName]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Dynamic header title */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: t('player.matchesTitle', { name: playerName }),
          headerBackTitle: '',
        }}
      />
      <FlatList
        data={renderItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <StatsHeader wins={stats.wins} losses={stats.losses} isSettled={isStatsSettled} />
            {/* Discipline filters */}
            <View className="flex-row gap-2 px-4 pt-2 pb-2">
              {(['all', 'simple', 'double', 'mixte'] as DisciplineFilter[]).map((key) => {
                const isActive = activeDiscipline === key;
                return (
                  <Pressable
                    key={key}
                    className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                    onPress={() => setDiscipline(key)}
                  >
                    <Text className={`text-[13px] font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                      {key === 'all' ? t('matchHistory.all') : key === 'simple' ? t('matchHistory.simple') : key === 'double' ? t('matchHistory.double') : t('matchHistory.mixte')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        }
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100" />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      />
    </View>
  );
}
