import { resolveRecentRoutineCta } from '@/utils/recentRoutineCta';

describe('resolveRecentRoutineCta', () => {
  it('rotina vazia (zero treinos) → "Montar rotina"', () => {
    expect(resolveRecentRoutineCta({ totalDayCount: 0, hasTodayWorkout: false })).toEqual({
      kind: 'montar',
      label: 'Montar rotina',
    });
  });

  it('rotina vazia tem prioridade mesmo se hasTodayWorkout viesse true por engano', () => {
    expect(resolveRecentRoutineCta({ totalDayCount: 0, hasTodayWorkout: true }).kind).toBe('montar');
  });

  it('tem treinos, mas nenhum elegível hoje → "Abrir rotina"', () => {
    expect(resolveRecentRoutineCta({ totalDayCount: 3, hasTodayWorkout: false })).toEqual({
      kind: 'abrir',
      label: 'Abrir rotina',
    });
  });

  it('tem treino elegível hoje (versão active) → "Iniciar treino"', () => {
    expect(resolveRecentRoutineCta({ totalDayCount: 3, hasTodayWorkout: true })).toEqual({
      kind: 'iniciar',
      label: 'Iniciar treino',
    });
  });
});
