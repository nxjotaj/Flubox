import { getD1 } from '@/db';
import { channelLabel, labelFor } from '@/lib/presentation';
import { z } from 'zod';
import { assertAssistantPermission } from './access';
import type {
  AssistantContext,
  AssistantSource,
  AssistantToolResult,
} from './types';

const emptyInput = z.object({});
const periodInput = z.object({
  days: z.number().int().min(1).max(365).default(30),
});

function orderOrganizationColumn(context: AssistantContext) {
  if (context.organizationType === 'supplier')
    return 'supplier_organization_id';
  if (context.organizationType === 'reseller')
    return 'reseller_organization_id';
  return null;
}

async function ordersSummary(context: AssistantContext, days: number) {
  assertAssistantPermission(context, 'orders.view');
  const column = orderOrganizationColumn(context);
  const condition = column ? `${column}=? AND ` : '';
  const values = column ? [context.organizationId, days] : [days];
  const rows = await getD1()
    .prepare(
      `SELECT status,COUNT(*) total,COALESCE(SUM(total_cents),0) value FROM orders WHERE ${condition}created_at::timestamptz >= NOW() - (? * INTERVAL '1 day') GROUP BY status ORDER BY total DESC`,
    )
    .bind(...values)
    .all<{ status: string; total: number; value: number }>();
  return {
    period: `${days} dias`,
    statuses: rows.results.map((row) => ({
      situation: labelFor(row.status),
      orders: Number(row.total),
      value: Number(row.value) / 100,
    })),
  };
}

async function orderDetails(context: AssistantContext, orderNumber: string) {
  assertAssistantPermission(context, 'orders.view');
  const column = orderOrganizationColumn(context);
  const condition = column ? `AND o.${column}=?` : '';
  const values = column ? [orderNumber, context.organizationId] : [orderNumber];
  const order = await getD1()
    .prepare(
      `SELECT o.id,o.number,o.status,o.channel,o.total_cents totalCents,o.created_at createdAt FROM orders o WHERE o.number=? ${condition} LIMIT 1`,
    )
    .bind(...values)
    .first<{
      id: string;
      number: string;
      status: string;
      channel: string;
      totalCents: number;
      createdAt: string;
    }>();
  if (!order) return { found: false };
  const items = await getD1()
    .prepare(
      `SELECT json_extract(product_snapshot,'$.title') title,quantity,unit_price_cents unitPriceCents FROM order_items WHERE order_id=?`,
    )
    .bind(order.id)
    .all<{ title: string; quantity: number; unitPriceCents: number }>();
  return {
    found: true,
    number: order.number,
    situation: labelFor(order.status),
    channel: channelLabel(order.channel),
    total: Number(order.totalCents) / 100,
    createdAt: order.createdAt,
    items: items.results.map((item) => ({
      product: item.title,
      quantity: item.quantity,
      unitPrice: Number(item.unitPriceCents) / 100,
    })),
  };
}

async function productPerformance(context: AssistantContext, days: number) {
  assertAssistantPermission(context, 'orders.view');
  const column = orderOrganizationColumn(context);
  const condition = column ? `o.${column}=? AND ` : '';
  const values = column ? [context.organizationId, days] : [days];
  const rows = await getD1()
    .prepare(
      `SELECT MAX(json_extract(i.product_snapshot,'$.title')) title,SUM(i.quantity) units,COALESCE(SUM(i.subtotal_cents),0) value FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${condition}o.created_at::timestamptz >= NOW() - (? * INTERVAL '1 day') GROUP BY i.product_id ORDER BY units DESC LIMIT 10`,
    )
    .bind(...values)
    .all<{ title: string; units: number; value: number }>();
  return rows.results.map((row) => ({
    product: row.title,
    units: Number(row.units),
    value: Number(row.value) / 100,
  }));
}

