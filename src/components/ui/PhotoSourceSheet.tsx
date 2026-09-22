import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { pickPhoto } from '@/utils/photo';

import { AppIcon } from './AppIcon';
import { AppSheet } from './AppSheet';
import { AppText } from './AppText';

export interface PhotoSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (uri: string) => void;
  title?: string;
}

/**
 * Universal Photo Source Picker: gives users the choice between Camera (taking a photo)
 * and Gallery (choosing an existing image). Used across all modals and screens in TameerBook.
 */
export function PhotoSourceSheet({
  visible,
  onClose,
  onSelect,
  title,
}: PhotoSourceSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const [loadingSource, setLoadingSource] = useState<'camera' | 'gallery' | null>(null);

  const handlePick = async (source: 'camera' | 'gallery') => {
    setLoadingSource(source);
    try {
      const uri = await pickPhoto(source);
      if (uri) {
        onSelect(uri);
        onClose();
      }
    } catch (e) {
      swallow(`photoSourceSheet:${source}`)(e);
    } finally {
      setLoadingSource(null);
    }
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={title ?? t('photoSourceTitle')}
      scroll={false}
    >
      <View style={styles.container}>
        <Pressable
          onPress={() => void handlePick('camera')}
          disabled={loadingSource !== null}
          accessibilityRole="button"
          accessibilityLabel={t('photoFromCamera')}
          style={({ pressed }) => [
            styles.optionCard,
            pressed && styles.pressed,
            loadingSource === 'camera' && styles.active,
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
            {loadingSource === 'camera' ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <AppIcon name="camera" size={24} color="primary" />
            )}
          </View>
          <View style={styles.textContainer}>
            <AppText size="md" weight="bold">
              {t('photoFromCamera')}
            </AppText>
            <AppText size="xs" color="textSecondary">
              {t('aiFromCamera')}
            </AppText>
          </View>
          <AppIcon name="forward" size={18} color="textSecondary" />
        </Pressable>

        <Pressable
          onPress={() => void handlePick('gallery')}
          disabled={loadingSource !== null}
          accessibilityRole="button"
          accessibilityLabel={t('photoFromGallery')}
          style={({ pressed }) => [
            styles.optionCard,
            pressed && styles.pressed,
            loadingSource === 'gallery' && styles.active,
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.accentSoft }]}>
            {loadingSource === 'gallery' ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <AppIcon name="image" size={24} color="accent" />
            )}
          </View>
          <View style={styles.textContainer}>
            <AppText size="md" weight="bold">
              {t('photoFromGallery')}
            </AppText>
            <AppText size="xs" color="textSecondary">
              {t('aiFromGallery')}
            </AppText>
          </View>
          <AppIcon name="forward" size={18} color="textSecondary" />
        </Pressable>
      </View>
    </AppSheet>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
    },
    pressed: {
      backgroundColor: theme.colors.track,
      opacity: 0.9,
    },
    active: {
      borderColor: theme.colors.primary,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
      gap: 2,
    },
  });
