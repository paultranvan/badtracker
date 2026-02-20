import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  getPlayerProfile,
  type PlayerProfile,
} from '../../../src/api/ffbad';
import { useSession } from '../../../src/auth/context';
import { useBookmarks } from '../../../src/bookmarks/context';
import type { BookmarkedPlayer } from '../../../src/bookmarks/storage';

// ============================================================
// Component
// ============================================================

export default function PlayerProfileScreen() {
  const { licence } = useLocalSearchParams<{ licence: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session } = useSession();
  const { isBookmarked, addBookmark, removeBookmark, updateStoredRankings } = useBookmarks();

  const isOwnProfile = session?.licence === licence;
  const bookmarked = player ? isBookmarked(player.licence) : false;

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
    setIsLoading(true);
    setError(null);

    try {
      const profile = await getPlayerProfile(licence);
      if (cancelled) return;

      if (profile) {
        setPlayer(profile);
        // Passive ranking refresh: update stored bookmark if this player is bookmarked
        updateStoredRankings(profile.licence, {
          simple: profile.rankings.simple?.classement,
          double: profile.rankings.double?.classement,
          mixte: profile.rankings.mixte?.classement,
        });
      } else {
        setError(t('player.error'));
      }
    } catch {
      if (!cancelled) {
        setError(t('player.error'));
      }
    } finally {
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    // Return cleanup function
    return () => {
      cancelled = true;
    };
  }, [licence, t, updateStoredRankings]);

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
  if (error || !player) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? t('player.error')}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={() => fetchProfile()}
        >
          <Text style={styles.retryText}>{t('player.retry')}</Text>
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.playerName}>
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
                <Text style={[styles.clubName, styles.clubNameLink]}>
                  {player.nomClub}
                </Text>
              </Pressable>
            ) : player.nomClub ? (
              <Text style={styles.clubName}>{player.nomClub}</Text>
            ) : null}
            <Text style={styles.licence}>
              {t('player.licence')}: {player.licence}
            </Text>
          </View>
          {!isOwnProfile && (
            <Pressable onPress={handleBookmarkToggle} hitSlop={8} style={styles.bookmarkButton}>
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('player.rankings')}</Text>

        {hasRankings ? (
          <>
            {simple ? (
              <RankingCard
                discipline={t('player.simple')}
                classement={simple.classement}
                cpph={simple.cpph}
                cpphLabel={t('player.cpph')}
              />
            ) : null}
            {double ? (
              <RankingCard
                discipline={t('player.double')}
                classement={double.classement}
                cpph={double.cpph}
                cpphLabel={t('player.cpph')}
              />
            ) : null}
            {mixte ? (
              <RankingCard
                discipline={t('player.mixte')}
                classement={mixte.classement}
                cpph={mixte.cpph}
                cpphLabel={t('player.cpph')}
              />
            ) : null}
          </>
        ) : (
          <Text style={styles.noRankings}>{t('player.noRankings')}</Text>
        )}
      </View>
    </ScrollView>
  );
}

// ============================================================
// Ranking Card Sub-component
// ============================================================

interface RankingCardProps {
  discipline: string;
  classement: string;
  cpph?: number;
  cpphLabel: string;
}

function RankingCard({ discipline, classement, cpph, cpphLabel }: RankingCardProps) {
  return (
    <View style={styles.rankingCard}>
      <View style={styles.rankingHeader}>
        <Text style={styles.discipline}>{discipline}</Text>
        <Text style={styles.classement}>{classement}</Text>
      </View>
      {cpph != null ? (
        <Text style={styles.cpph}>
          {cpphLabel}: {cpph.toFixed(1)}
        </Text>
      ) : null}
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
  content: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },

  // Header
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  bookmarkButton: {
    padding: 4,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  clubName: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  clubNameLink: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  licence: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },

  // Ranking card
  rankingCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rankingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discipline: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  classement: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  cpph: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },

  // No rankings
  noRankings: {
    fontSize: 15,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Error
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
