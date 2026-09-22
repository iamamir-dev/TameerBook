import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSheetAnimation } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
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
 * Universal bottom-sheet shell: guarantees that active inputs and action buttons
 * are NEVER hidden behind the keyboard on both Android and iOS.
 */
export function AppSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  maxHeightRatio = 0.88,
}: AppSheetProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const styles = makeStyles(theme);
  const { mounted, backdropStyle, sheetStyle, onSheetLayout } = useSheetAnimation(visible);

  // Cross-platform keyboard avoidance:
  // On iOS, listen to `keyboardWillShow/Hide` for synced animation.
  // On Android, listen to `keyboardDidShow/Hide` so React Native Modal Dialog windows
  // reliably lift inputs and footers above the software keyboard.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKb(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKb(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticBody}>{children}</View>
  );

  const footerPadBottom = insets.bottom + theme.spacing.md;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: kb }]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
          />
        </Animated.View>

        <Animated.View
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            sheetStyle,
            { maxHeight: Math.max(200, screenHeight * maxHeightRatio - kb) },
          ]}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            style={styles.grabberArea}
          >
            <View style={styles.grabber} />
          </Pressable>

          {title ? (
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <AppText size="lg" weight="bold" numberOfLines={1}>
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText size="xs" color="textSecondary" numberOfLines={1}>
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.dim]}
              >
                <AppIcon name="close" size={20} color="textSecondary" />
              </Pressable>
            </View>
          ) : null}

          {body}

          {footer ? (
            <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>{footer}</View>
          ) : (
            <View style={{ height: footerPadBottom }} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay },
    sheet: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.xl,
      ...theme.shadows.raised,
    },
    grabberArea: {
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      width: '100%',
    },
    grabber: {
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    headerTextWrap: {
      flex: 1,
      gap: 2,
    },
    closeBtn: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
    dim: { opacity: 0.6 },
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
