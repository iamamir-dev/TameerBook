import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { AddPhotoTile, AppText, ImageLightbox } from '@/components/ui';
import type { DocumentRow } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/PlotDocsGrid.styles';

interface Props {
  docs: DocumentRow[];
  readOnly: boolean;
  onAdd: () => void;
}

/** Known document labels stored as translation keys → shown on the chip. */
const KNOWN_LABELS: Record<string, TranslationKey> = {
  docOther: 'docOther',
  photoReceipt: 'photoReceipt',
};

/**
 * The plot's document thumbnails — each image carries its label on a chip
 * floated just above its bottom edge — plus the dashed "add" tile and the
 * full-screen viewer.
 */
export function PlotDocsGrid({ docs, readOnly, onAdd }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const [viewer, setViewer] = useState<string | null>(null);

  const labelText = (label: string | null): string => {
    if (!label) return '';
    return label in KNOWN_LABELS ? t(KNOWN_LABELS[label]) : label;
  };

  return (
    <>
      <View style={styles.grid}>
        {docs.map((d) => {
          const text = labelText(d.label);
          return (
            <Pressable key={d.id} onPress={() => setViewer(d.file_uri)} accessibilityRole="button" style={styles.tile}>
              <Image source={{ uri: d.file_uri }} style={styles.thumb} />
              {text ? (
                <View style={styles.labelChip}>
                  <AppText size="xs" weight="bold" color="onHero" numberOfLines={1}>
                    {text}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {!readOnly ? <AddPhotoTile label={t('addDocument')} onPress={onAdd} style={styles.add} /> : null}
      </View>

      <ImageLightbox uri={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
