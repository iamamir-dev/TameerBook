import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppText } from '@/components/ui';
import { addLaborer, attachLaborerToProject, type LaborerRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface AddWorkerSheetProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  /** Existing laborers not yet attached to this project (pickable chips). */
  availableLaborers: LaborerRow[];
  /** Reload the screen's data after the worker is attached. */
  onSaved: () => Promise<void>;
}

/**
 * Bottom sheet that puts a worker on the project's labor khata: pick an
 * existing laborer or create a brand-new one (name + phone), then set the
 * daily wage for this project. Owns its own form state, reset on every open.
 */
export function AddWorkerSheet({
  visible,
  onClose,
  projectId,
  availableLaborers,
  onSaved,
}: AddWorkerSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { saving, run } = useSaveAction();

  const [pickLaborerId, setPickLaborerId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCnic, setNewCnic] = useState('');
  const [newWage, setNewWage] = useState(0);

  // Fresh form per open.
  useEffect(() => {
    if (!visible) return;
    setPickLaborerId(null);
    setNewName('');
    setNewPhone('');
    setNewCnic('');
    setNewWage(0);
  }, [visible]);

  const canSave = newWage > 0 && (pickLaborerId !== null || newName.trim().length > 0);

  const onSave = (): void => {
    if (!canSave || saving) return;
    void run(async () => {
      let laborerId = pickLaborerId;
      if (!laborerId) {
        const created = await addLaborer({
          name: newName.trim(),
          phone: newPhone.trim() || null,
          cnic: newCnic.trim() || null,
        });
        laborerId = created.id;
      }
      await attachLaborerToProject({ projectId, laborerId, dailyWage: newWage });
      onClose();
      await onSaved();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.grabber} />
        <AppText size="lg" weight="bold">
          {t('addWorker')}
        </AppText>

        {/* Existing workers not yet on this project */}
        {availableLaborers.length > 0 ? (
          <View style={styles.chipWrap}>
            {availableLaborers.map((l) => {
              const selected = pickLaborerId === l.id;
              return (
                <Pressable
                  key={l.id}
                  onPress={() => setPickLaborerId(selected ? null : l.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.pillChip, selected && styles.pillChipActive]}
                >
                  <AppText size="sm" weight="semibold" color={selected ? 'accent' : 'textPrimary'}>
                    {l.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* …or a brand-new worker */}
        {pickLaborerId === null ? (
          <>
            <FloatingLabelInput label={t('workerName')} value={newName} onChangeText={setNewName} />
            <FloatingLabelInput
              label={t('phone')}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />
            <FloatingLabelInput label={t('cnic')} value={newCnic} onChangeText={setNewCnic} hint={t('optional')} />
          </>
        ) : null}

        <AmountInput
          value={newWage}
          onChange={setNewWage}
          label={t('dailyWage')}
          floating
          surface={theme.colors.card}
        />

        <AppButton
          label={t('save')}
          icon="check"
          onPress={onSave}
          loading={saving}
          disabled={!canSave}
        />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /* add-worker chips */
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    pillChip: {
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    pillChipActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
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
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
  });
