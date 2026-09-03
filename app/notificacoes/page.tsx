import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { MarkReadButton } from './mark-read-button';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireAuthenticatedUser('/notificacoes');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const rows = await getD1()
    .prepare(
      `SELECT id,type,title,body,entity_type entityType,entity_id entityId,read_at readAt,created_at createdAt FROM notifications WHERE organization_id=? ORDER BY created_at DESC LIMIT 100`,
    )
    .bind(account.organization.id)
    .all<{
      id: string;
      type: string;
      title: string;
      body: string;
      entityType: string | null;
      entityId: string | null;
      readAt: string | null;
      createdAt: string;
    }>();
  return (
    <AppShell account={account} activePath="/notificacoes">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <Bell /> Central de alertas
          </span>
          <h1>Notificações</h1>
          <p>Eventos importantes da sua operação em um só lugar.</p>
        </div>
        <div className="page-actions">
          <MarkReadButton />
        </div>
      </section>
      <section className="surface-card notification-center">
        {rows.results.length ? (
          rows.results.map((item) => (
            <article className={item.readAt ? '' : 'unread'} key={item.id}>
              <i>
                <Bell />
              </i>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>
                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                </small>
              </div>
              {item.entityType === 'order' && item.entityId && (
                <a href={`/pedidos/${item.entityId}`}>Abrir pedido</a>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <Bell />
            <strong>Nenhuma notificação</strong>
            <p>Você está em dia.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
