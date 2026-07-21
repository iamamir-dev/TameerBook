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
 * The one bottom-sheet shell for the whole app.
 *
 * Keyboard handling (precise, no gaps): the sheet is lifted to sit just above
 * the keyboard (`root` gets bottom padding = keyboard height) AND its max height
 * shrinks by the same amount, so the header stays pinned on screen, the footer
 * (Save) sits right above the keyboard, and the body scrolls between them —
 * with no empty space and nothing pushed off-screen.
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

  // When the keyboard is up, its area already covers the bottom safe inset.
  const footerPadBottom = kb > 0 ? theme.spacing.md : insets.bottom + theme.spacing.md;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingBottom: kb }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('cancel')} />

        <View style={[styles.sheet, { maxHeight: screenHeight * maxHeightRatio - kb }]}>
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
            <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>{footer}</View>
          ) : (
            <View style={{ height: footerPadBottom }} />
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
