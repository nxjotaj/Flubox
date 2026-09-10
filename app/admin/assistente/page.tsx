import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { labelFor } from '@/lib/presentation';
import { assistantAdminMetrics } from '@/modules/assistant/service';
import {
  getAccountContext,
  requireAccountPermission,
} from '@/modules/identity/service';
import { Activity, Bot, CircleAlert, Gauge, Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AssistantAdminForm } from './assistant-admin-form';

export const dynamic = 'force-dynamic';

export default async function AssistantAdminPage() {
  const user = await requireAuthenticatedUser('/admin/assistente');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  await requireAccountPermission(user, 'assistant.manage');
  const metrics = await assistantAdminMetrics();
  return (
    <AppShell account={account} activePath="/admin/assistente">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <Bot /> Governança da inteligência artificial
          </span>
          <h1>Administração do Assistente Flubox</h1>
          <p>
            Acompanhe consumo, disponibilidade e falhas sem acessar o conteúdo
            particular das conversas.
          </p>
        </div>
        <div
          className={`assistant-availability ${metrics.configured ? 'available' : 'waiting'}`}
        >
          <i />
          <div>
            <strong>
              {metrics.configured
                ? 'Llama configurado'
                : 'Credenciais pendentes'}
            </strong>
            <small>
              {metrics.configured
                ? 'Cloudflare Workers AI'
                : 'Nenhuma resposta será cobrada ou enviada'}
            </small>
          </div>
        </div>
      </section>
      <div className="finance-summary">
        <article>
          <Activity />
          <small>Mensagens hoje</small>
          <strong>{Number(metrics.usage?.messages ?? 0)}</strong>
        </article>
        <article>
          <Users />
          <small>Usuários hoje</small>
          <strong>{Number(metrics.usage?.users ?? 0)}</strong>
        </article>
        <article>
          <Gauge />
          <small>Tempo médio</small>
          <strong>{Math.round(Number(metrics.runs?.average ?? 0))} ms</strong>
        </article>
        <article>
          <CircleAlert />
          <small>Falhas em 24 horas</small>
          <strong>{Number(metrics.runs?.failed ?? 0)}</strong>
        </article>
      </div>
      <div className="order-detail-grid assistant-admin-grid">
        <section>
          <h2>Limites do piloto gratuito</h2>
          <p>
            Ao atingir o limite, o assistente para de responder. Não existe
            fallback pago automático.
          </p>
          <AssistantAdminForm
            userLimit={metrics.limits.user}
            organizationLimit={metrics.limits.organization}
          />
        </section>
        <section>
          <h2>Privacidade</h2>
          <p>
            Esta área mostra somente métricas, avaliações agregadas e códigos de
            falha. O conteúdo das conversas permanece privado para cada usuário.
          </p>
          <div className="assistant-feedback-summary">
            <strong>{Number(metrics.feedback?.helpful ?? 0)}</strong>
            <span>respostas úteis</span>
            <strong>{Number(metrics.feedback?.unhelpful ?? 0)}</strong>
            <span>respostas não úteis</span>
          </div>
        </section>
      </div>
      <section className="surface-card assistant-incidents">
        <h2>Ocorrências recentes</h2>
        {metrics.incidents.length === 0 ? (
          <p>Nenhuma falha registrada.</p>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Situação</th>
                  <th>Provedor</th>
                  <th>Modelo</th>
                  <th>Motivo técnico</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {metrics.incidents.map((incident, index) => (
                  <tr key={`${incident.createdAt}-${index}`}>
                    <td>{labelFor(incident.status)}</td>
                    <td>Cloudflare</td>
                    <td>{incident.model}</td>
                    <td>{incident.errorCode ?? 'Falha não classificada'}</td>
                    <td>
                      {new Date(incident.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
