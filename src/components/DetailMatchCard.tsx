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

  // Left accent bar color
  const accentColor = isWin ? '#16a34a' : isLoss ? '#dc2626' : '#d1d5db';

  // Background tint class
  const bgTint = isWin ? 'bg-win/5' : isLoss ? 'bg-loss/5' : 'bg-gray-50/50';

  // Points display
  const pointsText = match.pointsImpact != null && match.pointsImpact !== 0
    ? `${match.pointsImpact > 0 ? '+' : ''}${match.pointsImpact.toFixed(1)}`
    : null;
  const pointsPillBg = match.pointsImpact != null && match.pointsImpact >= 0
    ? 'bg-win/10'
    : 'bg-loss/10';
  const pointsTextColor = match.pointsImpact != null && match.pointsImpact >= 0
    ? 'text-win'
    : 'text-loss';

  // Parse set scores
  const scores = splitSetScores(match);

  // Build team names — for doubles/mixed show "Player / Partner"
  const userTeamName = match.partner
    ? playerName ? `${playerName}  /  ${match.partner}` : match.partner
    : null;

  // Opponent team
  const opponentName = match.opponent
    ? match.opponent + (match.opponent2 ? `  /  ${match.opponent2}` : '')
    : null;

  // Winner/loser text styles
  const winnerNameClass = 'font-bold text-gray-900';
  const loserNameClass = 'text-gray-600';

  return (
    <View
      className={`${nested ? 'ml-7 mr-3 mb-1' : 'mb-1'} rounded-lg overflow-hidden ${bgTint}`}
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      <View className="px-3 py-2">
        {/* Header: Round + Points */}
        <View className="flex-row justify-between items-center mb-1.5">
          <Text className="text-[12px] text-muted" numberOfLines={1}>
            {match.round ?? match.date ?? ''}
          </Text>
          {pointsText ? (
            <View className={`${pointsPillBg} px-1.5 py-0.5 rounded`}>
              <Text
                className={`text-[12px] font-semibold ${pointsTextColor}`}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {pointsText}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Divider */}
        <View className="h-px bg-gray-200/60 mb-2" />

        {/* User team row */}
        <View className="flex-row items-center justify-between mb-0.5">
          <View className="flex-row items-center flex-1 mr-2">
            {userTeamName ? (
              <Text
                className={`text-[14px] ${isWin ? winnerNameClass : loserNameClass} flex-1`}
                numberOfLines={1}
              >
                {userTeamName}
              </Text>
            ) : (
              <Text className={`text-[14px] ${isWin ? winnerNameClass : loserNameClass}`}>
                {playerName ?? 'You'}
              </Text>
            )}
          </View>
          {/* User scores */}
          {scores ? (
            <View className="flex-row gap-2">
              {scores.map((s, i) => (
                <Text
                  key={i}
                  className={`text-[15px] w-6 text-center ${s.userWonSet ? 'font-bold text-gray-900' : 'text-gray-400'}`}
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
                  <Text
                    className={`text-[14px] ${isLoss ? winnerNameClass : loserNameClass}`}
                    numberOfLines={1}
                  >
                    {opponentName}
                  </Text>
                </Pressable>
              ) : (
                <Text
                  className={`text-[14px] ${isLoss ? winnerNameClass : loserNameClass} flex-1`}
                  numberOfLines={1}
                >
                  {opponentName}
                </Text>
              )
            ) : (
              <Text className="text-[14px] text-gray-400">-</Text>
            )}
          </View>
          {/* Opponent scores */}
          {scores ? (
            <View className="flex-row gap-2">
              {scores.map((s, i) => (
                <Text
                  key={i}
                  className={`text-[15px] w-6 text-center ${!s.userWonSet ? 'font-bold text-gray-900' : 'text-gray-400'}`}
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
