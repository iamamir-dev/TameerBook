import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
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
  /** Centered title in the compact header. */
  title?: string;
  /** Optional one-line context under the title. */
  subtitle?: string;
  /** Sheet body. */
  children: React.ReactNode;
  /** Pinned bar below the scroll area (e.g. a Save button); safe-area padded. */
  footer?: React.ReactNode;
  /** Wrap children in a ScrollView (default true). */
  scroll?: boolean;
  /** Fraction of screen height the sheet may grow to (default 0.9). */
  maxHeightRatio?: number;
}

/**
 * The one bottom-sheet shell for the whole app — a single place to get the look
 * and the keyboard behavior right for every drawer. Header is an icon chip +
 * title + subtitle; the body scrolls within a capped height; an optional footer
 * is pinned above the safe area behind a hairline.
 *
 * Keyboard: the sheet does NOT lift — the header stays pinned at the top and
 * the footer sits behind the keyboard. The body ScrollView insets for the
 * keyboard (`automaticallyAdjustKeyboardInsets`) so focused inputs scroll into
 * view. (Lifting the whole sheet pushed the header off the top of the screen.)
 */
export function AppSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  maxHeightRatio = 0.9,
}: AppSheetProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const styles = makeStyles(theme);

  // Track keyboard height so the scroll area can gain enough bottom room to
  // lift a focused input above the keyboard — without moving the header/footer.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: theme.spacing.sm + kb }]}
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
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('cancel')} />

        <View style={[styles.sheet, { maxHeight: screenHeight * maxHeightRatio }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('cancel')} style={styles.grabberArea}>
            <View style={styles.grabber} />
          </Pressable>

          {title ? (
            <View style={styles.header}>
              <AppText size="lg" weight="bold" center numberOfLines={1}>
                {title}
              </AppText>
              {subtitle ? (
                <AppText size="sm" color="textSecondary" center numberOfLines={1}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {body}

          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>{footer}</View>
          ) : (
            <View style={{ height: insets.bottom + theme.spacing.md }} />
          )}
        </View>
      </View>
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
      paddingHorizontal: theme.spacing.xl,
      ...theme.shadows.raised,
    },
    grabberArea: { alignItems: 'center', paddingVertical: theme.spacing.sm },
    grabber: { width: 40, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    header: { alignItems: 'center', gap: 2, marginBottom: theme.spacing.md },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
    staticBody: { gap: theme.spacing.md },
    footer: {
      paddingTop: theme.spacing.md,
      marginTop: theme.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
  });
