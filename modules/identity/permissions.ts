export const PERMISSIONS = {
  'organization.view': 'Visualizar a organização',
  'organization.manage': 'Gerenciar dados e membros da organização',
  'products.view': 'Visualizar produtos',
  'products.manage': 'Criar e editar produtos',
  'products.review': 'Revisar e moderar produtos',
  'categories.manage': 'Gerenciar categorias e atributos',
  'orders.view': 'Visualizar pedidos',
  'orders.manage': 'Operar pedidos',
  'fulfillment.view': 'Visualizar a fila de separação',
  'fulfillment.manage': 'Separar, imprimir e despachar pedidos',
  'payments.view': 'Visualizar pagamentos',
  'audit.view': 'Visualizar auditoria',
  'settings.manage': 'Gerenciar configurações',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_PERMISSION_MAP = {
  supplier_owner: [
    'organization.view',
    'organization.manage',
    'products.view',
    'products.manage',
    'orders.view',
    'orders.manage',
    'fulfillment.view',
    'fulfillment.manage',
    'payments.view',
    'audit.view',
  ],
  supplier_member: [
    'organization.view',
    'products.view',
    'orders.view',
  ],
  supplier_operator_1: [
    'organization.view',
    'orders.view',
    'fulfillment.view',
    'fulfillment.manage',
  ],
  supplier_operator_2: [
    'organization.view',
    'orders.view',
    'fulfillment.view',
    'fulfillment.manage',
  ],
  reseller_owner: [
    'organization.view',
    'organization.manage',
    'products.view',
    'orders.view',
    'orders.manage',
    'payments.view',
  ],
  reseller_member: [
    'organization.view',
    'products.view',
    'orders.view',
    'orders.manage',
  ],
  platform_admin: Object.keys(PERMISSIONS) as PermissionKey[],
} satisfies Record<string, PermissionKey[]>;

export type RoleKey = keyof typeof ROLE_PERMISSION_MAP;

export function roleAllows(role: RoleKey, permission: PermissionKey): boolean {
  return (ROLE_PERMISSION_MAP[role] as readonly PermissionKey[]).includes(
    permission,
  );
}
