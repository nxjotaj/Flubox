import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { MessageComposer } from './message-composer';

export const dynamic = 'force-dynamic';
type CaseRow = {
  id: string;
  reason: string;
  status: string;
  number: string;
  preview: string;
  updatedAt: string;
};
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const user = await requireAuthenticatedUser('/mensagens');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const cases = await getD1()
    .prepare(
      `SELECT c.id,c.reason,c.status,o.number,COALESCE((SELECT body FROM case_messages m WHERE m.case_id=c.id ORDER BY m.created_at DESC LIMIT 1),c.description) preview,c.updated_at updatedAt FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE c.opened_by_organization_id=? OR o.supplier_organization_id=? OR o.reseller_organization_id=? ORDER BY c.updated_at DESC`,
    )
    .bind(
      account.organization.id,
      account.organization.id,
      account.organization.id,
    )
    .all<CaseRow>();
  const requested = (await searchParams).case;
  const selected =
    cases.results.find((item) => item.id === requested) ??
    cases.results[0] ??
    null;
  const messages = selected
    ? await getD1()
        .prepare(
          `SELECT m.id,m.body,m.created_at createdAt,COALESCE(u.name,u.email) author,m.author_user_id authorId FROM case_messages m JOIN users u ON u.id=m.author_user_id WHERE m.case_id=? ORDER BY m.created_at`,
        )
        .bind(selected.id)
        .all<{
          id: string;
          body: string;
          createdAt: string;
          author: string;
          authorId: string;
        }>()
    : { results: [] };
  return (
    <AppShell account={account} activePath="/mensagens">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <MessageCircle /> Comunicação
          </span>
          <h1>Mensagens</h1>
          <p>
            Conversas vinculadas a pedidos e atendimentos, preservadas para
            auditoria.
          </p>
        </div>
      </section>
      <section className="message-layout surface-card">
        <aside>
          {cases.results.length ? (
            cases.results.map((item) => (
              <a
                className={selected?.id === item.id ? 'active' : ''}
                href={`/mensagens?case=${item.id}`}
                key={item.id}
              >
                <span>{item.number.slice(-2)}</span>
                <div>
                  <strong>{item.number}</strong>
                  <small>{item.reason}</small>
                  <p>{item.preview}</p>
                </div>
              </a>
            ))
          ) : (
            <div className="empty-state compact">
              <MessageCircle />
              <strong>Sem conversas</strong>
              <p>Abra um caso em um pedido para iniciar.</p>
            </div>
          )}
        </aside>
        {selected ? (
          <div className="conversation-panel">
            <header>
              <div>
                <strong>{selected.number}</strong>
                <small>
                  {selected.reason} · {selected.status}
                </small>
              </div>
            </header>
            <div className="conversation-messages">
              {messages.results.length ? (
                messages.results.map((message) => (
                  <article
                    className={
                      message.authorId === account.user.id ? 'mine' : ''
                    }
                    key={message.id}
                  >
                    <strong>{message.author}</strong>
                    <p>{message.body}</p>
                    <time>
                      {new Date(message.createdAt).toLocaleString('pt-BR')}
                    </time>
                  </article>
                ))
              ) : (
                <div className="empty-state compact">
                  <MessageCircle />
                  <strong>Conversa iniciada</strong>
                  <p>Envie a primeira mensagem sobre este caso.</p>
                </div>
              )}
            </div>
            <MessageComposer caseId={selected.id} />
          </div>
        ) : (
          <div className="message-placeholder">
            <MessageCircle />
            <h2>Nenhum atendimento selecionado</h2>
            <p>Casos de pós-venda aparecerão aqui.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
