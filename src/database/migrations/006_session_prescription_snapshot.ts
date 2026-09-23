/**
 * WorkoutSession passa a referenciar a versão do plano usada e a preservar
 * um snapshot imutável da prescrição (ver src/domain/prescriptionSnapshot.ts)
 * — protege o histórico contra edição futura do catálogo compartilhado de
 * exercícios, que não é coberto pelo versionamento do plano em si.
 */
export const migration006Up = `
ALTER TABLE workout_sessions ADD COLUMN plan_version_id TEXT REFERENCES workout_plan_versions(id);
ALTER TABLE workout_sessions ADD COLUMN prescription_snapshot TEXT NOT NULL DEFAULT '{}';

UPDATE workout_sessions
SET plan_version_id = plan_id || '_v1'
WHERE plan_version_id IS NULL;
`;
