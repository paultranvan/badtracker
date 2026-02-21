import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useClubLeaderboard } from '../../../src/hooks/useClubLeaderboard';
import { useSession } from '../../../src/auth/context';
import type { LeaderboardEntry } from '../../../src/utils/clubLeaderboard';
import { PlayerRow } from '../../../src/components';

// ============================================================
// Club Leaderboard Stack Screen
// ============================================================

/**
 * Displays the leaderboard for a specific club, accessible via deep navigation
 * from player profiles. Receives the club ID as a route parameter.
 *
 * Unlike the Club tab, this screen:
 * - Does NOT include club search functionality
 * - Shows only the targeted club's leaderboard
 */
export default function ClubLeaderboardScreen() {
  const { t } = useTranslation();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { session } = useSession();

  const {
    members,
    clubName,
    rankedCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = useClubLeaderboard(clubId ?? null);

  // ----------------------------------------------------------
  // Row renderer
  // ----------------------------------------------------------
  const renderRow = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <PlayerRow
        name={`${item.nom} ${item.prenom}`}
        rank={item.bestRank}
        position={item.position}
        isCurrentUser={item.licence === session?.licence}
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: { licence: item.licence },
          })
        }
      />
    ),
    [session?.licence]
  );

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-body text-loss text-center mb-4">{error}</Text>
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
  // Leaderboard view
  // ----------------------------------------------------------
  return (
    <View className="flex-1 bg-white">
      {/* Club header */}
      <View className="px-4 pt-4 pb-2 border-b border-gray-200 bg-white">
        <Text className="text-title text-gray-900" numberOfLines={2}>
          {clubName || t('club.title')}
        </Text>
        <Text className="text-caption text-muted mt-0.5">
          {t('club.members', { count: rankedCount })}
        </Text>
      </View>

      {/* Leaderboard list */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.licence}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
        contentContainerStyle={
          members.length === 0 ? { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 } : { paddingVertical: 4 }
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <View className="items-center gap-2">
            <Ionicons name="people-outline" size={36} color="#d1d5db" />
            <Text className="text-body text-gray-400 italic text-center">{t('club.noMembers')}</Text>
          </View>
        }
      />
    </View>
  );
}
