import { useCallback } from 'react';
import { FlatList, View, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useBookmarks } from '../../../../src/bookmarks/context';
import type { BookmarkedPlayer } from '../../../../src/bookmarks/storage';
import { PlayerRow } from '../../../../src/components';

export default function BookmarksScreen() {
  const { bookmarks } = useBookmarks();
  const { t } = useTranslation();

  const sorted = [...bookmarks].sort((a, b) => {
    const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
    const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (sorted.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Ionicons name="star-outline" size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
        <Text className="text-body text-gray-400 text-center">{t('bookmarks.empty')}</Text>
      </View>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: BookmarkedPlayer }) => {
      const rankParts: string[] = [];
      if (item.rankings.simple) rankParts.push(item.rankings.simple);
      if (item.rankings.double) rankParts.push(item.rankings.double);
      if (item.rankings.mixte) rankParts.push(item.rankings.mixte);
      const bestRank = rankParts[0];

      return (
        <PlayerRow
          name={`${item.nom} ${item.prenom}`}
          rank={bestRank}
          isBookmarked
          onPress={() => router.push({ pathname: '/player/[licence]', params: { licence: item.licence } })}
        />
      );
    },
    [],
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.licence}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingVertical: 8 }}
    />
  );
}
