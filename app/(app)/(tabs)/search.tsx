import { useCallback } from 'react';
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
import { usePlayerSearch } from '../../../src/hooks/usePlayerSearch';
import { useBookmarks } from '../../../src/bookmarks/context';
import { useConnectivity } from '../../../src/connectivity/context';
import { PlayerRow } from '../../../src/components';

export default function SearchScreen() {
  const { t } = useTranslation();
  const { query, setQuery, results, isLoading, error } = usePlayerSearch();
  const { isBookmarked } = useBookmarks();
  const { isConnected } = useConnectivity();

  // When offline, show disabled state per user decision
  if (!isConnected) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="cloud-offline-outline" size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
          <Text className="text-body text-muted text-center">{t('offline.searchDisabled')}</Text>
        </View>
      </View>
    );
  }

  const renderItem = useCallback(
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

  return (
    <View className="flex-1 bg-white">
      {/* Search input */}
      <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
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
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#d1d5db" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results area */}
      <View className="flex-1">
        {isLoading ? (
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
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
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
        )}
      </View>
    </View>
  );
}
