/** Objetivo opcional do plano (ex.: "Hipertrofia Setembro" → "Ganho de massa"). Só-adição. */
export const migration008Up = `
ALTER TABLE workout_plans ADD COLUMN goal TEXT;
`;
