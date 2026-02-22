import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
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
import { Card } from '../../../../src/components';
import type { BookmarkedPlayer } from '../../../../src/bookmarks/storage';
import { useHeadToHead, type H2HStats, type H2HMatch } from '../../../../src/hooks/useHeadToHead';

// ============================================================
// Discipline colors (matches dashboard)
// ============================================================

const disciplineColors: Record<string, string> = {
  simple: '#3b82f6',
  double: '#10b981',
  mixte: '#f59e0b',
};

// ============================================================
// Ranking Card Sub-component
// ============================================================

function RankingCardItem({
  disciplineKey,
  discipline,
  classement,
  cpph,
  cpphLabel,
}: {
  disciplineKey: string;
  discipline: string;
  classement: string;
  cpph?: number;
  cpphLabel: string;
}) {
  return (
    <Card
      className="p-4 mb-2 border-t-[3px]"
      style={{ borderTopColor: disciplineColors[disciplineKey] || '#e5e7eb' }}
    >
      <View className="flex-row justify-between items-center">
        <Text className="text-body font-medium text-gray-700">{discipline}</Text>
        <Text className="text-[18px] font-bold text-primary">{classement}</Text>
      </View>
      {cpph != null && (
        <Text className="text-caption text-muted mt-1">
          {cpphLabel}: {cpph.toFixed(1)}
        </Text>
      )}
    </Card>
  );
}

// ============================================================
// H2H Win Rate Bar
// ============================================================

function WinRateBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (total === 0) return null;
  const winPct = (wins / total) * 100;

  return (
    <View className="flex-row h-2 rounded-full overflow-hidden bg-gray-100 mt-2">
      <View style={{ width: `${winPct}%` }} className="bg-win rounded-l-full" />
      <View style={{ width: `${100 - winPct}%` }} className="bg-loss rounded-r-full" />
    </View>
  );
}

// ============================================================
// H2H Discipline Mini-Card
// ============================================================

function DisciplineMiniCard({
  label,
  wins,
  losses,
  color,
}: {
  label: string;
  wins: number;
  losses: number;
  color: string;
}) {
  if (wins === 0 && losses === 0) return null;

  return (
    <View
      className="rounded-lg px-3 py-2 items-center border-t-[3px]"
      style={{ borderTopColor: color, backgroundColor: `${color}10` }}
    >
      <Text className="text-caption font-bold text-gray-700">{label}</Text>
      <Text className="text-body font-semibold text-gray-900 mt-0.5">
        {wins}-{losses}
      </Text>
    </View>
  );
}

// ============================================================
// H2H Match Row
// ============================================================

