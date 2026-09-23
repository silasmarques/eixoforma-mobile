export interface TreinoFormValidationError {
  field: 'name' | 'weekdays';
  message: string;
}

/**
 * Validação do formulário "Adicionar/editar treino" (RotinaFormScreen) —
 * extraída como função pura pra ser testável sem depender de um renderer de
 * componentes (o projeto não tem @testing-library/react-native instalado).
 */
export function validateTreinoForm(input: {
  name: string;
  weekdays: number[];
}): TreinoFormValidationError | null {
  if (input.name.trim() === '') {
    return { field: 'name', message: 'Dê um nome pra esse treino.' };
  }
  if (input.weekdays.length === 0) {
    return { field: 'weekdays', message: 'Escolha em quais dias da semana esse treino acontece.' };
  }
  return null;
}
