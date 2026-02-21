import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-gifted-charts';
import { useSession } from '../../src/auth/context';
import { useRankingEvolution } from '../../src/hooks/useRankingEvolution';
import { Card } from '../../src/components';
import {
  DISCIPLINE_COLORS,
  RANK_ORDER,
  type Discipline,
  type ChartDataPoint,
} from '../../src/utils/rankingChart';

// ============================================================
// Types
// ============================================================

type VisibleDisciplines = Record<Discipline, boolean>;

// ============================================================
// Main Screen
// ============================================================

export default function RankingChartScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const licence = session?.licence ?? '';
  const { chartData, isLoading, isRefreshing, error, refresh } =
    useRankingEvolution(licence);

  const [visibleDisciplines, setVisibleDisciplines] =
    useState<VisibleDisciplines>({
      simple: true,
      double: true,
      mixte: true,
    });

  const toggleDiscipline = (key: Discipline) => {
    setVisibleDisciplines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ----------------------------------------------------------
  // Build chart dataSets from visible disciplines
  // ----------------------------------------------------------
  const yAxisOffset = chartData?.minValue ?? 0;

  const dataSets = useMemo(() => {
    if (!chartData) return [];

    return chartData.disciplines
      .filter((d) => visibleDisciplines[d.discipline] && d.points.length > 0)
      .map((d) => {
        const data = d.points.map((point) => {
          const item: Record<string, unknown> = {
            value: point.value - yAxisOffset,
            label: point.label,
          };

          if (point.isMilestone) {
            item.showDataPoint = true;
            item.dataPointRadius = 7;
            item.customDataPoint = () => (
              <View
                className="w-3.5 h-3.5 rounded-full border-2 border-white"
                style={{ backgroundColor: d.color }}
              />
            );
          }

          return item;
        });

        return {
          data,
          color: d.color,
          thickness: 2,
          hideDataPoints: true,
          dataPointsColor: d.color,
          startFillColor: `${d.color}15`,
          endFillColor: `${d.color}05`,
        };
      });
  }, [chartData, visibleDisciplines, yAxisOffset]);

  // ----------------------------------------------------------
  // Chart dimensions and config
  // ----------------------------------------------------------
  const chartConfig = useMemo(() => {
    if (!chartData || dataSets.length === 0) {
      return { maxValue: 12, noOfSections: 12, spacing: 40, yAxisLabelTexts: RANK_ORDER };
    }

    const maxVal = chartData.maxValue;
    const minVal = chartData.minValue;
    const yAxisLabelTexts = RANK_ORDER.slice(minVal, maxVal + 1);
    const noOfSections = (maxVal - minVal) || 1;
    const maxPoints = Math.max(...dataSets.map((ds) => ds.data.length), 1);
    const spacing = Math.max(20, Math.min(50, 300 / maxPoints));

    return { maxValue: maxVal - minVal, noOfSections, spacing, yAxisLabelTexts };
  }, [chartData, dataSets]);

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-body text-loss text-center mb-4">{t(error)}</Text>
        <Pressable
          className="bg-primary px-6 py-2.5 rounded-lg active:bg-primary-dark"
          onPress={() => refresh()}
        >
          <Text className="text-white text-body font-semibold">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------------------------
  // No data state
  // ----------------------------------------------------------
  if (!chartData || chartData.disciplines.every((d) => d.points.length === 0)) {
    return (
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        <Text className="text-body text-muted italic text-center">{t('ranking.noData')}</Text>
      </ScrollView>
    );
  }

  // ----------------------------------------------------------
  // Chart content
  // ----------------------------------------------------------
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          colors={['#2563eb']}
          tintColor="#2563eb"
        />
      }
    >
      {/* Header */}
      <Text className="text-title text-gray-900 mb-1">{t('ranking.title')}</Text>
      <Text className="text-caption text-muted mb-4">{t('ranking.subtitle')}</Text>

      {/* Legend */}
      <ChartLegend
        visible={visibleDisciplines}
        onToggle={toggleDiscipline}
        chartData={chartData.disciplines}
        t={t}
      />

      {/* Chart */}
      <Card className="p-4 mb-4">
        {dataSets.length > 0 ? (
          <LineChart
            dataSet={dataSets}
            height={280}
            stepChart
            maxValue={chartConfig.maxValue}
            noOfSections={chartConfig.noOfSections}
            yAxisLabelTexts={chartConfig.yAxisLabelTexts}
            spacing={chartConfig.spacing}
            initialSpacing={20}
            endSpacing={20}
            rulesType="solid"
            rulesColor="#f3f4f6"
            yAxisTextStyle={{ color: '#6b7280', fontSize: 11 }}
            xAxisLabelTextStyle={{ color: '#6b7280', fontSize: 10 }}
            xAxisColor="#e5e7eb"
            yAxisColor="#e5e7eb"
            hideRules={false}
            showVerticalLines={false}
            pointerConfig={{
              pointerStripHeight: 240,
              pointerStripColor: '#e5e7eb',
              pointerStripWidth: 1,
              pointerColor: '#6b7280',
              radius: 5,
              pointerLabelWidth: 100,
              pointerLabelHeight: 60,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (items: Array<{ value: number }>) => {
                const val = Math.round(items[0]?.value ?? 0) + (chartData?.minValue ?? 0);
                const rankLabel = RANK_ORDER[val] ?? '';
                return (
                  <Card className="px-3 py-2 shadow-md" style={{ borderLeftWidth: 3, borderLeftColor: '#6b7280' }}>
                    <Text className="text-caption font-bold text-gray-800">{rankLabel}</Text>
                  </Card>
                );
              },
            }}
          />
        ) : (
          <View className="h-[280px] items-center justify-center bg-gray-50 rounded-lg">
            <Text className="text-body text-muted italic">
              {t('ranking.legend')}
            </Text>
          </View>
        )}
      </Card>

      {/* Legend hint */}
      <Text className="text-[11px] text-muted text-center mt-2">{t('ranking.legend')}</Text>
    </ScrollView>
  );
}

// ============================================================
// Chart Legend Sub-component
// ============================================================

interface ChartLegendProps {
  visible: VisibleDisciplines;
  onToggle: (key: Discipline) => void;
  chartData: Array<{
    discipline: Discipline;
    points: ChartDataPoint[];
  }>;
  t: (key: string) => string;
}

function ChartLegend({ visible, onToggle, chartData, t }: ChartLegendProps) {
  const items: Array<{
    key: Discipline;
    color: string;
    labelKey: string;
  }> = [
    { key: 'simple', color: DISCIPLINE_COLORS.simple, labelKey: 'ranking.simple' },
    { key: 'double', color: DISCIPLINE_COLORS.double, labelKey: 'ranking.double' },
    { key: 'mixte', color: DISCIPLINE_COLORS.mixte, labelKey: 'ranking.mixte' },
  ];

  return (
    <View className="flex-row justify-center gap-4 mb-3">
      {items.map(({ key, color, labelKey }) => {
        const hasData =
          chartData.find((d) => d.discipline === key)?.points.length ?? 0;
        const isVisible = visible[key];
        return (
          <Pressable
            key={key}
            className="flex-row items-center gap-2 py-1 px-2"
            onPress={() => onToggle(key)}
          >
            <View
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: isVisible ? color : 'transparent',
                borderWidth: isVisible ? 0 : 2,
                borderColor: color,
              }}
            />
            <Text className={`text-caption ${isVisible ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {t(labelKey)}
            </Text>
            {hasData === 0 && (
              <Text className="text-[10px] text-gray-400 italic ml-1">NC</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
