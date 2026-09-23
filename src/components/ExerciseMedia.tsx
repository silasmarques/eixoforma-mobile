import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ExercisePlaceholder } from './ExercisePlaceholder';
import { getExerciseMedia } from '@/catalog/exercise-media';
import { colors, radius } from '@/theme/tokens';

export type ExerciseMediaVariant = 'thumbnail' | 'hero';

interface ExerciseMediaProps {
  exerciseId: string;
  name: string;
  muscleGroupSlug: string;
  variant: ExerciseMediaVariant;
}

const THUMBNAIL_SIZE = 56;
const HERO_ASPECT_RATIO = 4 / 3;
const PLACEHOLDER_SIZE: Record<ExerciseMediaVariant, number> = {
  thumbnail: 56,
  hero: 96,
};

/**
 * Imagem do exercício quando existe no catálogo de mídia (ver
 * src/catalog/exercise-media.ts), com fallback pro ExercisePlaceholder já
 * existente — sem imagem no manifesto, ou erro real de carregamento, sempre
 * cai no placeholder colorido por grupo muscular. Nunca corta o exercício:
 * resizeMode="contain" dentro de um cartão com fundo claro.
 */
export function ExerciseMedia({ exerciseId, name, muscleGroupSlug, variant }: ExerciseMediaProps) {
  const [failed, setFailed] = useState(false);
  const media = getExerciseMedia(exerciseId);

  if (!media || failed) {
    return (
      <View
        style={variant === 'hero' ? styles.heroFallback : styles.thumbnailFallback}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ExercisePlaceholder name={name} muscleGroupSlug={muscleGroupSlug} size={PLACEHOLDER_SIZE[variant]} />
      </View>
    );
  }

  return (
    <View
      style={variant === 'hero' ? styles.heroCard : styles.thumbnailCard}
      accessibilityIgnoresInvertColors
    >
      <Image
        source={media.main}
        resizeMode="contain"
        style={styles.image}
        onError={() => setFailed(true)}
        accessibilityLabel={name}
      />
    </View>
  );
}

const cardBase = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  overflow: 'hidden' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles = StyleSheet.create({
  thumbnailCard: {
    ...cardBase,
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.md,
  },
  thumbnailFallback: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    ...cardBase,
    width: '100%',
    aspectRatio: HERO_ASPECT_RATIO,
    borderRadius: radius.lg,
  },
  heroFallback: {
    width: '100%',
    aspectRatio: HERO_ASPECT_RATIO,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
