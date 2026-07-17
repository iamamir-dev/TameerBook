import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppText } from './AppText';

interface AvatarProps {
  /** Photo uri; when null a gold letter-avatar of the first initial shows. */
  uri?: string | null;
  name: string;
  /** Diameter in px (default 48). */
  size?: number;
}

/**
 * Circular photo/letter avatar. Replaces the identical inline `Avatar`
 * reimplemented in `InvestorsScreen` and `InvestorPersonSheet` (and the same
 * shape used for workers/companies).
 */
export function Avatar({ uri, name, size = 48 }: AvatarProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const dim = { width: size, height: size, borderRadius: theme.radius.pill };

  if (uri) return <Image source={{ uri }} style={[styles.image, dim]} />;
  return (
    <View style={[styles.fallback, dim]}>
      <AppText size="lg" weight="bold" color="onPrimary">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    image: { backgroundColor: theme.colors.track },
    fallback: {
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
