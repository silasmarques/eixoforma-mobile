import type { ImageSourcePropType } from 'react-native';

/**
 * Mídia de um exercício. Só `main` existe hoje — os campos comentados são o
 * motivo do valor já ser um objeto em vez de `ImageSourcePropType` puro: dá
 * pra adicionar `start`/`end`/`gif`/`video` depois sem mudar nenhum call site
 * de `ExerciseMedia`. Não implementar esses campos ainda.
 */
export interface ExerciseMediaEntry {
  main: ImageSourcePropType;
  // start?: ImageSourcePropType;
  // end?: ImageSourcePropType;
  // gif?: ImageSourcePropType;
  // video?: string;
}

/**
 * Chaveado pelos exerciseId reais e estáveis do catálogo (ver
 * src/mocks/exercises.ts) — nunca pelos slugs conceituais usados em
 * conversa. `require()` sempre literal: Metro não resolve `require()`
 * dinâmico, e apontar pra um arquivo que não existe em disco quebra o
 * bundle na hora, não em runtime — por isso só entra aqui quando o asset já
 * está de fato em assets/exercises/.
 *
 * Sem entrada para um exerciseId → ExerciseMedia cai no ExercisePlaceholder
 * (ver src/components/ExerciseMedia.tsx). Catálogo cresce progressivamente;
 * a ausência de mídia nunca impede montar ou iniciar um treino.
 */
export const EXERCISE_MEDIA: Partial<Record<string, ExerciseMediaEntry>> = {
  // Lote piloto (ids canônicos confirmados — aguardando os PNGs reais em assets/exercises/):
  // ex_agachamento_livre: { main: require('../../assets/exercises/ex_agachamento_livre.png') },
  // ex_supino_inclinado_halteres: { main: require('../../assets/exercises/ex_supino_inclinado_halteres.png') },
  // ex_puxada_frente: { main: require('../../assets/exercises/ex_puxada_frente.png') },
  // ex_elevacao_lateral: { main: require('../../assets/exercises/ex_elevacao_lateral.png') },
};

export function getExerciseMedia(exerciseId: string): ExerciseMediaEntry | null {
  return EXERCISE_MEDIA[exerciseId] ?? null;
}
