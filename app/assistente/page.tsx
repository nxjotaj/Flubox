import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { AssistantChat } from '@/components/assistant-chat';
import {
  getAccountContext,
  requireAccountPermission,
} from '@/modules/identity/service';
import {
  assistantUsageSummary,
  listSuggestions,
} from '@/modules/assistant/service';
import { Bot, Gauge, LockKeyhole, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';
import { SuggestionList, type SuggestionView } from './suggestion-list';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const user = await requireAuthenticatedUser('/assistente');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  await requireAccountPermission(user, 'assistant.use');
  const [usage, suggestions] = await Promise.all([
    assistantUsageSummary(account),
    listSuggestions(account),
  ]);
  const profile =
    account.organization.type === 'supplier'
      ? 'fornecedor'
      : account.organization.type === 'reseller'
        ? 'revendedor'
        : 'administrador';
  return (
    <AppShell account={account} activePath="/assistente">
      <section className="page-heading assistant-page-heading">
        <div>
          <span className="page-kicker">
            <Sparkles /> Inteligência operacional com privacidade
          </span>
          <h1>Assistente Flubox</h1>
          <p>
            Um assistente preparado para sua operação de {profile}, limitado aos
            seus dados e às suas permissões.
          </p>
        </div>
        <div
          className={`assistant-availability ${usage.configured ? 'available' : 'waiting'}`}
        >
          <i />
          <div>
            <strong>
              {usage.configured
                ? 'Disponível para conversar'
                : 'Aguardando ativação'}
            </strong>
            <small>
              {usage.configured
                ? `${usage.limit - usage.used} mensagens disponíveis hoje`
                : 'Configure o provedor para iniciar o piloto'}
            </small>
          </div>
        </div>
      </section>
      <div className="assistant-overview">
        <article>
          <Bot />
          <div>
            <strong>Somente consulta</strong>
            <span>
              O assistente não altera pedidos, estoque, pagamentos ou cadastros.
            </span>
          </div>
        </article>
        <article>
          <LockKeyhole />
          <div>
            <strong>Dados isolados</strong>
            <span>
              Cada resposta respeita seu usuário, organização e permissões.
            </span>
          </div>
        </article>
        <article>
          <Gauge />
          <div>
            <strong>Uso gratuito controlado</strong>
            <span>
              {usage.used} de {usage.limit} mensagens usadas hoje.
            </span>
          </div>
        </article>
      </div>
      <SuggestionList initialSuggestions={suggestions as SuggestionView[]} />
      <AssistantChat configured={usage.configured} />
    </AppShell>
  );
}
