/**
 * Um WorkoutDay pode estar associado a zero, um ou vários dias da semana.
 * Tabela relacional (não array serializado em TEXT) para permitir consultas
 * diretas ("quais treinos caem hoje") e mapear 1:1 para um backend
 * relacional futuro.
 */
export const migration004Up = `
CREATE TABLE workout_day_weekdays (
  day_id TEXT NOT NULL REFERENCES workout_days(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  PRIMARY KEY (day_id, weekday)
);

CREATE INDEX idx_workout_day_weekdays_weekday ON workout_day_weekdays(weekday);
`;
