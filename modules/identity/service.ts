import { getD1 } from '@/db';
import { ensureDatabase } from '@/db/initialize';
import type { AuthenticatedUser } from '@/app/chatgpt-auth';
import { roleAllows, type PermissionKey, type RoleKey } from './permissions';
import { cookies } from 'next/headers';
import { cache } from 'react';

export const ACTIVE_ORGANIZATION_COOKIE = 'flubox_active_organization';

export type AccountContext = {
  user: { id: string; email: string; name: string | null };
  organization: {
    id: string;
    type: 'supplier' | 'reseller' | 'platform';
    displayName: string;
    status: string;
  };
  role: string;
  memberId: string;
};

type ContextRow = {
  user_id: string;
  email: string;
  name: string | null;
  organization_id: string;
  organization_type: 'supplier' | 'reseller' | 'platform';
  display_name: string;
  organization_status: string;
  role_key: string;
  member_id: string;
};

export async function syncAuthenticatedUser(
  authUser: AuthenticatedUser,
): Promise<string> {
  await ensureDatabase();
  const d1 = getD1();
  const now = new Date().toISOString();
  const existing = await d1
    .prepare('SELECT id FROM users WHERE auth_subject = ?')
    .bind(authUser.userId)
    .first<{ id: string }>();
  const userId = existing?.id ?? crypto.randomUUID();
  await d1
    .prepare(
      `INSERT INTO users (id, auth_subject, email, name, status, last_login_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?) ON CONFLICT(auth_subject) DO UPDATE SET email = excluded.email, name = excluded.name, last_login_at=excluded.last_login_at, updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      authUser.userId,
      authUser.email.toLowerCase(),
      authUser.fullName,
      now,
      now,
      now,
    )
    .run();
  return userId;
}

export const getAccountContext = cache(async function getAccountContext(
  authUser: AuthenticatedUser,
): Promise<AccountContext | null> {
  let selectedOrganizationId: string | undefined;
  try {
    selectedOrganizationId = (await cookies()).get(
      ACTIVE_ORGANIZATION_COOKIE,
    )?.value;
  } catch {
    selectedOrganizationId = undefined;
  }
  const selectContext = (organizationId?: string) =>
    getD1()
      .prepare(
        `SELECT u.id AS user_id, u.email, u.name, m.id AS member_id, o.id AS organization_id, o.type AS organization_type, o.display_name, o.status AS organization_status, r.key AS role_key FROM users u JOIN organization_members m ON m.user_id = u.id AND m.status = 'active' JOIN organizations o ON o.id = m.organization_id JOIN roles r ON r.id = m.role_id WHERE u.auth_subject = ? AND (? IS NULL OR o.id = ?) ORDER BY m.created_at LIMIT 1`,
      )
      .bind(authUser.userId, organizationId ?? null, organizationId ?? null)
      .first<ContextRow>();
  const row =
    (selectedOrganizationId
      ? await selectContext(selectedOrganizationId)
      : null) ?? (await selectContext());
  if (!row) {
    await syncAuthenticatedUser(authUser);
    return null;
  }
  if (
    row.organization_type === 'reseller' &&
    row.organization_status === 'suspended'
  ) {
    const profile = await getD1()
      .prepare(
        'SELECT deactivated_until deactivatedUntil FROM reseller_profiles WHERE organization_id=?',
      )
      .bind(row.organization_id)
      .first<{ deactivatedUntil: string | null }>();
    if (
      profile?.deactivatedUntil &&
      new Date(profile.deactivatedUntil).getTime() <= Date.now()
    ) {
      const now = new Date().toISOString();
      await getD1().batch([
        getD1()
          .prepare(
            "UPDATE organizations SET status='active',updated_at=? WHERE id=?",
          )
          .bind(now, row.organization_id),
        getD1()
          .prepare(
            'UPDATE reseller_profiles SET deactivated_until=NULL,updated_at=? WHERE organization_id=?',
          )
          .bind(now, row.organization_id),
      ]);
      row.organization_status = 'active';
    }
  }
  return {
    user: { id: row.user_id, email: row.email, name: row.name },
    organization: {
      id: row.organization_id,
      type: row.organization_type,
      displayName: row.display_name,
      status: row.organization_status,
    },
    role: row.role_key,
    memberId: row.member_id,
  };
});

export async function listAccountOrganizations(authUser: AuthenticatedUser) {
  const userId = await syncAuthenticatedUser(authUser);
  const result = await getD1()
    .prepare(
      `SELECT o.id, o.type, o.display_name displayName, o.status, r.key role FROM organization_members m JOIN organizations o ON o.id=m.organization_id JOIN roles r ON r.id=m.role_id WHERE m.user_id=? AND m.status='active' ORDER BY o.display_name`,
    )
    .bind(userId)
    .all<{
      id: string;
      type: 'supplier' | 'reseller' | 'platform';
      displayName: string;
      status: string;
      role: string;
    }>();
  return result.results;
}

export async function createOrganizationForUser(input: {
  authUser: AuthenticatedUser;
  type: 'supplier' | 'reseller';
  displayName: string;
  requestId: string;
}): Promise<AccountContext> {
  const userId = await syncAuthenticatedUser(input.authUser);
  const existing = await getAccountContext(input.authUser);
  if (existing) return existing;

  const d1 = getD1();
  const organizationId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const role = input.type === 'supplier' ? 'supplier_owner' : 'reseller_owner';
  const now = new Date().toISOString();

  await d1.batch([
    d1
      .prepare(
        `INSERT INTO organizations (id, type, legal_name, display_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'onboarding', ?, ?)`,
      )
      .bind(
        organizationId,
        input.type,
        input.displayName,
        input.displayName,
        now,
        now,
      ),
    d1
      .prepare(
        `INSERT INTO organization_members (id, organization_id, user_id, role_id, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`,
      )
      .bind(membershipId, organizationId, userId, `role:${role}`, now),
    d1
      .prepare(
        `INSERT INTO audit_logs (id, actor_user_id, organization_id, action, entity_type, entity_id, request_id, metadata, created_at) VALUES (?, ?, ?, 'organization.created', 'organization', ?, ?, ?, ?)`,
      )
      .bind(
        auditId,
        userId,
        organizationId,
        organizationId,
        input.requestId,
        JSON.stringify({ type: input.type }),
        now,
      ),
  ]);

  return {
    user: {
      id: userId,
      email: input.authUser.email,
      name: input.authUser.fullName,
    },
    organization: {
      id: organizationId,
      type: input.type,
      displayName: input.displayName,
      status: 'onboarding',
    },
    role,
    memberId: membershipId,
  };
}

export async function requireAccountPermission(
  authUser: AuthenticatedUser,
  permission: PermissionKey,
): Promise<AccountContext> {
  const account = await getAccountContext(authUser);
  if (!account) throw new Error('ACCOUNT_REQUIRED');
  const override = await getD1()
    .prepare(
      'SELECT allowed FROM member_permission_overrides WHERE member_id=? AND permission_key=?',
    )
    .bind(account.memberId, permission)
    .first<{ allowed: boolean }>();
  const allowed = override
    ? Boolean(override.allowed)
    : roleAllows(account.role as RoleKey, permission);
  if (!allowed) throw new Error('FORBIDDEN');
  return account;
}
