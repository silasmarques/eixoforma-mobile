/**
 * Fundação do schema local. Separa explicitamente prescrição (workout_plans →
 * prescribed_sets) de execução (workout_sessions → performed_sets); nenhuma
 * tabela de execução referencia campos de prescrição além do id, então uma
 * série realizada nunca pode sobrescrever a série prescrita.
 */
export const migration001Up = `
PRAGMA foreign_keys = ON;

CREATE TABLE exercises (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  primary_muscle_group TEXT NOT NULL,
  secondary_muscle_groups TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL,
  image_placeholder TEXT NOT NULL,
  instruction TEXT NOT NULL,
  coach_note TEXT
);

CREATE TABLE workout_plans (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workout_days (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES workout_plans(id),
  "order" INTEGER NOT NULL,
  name TEXT NOT NULL,
  muscle_groups TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_workout_days_plan_id ON workout_days(plan_id);

CREATE TABLE prescribed_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  day_id TEXT NOT NULL REFERENCES workout_days(id),
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL,
  coach_note TEXT
);

CREATE INDEX idx_prescribed_exercises_day_id ON prescribed_exercises(day_id);

CREATE TABLE prescribed_sets (
  id TEXT PRIMARY KEY NOT NULL,
  prescribed_exercise_id TEXT NOT NULL REFERENCES prescribed_exercises(id),
  "order" INTEGER NOT NULL,
  target_reps INTEGER,
  rep_range_min INTEGER,
  rep_range_max INTEGER,
  target_load_kg REAL,
  rest_seconds INTEGER NOT NULL,
  technique TEXT NOT NULL DEFAULT 'normal',
  note TEXT
);

CREATE INDEX idx_prescribed_sets_prescribed_exercise_id ON prescribed_sets(prescribed_exercise_id);

CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES workout_plans(id),
  day_id TEXT NOT NULL REFERENCES workout_days(id),
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX idx_workout_sessions_day_id ON workout_sessions(day_id);

-- Impede duas sessões in_progress simultâneas no app inteiro (índice único parcial).
CREATE UNIQUE INDEX idx_workout_sessions_single_in_progress
  ON workout_sessions(status)
  WHERE status = 'in_progress';

CREATE TABLE performed_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id),
  prescribed_exercise_id TEXT NOT NULL REFERENCES prescribed_exercises(id),
  "order" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_performed_exercises_session_id ON performed_exercises(session_id);

CREATE TABLE performed_sets (
  id TEXT PRIMARY KEY NOT NULL,
  performed_exercise_id TEXT NOT NULL REFERENCES performed_exercises(id),
  prescribed_set_id TEXT NOT NULL REFERENCES prescribed_sets(id),
  reps INTEGER,
  load_kg REAL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT
);

CREATE INDEX idx_performed_sets_performed_exercise_id ON performed_sets(performed_exercise_id);
`;