async function inventorySummary(context: AssistantContext) {
  assertAssistantPermission(context, 'products.view');
  if (context.organizationType === 'reseller') {
    const rows = await getD1()
      .prepare(
        `SELECT COUNT(*) total,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active FROM sales_channel_listings WHERE organization_id=?`,
      )
      .bind(context.organizationId)
      .first<{ total: number; active: number }>();
    return {
      linkedListings: Number(rows?.total ?? 0),
      activeListings: Number(rows?.active ?? 0),
      note: 'O estoque físico pertence aos fornecedores; o revendedor acompanha anúncios vinculados.',
    };
  }
  const condition =
    context.organizationType === 'platform' ? '' : 'WHERE p.organization_id=?';
  const values =
    context.organizationType === 'platform' ? [] : [context.organizationId];
  const row = await getD1()
    .prepare(
      `SELECT COUNT(DISTINCT p.id) products,COALESCE(SUM(v.stock),0) units,COUNT(*) FILTER (WHERE v.stock<=5) low_stock FROM products p LEFT JOIN product_variants v ON v.product_id=p.id ${condition}`,
    )
    .bind(...values)
    .first<{ products: number; units: number; lowStock: number }>();
  return {
    products: Number(row?.products ?? 0),
    units: Number(row?.units ?? 0),
    lowStockVariants: Number(row?.lowStock ?? 0),
  };
}

