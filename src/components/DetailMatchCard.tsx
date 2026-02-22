import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { type MatchItem, splitSetScores } from '../utils/matchHistory';

interface DetailMatchCardProps {
  match: MatchItem;
  nested?: boolean;
  playerName?: string;
}

export function DetailMatchCard({ match, nested = true, playerName }: DetailMatchCardProps) {
  const isWin = match.isWin === true;
  const isLoss = match.isWin === false;

  // Border and indicator colors
  const borderColor = isWin ? 'border-l-win' : isLoss ? 'border-l-loss' : 'border-l-gray-300';
  const emoji = isWin ? '\ud83d\udc4d' : isLoss ? '\ud83d\udc4e' : '';
  const emojiColor = isWin ? 'text-win' : 'text-loss';

  // Points display
  const pointsText = match.pointsImpact != null && match.pointsImpact !== 0
    ? `${match.pointsImpact > 0 ? '+' : ''}${match.pointsImpact.toFixed(1)}`
    : null;
  const pointsColor = match.pointsImpact != null && match.pointsImpact >= 0 ? 'text-win' : 'text-loss';

  // Parse set scores
  const scores = splitSetScores(match);

  // Build team names
  const userTeamName = match.partner ? match.partner : null;

  // Opponent team
  const opponentName = match.opponent
    ? match.opponent + (match.opponent2 ? `  /  ${match.opponent2}` : '')
    : null;

  return (
    <View className={`${nested ? 'ml-10 mr-3' : 'mx-0'} border-l-[3px] ${borderColor} border-b border-b-gray-100`}>
      <View className="px-3 py-2">
        {/* Header: Round + Points */}
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-[12px] text-muted" numberOfLines={1}>
            {match.round ?? match.date ?? ''}
          </Text>
          {pointsText ? (
            <Text className={`text-[12px] font-semibold ${pointsColor}`} style={{ fontVariant: ['tabular-nums'] }}>
              {pointsText}
            </Text>
          ) : null}
        </View>

        {/* User team row */}
        <View className="flex-row items-center justify-between mb-0.5">
          <View className="flex-row items-center flex-1 mr-2">
            {userTeamName ? (
              <Text className={`text-[13px] ${isWin ? 'font-bold text-gray-900' : 'text-gray-700'} flex-1`} numberOfLines={1}>
                {userTeamName}
              </Text>
            ) : (
              <Text className={`text-[13px] ${isWin ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                {playerName ?? 'You'}
              </Text>
            )}
          </View>
          {/* User scores */}
          {scores ? (
            <View className="flex-row gap-1">
              {scores.map((s, i) => (
                <Text
                  key={i}
                  className={`text-[13px] w-5 text-center ${s.userWonSet ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {s.userScore}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Opponent team row */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            {opponentName ? (
              match.opponentLicence ? (
                <Pressable className="flex-1" onPress={() => router.push(`/player/${match.opponentLicence}`)}>
                  <Text className={`text-[13px] ${isLoss ? 'font-bold text-gray-900' : 'text-gray-700'}`} numberOfLines={1}>
                    {opponentName}
                  </Text>
                </Pressable>
              ) : (
                <Text className={`text-[13px] ${isLoss ? 'font-bold text-gray-900' : 'text-gray-700'} flex-1`} numberOfLines={1}>
                  {opponentName}
                </Text>
              )
            ) : (
              <Text className="text-[13px] text-gray-400">-</Text>
            )}
            {/* Win/loss emoji */}
            {emoji ? (
              <Text className={`text-[13px] ml-1.5 ${emojiColor}`}>{emoji}</Text>
            ) : null}
          </View>
          {/* Opponent scores */}
          {scores ? (
            <View className="flex-row gap-1">
              {scores.map((s, i) => (
                <Text
                  key={i}
                  className={`text-[13px] w-5 text-center ${!s.userWonSet ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {s.opponentScore}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Duration (if available) */}
        {match.duration ? (
          <Text className="text-[11px] text-muted mt-0.5 self-end">{match.duration}</Text>
        ) : null}
      </View>
    </View>
  );
}
