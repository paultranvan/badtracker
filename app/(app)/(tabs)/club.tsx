import { useState, useCallback, useMemo } from 'react';
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
import {
  type LeaderboardEntry,
  type ClubDisciplineFilter,
  type ClubGenderFilter,
  type DisciplineRanking,
  sortLeaderboardByDiscipline,
  filterByGender,
  getSortDiscipline,
  abbreviateCategory,
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

  const userClubId = session?.clubId ?? null;

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
        disciplineFilter={disciplineFilter}
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: {
              licence: item.licence,
              personId: String(item.personId),
              nom: item.name,
            },
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
  // No club state
  // ----------------------------------------------------------
  if (!displayClubId) {
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
            <View className="flex-row items-center gap-2">
              <Ionicons name="people" size={18} color="#2563eb" />
              <Text className="text-title text-gray-900 flex-shrink" numberOfLines={2}>
                {clubName || t('club.title')}
              </Text>
            </View>
            {hasMembers ? (
              <Text className="text-caption text-muted mt-0.5 ml-[26px]">
                {members.length} {t('club.memberCount')} · {rankedCount} {t('club.rankedCount')}
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
              const chipColor = DISCIPLINE_CHIP_COLORS[key];
              return (
                <Pressable
                  key={key}
                  className={`px-3 py-1.5 rounded-full border ${isActive ? 'border-transparent' : 'bg-white border-gray-200'}`}
                  style={isActive ? { backgroundColor: chipColor.bg } : undefined}
                  onPress={() => setDisciplineFilter(key)}
                >
                  <Text
                    className={`text-[13px] font-medium ${isActive ? '' : 'text-gray-700'}`}
                    style={isActive ? { color: chipColor.text } : undefined}
                  >
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
// Club Member Row Component
// ============================================================

const PODIUM_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#FEF3C7', text: '#D97706' },  // gold
  2: { bg: '#F3F4F6', text: '#6B7280' },  // silver
  3: { bg: '#FED7AA', text: '#C2410C' },  // bronze
};

const PODIUM_MEDALS: Record<number, string> = {
  1: '\uD83E\uDD47',  // gold medal
  2: '\uD83E\uDD48',  // silver medal
  3: '\uD83E\uDD49',  // bronze medal
};

const DISCIPLINE_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  all: { bg: '#2563eb', text: '#ffffff' },      // primary blue
  simple: { bg: '#3b82f6', text: '#ffffff' },   // singles blue
  double: { bg: '#10b981', text: '#ffffff' },   // doubles green
  mixte: { bg: '#f59e0b', text: '#ffffff' },    // mixed amber
};

function ClubMemberRow({
  item,
  isCurrentUser,
  disciplineFilter,
  onPress,
}: {
  item: LeaderboardEntry;
  isCurrentUser: boolean;
  disciplineFilter: ClubDisciplineFilter;
  onPress: () => void;
}) {
  const sortDisc = getSortDiscipline(item, disciplineFilter);
  const displayRate = disciplineFilter === 'all'
    ? item.bestRate
    : item[disciplineFilter]?.rate ?? null;

  return (
    <Pressable
      className={`px-4 py-3 ${isCurrentUser ? 'bg-primary-bg border-l-[3px] border-l-primary' : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      {/* Line 1: Position, name (+YOU badge), category, points */}
      <View className="flex-row items-center">
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-3"
          style={{
            backgroundColor: PODIUM_COLORS[item.position]?.bg ?? '#F3F4F6',
          }}
        >
          {PODIUM_MEDALS[item.position] ? (
            <Text className="text-[18px]">{PODIUM_MEDALS[item.position]}</Text>
          ) : (
            <Text
              className="text-caption font-bold"
              style={{
                color: PODIUM_COLORS[item.position]?.text ?? '#6B7280',
              }}
            >
              {item.position}
            </Text>
          )}
        </View>
        <View className="flex-1 flex-shrink flex-row items-center gap-1.5">
          <Text className="text-body font-semibold text-gray-900 flex-shrink" numberOfLines={1}>
            {item.name}
          </Text>
          {isCurrentUser && (
            <View className="bg-primary rounded px-1.5 py-0.5">
              <Text className="text-[9px] font-bold text-white">YOU</Text>
            </View>
          )}
        </View>
        <Text className="text-[11px] text-gray-400 mx-2">
          {abbreviateCategory(item.category)}
        </Text>
        {displayRate != null ? (
          <Text
            className={`font-bold text-gray-800 ${item.position <= 3 ? 'text-[17px]' : 'text-body'}`}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {displayRate}
          </Text>
        ) : (
          <Text className="text-body text-gray-300">-</Text>
        )}
      </View>

      {/* Line 2: 3 rank pills with points */}
      <View className="flex-row items-center gap-2 mt-1.5 ml-11">
        <RankPill
          ranking={item.simple}
          label="S"
          color="#3b82f6"
          bgColor="#dbeafe"
          isSort={sortDisc === 'simple'}
        />
        <RankPill
          ranking={item.double}
          label="D"
          color="#10b981"
          bgColor="#d1fae5"
          isSort={sortDisc === 'double'}
        />
        <RankPill
          ranking={item.mixte}
          label="M"
          color="#f59e0b"
          bgColor="#fef3c7"
          isSort={sortDisc === 'mixte'}
        />
      </View>
    </Pressable>
  );
}

// ============================================================
// Rank Pill Sub-component (shows subLevel + rate)
// ============================================================

function RankPill({
  ranking,
  label,
  color,
  bgColor,
  isSort,
}: {
  ranking: DisciplineRanking | null;
  label: string;
  color: string;
  bgColor: string;
  isSort: boolean;
}) {
  if (!ranking || ranking.subLevel === '-') {
    return (
      <View className="items-center">
        <View className="rounded-md px-2.5 py-1 bg-gray-50">
          <Text className="text-[11px] text-gray-300">NC</Text>
        </View>
        <Text className="text-[9px] text-gray-300 mt-0.5">{label}</Text>
      </View>
    );
  }

  const rateStr = ranking.rate != null ? ` \u00b7 ${ranking.rate}` : '';

  if (isSort) {
    // Active sort pill: filled with discipline color, white text
    return (
      <View className="items-center">
        <View
          style={{ backgroundColor: color }}
          className="rounded-md px-2.5 py-1"
        >
          <Text className="text-[11px] font-bold text-white">
            {ranking.subLevel}{rateStr}
          </Text>
        </View>
        <Text style={{ color }} className="text-[9px] font-bold mt-0.5">{label}</Text>
      </View>
    );
  }

  // Inactive pill: tinted background with colored left border
  return (
    <View className="items-center">
      <View
        style={{ backgroundColor: bgColor }}
        className="rounded-md px-2.5 py-1"
      >
        <Text style={{ color, fontSize: 11, fontWeight: '500' }}>
          {ranking.subLevel}{rateStr}
        </Text>
      </View>
      <Text className="text-[9px] text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}
