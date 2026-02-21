import { View, Text, Pressable } from 'react-native';
import { Badge } from './Badge';

interface MatchCardProps {
  isWin: boolean | null;
  badgeLabel: string;
  opponent: string;
  event?: string;
  score?: string;
  discipline?: string;
  onPress?: () => void;
}

export function MatchCard({
  isWin,
  badgeLabel,
  opponent,
  event,
  score,
  onPress,
}: MatchCardProps) {
  const borderColor = isWin === true
    ? 'border-l-win'
    : isWin === false
      ? 'border-l-loss'
      : 'border-l-gray-300';

  const variant = isWin === true ? 'win' : isWin === false ? 'loss' : 'unknown';

  return (
    <Pressable
      className={`flex-row items-center py-3 border-l-[3px] ${borderColor} pl-3 border-b border-b-gray-100`}
      style={({ pressed }) => ({ opacity: pressed && onPress ? 0.7 : 1 })}
      onPress={onPress}
    >
      <Badge variant={variant} label={badgeLabel} />
      <View className="flex-1 ml-3">
        <Text className="text-body font-medium text-gray-900" numberOfLines={1}>
          {opponent}
        </Text>
        {event && (
          <Text className="text-[12px] text-muted mt-0.5" numberOfLines={1}>
            {event}
          </Text>
        )}
      </View>
      {score && (
        <Text
          className={`text-body font-semibold ml-2 ${
            isWin === true ? 'text-win' : isWin === false ? 'text-loss' : 'text-muted'
          }`}
        >
          {score}
        </Text>
      )}
    </Pressable>
  );
}
