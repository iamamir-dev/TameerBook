import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppCard, AppHeader, AppIcon, AppText, SortableList } from '@/components/ui';
import {
  addStage,
  deleteStage,
  listStages,
  reorderStages,
  updateStage,
  type StageModule,
  type StageRow,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { STAGE_TONES, stageTone, type ColorKey } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Manage display statuses (Settings → Statuses): the labels a builder pins on
 * a project or plot card ("Under Construction", "Possession"…). Per-module
 * tabs, add/rename/delete (blocked while in use), drag-to-reorder.
 */
export function StatusesScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [module, setModule] = useState<StageModule>('PROJECT');
  const [rows, setRows] = useState<StageRow[]>([]);
  const [editor, setEditor] = useState<{ stage: StageRow | null } | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<ColorKey | null>(null);
  const { saving, run } = useSaveAction();

  const label = (s: StageRow) => (language === 'ur' ? s.name_ur : s.name_en);

  const load = useCallback(async () => setRows(await listStages(module)), [module]);
  const { reload } = useFocusReload(load);
  useEffect(() => {
    void load();
  }, [load]);

  const save = () => {
    if (!editor || !name.trim() || saving) return;
    void (async () => {
      const ok = await run(async () => {
        if (editor.stage) await updateStage(editor.stage.id, name, color);
        else await addStage(module, name, color).then(() => undefined);
      });
      if (ok) {
        setEditor(null);
        await reload();
      }
    })();
  };

  const confirmDelete = (stage: StageRow) => {
    Alert.alert(label(stage), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await run(() => deleteStage(stage.id));
            if (ok) await reload();
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('statusesTitle')} onBack={() => navigation.goBack()} />

      <View style={styles.segment}>
        {(['PROJECT', 'PLOT'] as StageModule[]).map((m) => {
          const active = module === m;
          return (
            <Pressable
              key={m}
              onPress={() => setModule(m)}
              style={[styles.segBtn, active && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <AppText size="sm" weight="bold" color={active ? 'onAccent' : 'textSecondary'}>
                {t(m === 'PROJECT' ? 'projects' : 'plotsTitle')}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <AppCard style={styles.card}>
          {rows.length > 0 ? (
            <SortableList
              items={rows}
              keyOf={(s) => s.id}
              rowHeight={44}
              onReorder={(ids) => {
                void (async () => {
                  const ok = await run(() => reorderStages(ids));
                  if (ok) await reload();
                })();
              }}
              renderItem={(stage) => (
                <View style={styles.row}>
                  <AppIcon name="reorder" size={14} color="textSecondary" />
                  {/* The status's color — the same one its badge wears on cards. */}
                  <View style={[styles.colorDot, { backgroundColor: theme.colors[stageTone(stage)] }]} />
                  <AppText size="sm" style={styles.flex} numberOfLines={1}>
                    {label(stage)}
                  </AppText>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => {
                        setName(stage.name_en);
                        setColor(stageTone(stage));
                        setEditor({ stage });
                      }}
                      hitSlop={theme.touch.hitSlop}
                      accessibilityLabel={t('edit')}
                    >
                      <AppIcon name="edit" size={18} color="textSecondary" />
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(stage)} hitSlop={theme.touch.hitSlop} accessibilityLabel={t('delete')}>
                      <AppIcon name="close" size={18} color="danger" />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          ) : null}
        </AppCard>

        <AppButton
          label={t('addStatus')}
          icon="add"
          variant="secondary"
          onPress={() => {
            setName('');
            // New status defaults to the next color in the cycle.
            setColor(stageTone({ sort_order: rows.length }));
            setEditor({ stage: null });
          }}
        />
      </ScrollView>

      <Modal visible={!!editor} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={() => setEditor(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {editor?.stage ? t('edit') : t('addStatus')}
            </AppText>
            <FloatingLabelInput label={t('name')} value={name} onChangeText={setName} />
            {/* Pick the status's color — the same tone it will wear on cards. */}
            <View style={styles.colorRow}>
              {STAGE_TONES.map((tone) => (
                <Pressable
                  key={tone}
                  onPress={() => setColor(tone)}
                  accessibilityRole="button"
                  accessibilityLabel={tone}
                  style={[
                    styles.colorPick,
                    { backgroundColor: theme.colors[tone] },
                    color === tone && styles.colorPickActive,
                  ]}
                />
              ))}
            </View>
            <AppButton label={t('save')} icon="check" onPress={save} loading={saving} disabled={!name.trim()} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    segment: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      margin: theme.spacing.lg,
      padding: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
    },
    segBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
    segBtnActive: { backgroundColor: theme.colors.accent },
    content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
    card: { gap: theme.spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    colorDot: { width: 12, height: 12, borderRadius: 6 },
    colorRow: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
    colorPick: { width: 34, height: 34, borderRadius: 17 },
    colorPickActive: { borderWidth: 3, borderColor: theme.colors.textPrimary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
  });
