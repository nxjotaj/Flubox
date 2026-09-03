import { describe, expect, it } from 'vitest';
import { chooseActiveOrganization } from './active-organization';
describe('organização ativa', () => {
  const memberships = [
    { id: 'supplier-a', status: 'active' },
    { id: 'reseller-b', status: 'active' },
    { id: 'revoked-c', status: 'revoked' },
  ];
  it('respeita uma seleção que pertence ao usuário', () =>
    expect(chooseActiveOrganization(memberships, 'reseller-b')?.id).toBe(
      'reseller-b',
    ));
  it('não aceita organização sem membership ativo', () =>
    expect(chooseActiveOrganization(memberships, 'revoked-c')?.id).toBe(
      'supplier-a',
    ));
  it('retorna vazio sem vínculos ativos', () =>
    expect(chooseActiveOrganization([], 'supplier-a')).toBeNull());
});
