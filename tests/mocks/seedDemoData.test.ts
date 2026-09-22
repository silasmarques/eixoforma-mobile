import { runMigrations } from '@/database/migrate';
import { mockExercises } from '@/mocks/exercises';
import { seedDemoData } from '@/mocks/seedDemoData';
import { createNodeSqliteClient } from '../support/nodeSqliteClient';

describe('seedDemoData', () => {
  it('insere o catálogo e o plano de demonstração', async () => {
    const client = createNodeSqliteClient();
    await runMigrations(client);
    await seedDemoData(client);

    const exerciseCount = await client.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM exercises;'
    );
    expect(exerciseCount?.count).toBe(mockExercises.length);

    const days = await client.getAllAsync<{ name: string }>(
      'SELECT name FROM workout_days ORDER BY "order";'
    );
    expect(days.map((d) => d.name)).toEqual(['Treino A', 'Treino B', 'Treino C']);
  });

  it('é idempotente — rodar duas vezes não duplica dados', async () => {
    const client = createNodeSqliteClient();
    await runMigrations(client);
    await seedDemoData(client);
    await seedDemoData(client);

    const planCount = await client.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM workout_plans;'
    );
    expect(planCount?.count).toBe(1);
  });
});