async function financialSummary(context: AssistantContext, days: number) {
  assertAssistantPermission(context, 'payments.view');
  const row = await getD1()
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE 0 END),0) credits,COALESCE(SUM(CASE WHEN direction='debit' THEN amount_cents ELSE 0 END),0) debits,COUNT(*) entries FROM ledger_entries WHERE organization_id=? AND created_at::timestamptz >= NOW() - (? * INTERVAL '1 day')`,
    )
    .bind(context.organizationId, days)
    .first<{ credits: number; debits: number; entries: number }>();
  return {
    period: `${days} dias`,
    credits: Number(row?.credits ?? 0) / 100,
    debits: Number(row?.debits ?? 0) / 100,
    balance: (Number(row?.credits ?? 0) - Number(row?.debits ?? 0)) / 100,
    entries: Number(row?.entries ?? 0),
  };
}

async function integrations(context: AssistantContext) {
  if (
    context.organizationType !== 'reseller' &&
    context.organizationType !== 'platform'
  )
    return {
      note: 'Integrações de marketplace são administradas pelos revendedores.',
    };
  assertAssistantPermission(context, 'integrations.manage');
  const where =
    context.organizationType === 'platform' ? '' : 'WHERE organization_id=?';
  const values =
    context.organizationType === 'platform' ? [] : [context.organizationId];
  const rows = await getD1()
    .prepare(
      `SELECT provider,status,display_name displayName,last_synced_at lastSyncedAt,last_error lastError FROM sales_channel_connections ${where} ORDER BY updated_at DESC LIMIT 20`,
    )
    .bind(...values)
    .all<{
      provider: string;
      status: string;
      displayName: string;
      lastSyncedAt: string | null;
      lastError: string | null;
    }>();
  return rows.results.map((row) => ({
    channel: channelLabel(row.provider),
    account: row.displayName,
    situation: labelFor(row.status),
    lastSynchronization: row.lastSyncedAt,
    issue: row.lastError ? 'Há uma pendência técnica registrada.' : null,
  }));
}

async function support(context: AssistantContext) {
  assertAssistantPermission(context, 'orders.view');
  const orgFilter =
    context.organizationType === 'platform'
      ? ''
      : `AND (c.opened_by_organization_id=? OR o.supplier_organization_id=? OR o.reseller_organization_id=?)`;
  const values =
    context.organizationType === 'platform'
      ? []
      : [
          context.organizationId,
          context.organizationId,
          context.organizationId,
        ];
  const rows = await getD1()
    .prepare(
      `SELECT c.type,c.reason,c.status,o.number FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE c.status NOT IN ('closed','resolved') ${orgFilter} ORDER BY c.updated_at DESC LIMIT 20`,
    )
    .bind(...values)
    .all<{ type: string; reason: string; status: string; number: string }>();
  return rows.results.map((row) => ({
    order: row.number,
    type: labelFor(row.type),
    reason: row.reason,
    situation: labelFor(row.status),
  }));
}

async function accountSummary(context: AssistantContext) {
  const row = await getD1()
    .prepare(
      'SELECT display_name displayName,status,type FROM organizations WHERE id=?',
    )
    .bind(context.organizationId)
    .first<{ displayName: string; status: string; type: string }>();
  return {
    organization: row?.displayName,
    type: labelFor(row?.type),
    situation: labelFor(row?.status),
    role: labelFor(context.role),
  };
}

async function searchHelp(query: string) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 4);
  if (!words.length) return [];
  const conditions = words
    .map(() => '(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)')
    .join(' OR ');
  const values = words.flatMap((word) => [`%${word}%`, `%${word}%`]);
  const rows = await getD1()
    .prepare(
      `SELECT title,category,LEFT(content,1200) content FROM assistant_knowledge_documents WHERE active=true AND (${conditions}) LIMIT 5`,
    )
    .bind(...values)
    .all<{ title: string; category: string; content: string }>();
  return rows.results;
}

export async function collectOperationalContext(
  prompt: string,
  context: AssistantContext,
): Promise<AssistantToolResult[]> {
  const normalized = prompt.toLowerCase();
  const results: AssistantToolResult[] = [];
  const add = (tool: string, data: unknown, sources: AssistantSource[]) =>
    results.push({ tool, data, sources });

  add('get_account_summary', await accountSummary(context), [
    { type: 'relatorio', label: 'Conta e organização' },
  ]);
  if (/pedido|venda|atras|fatur|relat[oó]rio|desempenho/.test(normalized))
    add(
      'get_orders_summary',
      await ordersSummary(context, periodInput.parse({ days: 30 }).days),
      [
        {
          type: 'relatorio',
          label: 'Pedidos dos últimos 30 dias',
          href: '/pedidos',
        },
      ],
    );
  const orderNumber = prompt.match(/FLB-[A-Z0-9-]+/i)?.[0];
  if (orderNumber)
    add('get_order_details', await orderDetails(context, orderNumber), [
      {
        type: 'pedido',
        label: `Pedido ${orderNumber.toUpperCase()}`,
        href: '/pedidos',
      },
    ]);
  if (/produto|mais vend|desempenho|relat[oó]rio/.test(normalized))
    add('get_product_performance', await productPerformance(context, 30), [
      {
        type: 'relatorio',
        label: 'Desempenho de produtos nos últimos 30 dias',
        href: '/relatorios',
      },
    ]);
  if (/estoque|produto|variante|sem saldo|baixo/.test(normalized))
    add('get_inventory_summary', await inventorySummary(context), [
      {
        type: 'estoque',
        label: 'Posição atual de estoque',
        href:
          context.organizationType === 'reseller' ? '/integracoes' : '/estoque',
      },
    ]);
  if (
    /finance|fatur|receb|pagamento|saldo|margem|cr[eé]dito/.test(normalized) &&
    context.permissions.includes('payments.view')
  )
    add('get_financial_summary', await financialSummary(context, 30), [
      {
        type: 'relatorio',
        label: 'Financeiro dos últimos 30 dias',
        href: '/financeiro',
      },
    ]);
  if (/mercado livre|shopee|integra|an[uú]ncio|canal/.test(normalized))
    add('get_marketplace_integration_status', await integrations(context), [
      {
        type: 'integracao',
        label: 'Situação das integrações',
        href: '/integracoes',
      },
    ]);
  if (/caso|suporte|disputa|reclama|devolu|p[oó]s-venda/.test(normalized))
    add('get_support_cases', await support(context), [
      { type: 'suporte', label: 'Casos em andamento', href: '/casos' },
    ]);
  const help = await searchHelp(prompt);
  if (help.length)
    add(
      'search_help',
      help,
      help.map((item) => ({ type: 'ajuda' as const, label: item.title })),
    );
  if (/relat[oó]rio|resumo|vis[aã]o geral/.test(normalized))
    add(
      'generate_operational_report',
      {
        generatedAt: new Date().toISOString(),
        period: '30 dias',
        sectionsIncluded: results.map((result) => result.tool),
        note: 'Todos os valores foram calculados pelo backend do Flubox.',
      },
      [
        {
          type: 'relatorio',
          label: 'Relatório operacional consolidado',
          href: '/relatorios',
        },
      ],
    );
  return results;
}

export const assistantToolSchemas = {
  get_account_summary: emptyInput,
  get_orders_summary: periodInput,
  get_order_details: z.object({ orderNumber: z.string().min(1).max(40) }),
  get_inventory_summary: emptyInput,
  get_product_performance: periodInput,
  get_financial_summary: periodInput,
  get_marketplace_integration_status: emptyInput,
  get_support_cases: emptyInput,
  generate_operational_report: periodInput,
};
