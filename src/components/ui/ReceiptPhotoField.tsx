import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { captureReceipt } from '@/utils/photo';

import { AppButton } from './AppButton';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

interface ReceiptPhotoFieldProps {
  /** Current photo URI (null = none captured yet). */
  uri: string | null;
  onChange: (uri: string | null) => void;
  /** Row/button label (defaults to the "photo receipt" string). */
  label?: string;
}

/**
 * The one proof-of-payment photo field. Replaces the copy-pasted "capture a
 * receipt → thumbnail + remove, else a camera button" block that the plot,
 * sale and other money sheets each reimplemented. Captures via the shared
 * `captureReceipt` (camera + compress); drop it into a `MoneyEntrySheet`'s
 * `extra`.
 */
export function ReceiptPhotoField({ uri, onChange, label }: ReceiptPhotoFieldProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const text = label ?? t('photoReceipt');

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
    <AppButton
      label={text}
      icon="camera"
      variant="secondary"
      onPress={() => {
        void captureReceipt()
          .then((u) => {
            if (u) onChange(u);
          })
          .catch(swallow('receipt:capture'));
      }}
    />
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
