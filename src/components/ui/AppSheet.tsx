import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppText } from './AppText';

interface AppSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional bold title rendered under the grabber. */
  title?: string;
  /** Sheet body. */
  children: React.ReactNode;
  /** Pinned bar below the scroll area (e.g. a Save button); safe-area padded. */
  footer?: React.ReactNode;
  /** Wrap children in a ScrollView (default true). Turn off for lists that
   *  manage their own scrolling. */
  scroll?: boolean;
  /** Fraction of screen height the sheet may grow to (default 0.85). */
  maxHeightRatio?: number;
}

/**
 * The one bottom-sheet shell for the whole app. Collapses the ~30 hand-rolled
 * `Modal` + backdrop + grabber + KeyboardAvoidingView blocks that each screen
 * used to reimplement. Content and a pinned footer are the only knobs — the
 * shell owns the animation, dismissal (backdrop / grabber / hardware back),
 * keyboard avoidance, safe-area padding, and the capped-height scroll behavior.
 *
 * Modeled on the proven `SelectSheet` shell so it behaves identically.
 */
export function AppSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scroll = true,
  maxHeightRatio = 0.85,
}: AppSheetProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const styles = makeStyles(theme);

  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticBody}>{children}</View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('cancel')} />

        <View style={[styles.sheet, { maxHeight: screenHeight * maxHeightRatio }]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            style={styles.grabberArea}
          >
            <View style={styles.grabber} />
          </Pressable>

          {title ? (
            <AppText size="lg" weight="bold" style={styles.title}>
              {title}
            </AppText>
          ) : null}

          {body}

          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>{footer}</View>
          ) : (
            <View style={{ height: insets.bottom + theme.spacing.md }} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.raised,
    },
    grabberArea: { alignItems: 'center', paddingVertical: theme.spacing.md },
    grabber: { width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    title: { marginBottom: theme.spacing.md },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
    staticBody: { gap: theme.spacing.md },
    footer: { paddingTop: theme.spacing.md },
  });
