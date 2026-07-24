import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
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
import type { GlyphName, IconKey } from './icons';

export interface SelectOption {
  id: string;
  label: string;
  subtitle?: string;
  icon?: IconKey | GlyphName;
  /** Small colored dot before the label (e.g. a status's color). */
  dotColor?: string;
  /** Shown faded and non-selectable (e.g. already used elsewhere). */
  disabled?: boolean;
}

interface SelectSheetProps {
  visible: boolean;
  onClose: () => void;
  options: SelectOption[];
  selectedId?: string;
  onSelect: (option: SelectOption) => void;
  title: string;
  /** Show a search box above the list (default true). */
  searchable?: boolean;
}

/**
 * A single-select bottom sheet. Rebuilt simple + robust: the Modal's own
 * "slide" handles the animation (no Reanimated/gesture layer), and the list
 * sits in an OUTER flex column so it can shrink and scroll reliably on every
 * device. The sheet hugs its content up to a cap, then the list scrolls.
 *
 * Dismiss by tapping the backdrop, the grabber, or the hardware back button.
 */
export function SelectSheet({
  visible,
  onClose,
  options,
  selectedId,
  onSelect,
  title,
  searchable = true,
}: SelectSheetProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const styles = makeStyles(theme);
  const { mounted, backdropStyle, sheetStyle } = useSheetAnimation(visible);

  const [query, setQuery] = useState('');

  // Fresh search each time the sheet opens.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  // Lift the sheet above the keyboard (so the search box + list stay visible).
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subtitle ? o.subtitle.toLowerCase().includes(q) : false)
    );
  }, [options, query]);

  const handleSelect = (option: SelectOption) => {
    onSelect(option);
    onClose();
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Column that pins the sheet to the bottom; tap above it to dismiss. */}
      <View style={[styles.root, { paddingBottom: kb }]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('cancel')} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle, { maxHeight: screenHeight * 0.85 - kb, paddingBottom: (kb > 0 ? 0 : insets.bottom) + theme.spacing.md }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('cancel')} style={styles.grabberArea}>
            <View style={styles.grabber} />
          </Pressable>

          <AppText size="lg" weight="bold" style={styles.title}>
            {title}
          </AppText>

          {searchable ? (
            <View style={styles.searchBox}>
              <AppIcon name="search" size={22} color="textSecondary" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('search')}
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.searchInput}
              />
            </View>
          ) : null}

          {/* flexShrink:1 lets this list give up height so it scrolls within
              the capped sheet; it still hugs content when the list is short. */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            bounces={false}
          >
            {filtered.length === 0 ? (
              <AppText size="sm" color="textSecondary" center style={styles.empty}>
                {t('search')}
              </AppText>
            ) : (
              filtered.map((option) => {
                const isSelected = option.id === selectedId;
                const disabled = !!option.disabled;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => (disabled ? undefined : handleSelect(option))}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled }}
                    style={({ pressed }) => [
                      styles.row,
                      isSelected && styles.rowSelected,
                      pressed && !disabled && styles.rowPressed,
                      disabled && styles.rowDisabled,
                    ]}
                  >
                    {option.dotColor ? (
                      <View style={[styles.dot, { backgroundColor: option.dotColor }]} />
                    ) : null}
                    {option.icon ? (
                      <View style={styles.rowChip}>
                        <AppIcon
                          name={option.icon}
                          size={22}
                          color={isSelected ? 'primary' : 'textSecondary'}
                        />
                      </View>
                    ) : null}
                    <View style={styles.rowBody}>
                      <AppText size="md" weight={isSelected ? 'bold' : 'semibold'}>
                        {option.label}
                      </AppText>
                      {option.subtitle ? (
                        <AppText size="sm" color="textSecondary">
                          {option.subtitle}
                        </AppText>
                      ) : null}
                    </View>
                    {isSelected ? <AppIcon name="checkCircle" size={24} color="primary" /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.lg,
      ...theme.shadows.raised,
    },
    grabberArea: {
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
    },
    grabber: {
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
    title: {
      marginBottom: theme.spacing.md,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      marginBottom: theme.spacing.md,
    },
    searchInput: {
      flex: 1,
      fontFamily: theme.typography.weights.regular,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textPrimary,
      textAlignVertical: 'center',
      includeFontPadding: false,
    },
    list: {
      // Shrinkable so it scrolls inside the capped sheet; grows no further than
      // its content so a short list leaves no dead space.
      flexGrow: 0,
      flexShrink: 1,
    },
    listContent: {
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
    },
    empty: {
      paddingVertical: theme.spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget + 4,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.chip,
    },
    rowSelected: {
      backgroundColor: theme.colors.primarySoft,
    },
    rowPressed: {
      opacity: 0.7,
    },
    rowDisabled: {
      opacity: 0.38,
    },
    dot: { width: 14, height: 14, borderRadius: 7 },
    rowChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
  });
