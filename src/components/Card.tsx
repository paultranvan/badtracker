import { View } from 'react-native';
import type { ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <View
      className={`rounded-xl bg-white shadow-sm shadow-black/10 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
