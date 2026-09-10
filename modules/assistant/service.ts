import { getD1 } from '@/db';
import type { AccountContext } from '@/modules/identity/service';
import { consumeRateLimit } from '@/lib/rate-limit';
import { buildAssistantContext } from './access';
import { getAssistantProvider } from './provider';
import { safeUserPrompt, sanitizeForAssistant, systemPrompt } from './security';
import { collectOperationalContext } from './tools';
import type { AssistantSource } from './types';
import { labelFor } from '@/lib/presentation';

async function assistantLimits() {
  const rows = await getD1()
    .prepare(
      `SELECT key,value FROM system_settings WHERE key IN ('assistant_daily_user_limit','assistant_daily_organization_limit')`,
    )
    .all<{ key: string; value: string }>();
  const values = new Map(
    rows.results.map((row) => [row.key, Number(row.value)]),
  );
  return {
    user:
      values.get('assistant_daily_user_limit') ||
      Number(process.env.ASSISTANT_DAILY_USER_LIMIT ?? 20),
    organization:
      values.get('assistant_daily_organization_limit') ||
      Number(process.env.ASSISTANT_DAILY_ORGANIZATION_LIMIT ?? 200),
  };
}

export function assistantConfigured() {
  return (
    process.env.ASSISTANT_ENABLED === 'true' &&
    Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) &&
    Boolean(process.env.CLOUDFLARE_AI_API_TOKEN)
  );
}

export async function assertAssistantEnabled(account: AccountContext) {
  if (process.env.ASSISTANT_ENABLED !== 'true')
    throw new Error('ASSISTANT_DISABLED');
  const setting = await getD1()
    .prepare(
      'SELECT enabled FROM assistant_organization_settings WHERE organization_id=?',
    )
    .bind(account.organization.id)
    .first<{ enabled: boolean }>();
  if (setting && !setting.enabled) throw new Error('ASSISTANT_DISABLED');
}

export async function consumeAssistantQuota(account: AccountContext) {
  const limits = await assistantLimits();
  const date = new Date().toISOString().slice(0, 10);
  const [userRate, organizationRate] = await Promise.all([
    consumeRateLimit(`assistant:user:${account.user.id}`, limits.user, 86400),
    consumeRateLimit(
      `assistant:organization:${account.organization.id}`,
      limits.organization,
      86400,
    ),
  ]);
  if (!userRate.allowed || !organizationRate.allowed)
    throw new Error('ASSISTANT_QUOTA');
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      `INSERT INTO assistant_usage (organization_id,user_id,usage_date,message_count,input_tokens,output_tokens,updated_at) VALUES (?,?,?,1,0,0,?) ON CONFLICT(organization_id,user_id,usage_date) DO UPDATE SET message_count=assistant_usage.message_count+1,updated_at=excluded.updated_at`,
    )
    .bind(account.organization.id, account.user.id, date, now)
    .run();
  return {
    remaining: Math.min(userRate.remaining, organizationRate.remaining),
  };
}

export async function listConversations(account: AccountContext) {
  return getD1()
    .prepare(
      `SELECT id,title,status,created_at createdAt,updated_at updatedAt FROM assistant_conversations WHERE organization_id=? AND user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50`,
    )
    .bind(account.organization.id, account.user.id)
    .all<{
      id: string;
      title: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>();
}

export async function createConversation(
  account: AccountContext,
  title?: string,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      `INSERT INTO assistant_conversations (id,organization_id,user_id,title,status,created_at,updated_at) VALUES (?,?,?,?,'active',?,?)`,
    )
    .bind(
      id,
      account.organization.id,
      account.user.id,
      title?.slice(0, 80) || 'Nova conversa',
      now,
      now,
    )
    .run();
  return {
    id,
    title: title?.slice(0, 80) || 'Nova conversa',
    createdAt: now,
    updatedAt: now,
  };
}

export async function requireOwnedConversation(
  account: AccountContext,
  id: string,
) {
  const conversation = await getD1()
    .prepare(
      `SELECT id,title,status FROM assistant_conversations WHERE id=? AND organization_id=? AND user_id=? AND deleted_at IS NULL`,
    )
    .bind(id, account.organization.id, account.user.id)
    .first<{ id: string; title: string; status: string }>();
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND');
  return conversation;
}

