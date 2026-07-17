import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AccountWithBalance } from '@/db';
import { useAccountOptions } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { SelectSheet } from './SelectSheet';

interface AccountPickerRowProps {
  accounts: AccountWithBalance[];
  selectedId?: string | null;
  onSelect: (accountId: string) => void;
  /** Field label above the chip (defaults to the "account" string). */
  label?: string;
}

/**
 * The one account-picker chip. Replaces the copy-pasted "tap to open the account
 * SelectSheet" block (a local `accountChip` style + a `SelectSheet` + open
 * state) that ≥6 screens each reimplemented. Shows the selected account's name +
 * live balance; tap opens the shared single-select sheet.
 */
export function AccountPickerRow({
  accounts,
  selectedId,
  onSelect,
  label,
}: AccountPickerRowProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const options = useAccountOptions(accounts);
  const [open, setOpen] = useState(false);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  return (
    <View style={styles.wrap}>
      <AppText size="sm" weight="semibold" color="textSecondary">
        {label ?? t('accountLabel')}
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        <AppIcon name="bank" size={22} color="textSecondary" />
        <View style={styles.chipBody}>
          <AppText size="md" weight="semibold" numberOfLines={1}>
            {selected ? selected.name : t('selectAccount')}
          </AppText>
          {selected ? (
            <AppText size="sm" color="textSecondary" tabular>
              {formatRupees(selected.balance)}
            </AppText>
          ) : null}
        </View>
        <AppIcon name="forward" size={20} color="textSecondary" />
      </Pressable>

      <SelectSheet
        visible={open}
        onClose={() => setOpen(false)}
        options={options}
        selectedId={selectedId ?? undefined}
        onSelect={(o) => onSelect(o.id)}
        title={t('selectAccount')}
        searchable={accounts.length > 5}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.background,
    },
    chipPressed: { opacity: 0.7 },
    chipBody: { flex: 1, gap: 2 },
  });
