import { describe, expect, it } from 'vitest';
import { roleAllows } from './permissions';

describe('roleAllows', () => {
  it('permite ao fornecedor gerenciar produtos da própria organização', () => {
    expect(roleAllows('supplier_owner', 'products.manage')).toBe(true);
  });

  it('não permite ao revendedor gerenciar configurações da plataforma', () => {
    expect(roleAllows('reseller_owner', 'settings.manage')).toBe(false);
  });

  it('concede ao administrador as permissões administrativas', () => {
    expect(roleAllows('platform_admin', 'audit.view')).toBe(true);
    expect(roleAllows('platform_admin', 'settings.manage')).toBe(true);
  });
});
