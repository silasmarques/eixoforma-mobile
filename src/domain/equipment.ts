export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell' | 'band';

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Halteres',
  cable: 'Cabo/Polia',
  machine: 'Máquina',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  band: 'Elástico',
};

export const EQUIPMENT_LIST = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export function isEquipment(value: unknown): value is Equipment {
  return typeof value === 'string' && (EQUIPMENT_LIST as string[]).includes(value);
}
