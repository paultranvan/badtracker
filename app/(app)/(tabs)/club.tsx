import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useClubLeaderboard } from '../../../src/hooks/useClubLeaderboard';
import { useClubSearch } from '../../../src/hooks/useClubSearch';
import { useSession } from '../../../src/auth/context';
import { getPlayerProfile } from '../../../src/api/ffbad';
import {
  type LeaderboardEntry,
  type ClubDisciplineFilter,
  sortLeaderboardByDiscipline,
  getDisplayRank,
} from '../../../src/utils/clubLeaderboard';
import type { ClubSearchResult } from '../../../src/hooks/useClubSearch';
import { Card, PlayerRow } from '../../../src/components';

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
    <Card className="mx-4 mt-4 overflow-hidden">
      <View className="h-1.5 bg-primary" />
      <View className="p-4">
        <Text className="text-[17px] font-bold text-gray-900 mb-3">{info.name}</Text>

        {info.city ? (
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text className="text-body text-gray-700 flex-1">
              {info.address ? `${info.address}, ` : ''}{info.city}
            </Text>
          </View>
        ) : null}

        {info.mail ? (
          <Pressable className="flex-row items-center gap-2 mb-2" onPress={() => Linking.openURL(`mailto:${info.mail}`)}>
            <Ionicons name="mail-outline" size={16} color="#6b7280" />
            <Text className="text-body text-primary flex-1">{info.mail}</Text>
          </Pressable>
        ) : null}

        {info.phone ? (
          <Pressable className="flex-row items-center gap-2 mb-2" onPress={() => Linking.openURL(`tel:${info.phone}`)}>
            <Ionicons name="call-outline" size={16} color="#6b7280" />
            <Text className="text-body text-primary flex-1">{info.phone}</Text>
          </Pressable>
        ) : null}

        {info.website ? (
          <Pressable className="flex-row items-center gap-2 mb-2" onPress={() => openLink(info.website)}>
            <Ionicons name="globe-outline" size={16} color="#6b7280" />
            <Text className="text-body text-primary flex-1" numberOfLines={1}>{info.website}</Text>
          </Pressable>
        ) : null}

        {info.initials ? (
          <View className="flex-row items-center gap-2">
            <Ionicons name="id-card-outline" size={16} color="#6b7280" />
            <Text className="text-body text-gray-700 flex-1">{info.initials}</Text>
          </View>
        ) : null}
      </View>
    </Card>
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

  const [disciplineFilter, setDisciplineFilter] = useState<ClubDisciplineFilter>('all');

  const filteredMembers = useMemo(
    () => sortLeaderboardByDiscipline(members, disciplineFilter),
    [members, disciplineFilter]
  );

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
    ({ item }: { item: LeaderboardEntry }) => (
      <PlayerRow
        name={`${item.nom} ${item.prenom}`}
        rank={getDisplayRank(item, disciplineFilter)}
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
    [session?.licence, disciplineFilter]
  );

  const renderSearchResult = useCallback(
    ({ item }: { item: ClubSearchResult }) => (
      <Pressable
        className="px-4 py-3 active:bg-gray-50"
        onPress={() => handleSelectClub(item)}
      >
        <Text className="text-body font-medium text-gray-900">{item.name}</Text>
      </Pressable>
    ),
    [handleSelectClub]
  );

  // ----------------------------------------------------------
  // Search mode render
  // ----------------------------------------------------------
  if (searchMode) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center gap-2 px-4 pt-4 pb-2 bg-white border-b border-gray-200">
          <View className="flex-1 flex-row items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
            <Ionicons name="search" size={18} color="#9ca3af" />
            <TextInput
              className="flex-1 ml-2 text-body text-gray-900"
              placeholder={t('club.searchPlaceholder')}
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => { setSearchQuery(''); search(''); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#d1d5db" />
              </Pressable>
            )}
          </View>
          <Pressable
            className="px-2 py-1 active:opacity-60"
            onPress={handleCancelSearch}
          >
            <Text className="text-body text-primary">{t('common.cancel')}</Text>
          </Pressable>
        </View>

        <View className="flex-1">
          {searchLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
              contentContainerStyle={{ paddingVertical: 4 }}
            />
          ) : searchQuery.length >= 3 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-body text-gray-400 text-center">{t('club.noResults')}</Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-body text-gray-400 text-center">{t('club.searchMinChars')}</Text>
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // No club state
  // ----------------------------------------------------------
  if (!displayClubId && !userClubLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-body text-muted text-center mb-5">{t('club.noClub')}</Text>
        <Pressable
          className="bg-primary px-6 py-2.5 rounded-lg active:bg-primary-dark"
          onPress={handleOpenSearch}
        >
          <Text className="text-white text-body font-semibold">{t('club.browseClubs')}</Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Leaderboard loading state
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
  // Club view
  // ----------------------------------------------------------
  const isViewingOtherClub = targetClubId !== null && targetClubId !== userClubId;
  const hasMembers = members.length > 0;

  return (
    <View className="flex-1 bg-white">
      {/* Club header */}
      <View className="flex-row items-center px-4 pt-4 pb-2 border-b border-gray-200 bg-white">
        <View className="flex-1">
          <Text className="text-title text-gray-900" numberOfLines={2}>
            {clubName || t('club.title')}
          </Text>
          {hasMembers ? (
            <Text className="text-caption text-muted mt-0.5">
              {t('club.members', { count: rankedCount })}
            </Text>
          ) : null}
        </View>
        <Pressable
          className="p-2 active:opacity-60"
          onPress={handleOpenSearch}
        >
          <Ionicons name="search" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {/* "My Club" button when viewing another club */}
      {isViewingOtherClub ? (
        <Pressable
          className="mx-4 mt-2 mb-1 self-start px-3.5 py-2 rounded-lg border border-primary active:bg-primary-bg"
          onPress={handleMyClub}
        >
          <Text className="text-body font-medium text-primary">{t('club.myClub')}</Text>
        </Pressable>
      ) : null}

      {/* Discipline filter chips */}
      {hasMembers ? (
        <View className="flex-row gap-2 px-4 py-2.5 border-b border-gray-100">
          {(['all', 'simple', 'double', 'mixte'] as ClubDisciplineFilter[]).map((key) => {
            const isActive = disciplineFilter === key;
            const labelKey = key === 'all' ? 'club.filterAll' : `club.filter${key.charAt(0).toUpperCase() + key.slice(1)}`;
            return (
              <Pressable
                key={key}
                className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                onPress={() => setDisciplineFilter(key)}
              >
                <Text className={`text-[13px] font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                  {t(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Club info + Members */}
      {hasMembers ? (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.licence}
          renderItem={renderLeaderboardRow}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
          contentContainerStyle={{ paddingVertical: 4 }}
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
            <View className="items-center py-8 px-6 gap-2">
              <Ionicons name="people-outline" size={36} color="#d1d5db" />
              <Text className="text-body text-gray-400 text-center">{t('club.membersUnavailable')}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
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
