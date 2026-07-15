import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddPhotoTile, AppCard, AppIcon, AppText } from '@/components/ui';
import type { DocumentRow } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface Props {
  photos: DocumentRow[];
  /** Capture a new site photo (wired through the parent's save action). */
  onCapture: () => void;
  busy?: boolean;
  /** Open the full photo diary (day-grouped grid). */
  onSeeAll: () => void;
  /** Hide the capture affordance on a completed (read-only) project. */
  readOnly?: boolean;
}

/** How many thumbnails the inline preview shows before "See all". */
const PREVIEW = 6;

/**
 * A styled site-photo gallery for the project detail: a header with a "see
 * all" link into the full diary, a rounded thumbnail grid preview, an add-photo
 * tile, and a tap-to-zoom lightbox. Photos come from the `site_photo` docs.
 */
export function ProjectGalleryCard({
  photos,
  onCapture,
  busy,
  onSeeAll,
  readOnly,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const [viewer, setViewer] = useState<string | null>(null);

  const preview = photos.slice(0, PREVIEW);
  const extra = photos.length - preview.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText size="lg" weight="bold">
          {`${t('galleryTitle')}${photos.length > 0 ? ` (${photos.length})` : ''}`}
        </AppText>
        {photos.length > 0 ? (
          <Pressable onPress={onSeeAll} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
            <AppText size="sm" weight="semibold" color="accent">
              {t('seeAll')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <AppCard compact>
        {photos.length === 0 && readOnly ? (
          <AppText size="sm" color="textSecondary" center style={styles.emptyPad}>
            {t('noPhotos')}
          </AppText>
        ) : (
          <View style={styles.grid}>
            {preview.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => setViewer(p.file_uri)}
                accessibilityRole="imagebutton"
                style={styles.cell}
              >
                <Image source={{ uri: p.file_uri }} style={styles.thumb} />
                {/* "+N more" veil on the last preview tile when there are extras. */}
                {i === preview.length - 1 && extra > 0 ? (
                  <Pressable onPress={onSeeAll} style={styles.moreVeil} accessibilityRole="button">
                    <AppText size="lg" weight="bold" color="onHero">
                      {`+${extra}`}
                    </AppText>
                  </Pressable>
                ) : null}
              </Pressable>
            ))}

            {!readOnly ? (
              <AddPhotoTile label={t('todayPhotos')} onPress={onCapture} busy={busy} style={styles.cell} />
            ) : null}
          </View>
        )}
      </AppCard>

      {/* Full-screen lightbox */}
      <Modal
        visible={viewer !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <View style={styles.viewer}>
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Pressable
            onPress={() => setViewer(null)}
            accessibilityRole="button"
            style={[styles.close, { top: insets.top + theme.spacing.md }]}
          >
            <AppIcon name="close" size={28} color="onHero" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const GAP = 6;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    emptyPad: { paddingVertical: theme.spacing.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    // Fixed square tiles (like the Docs grid) — the card always hugs its
    // content; a lone add-tile is just one small square, never a stretched box.
    cell: { width: 96, height: 96 },
    thumb: {
      width: '100%',
      height: '100%',
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.track,
    },
    moreVeil: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    viewerImage: { width: '100%', height: '80%' },
    close: {
      position: 'absolute',
      right: theme.spacing.lg,
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
