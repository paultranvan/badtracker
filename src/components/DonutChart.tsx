import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DonutChartProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  winColor?: string;
  lossColor?: string;
  label?: string;
}

export function DonutChart({
  percentage,
  size = 100,
  strokeWidth = 10,
  winColor = '#16a34a',
  lossColor = '#fee2e2',
  label,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(percentage / 100, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background ring (loss color) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={lossColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground arc (win color), rotated -90deg to start from top */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={winColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      {/* Center label */}
      <View className="absolute inset-0 justify-center items-center">
        <Text className="text-white text-[22px] font-extrabold">
          {label ?? `${percentage}%`}
        </Text>
      </View>
    </View>
  );
}
