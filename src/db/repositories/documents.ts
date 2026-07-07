import { getDatabase } from '../database';
import { DEFAULT_USER, type DocumentRow } from '../schema';
import { nowISO, uuid } from '../uuid';

export interface NewDocument {
  entityType: string;
  entityId: string;
  fileUri: string;
  label?: string | null;
  mime?: string | null;
  createdBy?: string;
}

export async function addDocument(input: NewDocument): Promise<DocumentRow> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO documents (id, created_at, created_by, entity_type, entity_id, label, file_uri, mime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    nowISO(),
    input.createdBy ?? DEFAULT_USER,
    input.entityType,
    input.entityId,
    input.label ?? null,
    input.fileUri,
    input.mime ?? null
  );
  return (await db.getFirstAsync<DocumentRow>('SELECT * FROM documents WHERE id = ?', id))!;
}

export async function listDocuments(
  entityType: string,
  entityId: string
): Promise<DocumentRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DocumentRow>(
    'SELECT * FROM documents WHERE entity_type = ? AND entity_id = ? ORDER BY created_at',
    entityType,
    entityId
  );
}

/** All documents for an entity type  handy for building an id → uri map. */
export async function listDocumentsForType(entityType: string): Promise<DocumentRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DocumentRow>(
    'SELECT * FROM documents WHERE entity_type = ? ORDER BY created_at',
    entityType
  );
}
