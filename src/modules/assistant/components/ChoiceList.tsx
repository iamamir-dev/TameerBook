import React from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/ChoiceList.styles';

interface ChoiceListProps {
  options: string[];
  onPick: (option: string) => void;
  disabled?: boolean;
  /** The option the user already picked (shown selected, others muted). */
  picked?: string | null;
}

/**
 * Tappable choices under a question ("Which plot?"): one row per option with
 * a radio dot. Tapping sends the option as the user's reply.
 */
export function ChoiceList({ options, onPick, disabled, picked }: ChoiceListProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  return (
    <View style={styles.card}>
      <AppText size="xs" weight="bold" color="textSecondary" uppercase style={styles.head}>
        {t('aiTapToChoose')}
      </AppText>
      {options.map((o, i) => {
        const selected = picked === o;
        const muted = !!picked && !selected;
        return (
          <Pressable
            key={`${o}-${i}`}
            onPress={() => onPick(o)}
            disabled={disabled || !!picked}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, i > 0 && styles.ruled, pressed && styles.pressed]}
          >
            <AppIcon name={selected ? 'checkCircle' : 'dotNext'} size={18} color={selected ? 'accent' : muted ? 'textSecondary' : 'primary'} />
            <AppText size="md" weight={selected ? 'bold' : 'semibold'} color={muted ? 'textSecondary' : 'textPrimary'} style={styles.label} numberOfLines={2}>
              {o}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
