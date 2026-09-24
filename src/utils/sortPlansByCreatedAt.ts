/**
 * Ordena WorkoutPlan por criação, mais recente primeiro — critério único e
 * explícito pra "Meus Treinos", independente de `selected_plan_id` (que é
 * preferência/seleção, uma preocupação diferente de ordenação visual).
 * Desempate determinístico por `id` quando `createdAt` é idêntico.
 */
export function sortPlansByCreatedAtDesc<T extends { id: string; createdAt: string }>(
  plans: readonly T[]
): T[] {
  return [...plans].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}
