import { useCallback } from 'react';

import {
  getLaborerKhata,
  listAccountsWithBalance,
  listProjects,
  type AccountWithBalance,
  type LaborerKhata,
  type ProjectRow,
} from '@/db';
import { useFocusData } from '@/hooks';

export interface LaborerKhataData {
  khata: LaborerKhata | null;
  accounts: AccountWithBalance[];
  projects: ProjectRow[];
}

/** One worker's khata + the accounts and projects the detail screen needs. */
export function useLaborerKhata(laborerId: string) {
  const loader = useCallback(async (): Promise<LaborerKhataData> => {
    const [khata, accounts, projects] = await Promise.all([
      getLaborerKhata(laborerId),
      listAccountsWithBalance(),
      listProjects(),
    ]);
    return { khata, accounts, projects };
  }, [laborerId]);

  return useFocusData<LaborerKhataData>(loader, { khata: null, accounts: [], projects: [] });
}
