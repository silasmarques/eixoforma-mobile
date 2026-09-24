export type RecentRoutineCtaKind = 'montar' | 'abrir' | 'iniciar';

export interface RecentRoutineCta {
  kind: RecentRoutineCtaKind;
  label: string;
}

/**
 * CTA do card "sua rotina mais recente" na Home. Conservador por design: só
 * vira "Iniciar treino" quando já existe uma resolução inequívoca de treino
 * elegível hoje (versão active, nunca draft — ver `resolveTodayWorkoutForPlan`
 * em homeSnapshot.ts). Qualquer outro caso cai em "Abrir rotina", nunca
 * inventa ou força início de sessão.
 */
export function resolveRecentRoutineCta(input: {
  totalDayCount: number;
  hasTodayWorkout: boolean;
}): RecentRoutineCta {
  if (input.totalDayCount === 0) {
    return { kind: 'montar', label: 'Montar rotina' };
  }
  if (input.hasTodayWorkout) {
    return { kind: 'iniciar', label: 'Iniciar treino' };
  }
  return { kind: 'abrir', label: 'Abrir rotina' };
}
