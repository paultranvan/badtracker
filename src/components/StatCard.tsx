import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';

interface StatCardProps {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  highlight?: boolean;
}

export function StatCard({ value, label, icon, iconColor = '#1e40af', highlight }: StatCardProps) {
  return (
    <Card className={`flex-1 items-center py-4 px-2 ${highlight ? 'bg-primary-bg' : ''}`}>
      {icon && (
        <Ionicons name={icon} size={18} color={iconColor} style={{ marginBottom: 4 }} />
      )}
      <Text className="text-display text-primary-dark">{value}</Text>
      <Text className="text-[11px] text-muted mt-1 text-center">{label}</Text>
    </Card>
  );
}
