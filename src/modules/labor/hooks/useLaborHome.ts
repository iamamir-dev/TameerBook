import { useCallback, useEffect, useState } from 'react';

import {
  getLaborerKhata,
  listAccountsWithBalance,
  listLaborersWithTotals,
  type AccountWithBalance,
  type LaborerProjectParticipation,
  type LaborerTotals,
} from '@/db';
import { useFocusData } from '@/hooks';
import { swallow } from '@/utils/log';

/** Labor-home list data (all workers with cross-project totals). */
export function useLaborHome() {
  const loader = useCallback(async () => ({ workers: await listLaborersWithTotals() }), []);
  return useFocusData(loader, { workers: [] as LaborerTotals[] });
}

export interface WorkerPayData {
  participations: LaborerProjectParticipation[];
  accounts: AccountWithBalance[];
}

/**
 * Loads the chosen worker's participations + accounts for the pay sheet opened
 * straight from the Labor home. Null worker clears it; stale responses from
 * rapid selection are dropped.
 */
export function useWorkerPayData(worker: LaborerTotals | null): WorkerPayData | null {
  const [data, setData] = useState<WorkerPayData | null>(null);

  useEffect(() => {
    if (!worker) {
      setData(null);
      return;
    }
    let alive = true;
    Promise.all([getLaborerKhata(worker.id), listAccountsWithBalance()])
      .then(([khata, accounts]) => {
        if (alive) setData({ participations: khata.participations, accounts });
      })
      .catch(swallow('labor:payData'));
    return () => {
      alive = false;
    };
  }, [worker]);

  return data;
}
