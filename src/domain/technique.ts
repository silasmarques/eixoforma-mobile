export type Technique = 'normal' | 'warmup' | 'drop_set' | 'rest_pause';

export const TECHNIQUE_LABELS: Record<Technique, string> = {
  normal: 'Normal',
  warmup: 'Aquecimento',
  drop_set: 'Drop set',
  rest_pause: 'Rest-pause',
};
