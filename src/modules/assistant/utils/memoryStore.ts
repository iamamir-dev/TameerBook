import { parseMemory, type UserMemory } from '@/ai';
import { loadSettings, saveSetting } from '@/db';

/**
 * Where the assistant's memory of the user lives: one JSON blob in
 * app_settings. Read fresh at the start of every turn (cheap) so Settings →
 * "Forget" and the chat never disagree.
 */
const KEY = 'aiMemory';

export async function loadMemory(): Promise<UserMemory> {
  const s = await loadSettings();
  return parseMemory(s[KEY]);
}

export function saveMemory(m: UserMemory): Promise<void> {
  return saveSetting(KEY, JSON.stringify(m));
}

export function forgetMemory(): Promise<void> {
  return saveSetting(KEY, '');
}
