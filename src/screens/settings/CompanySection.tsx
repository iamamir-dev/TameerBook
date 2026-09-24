import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';

import { SettingsGroup, SettingsRow } from '@/components/settings';
import { SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { swallow } from '@/utils/log';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const NEW_COMPANY_ID = '__new__';

/** Workspace switching, company details, and the management hubs. */
export function CompanySection(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const companies = useCompanyStore((st) => st.companies);
  const activeCompanyId = useCompanyStore((st) => st.activeCompanyId);
  const switchTo = useCompanyStore((st) => st.switchTo);
  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;
  const [open, setOpen] = useState(false);

  const companyOptions = useMemo<SelectOption[]>(
    () => [
      ...companies.map((c) => ({ id: c.id, label: c.name, subtitle: c.owner_name ?? undefined, icon: 'projects' as IconKey })),
      { id: NEW_COMPANY_ID, label: t('newCompany'), icon: 'add' as IconKey },
    ],
    [companies, t]
  );

  return (
    <>
      <SettingsGroup header={t('hdrWorkspace')}>
        <SettingsRow title={t('switchCompany')} subtitle={activeCompany?.name ?? undefined} value={companies.length > 1 ? String(companies.length) : undefined} onPress={() => setOpen(true)} />
        <SettingsRow title={t('companySetupTitle')} subtitle={t('companyDetailsSub')} onPress={() => navigation.navigate('CompanyDetail')} />
      </SettingsGroup>
      <SettingsGroup header={t('hdrManage')}>
        <SettingsRow title={t('accountsTitle')} onPress={() => navigation.navigate('Accounts')} />
        <SettingsRow title={t('reports')} onPress={() => navigation.navigate('Reports')} />
        <SettingsRow title={t('manageCategories')} onPress={() => navigation.navigate('Categories')} />
      </SettingsGroup>

      <SelectSheet
        visible={open}
        onClose={() => setOpen(false)}
        options={companyOptions}
        selectedId={activeCompanyId ?? undefined}
        title={t('switchCompany')}
        searchable={false}
        onSelect={(o) => {
          setOpen(false);
          if (o.id === NEW_COMPANY_ID) navigation.navigate('NewCompany');
          else switchTo(o.id).catch(swallow('settings:switchCompany'));
        }}
      />
    </>
  );
}
