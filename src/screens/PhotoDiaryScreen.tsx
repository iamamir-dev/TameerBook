import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppHeader, AppIcon, AppText } from '@/components/ui';
import { addDocument, type DocumentRow, listDocuments } from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { captureReceipt } from '@/utils/photo';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DiaryRoute = RouteProp<RootStackParamList, 'PhotoDiary'>;

export function PhotoDiaryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<DiaryRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [photos, setPhotos] = useState<DocumentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhotos(await listDocuments('site_photo', projectId));
  }, [projectId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Group photos by day (newest first).
  const groups = useMemo(() => {
    const map = new Map<string, DocumentRow[]>();
    for (const p of photos) {
      const day = p.created_at.slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(p);
      map.set(day, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [photos]);

  const onCapture = async () => {
    setBusy(true);
    try {
      const uri = await captureReceipt();
      if (uri) {
        await addDocument({ entityType: 'site_photo', entityId: projectId, fileUri: uri, mime: 'image/jpeg' });
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('photoDiary')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <AppButton label={t('todayPhotos')} icon="camera" onPress={onCapture} loading={busy} />

        {groups.length === 0 ? (
          <AppText size="sm" color="textSecondary" center style={styles.empty}>
            {t('noPhotos')}
          </AppText>
        ) : (
          groups.map(([day, items]) => (
            <View key={day} style={styles.group}>
              <AppText size="sm" weight="bold" color="textSecondary">
                {dayjs(day).format('DD MMM YYYY')}
              </AppText>
              <View style={styles.grid}>
                {items.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setViewer(p.file_uri)}
                    accessibilityRole="button"
                    style={styles.cell}
                  >
                    <Image source={{ uri: p.file_uri }} style={styles.thumb} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewer(null)} accessibilityRole="button" style={styles.close}>
            <AppIcon name="close" size={28} color="onHero" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const GAP = 4;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    empty: { paddingVertical: theme.spacing.xxxl },
    group: { gap: theme.spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    cell: { width: '32%', flexGrow: 1, aspectRatio: 1 },
    thumb: { width: '100%', height: '100%', borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    viewerImage: { width: '100%', height: '80%' },
    close: {
      position: 'absolute',
      top: theme.spacing.xxxl,
      right: theme.spacing.lg,
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
