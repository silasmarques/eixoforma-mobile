import { sortPlansByCreatedAtDesc } from '@/utils/sortPlansByCreatedAt';

function plan(id: string, createdAt: string) {
  return { id, createdAt };
}

describe('sortPlansByCreatedAtDesc', () => {
  it('lista vazia continua vazia', () => {
    expect(sortPlansByCreatedAtDesc([])).toEqual([]);
  });

  it('um único plano', () => {
    const p = plan('p1', '2026-09-10T09:00:00.000Z');
    expect(sortPlansByCreatedAtDesc([p])).toEqual([p]);
  });

  it('mais recente primeiro', () => {
    const old = plan('old', '2026-09-10T09:00:00.000Z');
    const mid = plan('mid', '2026-09-20T09:00:00.000Z');
    const recent = plan('recent', '2026-09-24T09:00:00.000Z');

    const sorted = sortPlansByCreatedAtDesc([old, recent, mid]);
    expect(sorted.map((p) => p.id)).toEqual(['recent', 'mid', 'old']);
  });

  it('não ordena alfabeticamente — só por createdAt', () => {
    const zPlan = plan('z_plan', '2026-09-24T09:00:00.000Z');
    const aPlan = plan('a_plan', '2026-09-10T09:00:00.000Z');
    const sorted = sortPlansByCreatedAtDesc([aPlan, zPlan]);
    expect(sorted.map((p) => p.id)).toEqual(['z_plan', 'a_plan']);
  });

  it('desempate determinístico por id quando createdAt é idêntico', () => {
    const same = '2026-09-24T09:00:00.000Z';
    const b = plan('plan_b', same);
    const a = plan('plan_a', same);
    const result1 = sortPlansByCreatedAtDesc([b, a]).map((p) => p.id);
    const result2 = sortPlansByCreatedAtDesc([a, b]).map((p) => p.id);
    expect(result1).toEqual(result2); // mesma ordem independente da entrada
    expect(result1).toEqual(['plan_a', 'plan_b']);
  });

  it('não muta o array original', () => {
    const list = [plan('a', '2026-09-10T09:00:00.000Z'), plan('b', '2026-09-20T09:00:00.000Z')];
    const originalOrder = list.map((p) => p.id);
    sortPlansByCreatedAtDesc(list);
    expect(list.map((p) => p.id)).toEqual(originalOrder);
  });
});