export async function getConversation(account: AccountContext, id: string) {
  const conversation = await requireOwnedConversation(account, id);
  const messages = await getD1()
    .prepare(
      `SELECT id,role,content,sources_json sourcesJson,feedback,created_at createdAt FROM assistant_messages WHERE conversation_id=? AND organization_id=? ORDER BY created_at`,
    )
    .bind(id, account.organization.id)
    .all<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      sourcesJson: string;
      feedback: string | null;
      createdAt: string;
    }>();
  return {
    ...conversation,
    messages: messages.results.map((message) => ({
      ...message,
      sources: JSON.parse(message.sourcesJson) as AssistantSource[],
      sourcesJson: undefined,
    })),
  };
}

export async function renameConversation(
  account: AccountContext,
  id: string,
  title: string,
) {
  await requireOwnedConversation(account, id);
  await getD1()
    .prepare(
      'UPDATE assistant_conversations SET title=?,updated_at=? WHERE id=?',
    )
    .bind(title.slice(0, 80), new Date().toISOString(), id)
    .run();
}

export async function deleteConversation(account: AccountContext, id: string) {
  await requireOwnedConversation(account, id);
  await getD1()
    .prepare(
      "UPDATE assistant_conversations SET deleted_at=?,status='archived' WHERE id=?",
    )
    .bind(new Date().toISOString(), id)
    .run();
}

