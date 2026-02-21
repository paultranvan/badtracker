import { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  LayoutAnimation,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useMatchHistory,
  type MatchItem,
  type MatchSection,
  type DisciplineFilter,
} from '../../../src/hooks/useMatchHistory';

// ============================================================
// Constants
// ============================================================

const HEADER_MAX_HEIGHT = 140;
const HEADER_COLLAPSE_DISTANCE = HEADER_MAX_HEIGHT;

const DISCIPLINE_FILTERS: Array<{
  key: DisciplineFilter;
  labelKey: string;
}> = [
  { key: 'all', labelKey: 'matchHistory.all' },
  { key: 'simple', labelKey: 'matchHistory.simple' },
  { key: 'double', labelKey: 'matchHistory.double' },
  { key: 'mixte', labelKey: 'matchHistory.mixte' },
];

// ============================================================
// Main Screen
// ============================================================

export default function MatchHistoryScreen() {
  const { t } = useTranslation();
  const scrollY = useSharedValue(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (title: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const {
    sections,
    allMatches,
    stats,
    disciplineCounts,
    availableSeasons,
    activeDiscipline,
    activeSeason,
    isLoading,
    isRefreshing,
    error,
    setDiscipline,
    setSeason,
    refresh,
  } = useMatchHistory();

  // Scroll handler — updates shared value for Reanimated UI-thread animation
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_DISTANCE],
      [HEADER_MAX_HEIGHT, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_COLLAPSE_DISTANCE / 2],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

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
  if (error && allMatches.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-body text-loss text-center mb-4">{t(error)}</Text>
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
  // Empty state message
  // ----------------------------------------------------------
  const emptyMessage =
    allMatches.length === 0
      ? t('matchHistory.noMatches')
      : t('matchHistory.noMatchesForFilter');

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <View className="flex-1 bg-white">
      {/* Collapsible Stats Header */}
      <Animated.View
        className="overflow-hidden bg-primary-bg"
        style={headerAnimatedStyle}
      >
        <StatsHeader stats={stats} t={t} />
      </Animated.View>

      {/* Discipline Filter Chips — only show when discipline data is available */}
      {(disciplineCounts.simple > 0 || disciplineCounts.double > 0 || disciplineCounts.mixte > 0) && (
        <View className="flex-row gap-2 px-4 py-2.5 border-b border-gray-100">
          {DISCIPLINE_FILTERS.map(({ key, labelKey }) => {
            const count = disciplineCounts[key];
            const isActive = activeDiscipline === key;
            return (
              <Pressable
                key={key}
                className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                onPress={() => setDiscipline(key)}
              >
                <Text className={`text-[13px] font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                  {t(labelKey)} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Season Picker */}
      {availableSeasons.length > 0 && (
        <View className="flex-row items-center gap-2 px-4 py-2 border-b border-gray-100">
          <Text className="text-[13px] font-medium text-muted">{t('matchHistory.season')} :</Text>
          <Pressable
            className={`px-3 py-1.5 rounded-full border ${activeSeason === null ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
            onPress={() => setSeason(null)}
          >
            <Text className={`text-[13px] font-medium ${activeSeason === null ? 'text-white' : 'text-gray-700'}`}>
              {t('matchHistory.allSeasons')}
            </Text>
          </Pressable>
          {availableSeasons.map((season) => {
            const isActive = activeSeason === season;
            return (
              <Pressable
                key={season}
                className={`px-3 py-1.5 rounded-full border ${isActive ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                onPress={() => setSeason(season)}
              >
                <Text className={`text-[13px] font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                  {season}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Match List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => {
          const sectionKey = section.title || t('matchHistory.tournamentUnknown');
          return (
            <TournamentHeader
              section={section}
              t={t}
              isExpanded={expandedSections.has(sectionKey)}
              onToggle={() => toggleSection(sectionKey)}
            />
          );
        }}
        renderItem={({ item, section }) => {
          const sectionKey = section.title || t('matchHistory.tournamentUnknown');
          const isExpanded = expandedSections.has(sectionKey);
          return <MatchCardItem match={item} t={t} expanded={isExpanded} />;
        }}
        stickySectionHeadersEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <Text className="text-body text-gray-400 italic text-center py-10 px-6">{emptyMessage}</Text>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
    </View>
  );
}

// ============================================================
// Stats Header Sub-component
// ============================================================

interface StatsHeaderProps {
  stats: { wins: number; losses: number; total: number; winPercentage: number };
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function StatsHeader({ stats, t }: StatsHeaderProps) {
  return (
    <View className="p-4 pb-3">
      <Text className="text-[14px] font-semibold text-gray-700 mb-2">
        {t('matchHistory.statsHeader')}
      </Text>
      <Text className="text-[36px] font-bold text-primary mb-2">
        {t('matchHistory.winRate', { rate: stats.winPercentage })}
      </Text>
      {/* Progress bar */}
      <View className="h-2 bg-loss-bg rounded-full overflow-hidden mb-2">
        <View
          className="h-full bg-win rounded-full"
          style={{ width: stats.total > 0 ? `${stats.winPercentage}%` : 0 }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[14px] font-semibold text-win">
          {t('matchHistory.wins', { count: stats.wins })}
        </Text>
        <Text className="text-[14px] font-semibold text-loss">
          {t('matchHistory.losses', { count: stats.losses })}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Tournament Section Header
// ============================================================

interface TournamentHeaderProps {
  section: MatchSection;
  t: (key: string) => string;
  isExpanded: boolean;
  onToggle: () => void;
}

function TournamentHeader({ section, t, isExpanded, onToggle }: TournamentHeaderProps) {
  const title = section.title || t('matchHistory.tournamentUnknown');
  const wins = section.data.filter((m) => m.isWin === true).length;
  const losses = section.data.filter((m) => m.isWin === false).length;
  return (
    <Pressable
      className="flex-row justify-between items-center px-4 py-2.5 bg-slate-50 border-l-[3px] border-l-primary border-b border-b-gray-200 active:bg-slate-100"
      onPress={onToggle}
    >
      <Text className="text-body font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
        {title}
      </Text>
      <View className="flex-row items-center gap-2">
        {section.date ? (
          <Text className="text-caption text-muted">{section.date}</Text>
        ) : null}
        {wins > 0 && (
          <View className="bg-win/20 px-1.5 py-0.5 rounded">
            <Text className="text-[11px] font-semibold text-win">{wins}W</Text>
          </View>
        )}
        {losses > 0 && (
          <View className="bg-loss/20 px-1.5 py-0.5 rounded">
            <Text className="text-[11px] font-semibold text-loss">{losses}L</Text>
          </View>
        )}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#64748b"
        />
      </View>
    </Pressable>
  );
}

// ============================================================
// Match Card Sub-component (inline details, no accordion)
// ============================================================

interface MatchCardItemProps {
  match: MatchItem;
  t: (key: string, opts?: Record<string, unknown>) => string;
  expanded?: boolean;
}

function MatchCardItem({ match, t, expanded = false }: MatchCardItemProps) {
  const disciplineLetter =
    match.discipline === 'simple' ? 'S'
      : match.discipline === 'double' ? 'D'
        : match.discipline === 'mixte' ? 'M'
          : '';

  const isWin = match.isWin === true;
  const isLoss = match.isWin === false;

  const borderClass = isWin ? 'border-l-win' : isLoss ? 'border-l-loss' : 'border-l-gray-300';
  const badgeBg = isWin ? 'bg-win' : isLoss ? 'bg-loss' : 'bg-gray-300';
  const badgeText = isWin ? t('matchHistory.victory') : isLoss ? t('matchHistory.defeat') : '?';

  const pointsText = match.pointsImpact != null
    ? (match.pointsImpact >= 0 ? `+${match.pointsImpact.toFixed(1)}` : match.pointsImpact.toFixed(1)) + ' pts'
    : null;
  const pointsClass = match.pointsImpact != null && match.pointsImpact >= 0 ? 'text-win' : 'text-loss';

  // Discipline badge colors
  const discColors: Record<string, string> = { simple: 'bg-blue-100', double: 'bg-emerald-100', mixte: 'bg-amber-100' };
  const discTextColors: Record<string, string> = { simple: 'text-singles', double: 'text-doubles', mixte: 'text-mixed' };
  const discBg = discColors[match.discipline ?? ''] || 'bg-gray-200';
  const discText = discTextColors[match.discipline ?? ''] || 'text-gray-500';

  if (!expanded) {
    // Collapsed: compact single-line summary
    return (
      <View className={`px-4 py-2 border-l-[3px] ${borderClass} border-b border-b-gray-50`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1">
            {disciplineLetter ? (
              <View className={`w-5 h-5 rounded-full items-center justify-center ${discBg}`}>
                <Text className={`text-[10px] font-bold ${discText}`}>{disciplineLetter}</Text>
              </View>
            ) : null}
            <Text className="text-[14px] text-gray-700 flex-1" numberOfLines={1}>
              {match.opponent
                ? `${match.opponent}${match.opponent2 ? ` / ${match.opponent2}` : ''}`
                : '-'}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {match.setScores && match.setScores.length > 0 ? (
              <Text className="text-[13px] text-gray-500" style={{ fontVariant: ['tabular-nums'] }}>
                {match.setScores.join(' ')}
              </Text>
            ) : match.score ? (
              <Text className="text-[13px] text-gray-500" style={{ fontVariant: ['tabular-nums'] }}>
                {match.score}
              </Text>
            ) : null}
            <View className={`w-6 h-6 rounded-full items-center justify-center ${badgeBg}`}>
              <Text className="text-[10px] font-bold text-white">{badgeText}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Expanded: full detail card
  return (
    <View className={`px-4 py-3 border-l-[3px] ${borderClass} border-b border-b-gray-100 bg-white`}>
      {/* Row 1: discipline badge + round + result badge */}
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-2 flex-1">
          {disciplineLetter ? (
            <View className={`w-6 h-6 rounded-full items-center justify-center ${discBg}`}>
              <Text className={`text-[11px] font-bold ${discText}`}>{disciplineLetter}</Text>
            </View>
          ) : null}
          {match.round ? (
            <Text className="text-caption text-muted" numberOfLines={1}>{match.round}</Text>
          ) : null}
        </View>
        <View className={`w-7 h-7 rounded-full items-center justify-center ${badgeBg}`}>
          <Text className="text-caption font-bold text-white">{badgeText}</Text>
        </View>
      </View>

      {/* Row 2: Partner (doubles/mixed) */}
      {match.partner ? (
        <View className="flex-row items-center mb-1">
          <Ionicons name="people-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
          <Text className="text-[14px] font-medium text-gray-700" numberOfLines={1}>
            {match.partner}
          </Text>
        </View>
      ) : null}

      {/* Row 3: Opponent */}
      {match.opponent ? (
        <View className="flex-row items-center mb-2">
          <Text className="text-[13px] text-gray-400 mr-1">{t('matchHistory.vs')}</Text>
          {match.opponentLicence ? (
            <Pressable onPress={() => router.push(`/player/${match.opponentLicence}`)}>
              <Text className="text-[14px] font-medium text-primary" numberOfLines={1}>
                {match.opponent}{match.opponent2 ? ` / ${match.opponent2}` : ''}
              </Text>
            </Pressable>
          ) : (
            <Text className="text-[14px] font-medium text-gray-700" numberOfLines={1}>
              {match.opponent}{match.opponent2 ? ` / ${match.opponent2}` : ''}
            </Text>
          )}
        </View>
      ) : null}

      {/* Row 4: Set scores displayed prominently */}
      {match.setScores && match.setScores.length > 0 ? (
        <View className="flex-row gap-3 mb-2">
          {match.setScores.map((setScore, i) => (
            <View key={i} className="bg-gray-50 px-3 py-1.5 rounded-lg">
              <Text className="text-[10px] text-muted text-center mb-0.5">Set {i + 1}</Text>
              <Text className="text-[15px] font-bold text-gray-900 text-center" style={{ fontVariant: ['tabular-nums'] }}>
                {setScore}
              </Text>
            </View>
          ))}
        </View>
      ) : match.score ? (
        <View className="mb-2">
          <Text className="text-[15px] font-bold text-gray-900" style={{ fontVariant: ['tabular-nums'] }}>
            {match.score}
          </Text>
        </View>
      ) : null}

      {/* Row 5: Points impact */}
      {pointsText ? (
        <View className="flex-row justify-end">
          <Text className={`text-[13px] font-semibold ${pointsClass}`}>{pointsText}</Text>
        </View>
      ) : null}
    </View>
  );
}
