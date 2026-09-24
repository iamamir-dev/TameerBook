import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { SettingsGroup, SettingsRow } from '@/components/settings';
import { AppButton, AppIcon, AppSheet } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/stores/useSettingsStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Signature and the remove.bg key behind it. */
export function DocumentsSection(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const signature = useSettingsStore((s) => s.signature);
  const setSignature = useSettingsStore((s) => s.setSignature);
  const removeBgKey = useSettingsStore((s) => s.removeBgKey);
  const setRemoveBgKey = useSettingsStore((s) => s.setRemoveBgKey);
  const [keyOpen, setKeyOpen] = useState(false);
  const [draftKey, setDraftKey] = useState('');

  return (
    <>
      <SettingsGroup header={t('hdrSignature')}>
        <SettingsRow
          title={t('signatureSetting')}
          subtitle={signature ? undefined : t('addSignature')}
          trailing={signature ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
          onPress={() => navigation.navigate('Signature')}
          onLongPress={
            signature
              ? () =>
                  Alert.alert(t('signatureSetting'), t('deleteConfirm'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('delete'), style: 'destructive', onPress: () => setSignature(null) },
                  ])
              : undefined
          }
        />
        <SettingsRow
          title={t('removeBgKeyLabel')}
          subtitle={t('removeBgKeyHint')}
          trailing={removeBgKey ? <AppIcon name="checkCircle" size={20} color="accent" /> : undefined}
          onPress={() => {
            setDraftKey(removeBgKey ?? '');
            setKeyOpen(true);
          }}
        />
      </SettingsGroup>

      <AppSheet
        visible={keyOpen}
        onClose={() => setKeyOpen(false)}
        title={t('removeBgKeyLabel')}
        footer={
          <AppButton
            label={t('save')}
            icon="check"
            onPress={() => {
              setRemoveBgKey(draftKey.trim() || null);
              setKeyOpen(false);
            }}
          />
        }
      >
        <FloatingLabelInput label={t('removeBgKeyLabel')} value={draftKey} onChangeText={setDraftKey} hint={t('removeBgKeyHint')} />
      </AppSheet>
    </>
  );
}
