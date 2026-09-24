import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsGroup } from '@/components/settings';
import { AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

/** The charity share of each profit, as a stepper. */
export function MoneySection(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const donationPct = useSettingsStore((s) => s.donationPct);
  const setDonationPct = useSettingsStore((s) => s.setDonationPct);

  const step = (delta: number, label: string) => (
    <Pressable onPress={() => setDonationPct(Math.min(100, Math.max(0, donationPct + delta)))} hitSlop={theme.touch.hitSlop} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
      <AppText size="lg" weight="bold" color="primary">
        {delta < 0 ? '−' : '+'}
      </AppText>
    </Pressable>
  );

  return (
    <SettingsGroup header={t('donationPctLabel')} footer={t('donationNote')}>
      <View style={styles.row}>
        <View style={styles.labels}>
          <AppText size="md">{t('donationPctLabel')}</AppText>
          <AppText size="sm" color="textSecondary">
            {donationPct > 0 ? `${donationPct}% ${t('plotProfit')}` : '0%'}
          </AppText>
        </View>
        <View style={styles.stepper}>
          {step(-1, '-1%')}
          <AppText size="md" weight="bold" tabular style={styles.stepValue}>
            {donationPct}%
          </AppText>
          {step(1, '+1%')}
        </View>
      </View>
    </SettingsGroup>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { minHeight: theme.touch.minTarget, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    labels: { flex: 1, gap: 2 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    stepBtn: { width: 36, height: 36, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    stepValue: { minWidth: 48, textAlign: 'center' },
    pressed: { opacity: 0.6 },
  });
