import React from 'react';
import {
  KeyboardAvoidingView,
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
  /**
   * Take a FIXED tall height (maxHeightRatio) instead of hugging content, so
   * the header + footer stay anchored and only the body scrolls — for long,
   * growing forms (e.g. a multi-line booking).
   */
  fill?: boolean;
}

/**
 * The one bottom-sheet shell for the whole app — a single place to get the look
 * and the keyboard behavior right for every drawer. Header is an icon chip +
 * title + subtitle; the body scrolls within a capped height; an optional footer
 * is pinned above the safe area behind a hairline.
 *
 * Keyboard: `behavior="padding"` on BOTH platforms. Inside a bottom-anchored
 * Modal, padding lifts the sheet above the keyboard and resets cleanly on
 * dismiss — 'height' left a residual gap on Android after the keyboard closed.
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
  fill = false,
}: AppSheetProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const styles = makeStyles(theme);

  const body = scroll ? (
    <ScrollView
      style={[styles.scroll, fill && styles.scrollFill]}
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
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('cancel')} />

        <View style={[styles.sheet, fill ? { height: screenHeight * maxHeightRatio } : { maxHeight: screenHeight * maxHeightRatio }]}>
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
      paddingHorizontal: theme.spacing.xl,
      ...theme.shadows.raised,
    },
    grabberArea: { alignItems: 'center', paddingVertical: theme.spacing.sm },
    grabber: { width: 40, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    header: { alignItems: 'center', gap: 2, marginBottom: theme.spacing.md },
    scroll: { flexGrow: 0, flexShrink: 1 },
    // `fill` mode: the body takes all the space between the pinned header and
    // footer so only it scrolls.
    scrollFill: { flexGrow: 1, flexShrink: 1 },
    scrollContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
    staticBody: { gap: theme.spacing.md },
    footer: {
      paddingTop: theme.spacing.md,
      marginTop: theme.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
  });
