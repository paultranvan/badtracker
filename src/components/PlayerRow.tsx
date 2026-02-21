import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PlayerRowProps {
  name: string;
  club?: string;
  rank?: string;
  licence?: string;
  isBookmarked?: boolean;
  position?: number;
  isCurrentUser?: boolean;
  onPress?: () => void;
}

export function PlayerRow({
  name,
  club,
  rank,
  licence,
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
      </View>
      {rank && (
        <View className="bg-gray-100 rounded-md px-2 py-1 mr-2">
          <Text className="text-caption font-bold text-gray-700">{rank}</Text>
        </View>
      )}
      {isBookmarked && (
        <Ionicons name="star" size={16} color="#f59e0b" style={{ marginRight: 4 }} />
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </Pressable>
  );
}
