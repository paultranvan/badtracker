import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useClubLeaderboard } from '../../../src/hooks/useClubLeaderboard';
import { useSession } from '../../../src/auth/context';
import type { LeaderboardEntry } from '../../../src/utils/clubLeaderboard';

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
    ({ item }: { item: LeaderboardEntry }) => {
      const isCurrentUser = item.licence === session?.licence;

      return (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            isCurrentUser && styles.rowHighlighted,
            pressed && styles.rowPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: '/player/[licence]',
              params: { licence: item.licence },
            })
          }
        >
          <Text style={styles.rowPosition}>#{item.position}</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.nom} {item.prenom}
            </Text>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{item.bestRank}</Text>
          </View>
        </Pressable>
      );
    },
    [session?.licence]
  );

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
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
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
  // Leaderboard view
  // ----------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Club header */}
      <View style={styles.clubHeader}>
        <Text style={styles.clubHeaderName} numberOfLines={2}>
          {clubName || t('club.title')}
        </Text>
        <Text style={styles.clubHeaderCount}>
          {t('club.members', { count: rankedCount })}
        </Text>
      </View>

      {/* Leaderboard list */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.licence}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={
          members.length === 0 ? styles.emptyContainer : styles.listContent
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
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('club.noMembers')}</Text>
          </View>
        }
      />
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

  // Club header
  clubHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  clubHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  clubHeaderCount: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },

  // Leaderboard rows
  listContent: {
    paddingVertical: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
  },
  rowHighlighted: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowPosition: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 36,
  },
  rowInfo: {
    flex: 1,
    marginHorizontal: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },
  rankBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Error state
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
