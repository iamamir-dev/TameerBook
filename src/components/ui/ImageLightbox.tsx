import React from 'react';
import { Image, Modal, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSheetAnimation } from '@/hooks';

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
  const { mounted, backdropStyle } = useSheetAnimation(uri !== null);
  // Keep the image through the close fade (uri goes null before unmount).
  const [lastUri, setLastUri] = React.useState<string | null>(null);
  if (uri && uri !== lastUri) setLastUri(uri);
  const shown = uri ?? lastUri;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.viewer, backdropStyle]}>
        {shown ? <Image source={{ uri: shown }} style={styles.image} resizeMode="contain" /> : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('cancel')}
          style={[styles.close, { top: insets.top + theme.spacing.md }]}
        >
          <AppIcon name="close" size={28} color="onHero" />
        </Pressable>
      </Animated.View>
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
