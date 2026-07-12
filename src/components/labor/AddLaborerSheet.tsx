import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppText } from '@/components/ui';
import { addLaborer } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the worker is saved (parent reloads its list). */
  onSaved: () => Promise<void> | void;
}

/**
 * Register a worker at the COMPANY level (name + optional phone) from the
 * Labor home. The per-project wage is set later, when the worker is attached
 * to a project from its construction screen.
 */
export function AddLaborerSheet({ visible, onClose, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { saving, run: runSave } = useSaveAction();

  // Fresh form every open.
  useEffect(() => {
    if (visible) {
      setName('');
      setPhone('');
    }
  }, [visible]);

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void (async () => {
      const ok = await runSave(async () => {
        await addLaborer({ name: trimmed, phone: phone.trim() || null });
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
            {t('addWorker')}
          </AppText>
          <FloatingLabelInput label={t('workerName')} value={name} onChangeText={setName} />
          <FloatingLabelInput label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!name.trim()} />
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
  });
