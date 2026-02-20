import { useCallback } from 'react';
import { FlatList, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBookmarks } from '../../../../src/bookmarks/context';
import type { BookmarkedPlayer } from '../../../../src/bookmarks/storage';

const Separator = () => <View style={styles.separator} />;

export default function BookmarksScreen() {
  const { bookmarks } = useBookmarks();
  const { t } = useTranslation();

  // Sort alphabetically by name (nom then prenom)
  const sorted = [...bookmarks].sort((a, b) => {
    const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
    const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (sorted.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('bookmarks.empty')}</Text>
      </View>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: BookmarkedPlayer }) => (
      <Pressable
        onPress={() => router.push({ pathname: '/player/[licence]', params: { licence: item.licence } })}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Text style={styles.name}>{item.nom} {item.prenom}</Text>
        <View style={styles.rankings}>
          {item.rankings.simple && (
            <Text style={styles.rank}>{t('player.simple')}: {item.rankings.simple}</Text>
          )}
          {item.rankings.double && (
            <Text style={styles.rank}>{t('player.double')}: {item.rankings.double}</Text>
          )}
          {item.rankings.mixte && (
            <Text style={styles.rank}>{t('player.mixte')}: {item.rankings.mixte}</Text>
          )}
        </View>
      </Pressable>
    ),
    [t],
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.licence}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingVertical: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: '#f3f4f6',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  rankings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  rank: {
    fontSize: 13,
    color: '#6b7280',
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
});
