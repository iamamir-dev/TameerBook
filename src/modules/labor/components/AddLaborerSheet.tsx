import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppIcon, AppSheet } from '@/components/ui';
import { addLaborer } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { captureReceipt } from '@/utils/photo';

import { makeStyles } from '../styled/AddLaborerSheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the worker is saved (parent reloads its list). */
  onSaved: () => Promise<void> | void;
}

interface Form {
  name: string;
  phone: string;
  cnic: string;
  photoUri: string | null;
}
const EMPTY: Form = { name: '', phone: '', cnic: '', photoUri: null };

/**
 * Register a worker at the COMPANY level (name + optional phone/CNIC/photo).
 * The per-project wage is set later when attaching to a project. On `AppSheet`.
 */
export function AddLaborerSheet({ visible, onClose, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run: runSave } = useSaveAction();

  const [form, setForm] = useState<Form>(EMPTY);
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (visible) setForm(EMPTY);
  }, [visible]);

  const pickPhoto = async () => {
    const uri = await captureReceipt().catch(swallow('worker:photo'));
    if (uri) patch({ photoUri: uri });
  };

  const onSave = () => {
    const trimmed = form.name.trim();
    if (!trimmed) return;
    void (async () => {
      const ok = await runSave(async () => {
        await addLaborer({
          name: trimmed,
          phone: form.phone.trim() || null,
          cnic: form.cnic.trim() || null,
          photoUri: form.photoUri,
        });
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('addWorker')}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!form.name.trim()} />}
    >
      <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={t('photo')} style={styles.photoPicker}>
        {form.photoUri ? (
          <Image source={{ uri: form.photoUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <AppIcon name="dehari" size={26} color="primary" />
          </View>
        )}
        <View style={styles.cameraBadge}>
          <AppIcon name="camera" size={14} color="onAccent" />
        </View>
      </Pressable>
      <FloatingLabelInput label={t('workerName')} value={form.name} onChangeText={(v) => patch({ name: v })} />
      <FloatingLabelInput label={t('phone')} value={form.phone} onChangeText={(v) => patch({ phone: v })} mask="phone" />
      <FloatingLabelInput label={t('cnic')} value={form.cnic} onChangeText={(v) => patch({ cnic: v })} hint={t('optional')} mask="cnic" />
    </AppSheet>
  );
}
