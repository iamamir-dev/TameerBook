import React, { useEffect, useState } from 'react';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { addParty, type PartyRow, type PartyType } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';

import { AppButton } from './AppButton';
import { AppSheet } from './AppSheet';

interface AddPartySheetProps {
  visible: boolean;
  onClose: () => void;
  /** Field label — "Supplier", "Party", … (already translated). */
  label: string;
  /** The party type the new record is saved as. */
  partyType: PartyType;
  /** Called with the freshly saved party so the caller can select it. */
  onCreated: (party: PartyRow) => void;
  /** Optional phone field (off by default to keep the sheet one-field). */
  withPhone?: boolean;
}

/**
 * The one "save a new party" sheet (supplier / buyer / generic person) on the
 * shared AppSheet — replaces the hand-rolled add-party Modals that Entry and
 * MaterialEntry each re-implemented.
 */
export function AddPartySheet({ visible, onClose, label, partyType, onCreated, withPhone }: AddPartySheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const { saving, run } = useSaveAction();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName('');
    setPhone('');
  }, [visible]);

  const onSave = () => {
    if (!name.trim() || saving) return;
    void run(async () => {
      const created = await addParty({ type: partyType, name: name.trim(), phone: phone.trim() || null });
      onClose();
      onCreated(created);
    });
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('addNew')}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!name.trim()} fullWidth />}
    >
      <FloatingLabelInput label={label} value={name} onChangeText={setName} />
      {withPhone ? (
        <FloatingLabelInput label={t('phone')} value={phone} onChangeText={setPhone} mask="phone" hint={t('optional')} />
      ) : null}
    </AppSheet>
  );
}
