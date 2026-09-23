export type Technique = 'normal' | 'warmup' | 'drop_set' | 'rest_pause';

export const TECHNIQUE_LABELS: Record<Technique, string> = {
  normal: 'Normal',
  warmup: 'Aquecimento',
  drop_set: 'Drop set',
  rest_pause: 'Rest-pause',
};

export const TECHNIQUES = Object.keys(TECHNIQUE_LABELS) as Technique[];

export function isTechnique(value: unknown): value is Technique {
  return typeof value === 'string' && (TECHNIQUES as string[]).includes(value);
}
