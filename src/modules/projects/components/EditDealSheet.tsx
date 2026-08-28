import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppIcon, AppSheet, AppText, SelectSheet } from '@/components/ui';
import { upsertSale, type PartyRow, type SaleRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/EditDealSheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  /** The existing deal (null = recording it for the first time). */
  sale: SaleRow | null;
  buyers: PartyRow[];
  onSaved: () => Promise<void>;
}

/**
 * The buyer deal — agreed price + buyer (saved party or free text) — on the
 * shared AppSheet. Creates the sale on first save, edits it afterwards.
 */
export function EditDealSheet({ visible, onClose, projectId, sale, buyers, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();

  const [price, setPrice] = useState(0);
  const [buyer, setBuyer] = useState('');
  const [buyerPartyId, setBuyerPartyId] = useState<string | null>(null);
  const [buyerSheet, setBuyerSheet] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPrice(sale?.agreed_price ?? 0);
    setBuyer(sale?.buyer_name ?? '');
    setBuyerPartyId(sale?.buyer_party_id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onSave = () => {
    if (price <= 0 || saving) return;
    void run(async () => {
      await upsertSale(projectId, { agreedPrice: price, buyerName: buyer.trim() || null, buyerPartyId });
      onClose();
      await onSaved();
    });
  };

  return (
    <>
      <AppSheet
        visible={visible}
        onClose={onClose}
        title={t('saleDeal')}
        footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={price <= 0} fullWidth />}
      >
        <AmountInput label={t('agreedPrice')} value={price} onChange={setPrice} floating surface={theme.colors.card} autoFocus />
        {buyers.length > 0 ? (
          <Pressable onPress={() => setBuyerSheet(true)} style={styles.partyChip} accessibilityRole="button">
            <AppIcon name="investor" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={buyerPartyId ? 'textPrimary' : 'textSecondary'}>
              {buyerPartyId ? buyer : t('selectSavedParty')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>
        ) : null}
        <FloatingLabelInput
          label={t('buyerName')}
          value={buyer}
          onChangeText={(v) => {
            setBuyer(v);
            setBuyerPartyId(null);
          }}
        />
      </AppSheet>

      <SelectSheet
        visible={buyerSheet}
        onClose={() => setBuyerSheet(false)}
        options={buyers.map((p) => ({ id: p.id, label: p.name }))}
        selectedId={buyerPartyId ?? undefined}
        title={t('selectSavedParty')}
        onSelect={(o) => {
          const p = buyers.find((x) => x.id === o.id);
          if (p) {
            setBuyerPartyId(p.id);
            setBuyer(p.name);
          }
        }}
      />
    </>
  );
}
