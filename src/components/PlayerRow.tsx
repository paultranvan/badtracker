import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PlayerRowProps {
  name: string;
  club?: string;
  rank?: string;
  ranks?: { simple?: string; double?: string; mixte?: string };
  licence?: string;
  h2hCounts?: { against: number; together: number };
  isBookmarked?: boolean;
  position?: number;
  isCurrentUser?: boolean;
  onPress?: () => void;
}

const disciplineColors: Record<string, string> = {
  simple: '#3b82f6',
  double: '#10b981',
  mixte: '#f59e0b',
};

export function PlayerRow({
  name,
  club,
  rank,
  ranks,
  licence,
  h2hCounts,
  isBookmarked,
  position,
  isCurrentUser,
  onPress,
}: PlayerRowProps) {
  return (
    <Pressable
      className={`flex-row items-center px-4 py-3 ${isCurrentUser ? 'bg-primary-bg border-l-[3px] border-l-primary' : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      onPress={onPress}
    >
      {position != null && (
        <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Text className="text-caption font-bold text-gray-600">
            {position}
          </Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-body font-semibold text-gray-900" numberOfLines={1}>
          {name}
        </Text>
        {club && (
          <Text className="text-caption text-muted mt-0.5" numberOfLines={1}>
            {club}
          </Text>
        )}
        {licence && !club && (
          <Text className="text-[11px] text-gray-400 mt-0.5">{licence}</Text>
        )}
        {h2hCounts && (h2hCounts.against > 0 || h2hCounts.together > 0) && (
          <View className="flex-row mt-1 gap-1.5">
            {h2hCounts.against > 0 && (
              <View className="flex-row items-center bg-loss/10 rounded px-1.5 py-0.5">
                <Text className="text-[11px]">{'\u2694\uFE0F'}</Text>
                <Text className="text-[11px] font-semibold text-loss ml-0.5">{h2hCounts.against}</Text>
              </View>
            )}
            {h2hCounts.together > 0 && (
              <View className="flex-row items-center bg-primary/10 rounded px-1.5 py-0.5">
                <Text className="text-[11px]">{'\uD83E\uDD1D'}</Text>
                <Text className="text-[11px] font-semibold text-primary ml-0.5">{h2hCounts.together}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      {ranks ? (
        <View className="flex-row mr-2">
          {(Object.keys(disciplineColors) as Array<keyof typeof disciplineColors>).map((key) => {
            const value = ranks[key as keyof typeof ranks];
            if (!value) return null;
            const color = disciplineColors[key];
            return (
              <View
                key={key}
                className="rounded-md px-1.5 py-0.5 mr-1"
                style={{ backgroundColor: color + '20' }}
              >
                <Text style={{ color }} className="text-[11px] font-bold">
                  {value}
                </Text>
              </View>
            );
          })}
        </View>
      ) : rank ? (
        <View className="bg-gray-100 rounded-md px-2 py-1 mr-2">
          <Text className="text-caption font-bold text-gray-700">{rank}</Text>
        </View>
      ) : null}
      {isBookmarked && (
        <Ionicons name="star" size={16} color="#f59e0b" style={{ marginRight: 4 }} />
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </Pressable>
  );
}
