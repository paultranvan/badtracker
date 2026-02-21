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
  type ClubGenderFilter,
  sortLeaderboardByDiscipline,
  filterByGender,
} from '../../../src/utils/clubLeaderboard';
import type { ClubSearchResult } from '../../../src/hooks/useClubSearch';
import { Card } from '../../../src/components';

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

  const [showClubInfo, setShowClubInfo] = useState(false);
  const [disciplineFilter, setDisciplineFilter] = useState<ClubDisciplineFilter>('all');
  const [genderFilter, setGenderFilter] = useState<ClubGenderFilter>('all');

  const filteredMembers = useMemo(() => {
    const sorted = sortLeaderboardByDiscipline(members, disciplineFilter);
    return filterByGender(sorted, genderFilter);
  }, [members, disciplineFilter, genderFilter]);

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
      <ClubMemberRow
        item={item}
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
        <Pressable
          className="flex-1 flex-row items-center gap-1"
          onPress={() => clubInfo && setShowClubInfo((v) => !v)}
        >
          <View className="flex-1">
            <Text className="text-title text-gray-900" numberOfLines={2}>
              {clubName || t('club.title')}
            </Text>
            {hasMembers ? (
              <Text className="text-caption text-muted mt-0.5">
                {t('club.members', { count: members.length, ranked: rankedCount })}
              </Text>
            ) : null}
          </View>
          {clubInfo ? (
            <Ionicons
              name={showClubInfo ? 'chevron-up' : 'information-circle-outline'}
              size={20}
              color="#6b7280"
            />
          ) : null}
        </Pressable>
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

      {/* Filter chips */}
      {hasMembers ? (
        <View className="border-b border-gray-100">
          {/* Discipline filter */}
          <View className="flex-row gap-2 px-4 pt-2.5 pb-1.5">
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
          {/* Gender filter */}
          <View className="flex-row gap-2 px-4 pb-2.5 pt-1">
            {(['all', 'M', 'F'] as ClubGenderFilter[]).map((key) => {
              const isActive = genderFilter === key;
              const labelKey = key === 'all' ? 'club.genderAll' : key === 'M' ? 'club.genderMen' : 'club.genderWomen';
              return (
                <Pressable
                  key={key}
                  className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                  onPress={() => setGenderFilter(key)}
                >
                  <Text className={`text-[13px] font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                    {t(labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
          ListHeaderComponent={showClubInfo && clubInfo ? <ClubInfoCard info={clubInfo} /> : null}
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
          ListHeaderComponent={showClubInfo && clubInfo ? <ClubInfoCard info={clubInfo} /> : null}
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

// ============================================================
// Club Member Row Component (shows all 3 ranks)
// ============================================================

function ClubMemberRow({
  item,
  isCurrentUser,
  onPress,
}: {
  item: LeaderboardEntry;
  isCurrentUser: boolean;
  onPress: () => void;
}) {
  const genderColor = item.sex === 'F' ? '#ec4899' : '#3b82f6';

  return (
    <Pressable
      className={`flex-row items-center px-4 py-3 ${isCurrentUser ? 'bg-primary-bg border-l-[3px] border-l-primary' : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      {/* Position */}
      <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
        <Text className="text-caption font-bold text-gray-600">
          {item.position}
        </Text>
      </View>

      {/* Name + gender indicator */}
      <View className="flex-1 mr-2">
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name={item.sex === 'F' ? 'female' : 'male'}
            size={14}
            color={genderColor}
          />
          <Text className="text-body font-semibold text-gray-900 flex-1" numberOfLines={1}>
            {item.nom} {item.prenom}
          </Text>
        </View>
        {/* All 3 ranks row */}
        <View className="flex-row items-center gap-2 mt-1">
          <RankBadge label="S" rank={item.simpleRank} color="#3b82f6" bgColor="#dbeafe" />
          <RankBadge label="D" rank={item.doubleRank} color="#10b981" bgColor="#d1fae5" />
          <RankBadge label="M" rank={item.mixteRank} color="#f59e0b" bgColor="#fef3c7" />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  );
}

// ============================================================
// Rank Badge Sub-component
// ============================================================

function RankBadge({ label, rank, color, bgColor }: { label: string; rank: string; color: string; bgColor: string }) {
  if (!rank || rank === 'NC') {
    return (
      <View className="flex-row items-center gap-1">
        <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
        <Text className="text-[11px] text-gray-300">NC</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1">
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      <View style={{ backgroundColor: bgColor }} className="rounded px-1.5 py-0.5">
        <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{rank}</Text>
      </View>
    </View>
  );
}
