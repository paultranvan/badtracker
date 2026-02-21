import { View, Text } from 'react-native';

type BadgeVariant = 'win' | 'loss' | 'unknown' | 'singles' | 'doubles' | 'mixed';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  win: { bg: 'bg-win-bg', text: 'text-win' },
  loss: { bg: 'bg-loss-bg', text: 'text-loss' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-500' },
  singles: { bg: 'bg-blue-100', text: 'text-singles' },
  doubles: { bg: 'bg-emerald-100', text: 'text-doubles' },
  mixed: { bg: 'bg-amber-100', text: 'text-mixed' },
};

export function Badge({ variant, label, size = 'md' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2.5 py-1';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-caption';

  return (
    <View className={`rounded-full ${bg} ${sizeClass}`}>
      <Text className={`${textSize} font-semibold ${text}`}>{label}</Text>
    </View>
  );
}
