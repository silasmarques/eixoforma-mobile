import { validateTreinoForm } from '@/utils/validateTreinoForm';

describe('validateTreinoForm', () => {
  it('exige nome não vazio', () => {
    expect(validateTreinoForm({ name: '', weekdays: [1] })).toEqual({
      field: 'name',
      message: expect.any(String),
    });
  });

  it('rejeita nome só com espaços (trim)', () => {
    expect(validateTreinoForm({ name: '   ', weekdays: [1] })?.field).toBe('name');
  });

  it('exige ao menos um dia da semana selecionado', () => {
    expect(validateTreinoForm({ name: 'Treino A', weekdays: [] })).toEqual({
      field: 'weekdays',
      message: expect.any(String),
    });
  });

  it('aceita um único dia selecionado', () => {
    expect(validateTreinoForm({ name: 'Treino A', weekdays: [1] })).toBeNull();
  });

  it('aceita múltiplos dias selecionados', () => {
    expect(validateTreinoForm({ name: 'Treino A', weekdays: [1, 4] })).toBeNull();
  });
});
