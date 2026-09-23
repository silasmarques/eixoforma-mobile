/**
 * Aceita "30", "32,5" ou "32.5" (uso real no Brasil mistura vírgula e ponto)
 * e normaliza para número — o domínio nunca guarda string localizada.
 * `null` para vazio; `NaN` para entrada inválida (chamador decide como tratar).
 */
export function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // só dígitos, um único separador decimal (, ou .), sinal opcional
  if (!/^-?\d+([.,]\d+)?$/.test(trimmed)) return NaN;

  const normalized = trimmed.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

export function formatRestSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
