import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const CLOSE_DRAG_THRESHOLD = 120;

/**
 * A single-select bottom sheet with big, easy-to-tap rows and an optional
 * search box. Slides up with Reanimated and can be dismissed by dragging the
 * grabber down  no extra dependency, robust on low-end phones.
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

  const [query, setQuery] = useState('');
  // Keep the Modal mounted through the slide-out, then unmount.
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(screenHeight);

  const finishClose = useCallback(() => {
    setMounted(false);
    setQuery('');
    onClose();
  }, [onClose]);

  const animateClose = useCallback(() => {
    translateY.value = withTiming(screenHeight, { duration: 200 }, (done) => {
      if (done) runOnJS(finishClose)();
    });
  }, [finishClose, screenHeight, translateY]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = screenHeight;
      translateY.value = withTiming(0, { duration: 240 });
    } else if (mounted) {
      animateClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          if (event.translationY > 0) translateY.value = event.translationY;
        })
        .onEnd((event) => {
          if (event.translationY > CLOSE_DRAG_THRESHOLD) {
            translateY.value = withTiming(screenHeight, { duration: 180 }, (done) => {
              if (done) runOnJS(finishClose)();
            });
          } else {
            translateY.value = withTiming(0, { duration: 160 });
          }
        }),
    [finishClose, screenHeight, translateY]
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subtitle ? o.subtitle.toLowerCase().includes(q) : false)
    );
  }, [options, query]);

  const handleSelect = useCallback(
    (option: SelectOption) => {
      onSelect(option);
      animateClose();
    },
    [animateClose, onSelect]
  );

  if (!mounted) return <View />;

  return (
    <Modal visible transparent animationType="none" onRequestClose={animateClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={animateClose} accessibilityLabel={t('cancel')} />
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }, sheetStyle]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.grabberArea}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>

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

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((option) => {
              const isSelected = option.id === selectedId;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelect(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.row,
                    isSelected && styles.rowSelected,
                    pressed && styles.rowPressed,
                  ]}
                >
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
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingHorizontal: theme.spacing.lg,
      maxHeight: '85%',
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
      // Bounded by the sheet's maxHeight so long option lists (e.g. materials) scroll.
      flexShrink: 1,
    },
    listContent: {
      gap: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
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
    rowChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
  });
