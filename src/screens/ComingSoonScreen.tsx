import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader, EmptyState } from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ComingSoonRoute = RouteProp<RootStackParamList, 'ComingSoon'>;

/** Generic "built in a later phase" placeholder, titled by the caller. */
export function ComingSoonScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { titleKey } = useRoute<ComingSoonRoute>().params;
  const styles = makeStyles(theme);

  return (
    <View style={styles.screen}>
      <AppHeader title={t(titleKey as TranslationKey)} onBack={() => navigation.goBack()} />
      <EmptyState icon="empty" title={t('comingSoon')} message={t('comingSoonDetail')} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
  });
