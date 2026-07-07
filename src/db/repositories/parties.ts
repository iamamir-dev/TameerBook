import { getDatabase } from '../database';
import { DEFAULT_USER, type PartyRow, type PartyType } from '../schema';
import { nowISO, uuid } from '../uuid';
import { requireCompanyId } from './companies';

export interface NewParty {
  type: PartyType;
  name: string;
  phone?: string | null;
  cnic?: string | null;
  createdBy?: string;
}

export async function addParty(input: NewParty): Promise<PartyRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO parties (id, created_at, created_by, company_id, type, name, phone, cnic)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    requireCompanyId(),
    input.type,
    input.name,
    input.phone ?? null,
    input.cnic ?? null
  );
  return (await db.getFirstAsync<PartyRow>('SELECT * FROM parties WHERE id = ?', id))!;
}

export async function listParties(type?: PartyType): Promise<PartyRow[]> {
  const db = await getDatabase();
  if (type) {
    return db.getAllAsync<PartyRow>(
      'SELECT * FROM parties WHERE type = ? AND company_id = ? ORDER BY name',
      type,
      requireCompanyId()
    );
  }
  return db.getAllAsync<PartyRow>(
    'SELECT * FROM parties WHERE company_id = ? ORDER BY name',
    requireCompanyId()
  );
}

export async function getParty(id: string): Promise<PartyRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PartyRow>('SELECT * FROM parties WHERE id = ?', id);
}