function H2HMatchRow({ match }: { match: H2HMatch }) {
  const discColor = match.discipline === 'simple' ? '#3b82f6'
    : match.discipline === 'double' ? '#10b981' : '#f59e0b';

  return (
    <View
      className="flex-row items-center py-2.5 border-l-[3px] pl-3"
      style={{ borderLeftColor: discColor }}
    >
      <Text className={`text-body font-bold ${match.isWin ? 'text-win' : 'text-loss'} w-5`}>
        {match.isWin ? '\u2713' : '\u2717'}
      </Text>
      <View className="flex-1 ml-1">
        <Text className="text-body text-gray-900" numberOfLines={1}>
          {match.tournament}
        </Text>
        <Text className="text-caption text-muted mt-0.5">
          {match.date}
          {match.opponents ? ` \u00b7 vs ${match.opponents}` : ''}
        </Text>
      </View>
      <View className="items-end ml-2">
        {match.score ? (
          <Text className="text-caption font-medium text-gray-700">{match.score}</Text>
        ) : null}
        {match.points != null ? (
          <Text className={`text-caption font-bold ${match.points >= 0 ? 'text-win' : 'text-loss'}`}>
            {match.points >= 0 ? '+' : ''}{match.points}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ============================================================
// H2H Section
// ============================================================

function HeadToHeadSection({
  playerName,
  h2hTab,
  setH2hTab,
  against,
  together,
  againstMatches,
  togetherMatches,
  isLoading,
  t,
}: {
  playerName: string;
  h2hTab: 'against' | 'together';
  setH2hTab: (tab: 'against' | 'together') => void;
  against: H2HStats | null;
  together: H2HStats | null;
  againstMatches: H2HMatch[];
  togetherMatches: H2HMatch[];
  isLoading: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const activeStats = h2hTab === 'against' ? against : together;
  const activeMatches = h2hTab === 'against' ? againstMatches : togetherMatches;
  const againstCount = againstMatches.length;
  const togetherCount = togetherMatches.length;

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
            ⚔️ {t('player.h2hAgainst')} ({againstCount})
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-2.5 rounded-full items-center border ${
            h2hTab === 'together' ? 'bg-primary border-primary' : 'bg-white border-gray-200'
          }`}
          onPress={() => setH2hTab('together')}
        >
          <Text className={`text-body font-medium ${h2hTab === 'together' ? 'text-white' : 'text-gray-700'}`}>
            🤝 {t('player.h2hTogether')} ({togetherCount})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color="#2563eb" />
      ) : activeStats ? (
        <Card className="p-4">
          {/* Summary */}
          <Text className="text-body text-gray-500 mb-1">
            {h2hTab === 'against' ? `⚔️ ${t('player.h2hAgainst')}` : `🤝 ${t('player.h2hTogether')}`} {playerName}
          </Text>
          <View className="flex-row items-baseline gap-2">
            <Text className="text-[22px] font-bold text-win">
              {t('player.h2hWins', { count: activeStats.wins })}
            </Text>
            <Text className="text-[18px] text-gray-400">{'\u00b7'}</Text>
            <Text className="text-[22px] font-bold text-loss">
              {t('player.h2hLosses', { count: activeStats.losses })}
            </Text>
          </View>
          <WinRateBar wins={activeStats.wins} losses={activeStats.losses} />
          <Text className="text-caption text-muted mt-1 text-right">{activeStats.winRate}%</Text>

          {/* Per-discipline */}
          <View className="flex-row gap-2 mt-3">
            {h2hTab === 'against' && (
              <DisciplineMiniCard label="S" wins={activeStats.byDiscipline.simple.wins} losses={activeStats.byDiscipline.simple.losses} color="#3b82f6" />
            )}
            <DisciplineMiniCard label="D" wins={activeStats.byDiscipline.double.wins} losses={activeStats.byDiscipline.double.losses} color="#10b981" />
            <DisciplineMiniCard label="M" wins={activeStats.byDiscipline.mixte.wins} losses={activeStats.byDiscipline.mixte.losses} color="#f59e0b" />
          </View>

          {/* Last played */}
          {activeStats.lastPlayed && (
            <Text className="text-caption text-muted mt-3">
              {t('player.h2hLastPlayed', { date: activeStats.lastPlayed })}
            </Text>
          )}

          {/* Match list */}
          {activeMatches.length > 0 && (
            <View className="mt-3 pt-3 border-t border-gray-100">
              {activeMatches.map((match, i) => (
                <H2HMatchRow key={`${match.date}-${i}`} match={match} />
              ))}
            </View>
          )}
        </Card>
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
  const { isBookmarked, addBookmark, removeBookmark, updateStoredRankings } = useBookmarks();
  const { isConnected } = useConnectivity();

  const isOwnProfile = session?.licence === licence;
  const bookmarked = player ? isBookmarked(player.licence) : false;
  const isBookmarkedByLicence = licence ? isBookmarked(licence) : false;
  const hasCachedData = useRef(false);

  const [h2hTab, setH2hTab] = useState<'against' | 'together'>('against');

  // Head-to-head: only fetch when viewing someone else's profile
  const h2h = useHeadToHead(
    !isOwnProfile && personId ? personId : null
  );

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
  }, [licence, personId, nom, prenom, t, updateStoredRankings, isConnected, isBookmarked]);

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

      {/* Rankings section */}
      <View className="mb-6">
        <Text className="text-[18px] font-semibold text-gray-900 mb-3">{t('player.rankings')}</Text>

        {hasRankings ? (
          <>
            {simple ? (
              <RankingCardItem
                disciplineKey="simple"
                discipline={t('player.simple')}
                classement={simple.classement}
                cpph={simple.cpph}
                cpphLabel={t('player.cpph')}
              />
            ) : null}
            {double ? (
              <RankingCardItem
                disciplineKey="double"
                discipline={t('player.double')}
                classement={double.classement}
                cpph={double.cpph}
                cpphLabel={t('player.cpph')}
              />
            ) : null}
            {mixte ? (
              <RankingCardItem
                disciplineKey="mixte"
                discipline={t('player.mixte')}
                classement={mixte.classement}
                cpph={mixte.cpph}
                cpphLabel={t('player.cpph')}
              />
            ) : null}
          </>
        ) : (
          <Text className="text-body text-muted italic">{t('player.noRankings')}</Text>
        )}
      </View>

      {/* Ranking evolution link */}
      {hasRankings && (
        <Pressable
          className="flex-row items-center justify-center py-3 mt-2 active:opacity-60"
          onPress={() => router.push('/ranking-chart')}
        >
          <Ionicons name="trending-up" size={18} color="#2563eb" />
          <Text className="text-body font-medium text-primary ml-2">Ranking evolution</Text>
        </Pressable>
      )}

      {/* Head-to-Head section (only for other players) */}
      {!isOwnProfile && personId && (
        <HeadToHeadSection
          playerName={player.nom ?? ''}
          h2hTab={h2hTab}
          setH2hTab={setH2hTab}
          against={h2h.against}
          together={h2h.together}
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
