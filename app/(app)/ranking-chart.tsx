import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-gifted-charts';
import { useSession } from '../../src/auth/context';
import { useRankingEvolution } from '../../src/hooks/useRankingEvolution';
import {
  DISCIPLINE_COLORS,
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
  const dataSets = useMemo(() => {
    if (!chartData) return [];

    return chartData.disciplines
      .filter((d) => visibleDisciplines[d.discipline] && d.points.length > 0)
      .map((d) => {
        const data = d.points.map((point) => {
          const item: Record<string, unknown> = {
            value: point.value,
            label: point.label,
          };

          if (point.isMilestone) {
            item.showDataPoint = true;
            item.dataPointRadius = 7;
            item.customDataPoint = () => (
              <View
                style={[
                  styles.milestoneDot,
                  { backgroundColor: d.color },
                ]}
              />
            );
            item.dataPointLabelComponent = () => (
              <View
                style={[
                  styles.milestoneBadge,
                  { backgroundColor: d.color },
                ]}
              >
                <Text style={styles.milestoneText}>{point.rank}</Text>
              </View>
            );
            item.dataPointLabelShiftY = -22;
            item.dataPointLabelShiftX = -8;
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
  }, [chartData, visibleDisciplines]);

  // ----------------------------------------------------------
  // Chart dimensions and config
  // ----------------------------------------------------------
  const chartConfig = useMemo(() => {
    if (!chartData || dataSets.length === 0) {
      return { maxValue: 100, spacing: 40, xLabels: [] };
    }

    const maxVal = chartData.maxValue;
    const paddedMax = maxVal > 0 ? Math.ceil(maxVal * 1.1) : 100;

    // Calculate spacing to use available width
    // Largest dataset determines point count
    const maxPoints = Math.max(...dataSets.map((ds) => ds.data.length), 1);
    const spacing = Math.max(20, Math.min(50, 300 / maxPoints));

    return { maxValue: paddedMax, spacing, xLabels: [] };
  }, [chartData, dataSets]);

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ----------------------------------------------------------
  // Error state
  // ----------------------------------------------------------
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t(error)}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={() => refresh()}
        >
          <Text style={styles.retryText}>{t('common.retry')}</Text>
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
        style={styles.container}
        contentContainerStyle={styles.centeredContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        <Text style={styles.noDataText}>{t('ranking.noData')}</Text>
      </ScrollView>
    );
  }

  // ----------------------------------------------------------
  // Chart content
  // ----------------------------------------------------------
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
      <Text style={styles.title}>{t('ranking.title')}</Text>
      <Text style={styles.subtitle}>{t('ranking.subtitle')}</Text>

      {/* Legend */}
      <ChartLegend
        visible={visibleDisciplines}
        onToggle={toggleDiscipline}
        chartData={chartData.disciplines}
        t={t}
      />

      {/* Chart */}
      <View style={styles.chartContainer}>
        {dataSets.length > 0 ? (
          <LineChart
            dataSet={dataSets}
            height={280}
            maxValue={chartConfig.maxValue}
            noOfSections={5}
            spacing={chartConfig.spacing}
            initialSpacing={20}
            endSpacing={20}
            rulesType="solid"
            rulesColor="#f3f4f6"
            yAxisTextStyle={styles.yAxisText}
            xAxisLabelTextStyle={styles.xAxisText}
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
              pointerLabelComponent: (items: Array<{ value: number }>) => (
                <View style={styles.tooltipContainer}>
                  <Text style={styles.tooltipText}>
                    {items[0]?.value != null
                      ? `${items[0].value.toFixed(1)} pts`
                      : ''}
                  </Text>
                </View>
              ),
            }}
          />
        ) : (
          <View style={styles.noVisibleLines}>
            <Text style={styles.noVisibleText}>
              {t('ranking.legend')}
            </Text>
          </View>
        )}
      </View>

      {/* Legend hint */}
      <Text style={styles.legendHint}>{t('ranking.legend')}</Text>
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
    <View style={styles.legendRow}>
      {items.map(({ key, color, labelKey }) => {
        const hasData =
          chartData.find((d) => d.discipline === key)?.points.length ?? 0;
        return (
          <Pressable
            key={key}
            onPress={() => onToggle(key)}
            style={[
              styles.legendItem,
              !visible[key] && styles.legendItemHidden,
            ]}
          >
            <View
              style={[
                styles.legendDot,
                { backgroundColor: color },
                !visible[key] && styles.legendDotHidden,
              ]}
            />
            <Text
              style={[
                styles.legendLabel,
                !visible[key] && styles.legendLabelHidden,
              ]}
            >
              {t(labelKey)}
            </Text>
            {hasData === 0 && (
              <Text style={styles.legendNC}>NC</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },

  // Header
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  legendItemHidden: {
    opacity: 0.4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendDotHidden: {
    opacity: 0.5,
  },
  legendLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  legendLabelHidden: {
    color: '#9ca3af',
  },
  legendNC: {
    fontSize: 10,
    color: '#9ca3af',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  legendHint: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },

  // Chart
  chartContainer: {
    marginTop: 8,
    paddingRight: 8,
  },
  yAxisText: {
    color: '#6b7280',
    fontSize: 11,
  },
  xAxisText: {
    color: '#6b7280',
    fontSize: 10,
  },

  // No visible lines
  noVisibleLines: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  noVisibleText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // Milestone markers
  milestoneDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  milestoneBadge: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  milestoneText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },

  // Tooltip
  tooltipContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tooltipText: {
    fontWeight: '600',
    fontSize: 13,
    color: '#111',
    textAlign: 'center',
  },

  // No data
  noDataText: {
    fontSize: 15,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Error
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonPressed: {
    backgroundColor: '#1d4ed8',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
