import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { AccountWithBalance } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';

import { AccountPickerRow } from './AccountPickerRow';
import { AmountInput } from './AmountInput';
import { AppButton } from './AppButton';
import { AppSheet } from './AppSheet';
import { AppText } from './AppText';
import { DateField } from './DateField';
import type { GlyphName, IconKey } from './icons';

interface MoneyEntrySheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Optional header identity forwarded to AppSheet. */
  icon?: IconKey | GlyphName;
  subtitle?: string;

  /** Amount (rupees). */
  amount: number;
  onAmountChange: (v: number) => void;
  amountError?: string | null;
  amountLabel?: string;

  /** Account picker — omit `accounts` to hide it (e.g. accrual-only entries). */
  accounts?: AccountWithBalance[];
  accountId?: string | null;
  onAccountChange?: (id: string) => void;
  accountLabel?: string;

  /** Date — omit `date` to hide the field. Defaults maxDate to today. */
  date?: string;
  onDateChange?: (iso: string) => void;
  maxDate?: string;

  /** Note — omit `note`/`onNoteChange` to hide the field. */
  note?: string;
  onNoteChange?: (v: string) => void;

  /** Module-specific content ABOVE the amount (target picker, category chips). */
  header?: React.ReactNode;
  /** Module-specific content BELOW the note (proof photo tile, etc.). */
  extra?: React.ReactNode;

  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
}

/**
 * The canonical "record money" sheet — the ONE layout every money flow uses:
 *
 *   [header: target / category chips]  →  amount (inline validation)
 *   →  account (default)  →  date (back-datable)  →  note  →  [extra: photo]
 *   →  pinned Save.
 *
 * Replaces the copy-pasted AmountInput + DateField + account-chip form that ~17
 * screens/sheets each reassembled. Fully controlled: the module owns the state
 * (usually a `useXxxForm` reducer) and the save path (`useSaveAction`); this
 * component owns only the consistent layout and the shared sub-widgets.
 */
export function MoneyEntrySheet({
  visible,
  onClose,
  title,
  icon,
  subtitle,
  amount,
  onAmountChange,
  amountError,
  amountLabel,
  accounts,
  accountId,
  onAccountChange,
  accountLabel,
  date,
  onDateChange,
  maxDate,
  note,
  onNoteChange,
  header,
  extra,
  onSave,
  saving,
  saveLabel,
  saveDisabled,
}: MoneyEntrySheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const showAccount = accounts !== undefined && onAccountChange !== undefined;
  const showDate = date !== undefined && onDateChange !== undefined;
  const showNote = note !== undefined && onNoteChange !== undefined;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={title}
      icon={icon}
      subtitle={subtitle}
      footer={
        <AppButton
          label={saveLabel ?? t('save')}
          onPress={onSave}
          loading={saving}
          disabled={saveDisabled}
          fullWidth
        />
      }
    >
      {header}

      <AmountInput
        value={amount}
        onChange={onAmountChange}
        label={amountLabel ?? t('amount')}
        error={amountError}
        floating
        surface={theme.colors.card}
        autoFocus
      />

      {showAccount ? (
        <AccountPickerRow
          accounts={accounts}
          selectedId={accountId}
          onSelect={onAccountChange}
          label={accountLabel}
        />
      ) : null}

      {showDate ? (
        <View style={styles.field}>
          <AppText size="sm" weight="semibold" color="textSecondary">
            {t('date')}
          </AppText>
          <DateField value={date} onChange={onDateChange} maxDate={maxDate ?? todayISO().slice(0, 10)} />
        </View>
      ) : null}

      {showNote ? (
        <View style={styles.field}>
          <AppText size="sm" weight="semibold" color="textSecondary">
            {t('note')}
          </AppText>
          <TextInput
            value={note}
            onChangeText={onNoteChange}
            placeholder={t('note')}
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.noteInput}
            multiline
          />
        </View>
      ) : null}

      {extra}
    </AppSheet>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    field: { gap: theme.spacing.xs },
    noteInput: {
      fontFamily: theme.typography.weights.regular,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      textAlignVertical: 'top',
    },
  });
