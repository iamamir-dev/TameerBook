import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountInput, AppButton, AppText } from '@/components/ui';
import { setLaborerWage } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The participation whose dihari is being changed (null = closed). */
  projectLaborerId: string | null;
  projectName: string;
  currentWage: number;
  /** Called after saving (parent reloads the khata). */
  onSaved: () => Promise<void> | void;
}

/**
 * Change the agreed dihari for ONE project participation, from the worker's
 * khata. Applies to future attendance only — past accruals keep the wage
 * snapshot they were marked at.
 */
export function EditWageSheet({
  visible,
  onClose,
  projectLaborerId,
  projectName,
  currentWage,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [wage, setWage] = useState(currentWage);
  const { saving, run: runSave } = useSaveAction();

  useEffect(() => {
    if (visible) setWage(currentWage);
  }, [visible, currentWage]);

  const onSave = () => {
    if (!projectLaborerId || wage <= 0) return;
    void (async () => {
      const ok = await runSave(async () => {
        await setLaborerWage(projectLaborerId, wage);
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
            {t('dailyWage')}
          </AppText>
          <AppText size="sm" color="textSecondary" numberOfLines={1}>
            {projectName}
          </AppText>
          <AmountInput floating surface={theme.colors.card} label={t('dailyWage')} value={wage} onChange={setWage} />
          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={wage <= 0} />
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
