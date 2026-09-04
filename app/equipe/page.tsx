import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { labelFor } from '@/lib/presentation';
import { BrandLogo } from '@/components/brand-logo';
import { InviteForm } from './invite-form';
import { MemberActions } from './member-actions';
import { PermissionEditor } from './permission-editor';

export const dynamic = 'force-dynamic';
export default async function TeamPage() {
  const user = await requireAuthenticatedUser('/equipe');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/configuracoes');
  const members = await getD1()
    .prepare(
      `SELECT m.id,u.id userId,u.email, COALESCE(u.name, u.email) AS name, r.name AS role,r.key roleKey, m.status FROM organization_members m JOIN users u ON u.id=m.user_id JOIN roles r ON r.id=m.role_id WHERE m.organization_id=? ORDER BY m.created_at`,
    )
    .bind(account.organization.id)
    .all<{
      id: string;
      userId: string;
      email: string;
      name: string;
      role: string;
      roleKey: string;
      status: string;
    }>();
  const invites = await getD1()
    .prepare(
      `SELECT email,status,expires_at AS expiresAt FROM organization_invitations WHERE organization_id=? ORDER BY created_at DESC`,
    )
    .bind(account.organization.id)
    .all<{ email: string; status: string; expiresAt: string }>();
  const overrides = await getD1()
    .prepare(
      `SELECT member_id memberId,permission_key permissionKey FROM member_permission_overrides WHERE allowed=TRUE AND member_id IN (SELECT id FROM organization_members WHERE organization_id=?)`,
    )
    .bind(account.organization.id)
    .all<{ memberId: string; permissionKey: string }>();
  return (
    <main className="simple-app-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <a href="/dashboard">Voltar ao painel</a>
      </header>
      <section>
        <span className="eyebrow">Acesso e permissões</span>
        <h1>Equipe</h1>
        <p>
          Colaboradores recebem apenas as permissões operacionais do perfil, sem
          acesso a configurações críticas.
        </p>
        {account.role.endsWith('_owner') && <InviteForm />}
        <div className="team-list">
          {members.results.map((member) => (
            <article key={member.email}>
              <span>{member.name.slice(0, 1)}</span>
              <div>
                <strong>{member.name}</strong>
                <small>
                  {member.email} · {labelFor(member.roleKey)}
                </small>
              </div>
              <b>{labelFor(member.status)}</b>
              {account.role.endsWith('_owner') &&
                member.userId !== account.user.id && (
                  <MemberActions memberId={member.id} />
                )}
              {account.role === 'supplier_owner' &&
                member.roleKey === 'supplier_member' && (
                  <PermissionEditor
                    memberId={member.id}
                    initial={overrides.results
                      .filter((item) => item.memberId === member.id)
                      .map((item) => item.permissionKey)}
                  />
                )}
            </article>
          ))}
          {invites.results.map((invite) => (
            <article key={invite.email}>
              <span>✉</span>
              <div>
                <strong>{invite.email}</strong>
                <small>
                  Convite pendente até{' '}
                  {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
                </small>
              </div>
              <b>{labelFor(invite.status)}</b>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
