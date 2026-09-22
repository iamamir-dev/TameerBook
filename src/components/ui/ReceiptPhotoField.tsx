import React, { useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppButton } from './AppButton';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { PhotoSourceSheet } from './PhotoSourceSheet';

interface ReceiptPhotoFieldProps {
  /** Current photo URI (null = none captured yet). */
  uri: string | null;
  onChange: (uri: string | null) => void;
  /** Row/button label (defaults to the "photo receipt" string). */
  label?: string;
}

/**
 * The unified proof-of-payment photo field. Gives users two clear options:
 * Camera and Gallery. Used across all money entry sheets and screens.
 */
export function ReceiptPhotoField({ uri, onChange, label }: ReceiptPhotoFieldProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const text = label ?? t('photoReceipt');
  const [sourceSheet, setSourceSheet] = useState(false);

  if (uri) {
    return (
      <Pressable onPress={() => onChange(null)} style={styles.row} accessibilityRole="button" accessibilityLabel={text}>
        <Image source={{ uri }} style={styles.thumb} />
        <AppText size="sm" weight="semibold" style={styles.flex}>
          {text}
        </AppText>
        <AppIcon name="close" size={20} color="danger" />
      </Pressable>
    );
  }

  return (
    <>
      <AppButton
        label={text}
        icon="camera"
        variant="secondary"
        onPress={() => setSourceSheet(true)}
      />
      <PhotoSourceSheet
        visible={sourceSheet}
        onClose={() => setSourceSheet(false)}
        onSelect={onChange}
        title={text}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: theme.spacing.sm,
    },
    thumb: { width: 44, height: 44, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
  });
