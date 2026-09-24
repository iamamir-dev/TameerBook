import React from 'react';

import type { ResolvedDraft } from '@/ai';
import { AppSheet } from '@/components/ui';
import { useTranslation } from '@/i18n';

import { draftTitle } from '../utils/draftSummary';
import { DraftCard, type DraftCardProps } from './DraftCard';

interface DraftSheetProps extends Omit<DraftCardProps, 'resolved'> {
  visible: boolean;
  onClose: () => void;
  resolved: ResolvedDraft | null;
}

/**
 * The confirmation popup: the checked receipt (with anything still to pick)
 * and Reject · Accept, in a bottom sheet over the chat. Opens from the Save
 * button under the message, or from a typed "haan".
 */
export function DraftSheet({ visible, onClose, resolved, ...card }: DraftSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <AppSheet visible={visible} onClose={onClose} title={resolved ? draftTitle(resolved, t) : undefined}>
      {resolved ? <DraftCard resolved={resolved} {...card} /> : null}
    </AppSheet>
  );
}
