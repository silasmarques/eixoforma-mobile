import { formatRestSeconds, parseDecimalInput } from '@/utils/parseDecimalInput';

describe('parseDecimalInput', () => {
  it('aceita inteiro simples', () => {
    expect(parseDecimalInput('30')).toBe(30);
  });

  it('aceita vírgula decimal (pt-BR)', () => {
    expect(parseDecimalInput('32,5')).toBe(32.5);
  });

  it('aceita ponto decimal', () => {
    expect(parseDecimalInput('32.5')).toBe(32.5);
  });

  it('retorna null para string vazia', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('   ')).toBeNull();
  });

  it('rejeita entrada inválida (NaN)', () => {
    expect(Number.isNaN(parseDecimalInput('abc'))).toBe(true);
    expect(Number.isNaN(parseDecimalInput('32,5,6'))).toBe(true);
    expect(Number.isNaN(parseDecimalInput('30kg'))).toBe(true);
  });

  it('o valor normalizado nunca é uma string localizada — sempre number', () => {
    const value = parseDecimalInput('32,5');
    expect(typeof value).toBe('number');
  });
});

describe('formatRestSeconds', () => {
  it('mostra segundos abaixo de 1 minuto', () => {
    expect(formatRestSeconds(60)).toBe('1:00');
    expect(formatRestSeconds(45)).toBe('45s');
  });

  it('mostra minuto:segundo a partir de 60s', () => {
    expect(formatRestSeconds(90)).toBe('1:30');
    expect(formatRestSeconds(125)).toBe('2:05');
  });
});
