import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppSheet, AppText } from '@/components/ui';
import { addLaborer, attachLaborerToProject, type LaborerRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/AddWorkerSheet.styles';

interface AddWorkerSheetProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  /** Existing laborers not yet attached to this project (pickable chips). */
  availableLaborers: LaborerRow[];
  /** Reload the screen's data after the worker is attached. */
  onSaved: () => Promise<void>;
}

interface Form {
  pickLaborerId: string | null;
  name: string;
  phone: string;
  cnic: string;
  wage: number;
}
const EMPTY: Form = { pickLaborerId: null, name: '', phone: '', cnic: '', wage: 0 };

/**
 * Put a worker on the project's labor khata: pick an existing laborer or create
 * a new one, then set the per-project dihari. On the shared `AppSheet`.
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
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();

  const [form, setForm] = useState<Form>(EMPTY);
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (visible) setForm(EMPTY);
  }, [visible]);

  const canSave = form.wage > 0 && (form.pickLaborerId !== null || form.name.trim().length > 0);

  const onSave = (): void => {
    if (!canSave || saving) return;
    void run(async () => {
      // Create-then-attach in one atomic step so a failed attach can't orphan a
      // brand-new company-level laborer.
      let laborerId = form.pickLaborerId;
      if (!laborerId) {
        const created = await addLaborer({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          cnic: form.cnic.trim() || null,
        });
        laborerId = created.id;
      }
      await attachLaborerToProject({ projectId, laborerId, dailyWage: form.wage });
      onClose();
      await onSaved();
    });
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('addWorker')}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />}
    >
      {availableLaborers.length > 0 ? (
        <View style={styles.chipWrap}>
          {availableLaborers.map((l) => {
            const selected = form.pickLaborerId === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => patch({ pickLaborerId: selected ? null : l.id })}
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

      {form.pickLaborerId === null ? (
        <>
          <FloatingLabelInput label={t('workerName')} value={form.name} onChangeText={(v) => patch({ name: v })} />
          <FloatingLabelInput label={t('phone')} value={form.phone} onChangeText={(v) => patch({ phone: v })} mask="phone" />
          <FloatingLabelInput label={t('cnic')} value={form.cnic} onChangeText={(v) => patch({ cnic: v })} hint={t('optional')} mask="cnic" />
        </>
      ) : null}

      <AmountInput value={form.wage} onChange={(v) => patch({ wage: v })} label={t('dailyWage')} floating surface={theme.colors.card} />
    </AppSheet>
  );
}
