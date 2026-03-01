import { View, Text } from 'react-native';
import { useRankingLevels } from '../ranking-levels/context';
import { getRankProgress } from '../utils/rankings';

// ============================================================
// Types
// ============================================================

interface RankProgressBarProps {
  cpph: number;
  rank: string;
  discipline: 'simple' | 'double' | 'mixte';
  color: string;
}

// ============================================================
// Component
// ============================================================

/**
 * Displays a compact progress bar showing a player's position within
 * their current rank band, with labels for the neighboring ranks
 * and the points distance to each boundary.
 */
export function RankProgressBar({ cpph, rank, discipline, color }: RankProgressBarProps) {
  const levels = useRankingLevels();

  if (!levels) return null;

  const progress = getRankProgress(cpph, rank, discipline, levels);
  if (!progress) return null;

  // No meaningful boundaries — nothing to visualize
  if (progress.nextRank == null && progress.prevRank == null) return null;

  return (
    <View className="mt-1.5 w-full">
      {/* Rank labels row */}
      <View className="flex-row justify-between mb-0.5">
        <Text className="text-[10px] text-gray-400">
          {progress.prevRank ?? ''}
        </Text>
        <Text className="text-[10px] text-gray-400">
          {progress.nextRank ?? ''}
        </Text>
      </View>

      {/* Progress bar */}
      <View className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{
            width: `${progress.progressPercent}%`,
            backgroundColor: color,
          }}
        />
      </View>

      {/* Points distance row */}
      <View className="flex-row justify-between mt-0.5">
        <Text
          className="text-[10px] text-gray-400"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {progress.pointsToDown != null ? `-${progress.pointsToDown}` : ''}
        </Text>
        <Text
          className="text-[10px] text-gray-400"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {progress.pointsToNext != null ? `+${progress.pointsToNext}` : ''}
        </Text>
      </View>
    </View>
  );
}
