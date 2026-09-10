import type { AccountContext } from '../identity/service';
import {
  ROLE_PERMISSION_MAP,
  type PermissionKey,
  type RoleKey,
} from '../identity/permissions';
import { getD1 } from '../../db';
import type { AssistantContext } from './types';

export async function buildAssistantContext(
  account: AccountContext,
  conversationId: string,
): Promise<AssistantContext> {
  const base = ROLE_PERMISSION_MAP[account.role as RoleKey] ?? [];
  const overrides = await getD1()
    .prepare(
      'SELECT permission_key permissionKey,allowed FROM member_permission_overrides WHERE member_id=?',
    )
    .bind(account.memberId)
    .all<{ permissionKey: PermissionKey; allowed: boolean }>();
  const permissions = new Set<PermissionKey>(base);
  for (const override of overrides.results) {
    if (override.allowed) permissions.add(override.permissionKey);
    else permissions.delete(override.permissionKey);
  }
  if (!permissions.has('assistant.use')) throw new Error('FORBIDDEN');
  return Object.freeze({
    userId: account.user.id,
    organizationId: account.organization.id,
    organizationType: account.organization.type,
    role: account.role,
    permissions: Object.freeze([...permissions]),
    conversationId,
  });
}

export function assertAssistantPermission(
  context: AssistantContext,
  permission: PermissionKey,
) {
  if (!context.permissions.includes(permission)) throw new Error('FORBIDDEN');
}