export async function prepareAssistantStream(
  account: AccountContext,
  conversationId: string,
  rawPrompt: string,
) {
  await assertAssistantEnabled(account);
  await requireOwnedConversation(account, conversationId);
  const quota = await consumeAssistantQuota(account);
  const prompt = safeUserPrompt(rawPrompt);
  if (!prompt) throw new Error('EMPTY_PROMPT');
  const context = await buildAssistantContext(account, conversationId);
  const previous = await getD1()
    .prepare(
      `SELECT role,content FROM assistant_messages WHERE conversation_id=? AND organization_id=? ORDER BY created_at DESC LIMIT 10`,
    )
    .bind(conversationId, account.organization.id)
    .all<{ role: 'user' | 'assistant'; content: string }>();
  const toolResults = await collectOperationalContext(prompt, context);
  const sources = toolResults.flatMap((result) => result.sources);
  const now = new Date().toISOString();
  const userMessageId = crypto.randomUUID();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO assistant_messages (id,conversation_id,organization_id,user_id,role,content,sources_json,created_at) VALUES (?,?,?,?,'user',?,'[]',?)`,
      )
      .bind(
        userMessageId,
        conversationId,
        account.organization.id,
        account.user.id,
        prompt,
        now,
      ),
    getD1()
      .prepare(
        `UPDATE assistant_conversations SET title=CASE WHEN title='Nova conversa' THEN ? ELSE title END,updated_at=? WHERE id=?`,
      )
      .bind(prompt.slice(0, 60), now, conversationId),
  ]);
  const provider = getAssistantProvider();
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  await getD1()
    .prepare(
      `INSERT INTO assistant_runs (id,conversation_id,organization_id,user_id,provider,model,status,tools_json,created_at) VALUES (?,?,?,?,?,?,'running',?,?)`,
    )
    .bind(
      runId,
      conversationId,
      account.organization.id,
      account.user.id,
      provider.name,
      provider.model,
      JSON.stringify(toolResults.map((result) => result.tool)),
      now,
    )
    .run();
  try {
    const stream = await provider.stream({
      system: systemPrompt(labelFor(account.role)),
      messages: [
        ...previous.results.reverse(),
        { role: 'user', content: prompt },
      ],
      operationalContext: sanitizeForAssistant(
        toolResults.map(({ tool, data }) => ({ tool, data })),
      ),
    });
    return { stream, sources, runId, startedAt, quota };
  } catch (error) {
    await failAssistantRun(
      runId,
      startedAt,
      error instanceof Error ? error.name : 'PROVIDER_ERROR',
    );
    throw error;
  }
}

export async function completeAssistantRun(input: {
  account: AccountContext;
  conversationId: string;
  runId: string;
  startedAt: number;
  content: string;
  sources: AssistantSource[];
}) {
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO assistant_messages (id,conversation_id,organization_id,role,content,sources_json,created_at) VALUES (?,?,?,'assistant',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        input.conversationId,
        input.account.organization.id,
        input.content,
        JSON.stringify(input.sources),
        now,
      ),
    getD1()
      .prepare(
        `UPDATE assistant_runs SET status='completed',duration_ms=? WHERE id=?`,
      )
      .bind(Date.now() - input.startedAt, input.runId),
    getD1()
      .prepare('UPDATE assistant_conversations SET updated_at=? WHERE id=?')
      .bind(now, input.conversationId),
  ]);
}

export async function failAssistantRun(
  runId: string,
  startedAt: number,
  code: string,
) {
  await getD1()
    .prepare(
      `UPDATE assistant_runs SET status='failed',duration_ms=?,error_code=? WHERE id=?`,
    )
    .bind(Date.now() - startedAt, code.slice(0, 80), runId)
    .run();
}

export async function listSuggestions(account: AccountContext) {
  await refreshSuggestions(account);
  const rows = await getD1()
    .prepare(
      `SELECT id,category,priority,title,explanation,recommendation,source_reference sourceReference,action_href actionHref,expires_at expiresAt FROM assistant_suggestions WHERE organization_id=? AND (user_id IS NULL OR user_id=?) AND dismissed_at IS NULL AND expires_at>? ORDER BY CASE priority WHEN 'critica' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END,created_at DESC LIMIT 20`,
    )
    .bind(account.organization.id, account.user.id, new Date().toISOString())
    .all();
  return rows.results;
}

async function refreshSuggestions(account: AccountContext) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const suggestions: Array<{
    category: string;
    priority: string;
    title: string;
    explanation: string;
    recommendation: string;
    source: string;
    href: string;
  }> = [];
  if (account.organization.type === 'supplier') {
    const inventory = await getD1()
      .prepare(
        `SELECT COUNT(*) total FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.organization_id=? AND v.status='active' AND v.stock<=5`,
      )
      .bind(account.organization.id)
      .first<{ total: number }>();
    if (Number(inventory?.total ?? 0) > 0)
      suggestions.push({
        category: 'estoque',
        priority: 'atencao',
        title: 'Estoque baixo precisa de atenção',
        explanation: `${inventory?.total} variante(s) possuem cinco unidades ou menos.`,
        recommendation:
          'Revise o saldo e planeje a reposição para evitar indisponibilidade.',
        source: `inventory-low:${new Date().toISOString().slice(0, 10)}`,
        href: '/estoque',
      });
  }
  if (account.organization.type === 'reseller') {
    const integrations = await getD1()
      .prepare(
        `SELECT COUNT(*) total FROM sales_channel_connections WHERE organization_id=? AND status IN ('error','expired','revoked')`,
      )
      .bind(account.organization.id)
      .first<{ total: number }>();
    if (Number(integrations?.total ?? 0) > 0)
      suggestions.push({
        category: 'integracao',
        priority: 'critica',
        title: 'Integração de vendas com pendência',
        explanation: `${integrations?.total} conexão(ões) não estão operando normalmente.`,
        recommendation:
          'Abra Integrações, revise o motivo e reconecte a conta quando necessário.',
        source: `integration-issue:${new Date().toISOString().slice(0, 10)}`,
        href: '/integracoes',
      });
  }
  const orderColumn =
    account.organization.type === 'supplier'
      ? 'supplier_organization_id'
      : account.organization.type === 'reseller'
        ? 'reseller_organization_id'
        : null;
  if (orderColumn) {
    const stalled = await getD1()
      .prepare(
        `SELECT COUNT(*) total FROM orders WHERE ${orderColumn}=? AND status NOT IN ('delivered','completed','cancelled','refunded') AND updated_at::timestamptz < NOW() - INTERVAL '48 hours'`,
      )
      .bind(account.organization.id)
      .first<{ total: number }>();
    if (Number(stalled?.total ?? 0) > 0)
      suggestions.push({
        category: 'pedido',
        priority: 'atencao',
        title: 'Pedidos sem atualização recente',
        explanation: `${stalled?.total} pedido(s) estão há mais de 48 horas sem atualização.`,
        recommendation:
          'Confira os pedidos e identifique documentação, pagamento ou expedição pendente.',
        source: `orders-stalled:${new Date().toISOString().slice(0, 10)}`,
        href: '/pedidos',
      });
  }
  for (const suggestion of suggestions) {
    const existing = await getD1()
      .prepare(
        `SELECT id FROM assistant_suggestions WHERE organization_id=? AND source_reference=? AND dismissed_at IS NULL AND expires_at>?`,
      )
      .bind(account.organization.id, suggestion.source, now.toISOString())
      .first<{ id: string }>();
    if (existing) continue;
    await getD1()
      .prepare(
        `INSERT INTO assistant_suggestions (id,organization_id,category,priority,title,explanation,recommendation,source_reference,action_href,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.organization.id,
        suggestion.category,
        suggestion.priority,
        suggestion.title,
        suggestion.explanation,
        suggestion.recommendation,
        suggestion.source,
        suggestion.href,
        expiresAt,
        now.toISOString(),
      )
      .run();
  }
}

