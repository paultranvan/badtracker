import { View, Text, Pressable } from 'react-native';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-3 mt-1">
      <Text className="text-title text-gray-900">{title}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text className="text-body font-medium text-primary">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
