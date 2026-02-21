import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useClubLeaderboard } from '../../../src/hooks/useClubLeaderboard';
import { useClubSearch } from '../../../src/hooks/useClubSearch';
import { useSession } from '../../../src/auth/context';
import { getPlayerProfile } from '../../../src/api/ffbad';
import type { LeaderboardEntry } from '../../../src/utils/clubLeaderboard';
import type { ClubSearchResult } from '../../../src/hooks/useClubSearch';

const Separator = () => <View style={styles.separator} />;

// ============================================================
// Club Info Card Component
// ============================================================

function ClubInfoCard({ info }: { info: NonNullable<ReturnType<typeof useClubLeaderboard>['clubInfo']> }) {
  const { t } = useTranslation();

  const openLink = (url: string) => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(fullUrl);
  };

  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>{info.name}</Text>

      {info.city ? (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.infoText}>
            {info.address ? `${info.address}, ` : ''}{info.city}
          </Text>
        </View>
      ) : null}

      {info.mail ? (
        <Pressable style={styles.infoRow} onPress={() => Linking.openURL(`mailto:${info.mail}`)}>
          <Ionicons name="mail-outline" size={16} color="#6b7280" />
          <Text style={[styles.infoText, styles.infoLink]}>{info.mail}</Text>
        </Pressable>
      ) : null}

      {info.phone ? (
        <Pressable style={styles.infoRow} onPress={() => Linking.openURL(`tel:${info.phone}`)}>
          <Ionicons name="call-outline" size={16} color="#6b7280" />
          <Text style={[styles.infoText, styles.infoLink]}>{info.phone}</Text>
        </Pressable>
      ) : null}

      {info.website ? (
        <Pressable style={styles.infoRow} onPress={() => openLink(info.website)}>
          <Ionicons name="globe-outline" size={16} color="#6b7280" />
          <Text style={[styles.infoText, styles.infoLink]} numberOfLines={1}>{info.website}</Text>
        </Pressable>
      ) : null}

      {info.initials ? (
        <View style={styles.infoRow}>
          <Ionicons name="id-card-outline" size={16} color="#6b7280" />
          <Text style={styles.infoText}>{info.initials}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// Main Club Tab Screen
// ============================================================

export default function ClubScreen() {
  const { t } = useTranslation();
  const { session } = useSession();

  // User's own club state
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [userClubLoading, setUserClubLoading] = useState(true);

  // Viewing state — null means show user's own club
  const [targetClubId, setTargetClubId] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // The club currently displayed in the leaderboard
  const displayClubId = targetClubId ?? userClubId;

  const {
    members,
    clubName,
    clubInfo,
    rankedCount,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = useClubLeaderboard(displayClubId);

  const { clubs: searchResults, isLoading: searchLoading, search } = useClubSearch();

  // ----------------------------------------------------------
  // Fetch user's own club ID on mount
  // ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadUserClub() {
      if (!session?.licence) {
        setUserClubLoading(false);
        return;
      }

      try {
        const profile = await getPlayerProfile(session.licence);
        if (!cancelled && profile?.club) {
          setUserClubId(profile.club);
        }
      } catch {
        // Non-critical — user may still browse clubs manually
      } finally {
        if (!cancelled) {
          setUserClubLoading(false);
        }
      }
    }

    loadUserClub();

    return () => {
      cancelled = true;
    };
  }, [session?.licence]);

  // ----------------------------------------------------------
  // Search mode handlers
  // ----------------------------------------------------------
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      search(query);
    },
    [search]
  );

  const handleSelectClub = useCallback((club: ClubSearchResult) => {
    setTargetClubId(club.id);
    setSearchMode(false);
    setSearchQuery('');
  }, []);

  const handleMyClub = useCallback(() => {
    setTargetClubId(null);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setSearchMode(true);
  }, []);

  const handleCancelSearch = useCallback(() => {
    setSearchMode(false);
    setSearchQuery('');
  }, []);

  // ----------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------
  const renderLeaderboardRow = useCallback(
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

  const renderSearchResult = useCallback(
    ({ item }: { item: ClubSearchResult }) => (
      <Pressable
        style={({ pressed }) => [
          styles.searchResultItem,
          pressed && styles.searchResultItemPressed,
        ]}
        onPress={() => handleSelectClub(item)}
      >
        <Text style={styles.searchResultName}>{item.name}</Text>
      </Pressable>
    ),
    [handleSelectClub]
  );

  // ----------------------------------------------------------
  // Search mode render
  // ----------------------------------------------------------
  if (searchMode) {
    return (
      <View style={styles.container}>
        <View style={styles.searchHeader}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('club.searchPlaceholder')}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelButtonPressed,
            ]}
            onPress={handleCancelSearch}
          >
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>

        <View style={styles.searchContent}>
          {searchLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              ItemSeparatorComponent={Separator}
              contentContainerStyle={styles.listContent}
            />
          ) : searchQuery.length >= 3 ? (
            <View style={styles.centered}>
              <Text style={styles.hintText}>{t('club.noResults')}</Text>
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.hintText}>{t('club.searchMinChars')}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Loading state (initial fetch of user's club)
  // ----------------------------------------------------------
  if (userClubLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // No club state
  // ----------------------------------------------------------
  if (!displayClubId && !userClubLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noClubText}>{t('club.noClub')}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.browseButton,
            pressed && styles.browseButtonPressed,
          ]}
          onPress={handleOpenSearch}
        >
          <Text style={styles.browseButtonText}>{t('club.browseClubs')}</Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Leaderboard loading state
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
  // Club view
  // ----------------------------------------------------------
  const isViewingOtherClub = targetClubId !== null && targetClubId !== userClubId;
  const hasMembers = members.length > 0;

  return (
    <View style={styles.container}>
      {/* Club header */}
      <View style={styles.clubHeader}>
        <View style={styles.clubHeaderLeft}>
          <Text style={styles.clubHeaderName} numberOfLines={2}>
            {clubName || t('club.title')}
          </Text>
          {hasMembers ? (
            <Text style={styles.clubHeaderCount}>
              {t('club.members', { count: rankedCount })}
            </Text>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.searchIconButton,
            pressed && styles.searchIconButtonPressed,
          ]}
          onPress={handleOpenSearch}
        >
          <Ionicons name="search" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {/* "My Club" button when viewing another club */}
      {isViewingOtherClub ? (
        <Pressable
          style={({ pressed }) => [
            styles.myClubButton,
            pressed && styles.myClubButtonPressed,
          ]}
          onPress={handleMyClub}
        >
          <Text style={styles.myClubButtonText}>{t('club.myClub')}</Text>
        </Pressable>
      ) : null}

      {/* Club info + Members */}
      {hasMembers ? (
        <FlatList
          data={members}
          keyExtractor={(item) => item.licence}
          renderItem={renderLeaderboardRow}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={clubInfo ? <ClubInfoCard info={clubInfo} /> : null}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={['#2563eb']}
              tintColor="#2563eb"
            />
          }
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={clubInfo ? <ClubInfoCard info={clubInfo} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyMembersContainer}>
              <Ionicons name="people-outline" size={36} color="#d1d5db" />
              <Text style={styles.emptyText}>{t('club.membersUnavailable')}</Text>
            </View>
          }
          contentContainerStyle={styles.infoListContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={['#2563eb']}
              tintColor="#2563eb"
            />
          }
        />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  clubHeaderLeft: {
    flex: 1,
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
  searchIconButton: {
    padding: 8,
  },
  searchIconButtonPressed: {
    opacity: 0.6,
  },

  // Club info card
  infoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  infoLink: {
    color: '#2563eb',
  },

  // "My Club" button
  myClubButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    alignSelf: 'flex-start',
  },
  myClubButtonPressed: {
    backgroundColor: '#eff6ff',
  },
  myClubButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },

  // Leaderboard rows
  listContent: {
    paddingVertical: 4,
  },
  infoListContent: {
    paddingBottom: 24,
  },
  emptyMembersContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
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

  // Search mode
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    color: '#111',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelButtonPressed: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#2563eb',
  },
  searchContent: {
    flex: 1,
  },
  searchResultItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  searchResultItemPressed: {
    backgroundColor: '#f3f4f6',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },

  // No club state
  noClubText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  browseButtonPressed: {
    backgroundColor: '#1d4ed8',
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
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
