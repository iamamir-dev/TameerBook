import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

interface AddPhotoTileProps {
  label: string;
  onPress: () => void;
  busy?: boolean;
  /** Size/layout comes from the host grid (e.g. same cell as its thumbnails). */
  style?: StyleProp<ViewStyle>;
}

/**
 * THE app-wide "add a photo/document" tile: a compact dashed square with a
 * camera icon + label, sized by the host grid so it always matches the
 * thumbnails around it. Used by the project gallery, the photo diary, and
 * the documents sections — one look everywhere.
 */
export function AddPhotoTile({ label, onPress, busy, style }: AddPhotoTileProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tile, busy && styles.busy, style]}
    >
      <AppIcon name="camera" size={22} color="primary" />
      <AppText size="xs" weight="semibold" color="textSecondary" center numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    tile: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
      backgroundColor: theme.colors.background,
      padding: theme.spacing.xs,
    },
    busy: { opacity: 0.5 },
  });
