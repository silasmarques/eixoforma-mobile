import { generateId } from '@/utils/id';
import type { PlanOrigin, WorkoutPlan } from '@/domain/workoutPlan';
import type { SQLiteClient } from '@/database/sqliteClient';

interface PlanRow {
  id: string;
  name: string;
  origin: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

function toPlan(row: PlanRow): WorkoutPlan {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin as PlanOrigin,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPlans(client: SQLiteClient): Promise<WorkoutPlan[]> {
  const rows = await client.getAllAsync<PlanRow>('SELECT * FROM workout_plans ORDER BY created_at;');
  return rows.map(toPlan);
}

export async function getPlanById(client: SQLiteClient, planId: string): Promise<WorkoutPlan | null> {
  const row = await client.getFirstAsync<PlanRow>('SELECT * FROM workout_plans WHERE id = ?;', [planId]);
  return row ? toPlan(row) : null;
}

/** Cria só a linha do plano — a versão 1 (draft) é responsabilidade do service, que coordena as duas escritas. */
export async function insertPlan(
  client: SQLiteClient,
  params: { id: string; name: string; origin: PlanOrigin; createdByUserId: string | null }
): Promise<WorkoutPlan> {
  const now = new Date().toISOString();
  await client.runAsync(
    'INSERT INTO workout_plans (id, name, origin, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
    [params.id, params.name, params.origin, params.createdByUserId, now, now]
  );
  const plan = await getPlanById(client, params.id);
  if (!plan) throw new Error('Falha ao criar plano.');
  return plan;
}

export async function renamePlan(client: SQLiteClient, planId: string, name: string): Promise<void> {
  await client.runAsync('UPDATE workout_plans SET name = ?, updated_at = ? WHERE id = ?;', [
    name,
    new Date().toISOString(),
    planId,
  ]);
}

export function generatePlanId(): string {
  return generateId('plan');
}
