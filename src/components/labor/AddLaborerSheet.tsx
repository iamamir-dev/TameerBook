import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppIcon, AppText } from '@/components/ui';
import { addLaborer } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { captureReceipt } from '@/utils/photo';
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
  const [cnic, setCnic] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pickPhoto = async () => {
    const uri = await captureReceipt().catch(swallow('worker:photo'));
    if (uri) setPhotoUri(uri);
  };
  const { saving, run: runSave } = useSaveAction();

  // Fresh form every open.
  useEffect(() => {
    if (visible) {
      setName('');
      setPhone('');
      setCnic('');
      setPhotoUri(null);
    }
  }, [visible]);

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void (async () => {
      const ok = await runSave(async () => {
        await addLaborer({ name: trimmed, phone: phone.trim() || null, cnic: cnic.trim() || null, photoUri });
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

          {/* Tap the avatar to add/replace the worker's photo. */}
          <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={t('photo')} style={styles.photoPicker}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <AppIcon name="dehari" size={26} color="primary" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <AppIcon name="camera" size={14} color="onAccent" />
            </View>
          </Pressable>
          <FloatingLabelInput label={t('workerName')} value={name} onChangeText={setName} />
          <FloatingLabelInput label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FloatingLabelInput label={t('cnic')} value={cnic} onChangeText={setCnic} hint={t('optional')} />
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
    photoPicker: { alignSelf: 'flex-start' },
    avatar: { width: 64, height: 64, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    avatarFallback: {
      width: 64,
      height: 64,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
  });
