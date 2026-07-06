import { getDatabase } from '../database';
import { DEFAULT_USER, type PartyRow, type PartyType } from '../schema';
import { nowISO, uuid } from '../uuid';

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
    `INSERT INTO parties (id, created_at, created_by, type, name, phone, cnic)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
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
    return db.getAllAsync<PartyRow>('SELECT * FROM parties WHERE type = ? ORDER BY name', type);
  }
  return db.getAllAsync<PartyRow>('SELECT * FROM parties ORDER BY name');
}

export async function getParty(id: string): Promise<PartyRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PartyRow>('SELECT * FROM parties WHERE id = ?', id);
}
