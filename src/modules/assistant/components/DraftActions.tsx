import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { AnswerTarget } from '@/ai';
import { AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/DraftActions.styles';
import { navigateToTarget } from '../utils/navigateTarget';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DraftActionsProps {
  settled?: { status: 'accepted' | 'rejected'; message?: string; target?: AnswerTarget };
  /** "1/3" when the message carries several dependent writes. */
  step?: { index: number; total: number };
  disabled?: boolean;
  /** Opens the confirmation popup. */
  onSave: () => void;
  onReject: () => void;
}

/**
 * The strip under a confirmation message. The message itself carries the
 * details (the model writes them as a receipt); this strip only asks the
 * question: Reject, or Save, which opens the popup that checks and writes.
 * Once settled it collapses to one line with a link to what was saved.
 */
export function DraftActions({ settled, step, disabled, onSave, onReject }: DraftActionsProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  if (settled) {
    const ok = settled.status === 'accepted';
    return (
      <Pressable onPress={settled.target ? () => navigateToTarget(navigation, settled.target!) : undefined} disabled={!settled.target} accessibilityRole="button" style={styles.done}>
        <AppIcon name={ok ? 'checkCircle' : 'close'} size={16} color={ok ? 'success' : 'textSecondary'} />
        <AppText size="xs" weight="semibold" color={ok ? 'success' : 'textSecondary'} numberOfLines={1} style={styles.doneText}>
          {ok ? settled.message || t('aiSaved') : t('aiRejected')}
        </AppText>
        {settled.target ? (
          <>
            <AppText size="sm" weight="bold" color="accent">
              {t('aiView')}
            </AppText>
            <AppIcon name="forward" size={14} color="accent" />
          </>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable onPress={onReject} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnReject, pressed && styles.pressed]}>
        <AppText size="sm" weight="bold" color="textSecondary">
          {t('aiReject')}
        </AppText>
      </Pressable>
      <Pressable onPress={onSave} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnSave, pressed && styles.pressed]}>
        <AppIcon name="check" size={16} color="onAccent" />
        <AppText size="sm" weight="bold" color="onAccent">
          {step ? `${t('save')} ${step.index}/${step.total}` : t('save')}
        </AppText>
      </Pressable>
    </View>
  );
}
