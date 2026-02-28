import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  LayoutAnimation,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  getPlayerProfile,
  type PlayerProfile,
} from '../../../../src/api/ffbad';
import { useSession } from '../../../../src/auth/context';
import { useBookmarks } from '../../../../src/bookmarks/context';
import { useConnectivity } from '../../../../src/connectivity/context';
import { cacheGet, cacheSet } from '../../../../src/cache/storage';
import { Card, DetailMatchCard, StatCard, SectionHeader } from '../../../../src/components';
import type { BookmarkedPlayer } from '../../../../src/bookmarks/storage';
import { useHeadToHead } from '../../../../src/hooks/useHeadToHead';
import { useMatchHistory } from '../../../../src/hooks/useMatchHistory';
import { getRankLabel, getBestRanking } from '../../../../src/utils/rankings';
import {
  groupByTournamentNested,
  computeWinLossStats,
  type MatchItem,
  type TournamentSection,
  type DisciplineGroup,
} from '../../../../src/utils/matchHistory';

// ============================================================
// Discipline config (same as dashboard)
// ============================================================

const disciplineColors: Record<string, string> = {
  simple: '#3b82f6',
  double: '#10b981',
  mixte: '#f59e0b',
};

const disciplines: Array<{
  key: 'simple' | 'double' | 'mixte';
  translationKey: string;
}> = [
  { key: 'simple', translationKey: 'player.simple' },
  { key: 'double', translationKey: 'player.double' },
  { key: 'mixte', translationKey: 'player.mixte' },
];

// ============================================================
// H2H Discipline Row (level 2 accordion)
// ============================================================

const DISC_LETTERS: Record<string, string> = { simple: 'S', double: 'D', mixte: 'M' };
const DISC_COLORS: Record<string, string> = { simple: '#3b82f6', double: '#10b981', mixte: '#f59e0b' };
const DISC_BG_COLORS: Record<string, string> = { simple: '#dbeafe', double: '#d1fae5', mixte: '#fef3c7' };

