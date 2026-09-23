/**
 * Migration somente-adição (a 001 nunca é editada): acrescenta a descrição
 * do dia de treino, exibida no Detalhe do treino a partir do Mobile 1.2.
 */
export const migration002Up = `
ALTER TABLE workout_days ADD COLUMN description TEXT NOT NULL DEFAULT '';
`;
