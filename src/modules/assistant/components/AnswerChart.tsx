import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import type { AnswerChart as Chart } from '@/ai';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/AnswerChart.styles';
import { shortRupees } from '../utils/shortRupees';

/**
 * Small in-card charts, drawn from theme tokens so they read in both themes.
 *  - bars:    horizontal category bars (spend breakdown), one scale, value at the end
 *  - columns: grouped monthly columns (money in vs out) with a faint baseline grid
 */
export function AnswerChart({ chart }: { chart: Chart }): React.JSX.Element | null {
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (chart.kind === 'bars') {
    const max = Math.max(...chart.items.map((i) => i.value), 1);
    return (
      <View style={styles.wrap}>
        {chart.items.map((i, idx) => (
          <View key={`${i.label}-${idx}`} style={styles.barRow}>
            <AppText size="xs" color="textSecondary" numberOfLines={1} style={styles.barLabel}>
              {i.label}
            </AppText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(2, (i.value / max) * 100)}%` }]} />
            </View>
            <AppText size="xs" weight="bold" tabular style={styles.barValue}>
              {shortRupees(i.value)}
            </AppText>
          </View>
        ))}
      </View>
    );
  }

  // Grouped columns.
  const W = 320;
  const H = 130;
  const padL = 8;
  const padB = 18;
  const padT = 14;
  const groups = chart.groups;
  const max = Math.max(...groups.flatMap((g) => g.values), 1);
  const slot = (W - padL * 2) / Math.max(groups.length, 1);
  const barW = Math.min(18, slot / 3);
  const plotH = H - padB - padT;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const colors = [theme.colors.success, theme.colors.danger];

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        {chart.legend.map((l, i) => (
          <View key={`${l}-${i}`} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors[i] }]} />
            <AppText size="xs" color="textSecondary">
              {l}
            </AppText>
          </View>
        ))}
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0.5, 1].map((f) => (
          <Line key={f} x1={padL} x2={W - padL} y1={y(max * f)} y2={y(max * f)} stroke={theme.colors.track} strokeWidth={1} />
        ))}
        <Line x1={padL} x2={W - padL} y1={y(0)} y2={y(0)} stroke={theme.colors.border} strokeWidth={1} />
        <SvgText x={W - padL} y={y(max) - 3} fontSize={9} fill={theme.colors.textSecondary} textAnchor="end">
          {shortRupees(max)}
        </SvgText>
        {groups.map((g, gi) => {
          const cx = padL + slot * gi + slot / 2;
          return (
            <React.Fragment key={`${g.label}-${gi}`}>
              {g.values.map((v, vi) => {
                const x = cx - barW - 1 + vi * (barW + 2);
                const top = y(v);
                return <Rect key={vi} x={x} y={top} width={barW} height={Math.max(0, y(0) - top)} rx={3} fill={colors[vi]} />;
              })}
              <SvgText x={cx} y={H - 4} fontSize={9} fill={theme.colors.textSecondary} textAnchor="middle">
                {g.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
