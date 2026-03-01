import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerSearch } from '@/hooks/usePlayerSearch';
import { useBookmarks } from '@/bookmarks/context';
import { useConnectivity } from '@/connectivity/context';
import { PlayerRow } from '@/components';
import { useBookmarkH2HCounts } from '@/hooks/useBookmarkH2HCounts';
import { useBookmarkClubs } from '@/hooks/useBookmarkClubs';
import type { BookmarkedPlayer } from '@/bookmarks/storage';

export default function PlayersScreen() {
  const { t } = useTranslation();
  const { query, setQuery, results, isLoading, error } = usePlayerSearch();
  const { bookmarks, isBookmarked } = useBookmarks();
  const h2hCounts = useBookmarkH2HCounts(bookmarks);
  const clubInitials = useBookmarkClubs(bookmarks);
  const { isConnected } = useConnectivity();

  const isSearching = query.length > 0;

  const sortedBookmarks = useMemo(() => {
    return [...bookmarks].sort((a, b) => {
      const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
      const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [bookmarks]);

  const renderSearchItem = useCallback(
    ({ item }: { item: (typeof results)[number] }) => (
      <PlayerRow
        name={`${item.Nom} ${item.Prenom}`}
        club={item.NomClub || undefined}
        licence={item.Licence}
        isBookmarked={isBookmarked(item.Licence)}
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: {
              licence: item.Licence,
              personId: item.personId ?? '',
              nom: item.Nom ?? '',
              prenom: item.Prenom ?? '',
              club: item.Club ?? '',
              nomClub: item.NomClub ?? '',
            },
          })
        }
      />
    ),
    [isBookmarked],
  );

  const renderBookmarkItem = useCallback(
    ({ item }: { item: BookmarkedPlayer }) => (
      <PlayerRow
        name={`${item.nom} ${item.prenom}`}
        club={clubInitials.get(item.licence)}
        ranks={item.rankings}
        isBookmarked
        h2hCounts={h2hCounts.get(item.licence)}
        onPress={() =>
          router.push({
            pathname: '/player/[licence]',
            params: {
              licence: item.licence,
              nom: item.nom,
              prenom: item.prenom,
              ...(item.personId ? { personId: item.personId } : {}),
            },
          })
        }
      />
    ),
    [h2hCounts, clubInitials],
  );

  const separator = () => <View className="h-px bg-gray-100 mx-4" />;

  return (
    <View className="flex-1 bg-white">
      {/* Search input */}
      <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200">
        <View
          className={`flex-row items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-200 ${
            !isConnected ? 'opacity-50' : ''
          }`}
        >
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-body text-gray-900"
            placeholder={t('search.placeholder')}
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            editable={isConnected}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#d1d5db" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content area */}
      <View className="flex-1">
        {isSearching ? (
          isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-body text-loss text-center">{error}</Text>
            </View>
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.Licence}
              renderItem={renderSearchItem}
              ItemSeparatorComponent={separator}
              contentContainerStyle={{ paddingVertical: 8 }}
            />
          ) : query.length >= 3 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Ionicons name="search-outline" size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
              <Text className="text-body text-muted text-center">{t('search.noResults')}</Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-body text-gray-400 text-center">{t('search.minChars')}</Text>
            </View>
          )
        ) : sortedBookmarks.length > 0 ? (
          <FlatList
            data={sortedBookmarks}
            keyExtractor={(item) => item.licence}
            renderItem={renderBookmarkItem}
            ItemSeparatorComponent={separator}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="star-outline" size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
            <Text className="text-body text-gray-400 text-center">{t('players.noFavourites')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
