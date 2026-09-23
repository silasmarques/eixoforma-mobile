import { searchExercises } from '@/repositories/exerciseRepository';
import { setupTestDatabase } from '../support/setupTestDatabase';
import type { SQLiteClient } from '@/database/sqliteClient';

describe('exerciseRepository.searchExercises', () => {
  let client: SQLiteClient;

  beforeEach(async () => {
    client = await setupTestDatabase();
  });

  it('sem filtros retorna o catálogo inteiro', async () => {
    const results = await searchExercises(client, {});
    expect(results.length).toBeGreaterThanOrEqual(18);
  });

  it('busca por nome (parcial, case-sensitive não é requisito aqui)', async () => {
    const results = await searchExercises(client, { query: 'Supino' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.name.includes('Supino'))).toBe(true);
  });

  it('busca por nome sem resultado retorna array vazio (estado vazio da biblioteca)', async () => {
    const results = await searchExercises(client, { query: 'ExercicioQueNaoExiste123' });
    expect(results).toEqual([]);
  });

  it('filtra por grupo muscular', async () => {
    const results = await searchExercises(client, { muscleGroup: 'chest' });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((e) => e.primaryMuscleGroup === 'chest' || e.secondaryMuscleGroups.includes('chest'))
    ).toBe(true);
  });

  it('filtra por equipamento', async () => {
    const results = await searchExercises(client, { equipment: 'barbell' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.equipment === 'barbell')).toBe(true);
  });

  it('combina filtros de grupo muscular e equipamento', async () => {
    const results = await searchExercises(client, { muscleGroup: 'chest', equipment: 'barbell' });
    expect(results.every((e) => e.equipment === 'barbell')).toBe(true);
    expect(
      results.every((e) => e.primaryMuscleGroup === 'chest' || e.secondaryMuscleGroups.includes('chest'))
    ).toBe(true);
  });
});