function H2HDisciplineRow({
  discipline,
  isExpanded,
  onToggle,
}: {
  discipline: DisciplineGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const disc = discipline.discipline;
  const letter = DISC_LETTERS[disc] ?? '?';
  const labelKey = disc === 'simple' ? 'matchHistory.simple' : disc === 'double' ? 'matchHistory.double' : 'matchHistory.mixte';
  const pts = discipline.points;
  const pointsText = pts !== 0 ? (pts > 0 ? `+${pts.toFixed(1)}` : pts.toFixed(1)) + ' pts' : '';
  const pointsColor = pts > 0 ? 'text-win' : pts < 0 ? 'text-loss' : 'text-gray-400';

  return (
    <Pressable
      className="flex-row justify-between items-center pl-8 pr-4 py-2 bg-white border-b border-b-gray-100 active:bg-gray-50"
      onPress={onToggle}
    >
      <View className="flex-row items-center gap-2 flex-1">
        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: DISC_BG_COLORS[disc] }}>
          <Text style={{ color: DISC_COLORS[disc], fontSize: 11, fontWeight: '700' }}>{letter}</Text>
        </View>
        <Text className="text-[14px] font-medium text-gray-800">{t(labelKey)}</Text>
        {discipline.wins > 0 && (
          <View className="bg-win/20 px-1.5 py-0.5 rounded">
            <Text className="text-[11px] font-semibold text-win">{discipline.wins}W</Text>
          </View>
        )}
        {discipline.losses > 0 && (
          <View className="bg-loss/20 px-1.5 py-0.5 rounded">
            <Text className="text-[11px] font-semibold text-loss">{discipline.losses}L</Text>
          </View>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        {pointsText ? (
          <Text className={`text-caption font-semibold ${pointsColor}`} style={{ fontVariant: ['tabular-nums'] }}>
            {pointsText}
          </Text>
        ) : null}
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
      </View>
    </Pressable>
  );
}

// ============================================================
// H2H Tournament Header (level 1 accordion)
// ============================================================

function H2HTournamentHeader({
  tournament,
  isExpanded,
  onToggle,
}: {
  tournament: TournamentSection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const title = tournament.title || t('matchHistory.tournamentUnknown');
  const pts = tournament.totalPoints;
  const pointsText = pts !== 0 ? (pts > 0 ? `+${pts.toFixed(1)}` : pts.toFixed(1)) + ' pts' : '';
  const pointsColor = pts > 0 ? 'text-win' : pts < 0 ? 'text-loss' : 'text-gray-400';

  return (
    <Pressable
      className="flex-row justify-between items-center px-4 py-2.5 bg-slate-50 border-l-[3px] border-l-primary border-b border-b-gray-200 active:bg-slate-100"
      onPress={onToggle}
    >
      <Text className="text-body font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
        {title}
      </Text>
      <View className="flex-row items-center gap-2">
        {tournament.date ? (
          <Text className="text-caption text-muted">{tournament.date}</Text>
        ) : null}
        {pointsText ? (
          <Text className={`text-caption font-semibold ${pointsColor}`} style={{ fontVariant: ['tabular-nums'] }}>
            {pointsText}
          </Text>
        ) : null}
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#64748b" />
      </View>
    </Pressable>
  );
}

// ============================================================
// H2H Section
// ============================================================

function HeadToHeadSection({
  playerName,
  h2hTab,
  setH2hTab,
  againstMatches,
  togetherMatches,
  isLoading,
  t,
}: {
  playerName: string;
  h2hTab: 'against' | 'together';
  setH2hTab: (tab: 'against' | 'together') => void;
  againstMatches: MatchItem[];
  togetherMatches: MatchItem[];
  isLoading: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const activeMatches = h2hTab === 'against' ? againstMatches : togetherMatches;
  const tournaments = useMemo(() => groupByTournamentNested(activeMatches), [activeMatches]);
  const stats = useMemo(() => computeWinLossStats(activeMatches), [activeMatches]);

  const [expandedTournaments, setExpandedTournaments] = useState<Set<string>>(new Set());
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  // Reset accordion state when switching tabs
  useEffect(() => {
    setExpandedTournaments(new Set());
    setExpandedDisciplines(new Set());
  }, [h2hTab]);

  const toggleTournament = (title: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTournaments((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
        // Collapse disciplines within this tournament
        setExpandedDisciplines((dp) => {
          const nextDp = new Set(dp);
          for (const key of dp) {
            if (key.startsWith(`${title}:`)) nextDp.delete(key);
          }
          return nextDp;
        });
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const toggleDiscipline = (tournamentTitle: string, disc: DisciplineGroup) => {
    const key = `${tournamentTitle}:${disc.discipline}`;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDisciplines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const hasMatches = activeMatches.length > 0;

  return (
    <View className="mb-6">
      <Text className="text-[18px] font-semibold text-gray-900 mb-3">
        {t('player.h2h')}
      </Text>

      {/* Segment control */}
      <View className="flex-row gap-2 mb-4">
        <Pressable
          className={`flex-1 py-2.5 rounded-full items-center border ${
            h2hTab === 'against' ? 'bg-primary border-primary' : 'bg-white border-gray-200'
          }`}
          onPress={() => setH2hTab('against')}
        >
          <Text className={`text-body font-medium ${h2hTab === 'against' ? 'text-white' : 'text-gray-700'}`}>
            ⚔️ {t('player.h2hAgainst')} ({againstMatches.length})
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-2.5 rounded-full items-center border ${
            h2hTab === 'together' ? 'bg-primary border-primary' : 'bg-white border-gray-200'
          }`}
          onPress={() => setH2hTab('together')}
        >
          <Text className={`text-body font-medium ${h2hTab === 'together' ? 'text-white' : 'text-gray-700'}`}>
            🤝 {t('player.h2hTogether')} ({togetherMatches.length})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color="#2563eb" />
      ) : hasMatches ? (
        <View>
          {/* Stats summary */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-[20px] font-bold text-win">
                {t('player.h2hWins', { count: stats.wins })}
              </Text>
              <Text className="text-[16px] text-gray-400">{'\u00b7'}</Text>
              <Text className="text-[20px] font-bold text-loss">
                {t('player.h2hLosses', { count: stats.losses })}
              </Text>
            </View>
            <Text className="text-caption font-semibold text-muted">{stats.winPercentage}%</Text>
          </View>

          {/* Win rate bar */}
          <View className="flex-row h-2 rounded-full overflow-hidden bg-gray-100 mb-3">
            {stats.wins > 0 && (
              <View style={{ flex: stats.wins }} className="bg-win rounded-l-full" />
            )}
            {stats.losses > 0 && (
              <View style={{ flex: stats.losses }} className="bg-loss rounded-r-full" />
            )}
          </View>

          {/* Tournament accordion */}
          <View className="rounded-xl overflow-hidden border border-gray-200">
            {tournaments.map((tournament) => {
              const tKey = tournament.title || t('matchHistory.tournamentUnknown');
              const isTournamentExpanded = expandedTournaments.has(tKey);

              return (
                <View key={`t:${tKey}`}>
                  <H2HTournamentHeader
                    tournament={tournament}
                    isExpanded={isTournamentExpanded}
                    onToggle={() => toggleTournament(tKey)}
                  />
                  {isTournamentExpanded && tournament.disciplines.map((disc) => {
                    const dKey = `${tKey}:${disc.discipline}`;
                    const isDisciplineExpanded = expandedDisciplines.has(dKey);

                    return (
                      <View key={`d:${dKey}`}>
                        <H2HDisciplineRow
                          discipline={disc}
                          isExpanded={isDisciplineExpanded}
                          onToggle={() => toggleDiscipline(tKey, disc)}
                        />
                        {isDisciplineExpanded && disc.matches.map((match) => (
                          <DetailMatchCard key={`m:${match.id}`} match={match} playerName={playerName} />
                        ))}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <Card className="p-4 items-center">
          <Text className="text-body text-gray-400">
            {h2hTab === 'against' ? `⚔️ ${t('player.h2hNeverFaced')}` : `🤝 ${t('player.h2hNeverTeamed')}`}
          </Text>
        </Card>
      )}
    </View>
  );
}

// ============================================================
// Component
// ============================================================

export default function PlayerProfileScreen() {
  const { licence, personId, nom, prenom, club, nomClub } = useLocalSearchParams<{
    licence: string;
    personId?: string;
    nom?: string;
    prenom?: string;
    club?: string;
    nomClub?: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerProfile | null>(() => {
    // If we have basic info from search params, show it immediately
    if (nom || prenom) {
      return {
        licence: licence ?? '',
        nom: nom ?? '',
        prenom: prenom ?? '',
        club: club,
        nomClub: nomClub,
        rankings: {},
      };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session } = useSession();
  const { isBookmarked, addBookmark, removeBookmark, updateStoredRankings, updateStoredPersonId } = useBookmarks();
  const { isConnected } = useConnectivity();

  const isOwnProfile = session?.licence === licence;
  const bookmarked = player ? isBookmarked(player.licence) : false;
  const isBookmarkedByLicence = licence ? isBookmarked(licence) : false;
  const hasCachedData = useRef(false);

  const [h2hTab, setH2hTab] = useState<'against' | 'together'>('against');

  // Head-to-head: only fetch when viewing someone else's profile
  const h2h = useHeadToHead(
    !isOwnProfile && licence ? licence : null
  );

  // Match history for stats (best ranking comes from profile, win rate from matches)
  const matchHistory = useMatchHistory(personId);

  const handleBookmarkToggle = async () => {
    if (!player) return;
    if (bookmarked) {
      await removeBookmark(player.licence);
      Toast.show({ type: 'info', text1: t('bookmarks.removed'), visibilityTime: 2000 });
    } else {
      const bookmark: BookmarkedPlayer = {
        licence: player.licence,
        nom: player.nom,
        prenom: player.prenom,
        personId: player.personId ?? personId,
        rankings: {
          simple: player.rankings.simple?.classement,
          double: player.rankings.double?.classement,
          mixte: player.rankings.mixte?.classement,
        },
        bookmarkedAt: Date.now(),
      };
      await addBookmark(bookmark);
      Toast.show({ type: 'success', text1: t('bookmarks.added'), visibilityTime: 2000 });
    }
  };

  const fetchProfile = useCallback(async () => {
    if (!licence) return;

    let cancelled = false;
    const hasSearchParams = !!(nom || prenom);

    // If we have search param data, show it right away (don't block on loading)
    if (hasSearchParams) {
      hasCachedData.current = true;
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    // Step 1: Read from cache
    const cached = await cacheGet<PlayerProfile>(`player:${licence}`);
    if (cached) {
      setPlayer(cached);
      hasCachedData.current = true;
      setIsLoading(false);
      if (!isConnected) {
        return;
      }
    } else if (!isConnected) {
      if (!hasSearchParams) {
        setError(t('offline.unavailable'));
        setIsLoading(false);
      }
      return;
    }

    // Step 2: Fetch from API with timeout to avoid hanging
    try {
      const profilePromise = getPlayerProfile(licence, personId);
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );

      const profile = await Promise.race([profilePromise, timeoutPromise]);
      if (cancelled) return;

      if (profile) {
        // Merge with search params: API may not return name/club
        const merged: PlayerProfile = {
          ...profile,
          nom: profile.nom || nom || '',
          prenom: profile.prenom || prenom || '',
          club: profile.club || club,
          nomClub: profile.nomClub || nomClub,
        };
        setPlayer(merged);
        hasCachedData.current = true;
        updateStoredRankings(merged.licence, {
          simple: merged.rankings.simple?.classement,
          double: merged.rankings.double?.classement,
          mixte: merged.rankings.mixte?.classement,
        });
        if (merged.personId) {
          updateStoredPersonId(licence, merged.personId);
        }
        if (isBookmarked(licence)) {
          cacheSet(`player:${licence}`, merged);
        }
      } else {
        if (!hasCachedData.current) {
          setError(t('player.error'));
        }
      }
    } catch {
      if (!cancelled) {
        if (hasCachedData.current) {
          // Silently use basic/cached data
          return;
        }
        setError(t('player.error'));
      }
    } finally {
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [licence, personId, nom, prenom, t, updateStoredRankings, updateStoredPersonId, isConnected, isBookmarked]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    fetchProfile().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cleanup?.();
    };
  }, [fetchProfile]);

  // ----------------------------------------------------------
  // Loading state (only show spinner if we have no player data at all)
  // ----------------------------------------------------------
  if (isLoading && !player) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------
  if (error || !player) {
    const isOfflineError = !isConnected;
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        {isOfflineError && (
          <Ionicons name="cloud-offline-outline" size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
        )}
        <Text className="text-body text-loss text-center mb-4">{error ?? t('player.error')}</Text>
        <Pressable
          className="bg-primary px-6 py-2.5 rounded-lg active:bg-primary-dark"
          onPress={() => fetchProfile()}
        >
          <Text className="text-white text-body font-semibold">{t('offline.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Profile
  // ----------------------------------------------------------
  const { simple, double, mixte } = player.rankings;
  const hasRankings = simple || double || mixte;
  const bestRanking = getBestRanking(player.rankings);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      {/* Player header */}
      <View className="mb-6 pb-4 border-b border-gray-200">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-[24px] font-bold text-gray-900">
              {player.nom} {player.prenom}
            </Text>
            {player.nomClub && player.club ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/club/[clubId]',
                    params: { clubId: player.club! },
                  })
                }
              >
                <Text className="text-body text-primary underline mt-1">{player.nomClub}</Text>
              </Pressable>
            ) : player.nomClub ? (
              <Text className="text-body text-muted mt-1">{player.nomClub}</Text>
            ) : null}
            <Text className="text-caption text-gray-400 mt-1">
              {t('player.licence')}: {player.licence}
            </Text>
          </View>
          {!isOwnProfile && (
            <Pressable onPress={handleBookmarkToggle} hitSlop={8} className="p-1 ml-3">
              <Ionicons
                name={bookmarked ? 'star' : 'star-outline'}
                size={24}
                color={bookmarked ? '#f59e0b' : '#9ca3af'}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Quick Stats Row */}
      {hasRankings && (
        <View className="flex-row gap-2 mb-5">
          <StatCard
            value={bestRanking ? bestRanking.classement : t('dashboard.unranked')}
            label={t('dashboard.bestRanking')}
            icon="trophy-outline"
            iconColor="#d97706"
            highlight
          />
          <StatCard
            value={String(matchHistory.stats.total)}
            label={t('dashboard.matchesPlayed')}
            icon="fitness-outline"
          />
          <StatCard
            value={`${matchHistory.stats.winPercentage}%`}
            label={t('dashboard.winRate')}
            icon="analytics-outline"
          />
        </View>
      )}

      {/* Rankings Section */}
      <SectionHeader title={t('dashboard.rankings')} />
      {hasRankings ? (
        <View className="flex-row gap-2 mb-5">
          {disciplines.map(({ key, translationKey }) => {
            const ranking = player.rankings[key];
            const classement = getRankLabel(ranking?.classement);
            const cpph = ranking?.cpph;
            const isBest = key === bestRanking?.discipline;

            return (
              <Card
                key={key}
                className={`flex-1 items-center p-3 border-t-[3px] ${isBest ? 'shadow-md' : ''}`}
                style={{ borderTopColor: disciplineColors[key] }}
              >
                <Text className="text-caption text-muted mb-1 uppercase">{t(translationKey)}</Text>
                <Text className={`text-[22px] font-bold mb-0.5 ${isBest ? 'text-primary' : 'text-gray-700'}`}>
                  {classement}
                </Text>
                {cpph != null && (
                  <Text className="text-caption text-muted">{cpph.toFixed(1)} pts</Text>
                )}
              </Card>
            );
          })}
        </View>
      ) : (
        <Text className="text-body text-muted italic mb-5">{t('player.noRankings')}</Text>
      )}

      {/* Head-to-Head section (only for other players) */}
      {!isOwnProfile && licence && (
        <HeadToHeadSection
          playerName={session ? `${session.prenom} ${session.nom}` : ''}
          h2hTab={h2hTab}
          setH2hTab={setH2hTab}
          againstMatches={h2h.againstMatches}
          togetherMatches={h2h.togetherMatches}
          isLoading={h2h.isLoading}
          t={t}
        />
      )}

      {/* See all matches button */}
      {personId && (
        <Pressable
          className="flex-row items-center justify-center py-3.5 mx-0 mb-6 rounded-xl bg-primary-bg active:opacity-70"
          onPress={() => {
            if (isOwnProfile) {
              router.push('/(app)/(tabs)/matches');
            } else {
              router.push({
                pathname: '/player/[licence]/matches',
                params: {
                  licence: player.licence,
                  personId,
                  nom: player.nom,
                },
              });
            }
          }}
        >
          <Text className="text-body font-medium text-primary">📋 {t('player.seeAllMatches')} ›</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
