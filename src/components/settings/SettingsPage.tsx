import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface SettingsPageProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
  /** Sheets and pickers rendered outside the scroll view. */
  overlays?: React.ReactNode;
}

/** The shell every settings page shares: header with back chevron, one scrolling column of groups. */
export function SettingsPage({ title, subtitle, onBack, children, overlays }: SettingsPageProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.screen}>
      <AppHeader title={title} subtitle={subtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {overlays}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl + 40, gap: theme.spacing.md },
  });
