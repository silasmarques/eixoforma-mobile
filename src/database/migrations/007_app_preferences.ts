/** Preferências de UI (ex.: plano selecionado) — não é dado de prescrição, fica separado. */
export const migration007Up = `
CREATE TABLE app_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
