import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';

interface SearchBarProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

/**
 * Compact search field for long lists (workers / plots / investors /
 * transactions): icon + input + a clear button when there's text. Pure theme
 * tokens; filtering itself stays in the host screen.
 */
export function SearchBar({ value, onChange, placeholder }: SearchBarProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View style={styles.wrap}>
      <AppIcon name="search" size={18} color="textSecondary" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? t('search')}
        placeholderTextColor={theme.colors.textSecondary}
        style={styles.input}
        accessibilityLabel={t('search')}
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange('')} hitSlop={theme.touch.hitSlop} accessibilityLabel={t('cancel')}>
          <AppIcon name="close" size={18} color="textSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      minHeight: theme.touch.minTarget - 6,
    },
    input: {
      flex: 1,
      padding: 0,
      fontFamily: theme.typography.weights.semibold,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textPrimary,
      includeFontPadding: false,
    },
  });
