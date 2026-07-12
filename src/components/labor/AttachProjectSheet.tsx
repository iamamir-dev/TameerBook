import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountInput, AppButton, AppText } from '@/components/ui';
import { attachLaborerToProject, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  laborerId: string;
  /** ACTIVE projects the worker is NOT already attached to. */
  projects: ProjectRow[];
  /** Called after attaching (parent reloads the khata). */
  onSaved: () => Promise<void> | void;
}

/**
 * Put a worker on a project FROM their khata: pick one of the company's
 * active projects and agree the dihari for it. Mirrors the construction
 * screen's add-worker flow, from the worker's side.
 */
export function AttachProjectSheet({
  visible,
  onClose,
  laborerId,
  projects,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [wage, setWage] = useState(0);
  const { saving, run: runSave } = useSaveAction();

  // Fresh form every open.
  useEffect(() => {
    if (visible) {
      setProjectId(null);
      setWage(0);
    }
  }, [visible]);

  const onSave = () => {
    if (!projectId || wage <= 0) return;
    void (async () => {
      const ok = await runSave(async () => {
        await attachLaborerToProject({ projectId, laborerId, dailyWage: wage });
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('includeInProject')}
          </AppText>

          {/* Project chips — active projects the worker isn't on yet. */}
          <View style={styles.chips}>
            {projects.map((p) => {
              const selected = p.id === projectId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setProjectId(selected ? null : p.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <AppText size="sm" weight="semibold" color={selected ? 'onPrimary' : 'textPrimary'} numberOfLines={1}>
                    {p.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AmountInput floating surface={theme.colors.card} label={t('dailyWage')} value={wage} onChange={setWage} />
          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSave}
            loading={saving}
            disabled={!projectId || wage <= 0}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
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
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    chip: {
      paddingHorizontal: theme.spacing.lg,
      minHeight: 40,
      justifyContent: 'center',
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  });
