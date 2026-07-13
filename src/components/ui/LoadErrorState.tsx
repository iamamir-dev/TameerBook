import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { useTranslation } from '@/i18n';
import type { Theme } from '@/theme/theme';

import { AppButton } from './AppButton';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

interface LoadErrorStateProps {
  /** Re-run the failed load (wired to useFocusReload's `reload`). */
  onRetry: () => void;
}

/**
 * Centered "load failed" placeholder with a retry action. Screens render it
 * (instead of a blank loading branch) when `useFocusReload` reports
 * `loadFailed` and there is no data to show.
 */
export function LoadErrorState({ onRetry }: LoadErrorStateProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <AppIcon name="close" size={48} color="danger" />
      </View>
      <AppText size="xl" weight="bold" center style={styles.title}>
        {t('errorTitle')}
      </AppText>
      <AppText size="md" color="textSecondary" center style={styles.message}>
        {t('errorBody')}
      </AppText>
      <View style={styles.action}>
        <AppButton label={t('retry')} icon="transfer" onPress={onRetry} fullWidth={false} />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    title: {
      marginTop: theme.spacing.xs,
    },
    message: {
      maxWidth: 320,
    },
    action: {
      marginTop: theme.spacing.lg,
    },
  });
