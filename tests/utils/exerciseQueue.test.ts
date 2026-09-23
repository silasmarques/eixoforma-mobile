import { buildQueueSearch, configureSaveLabel, parseQueueParam } from '@/utils/exerciseQueue';

describe('parseQueueParam', () => {
  it('retorna lista vazia quando não há queue', () => {
    expect(parseQueueParam(undefined)).toEqual([]);
    expect(parseQueueParam('')).toEqual([]);
  });

  it('separa ids por vírgula', () => {
    expect(parseQueueParam('ex_a,ex_b,ex_c')).toEqual(['ex_a', 'ex_b', 'ex_c']);
  });

  it('ignora um único id', () => {
    expect(parseQueueParam('ex_a')).toEqual(['ex_a']);
  });
});

describe('buildQueueSearch', () => {
  it('retorna string vazia sem ids restantes e sem lote', () => {
    expect(buildQueueSearch([])).toBe('');
  });

  it('inclui queue quando há ids restantes', () => {
    expect(buildQueueSearch(['ex_b', 'ex_c'])).toBe('queue=ex_b%2Cex_c');
  });

  it('inclui batch só quando o lote é maior que 1', () => {
    expect(buildQueueSearch([], 1)).toBe('');
    expect(buildQueueSearch(['ex_b'], 3)).toBe('queue=ex_b&batch=3');
  });

  it('parseQueueParam reverte o que buildQueueSearch produziu', () => {
    const search = buildQueueSearch(['ex_b', 'ex_c'], 3);
    const queuePart = search.split('&').find((part) => part.startsWith('queue='));
    const queueValue = decodeURIComponent(queuePart!.slice('queue='.length));
    expect(parseQueueParam(queueValue)).toEqual(['ex_b', 'ex_c']);
  });
});

describe('configureSaveLabel', () => {
  it('edição sempre mostra "Salvar"', () => {
    expect(configureSaveLabel({ isEdit: true, remainingInQueue: 3, batchSize: 5 })).toBe('Salvar');
    expect(configureSaveLabel({ isEdit: true, remainingInQueue: 0 })).toBe('Salvar');
  });

  it('criação avulsa (sem fila) mostra "Salvar exercício"', () => {
    expect(configureSaveLabel({ isEdit: false, remainingInQueue: 0 })).toBe('Salvar exercício');
  });

  it('ainda restam exercícios na fila: "Próximo"', () => {
    expect(configureSaveLabel({ isEdit: false, remainingInQueue: 2, batchSize: 3 })).toBe('Próximo');
  });

  it('último exercício de um lote: "Adicionar exercícios"', () => {
    expect(configureSaveLabel({ isEdit: false, remainingInQueue: 0, batchSize: 3 })).toBe(
      'Adicionar exercícios'
    );
  });

  it('lote de tamanho 1 se comporta como criação avulsa', () => {
    expect(configureSaveLabel({ isEdit: false, remainingInQueue: 0, batchSize: 1 })).toBe(
      'Salvar exercício'
    );
  });
});
