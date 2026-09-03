import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CREATE_KINDS, draftToEntryPrefill, draftToMaterialPrefill, type ResolvedDraft } from '@/ai';
import { AppButton, AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/DraftCard.styles';
import type { Applied } from '../utils/applyDraft';
import { draftSummary } from '../utils/draftSummary';
import { navigateToTarget } from '../utils/navigateTarget';
import { ConfirmDraftSheet } from './ConfirmDraftSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DraftCardProps {
  resolved: ResolvedDraft;
  /** Toast after the write lands. */
  onDone?: (message: string) => void;
}

/**
 * "Here is what I understood" — the draft the model extracted, with every
 * name matched to the user's own data, and one button that opens the
 * confirmation sheet. Nothing is written until the user approves there.
 */
export function DraftCard({ resolved, onDone }: DraftCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState<Applied | null>(null);

  const d = resolved.draft;
  const { title, line } = draftSummary(resolved, t);
  const isCreate = CREATE_KINDS.has(d.kind);

  // Money drafts keep the manual path one tap away.
  const editInstead =
    d.kind === 'expense' || d.kind === 'income'
      ? () => {
          const p = draftToEntryPrefill(resolved);
          setOpen(false);
          if (p) navigation.navigate('Entry', p);
        }
      : d.kind === 'material'
        ? () => {
            const p = draftToMaterialPrefill(resolved);
            setOpen(false);
            if (p) navigation.navigate('MaterialEntry', { prefill: p });
          }
        : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppIcon name={applied ? 'checkCircle' : 'edit'} size={14} color={applied ? 'success' : 'accent'} />
        <AppText size="xs" weight="bold" color={applied ? 'success' : 'accent'}>
          {applied ? applied.message : title}
        </AppText>
      </View>
      <AppText size="sm" weight="semibold">
        {line}
      </AppText>
      {!applied && resolved.unresolved.length > 0 ? (
        <View style={styles.warn}>
          <AppIcon name="alert" size={14} color="gold" />
          <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
            {t('aiUnresolved')} {resolved.unresolved.join(', ')}
          </AppText>
        </View>
      ) : null}

      {applied ? (
        applied.target ? (
          <Pressable onPress={() => navigateToTarget(navigation, applied.target!)} accessibilityRole="button" style={styles.viewLink}>
            <AppText size="sm" weight="bold" color="accent">
              {t('aiView')}
            </AppText>
            <AppIcon name="forward" size={16} color="accent" />
          </Pressable>
        ) : null
      ) : (
        <AppButton label={isCreate ? t('aiAddLabel') : t('aiSaveLabel')} icon={isCreate ? 'add' : 'check'} onPress={() => setOpen(true)} />
      )}

      <ConfirmDraftSheet
        visible={open}
        resolved={resolved}
        onClose={() => setOpen(false)}
        onSaved={(a) => {
          setApplied(a);
          onDone?.(a.message);
        }}
        onEditInstead={editInstead}
      />
    </View>
  );
}
