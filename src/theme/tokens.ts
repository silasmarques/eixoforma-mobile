/**
 * Identidade visual própria do EixoForma: fundo claro, alto contraste, ações
 * grandes — pensada para leitura rápida durante o treino, sem relação com
 * nenhum outro aplicativo.
 */
export const colors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F3EE',
  border: '#E1E4DC',
  textPrimary: '#141812',
  textSecondary: '#5B6358',
  textMuted: '#8B9285',
  primary: '#2F6B3C',
  primaryPressed: '#24512D',
  onPrimary: '#FFFFFF',
  accent: '#D97A34',
  success: '#2F6B3C',
  warning: '#B8862B',
  danger: '#B3402F',
  muscleGroup: {
    chest: '#C6564A',
    back: '#2F6B90',
    shoulders: '#B8862B',
    biceps: '#3E7A5C',
    triceps: '#8A6BAE',
    forearms: '#7A6A55',
    core: '#4A7A6B',
    quadriceps: '#6B5B3E',
    hamstrings: '#8A6B3E',
    glutes: '#A6613E',
    calves: '#5B6E4E',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '700' as const, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  subtitle: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  numeric: { fontSize: 26, fontWeight: '700' as const, lineHeight: 30 },
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

export const minTouchTarget = 44;
