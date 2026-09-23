import type { SQLiteClient } from '@/database/sqliteClient';

const SELECTED_PLAN_ID_KEY = 'selected_plan_id';

export async function getSelectedPlanId(client: SQLiteClient): Promise<string | null> {
  const row = await client.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_preferences WHERE key = ?;',
    [SELECTED_PLAN_ID_KEY]
  );
  return row?.value ?? null;
}

export async function setSelectedPlanId(client: SQLiteClient, planId: string): Promise<void> {
  await client.runAsync('INSERT OR REPLACE INTO app_preferences (key, value) VALUES (?, ?);', [
    SELECTED_PLAN_ID_KEY,
    planId,
  ]);
}