export async function dismissSuggestion(account: AccountContext, id: string) {
  await getD1()
    .prepare(
      `UPDATE assistant_suggestions SET dismissed_at=? WHERE id=? AND organization_id=? AND (user_id IS NULL OR user_id=?)`,
    )
    .bind(
      new Date().toISOString(),
      id,
      account.organization.id,
      account.user.id,
    )
    .run();
}

export async function assistantUsageSummary(account: AccountContext) {
  const limits = await assistantLimits();
  const date = new Date().toISOString().slice(0, 10);
  const user = await getD1()
    .prepare(
      'SELECT message_count messageCount FROM assistant_usage WHERE organization_id=? AND user_id=? AND usage_date=?',
    )
    .bind(account.organization.id, account.user.id, date)
    .first<{ messageCount: number }>();
  return {
    configured: assistantConfigured(),
    enabled: process.env.ASSISTANT_ENABLED === 'true',
    used: Number(user?.messageCount ?? 0),
    limit: limits.user,
  };
}

export async function assistantAdminMetrics() {
  const date = new Date().toISOString().slice(0, 10);
  const [usage, runs, feedback, limits] = await Promise.all([
    getD1()
      .prepare(
        `SELECT COALESCE(SUM(message_count),0) messages,COUNT(DISTINCT user_id) users,COUNT(DISTINCT organization_id) organizations FROM assistant_usage WHERE usage_date=?`,
      )
      .bind(date)
      .first<{ messages: number; users: number; organizations: number }>(),
    getD1()
      .prepare(
        `SELECT COUNT(*) total,COUNT(*) FILTER (WHERE status='failed') failed,COALESCE(AVG(duration_ms) FILTER (WHERE status='completed'),0) average FROM assistant_runs WHERE created_at::timestamptz >= NOW() - INTERVAL '24 hours'`,
      )
      .first<{ total: number; failed: number; average: number }>(),
    getD1()
      .prepare(
        `SELECT COUNT(*) FILTER (WHERE feedback='helpful') helpful,COUNT(*) FILTER (WHERE feedback='unhelpful') unhelpful FROM assistant_messages WHERE created_at::timestamptz >= NOW() - INTERVAL '30 days'`,
      )
      .first<{ helpful: number; unhelpful: number }>(),
    assistantLimits(),
  ]);
  const incidents = await getD1()
    .prepare(
      `SELECT provider,model,status,error_code errorCode,duration_ms durationMs,created_at createdAt FROM assistant_runs WHERE status='failed' ORDER BY created_at DESC LIMIT 20`,
    )
    .all<{
      provider: string;
      model: string;
      status: string;
      errorCode: string | null;
      durationMs: number;
      createdAt: string;
    }>();
  return {
    usage,
    runs,
    feedback,
    limits,
    incidents: incidents.results,
    configured: assistantConfigured(),
  };
}
