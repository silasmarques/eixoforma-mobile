import { getExerciseMedia } from '@/catalog/exercise-media';

describe('getExerciseMedia', () => {
  it('retorna null para um exerciseId sem entrada no manifesto (fallback pro placeholder)', () => {
    expect(getExerciseMedia('ex_supino_reto_barra')).toBeNull();
    expect(getExerciseMedia('exercicio_que_nao_existe')).toBeNull();
  });
});
