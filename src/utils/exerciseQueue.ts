/**
 * Fila de configuração sequencial de exercícios (biblioteca → configurar #1
 * → configurar #2 → ...), usada tanto pela seleção múltipla na biblioteca
 * quanto pelo avanço de um exercício pro próximo dentro do
 * ExerciseConfigScreen. Extraída como funções puras pra ser testável sem
 * depender de navegação real.
 */

export function parseQueueParam(queue?: string): string[] {
  if (!queue) return [];
  return queue.split(',').filter((id) => id.length > 0);
}

/**
 * Monta a query string manualmente — Hermes (engine do RN) não tem
 * `URLSearchParams` sem polyfill, e o projeto não tem um instalado.
 */
export function buildQueueSearch(remainingIds: string[], batchSize?: number): string {
  const parts: string[] = [];
  if (remainingIds.length > 0) parts.push(`queue=${encodeURIComponent(remainingIds.join(','))}`);
  if (batchSize && batchSize > 1) parts.push(`batch=${batchSize}`);
  return parts.join('&');
}

/**
 * Rótulo do CTA de salvar um exercício, conforme a posição na fila:
 * - edição de um exercício já existente: sempre "Salvar";
 * - criação avulsa (sem fila / lote de 1): "Salvar exercício";
 * - criação em lote, ainda restam exercícios: "Próximo";
 * - criação em lote, último exercício: "Adicionar exercícios".
 */
export function configureSaveLabel(input: {
  isEdit: boolean;
  remainingInQueue: number;
  batchSize?: number;
}): string {
  if (input.isEdit) return 'Salvar';
  if (input.remainingInQueue > 0) return 'Próximo';
  if (input.batchSize && input.batchSize > 1) return 'Adicionar exercícios';
  return 'Salvar exercício';
}
