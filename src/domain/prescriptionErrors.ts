/** origin='prescribed' é somente leitura no Mobile — só o profissional edita, via Web/backend futuro. */
export class ReadOnlyPlanError extends Error {
  constructor(planId: string) {
    super(`O plano ${planId} é prescribed — somente leitura no Mobile.`);
    this.name = 'ReadOnlyPlanError';
  }
}

/** O plano não tem nenhuma versão draft nem active — nunca deveria acontecer (createPlan sempre gera um draft). */
export class InvalidPlanStateError extends Error {
  constructor(planId: string) {
    super(`Plano ${planId} está num estado inválido: nenhuma versão draft ou active.`);
    this.name = 'InvalidPlanStateError';
  }
}

/** O id que a UI está tentando editar não pertence à versão editável resolvida — provável uso de id obtido antes de um copy-on-write. */
export class StaleVersionReferenceError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} não pertence à versão editável atual — recarregue e tente novamente.`);
    this.name = 'StaleVersionReferenceError';
  }
}

/** activatePlanVersion recusou ativar um draft estruturalmente incompleto. */
export class IncompletePlanVersionError extends Error {
  constructor(reason: string) {
    super(`Versão não pode ser ativada: ${reason}`);
    this.name = 'IncompletePlanVersionError';
  }
}
