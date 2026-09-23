/**
 * Fecha a taxonomia de grupo muscular/equipamento (antes texto livre em
 * pt-BR) e separa ExerciseCategory de MuscleGroup (cardio não é mais um
 * "grupo muscular"). Cada exercício do seed é corrigido individualmente —
 * nenhuma conversão genérica tipo "Pernas → todos os grupos".
 */
export const migration005Up = `
ALTER TABLE exercises ADD COLUMN category TEXT NOT NULL DEFAULT 'strength'
  CHECK (category IN ('strength', 'mobility', 'warmup', 'core', 'cardio', 'stretching'));

UPDATE exercises SET primary_muscle_group = 'chest', secondary_muscle_groups = '["triceps","shoulders"]', equipment = 'barbell' WHERE id = 'ex_supino_reto_barra';
UPDATE exercises SET primary_muscle_group = 'chest', secondary_muscle_groups = '["shoulders","triceps"]', equipment = 'dumbbell' WHERE id = 'ex_supino_inclinado_halteres';
UPDATE exercises SET primary_muscle_group = 'chest', secondary_muscle_groups = '["shoulders"]', equipment = 'cable' WHERE id = 'ex_crucifixo_cabo';
UPDATE exercises SET primary_muscle_group = 'shoulders', secondary_muscle_groups = '["triceps"]', equipment = 'barbell' WHERE id = 'ex_desenvolvimento_militar';
UPDATE exercises SET primary_muscle_group = 'shoulders', secondary_muscle_groups = '[]', equipment = 'dumbbell' WHERE id = 'ex_elevacao_lateral';
UPDATE exercises SET primary_muscle_group = 'triceps', secondary_muscle_groups = '[]', equipment = 'cable' WHERE id = 'ex_triceps_corda_pulley';
UPDATE exercises SET primary_muscle_group = 'back', secondary_muscle_groups = '["biceps"]', equipment = 'cable' WHERE id = 'ex_puxada_frente';
UPDATE exercises SET primary_muscle_group = 'back', secondary_muscle_groups = '["biceps"]', equipment = 'barbell' WHERE id = 'ex_remada_curvada';
UPDATE exercises SET primary_muscle_group = 'back', secondary_muscle_groups = '["biceps"]', equipment = 'dumbbell' WHERE id = 'ex_remada_unilateral_halter';
UPDATE exercises SET primary_muscle_group = 'back', secondary_muscle_groups = '["shoulders"]', equipment = 'cable' WHERE id = 'ex_face_pull';
UPDATE exercises SET primary_muscle_group = 'biceps', secondary_muscle_groups = '["forearms"]', equipment = 'barbell' WHERE id = 'ex_rosca_direta_barra';
UPDATE exercises SET primary_muscle_group = 'biceps', secondary_muscle_groups = '["forearms"]', equipment = 'dumbbell' WHERE id = 'ex_rosca_alternada_halteres';
UPDATE exercises SET primary_muscle_group = 'quadriceps', secondary_muscle_groups = '["glutes","hamstrings"]', equipment = 'barbell' WHERE id = 'ex_agachamento_livre';
UPDATE exercises SET primary_muscle_group = 'quadriceps', secondary_muscle_groups = '["glutes"]', equipment = 'machine' WHERE id = 'ex_leg_press_45';
UPDATE exercises SET primary_muscle_group = 'quadriceps', secondary_muscle_groups = '[]', equipment = 'machine' WHERE id = 'ex_cadeira_extensora';
UPDATE exercises SET primary_muscle_group = 'hamstrings', secondary_muscle_groups = '[]', equipment = 'machine' WHERE id = 'ex_mesa_flexora';
UPDATE exercises SET primary_muscle_group = 'hamstrings', secondary_muscle_groups = '["glutes"]', equipment = 'barbell' WHERE id = 'ex_stiff_barra';
UPDATE exercises SET primary_muscle_group = 'calves', secondary_muscle_groups = '[]', equipment = 'machine' WHERE id = 'ex_panturrilha_em_pe';

UPDATE workout_days SET muscle_groups = '["chest","shoulders","triceps"]' WHERE id = 'day_treino_a';
UPDATE workout_days SET muscle_groups = '["back","biceps"]' WHERE id = 'day_treino_b';
UPDATE workout_days SET muscle_groups = '["quadriceps","hamstrings","glutes","calves"]' WHERE id = 'day_treino_c';
`;
