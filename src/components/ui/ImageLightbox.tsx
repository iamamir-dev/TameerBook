import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';

interface ImageLightboxProps {
  /** The image to show full-screen; null = closed. */
  uri: string | null;
  onClose: () => void;
}

/**
 * The one full-screen image viewer (site photos, receipts, plot documents) —
 * replaces the identical hand-rolled Modals in the photo diary, project
 * gallery and plot documents grid.
 */
export function ImageLightbox({ uri, onClose }: ImageLightboxProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('cancel')}
          style={[styles.close, { top: insets.top + theme.spacing.md }]}
        >
          <AppIcon name="close" size={28} color="onHero" />
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    viewer: { flex: 1, backgroundColor: theme.colors.lightboxBackdrop, alignItems: 'center', justifyContent: 'center' },
    image: { width: '100%', height: '80%' },
    close: {
      position: 'absolute',
      right: theme.spacing.lg,
      width: theme.touch.minTarget,
      height: theme.touch.minTarget,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.lightboxControl,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
