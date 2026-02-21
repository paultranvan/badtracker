import { useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerSearch } from '../../../src/hooks/usePlayerSearch';
import { useBookmarks } from '../../../src/bookmarks/context';
import { useConnectivity } from '../../../src/connectivity/context';

const Separator = () => <View style={styles.separator} />;

export default function SearchScreen() {
  const { t } = useTranslation();
  const { query, setQuery, results, isLoading, error } = usePlayerSearch();
  const { isBookmarked } = useBookmarks();
  const { isConnected } = useConnectivity();

  // When offline, show disabled state per user decision
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color="#9ca3af" />
          <Text style={styles.offlineText}>{t('offline.searchDisabled')}</Text>
        </View>
      </View>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: (typeof results)[number] }) => (
      <Pressable
        style={({ pressed }) => [
          styles.resultItem,
          pressed && styles.resultItemPressed,
        ]}
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
      >
        <View style={styles.resultRow}>
          <View style={styles.resultInfo}>
            <Text style={styles.playerName}>
              {item.Nom} {item.Prenom}
            </Text>
            {item.NomClub ? (
              <Text style={styles.clubName}>{item.NomClub}</Text>
            ) : null}
            <Text style={styles.licence}>{item.Licence}</Text>
          </View>
          {isBookmarked(item.Licence) && (
            <Ionicons name="star" size={14} color="#f59e0b" style={styles.starIndicator} />
          )}
        </View>
      </Pressable>
    ),
    [isBookmarked],
  );

  return (
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('search.placeholder')}
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Results area */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.Licence}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={styles.listContent}
          />
        ) : query.length >= 3 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('search.noResults')}</Text>
          </View>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.hintText}>{t('search.minChars')}</Text>
          </View>
        )}
      </View>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    color: '#111',
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  listContent: {
    paddingVertical: 8,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultItemPressed: {
    backgroundColor: '#f3f4f6',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  starIndicator: {
    marginLeft: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  clubName: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  licence: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  offlineText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
  },
});
