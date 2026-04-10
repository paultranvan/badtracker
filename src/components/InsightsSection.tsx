import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card } from './Card';
import { SectionHeader } from './SectionHeader';
import type { InsightsData } from '../utils/insights';

interface InsightsSectionProps {
  data: InsightsData | null;
}

function GridRow({ left, right }: { left: ReactNode | null; right: ReactNode | null }) {
  if (!left && !right) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {left ?? <View style={{ flex: 1 }} />}
      {right ?? <View style={{ flex: 1 }} />}
    </View>
  );
}

function WinStreakCard({ count, t }: { count: number; t: TFunction }) {
  return (
    <Card className="flex-1 items-center py-3 px-2">
      <Text className="text-caption text-muted uppercase">{t('insights.longestStreak')}</Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#f59e0b', marginVertical: 2 }}>
        {'🔥 '}{count}
      </Text>
      <Text className="text-[11px] text-muted">{t('insights.consecutiveWins')}</Text>
    </Card>
  );
}

function RecentFormCard({ results, t }: { results: boolean[]; t: TFunction }) {
  return (
    <Card className="flex-1 items-center py-3 px-2">
      <Text className="text-caption text-muted uppercase">{t('insights.recentForm')}</Text>
      <View style={{ flexDirection: 'row', gap: 4, marginVertical: 6 }}>
        {results.map((isWin, i) => (
          <View
            key={i}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: isWin ? '#10b981' : '#ef4444',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
              {isWin ? t('insights.formWin') : t('insights.formLoss')}
            </Text>
          </View>
        ))}
      </View>
      <Text className="text-[11px] text-muted">
        {t('insights.lastNMatches', { count: results.length })}
      </Text>
    </Card>
  );
}

function BiggestUpsetCard({ opponentRank, playerRank, t }: { opponentRank: string; playerRank: string; t: TFunction }) {
  return (
    <Card className="flex-1 items-center py-3 px-2">
      <Text className="text-caption text-muted uppercase">{t('insights.biggestUpset')}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#10b981', marginVertical: 2 }}>
        {'💥 '}{t('insights.vsRank', { rank: opponentRank })}
      </Text>
      <Text className="text-[11px] text-muted">
        {t('insights.youWere', { rank: playerRank })}
      </Text>
    </Card>
  );
}

function CpphMomentumCard({ total, matchCount, t }: { total: number; matchCount: number; t: TFunction }) {
  const isPositive = total >= 0;
  const arrow = isPositive ? '↑' : '↓';
  const color = isPositive ? '#10b981' : '#ef4444';
  const sign = isPositive ? '+' : '';

  return (
    <Card className="flex-1 items-center py-3 px-2">
      <Text className="text-caption text-muted uppercase">{t('insights.cpphMomentum')}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color, marginVertical: 2 }}>
        {arrow} {sign}{total.toFixed(1)}
      </Text>
      <Text className="text-[11px] text-muted">
        {t('insights.lastNMatches', { count: matchCount })}
      </Text>
    </Card>
  );
}

interface FullWidthCardProps {
  emoji: string;
  bgColor: string;
  label: string;
  title: string;
  subtitle: string;
}

function FullWidthCard({ emoji, bgColor, label, title, subtitle }: FullWidthCardProps) {
  return (
    <Card className="flex-row items-center p-3.5" style={{ gap: 14 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text className="text-caption text-muted uppercase">{label}</Text>
        <Text className="text-body font-bold text-gray-900" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[12px] text-muted">{subtitle}</Text>
      </View>
    </Card>
  );
}

function InsightsSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View
        className="flex-1 rounded-xl bg-gray-100"
        style={{ height: 80, opacity: 0.6 }}
      />
      <View
        className="flex-1 rounded-xl bg-gray-100"
        style={{ height: 80, opacity: 0.4 }}
      />
    </View>
  );
}

export function InsightsSection({ data }: InsightsSectionProps) {
  const { t } = useTranslation();

  if (!data) {
    return (
      <View>
        <SectionHeader title={t('insights.title')} />
        <InsightsSkeleton />
      </View>
    );
  }

  const hasAny =
    data.winStreak ||
    data.recentForm ||
    data.biggestUpset ||
    data.cpphMomentum ||
    data.bestTournament ||
    data.bestPartner ||
    data.nemesis ||
    data.mostPlayed;

  if (!hasAny) return null;

  return (
    <View>
      <SectionHeader title={t('insights.title')} />

      <View style={{ gap: 10, marginBottom: 10 }}>
        <GridRow
          left={data.winStreak ? <WinStreakCard count={data.winStreak.count} t={t} /> : null}
          right={data.recentForm ? <RecentFormCard results={data.recentForm.results} t={t} /> : null}
        />
        <GridRow
          left={data.biggestUpset ? <BiggestUpsetCard opponentRank={data.biggestUpset.opponentRank} playerRank={data.biggestUpset.playerRank} t={t} /> : null}
          right={data.cpphMomentum ? <CpphMomentumCard total={data.cpphMomentum.total} matchCount={data.cpphMomentum.matchCount} t={t} /> : null}
        />
      </View>

      <View style={{ gap: 10 }}>
        {data.bestTournament && (
          <FullWidthCard
            emoji="🏆"
            bgColor="#fef3c7"
            label={t('insights.bestTournament')}
            title={data.bestTournament.name}
            subtitle={t('insights.tournamentStats', {
              wins: data.bestTournament.wins,
              losses: data.bestTournament.losses,
              rate: data.bestTournament.winRate,
            })}
          />
        )}
        {data.bestPartner && (
          <FullWidthCard
            emoji="🤝"
            bgColor="#dbeafe"
            label={t('insights.bestPartner')}
            title={data.bestPartner.name}
            subtitle={t('insights.partnerStats', {
              count: data.bestPartner.matchCount,
              rate: data.bestPartner.winRate,
            })}
          />
        )}
        {data.nemesis && (
          <FullWidthCard
            emoji="⚔️"
            bgColor="#fee2e2"
            label={t('insights.nemesis')}
            title={data.nemesis.name}
            subtitle={t('insights.nemesisStats', {
              wins: data.nemesis.wins,
              losses: data.nemesis.losses,
            })}
          />
        )}
        {data.mostPlayed && (
          <FullWidthCard
            emoji="🔄"
            bgColor="#f0fdf4"
            label={t('insights.mostPlayed')}
            title={data.mostPlayed.name}
            subtitle={t('insights.mostPlayedStats', {
              count: data.mostPlayed.matchCount,
              date: data.mostPlayed.lastDate,
            })}
          />
        )}
      </View>
    </View>
  );
}
