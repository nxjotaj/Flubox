import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, onlyDigits } from './brazil-documents';

describe('documentos brasileiros', () => {
  it('normaliza a pontuação', () =>
    expect(onlyDigits('529.982.247-25')).toBe('52998224725'));
  it('valida CPF e rejeita sequência repetida', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });
  it('valida CNPJ e rejeita dígitos inválidos', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
  });
});
