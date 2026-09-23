/**
 * ESTRUTURAL (não é só-adição): introduz WorkoutPlanVersion como fonte de
 * verdade da árvore de prescrição e migra os dados do plano já seedado para
 * uma versão 1 "active".
 *
 * Decisão deliberada: NÃO recria `workout_days` para trocar `plan_id` por
 * `plan_version_id`. Em vez disso, adiciona `plan_version_id` como coluna
 * nova e mantém `plan_id` como coluna legada (nunca lida por código novo).
 * `prescribed_exercises`/`prescribed_sets` dependem de `workout_days.id`, que
 * não muda — reconstruir a tabela só para remover uma coluna não usada
 * aumentaria o risco desta migration sem nenhum ganho neste momento; a
 * remoção física de `plan_id` fica para quando o schema definitivo do
 * backend estiver decidido.
 *
 * Toda a migration roda dentro de uma única transação (ver migrate.ts) —
 * se qualquer passo falhar, nem o schema nem os dados avançam.
 */
export const migration003Up = `
CREATE TABLE workout_plan_versions (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES workout_plans(id),
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'superseded')),
  created_at TEXT NOT NULL,
  activated_at TEXT,
  UNIQUE (plan_id, version_number)
);

CREATE UNIQUE INDEX idx_plan_versions_single_active
  ON workout_plan_versions(plan_id) WHERE status = 'active';
CREATE UNIQUE INDEX idx_plan_versions_single_draft
  ON workout_plan_versions(plan_id) WHERE status = 'draft';

ALTER TABLE workout_days ADD COLUMN plan_version_id TEXT REFERENCES workout_plan_versions(id);

ALTER TABLE workout_plans
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'personal' CHECK (origin IN ('prescribed', 'personal'));
ALTER TABLE workout_plans ADD COLUMN created_by_user_id TEXT;

-- Backfill: cada plano que já tinha dias ganha uma versão 1 "active" com um
-- id determinístico (evita depender de geração de id em SQL puro).
INSERT INTO workout_plan_versions (id, plan_id, version_number, status, created_at, activated_at)
SELECT DISTINCT plan_id || '_v1', plan_id, 1, 'active', datetime('now'), datetime('now')
FROM workout_days
WHERE plan_id IS NOT NULL;

UPDATE workout_days
SET plan_version_id = plan_id || '_v1'
WHERE plan_version_id IS NULL;

-- O plano de demonstração seedado nas versões anteriores representa uma
-- prescrição de treinador — alinhar com o que o seed novo já cria do zero.
UPDATE workout_plans SET origin = 'prescribed' WHERE id = 'plan_eixoforma_demo';
`;
