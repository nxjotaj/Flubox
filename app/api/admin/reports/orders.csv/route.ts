import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requireAccountPermission } from '@/modules/identity/service';

const cell = (value: unknown) => {
  const rendered=value==null?'':['string','number','boolean','bigint'].includes(typeof value)?`${value as string|number|boolean|bigint}`:JSON.stringify(value);
  return `"${rendered.replaceAll('"', '""')}"`;
};
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return new Response('Faça login.', { status: 401 });
  const account = await requireAccountPermission(user, 'orders.view');
  if (account.organization.type !== 'platform')
    return new Response('Acesso negado.', { status: 403 });
  const result = await getD1()
    .prepare(
      `SELECT o.number,o.status,o.channel,s.display_name supplier,r.display_name reseller,o.subtotal_cents,o.commission_cents,o.total_cents,o.created_at FROM orders o JOIN organizations s ON s.id=o.supplier_organization_id JOIN organizations r ON r.id=o.reseller_organization_id ORDER BY o.created_at DESC`,
    )
    .all<Record<string, unknown>>();
  const headers = [
    'number',
    'status',
    'channel',
    'supplier',
    'reseller',
    'subtotal_cents',
    'commission_cents',
    'total_cents',
    'created_at',
  ];
  const csv = [
    '\uFEFF' + headers.map(cell).join(';'),
    ...result.results.map((row) =>
      headers.map((key) => cell(row[key])).join(';'),
    ),
  ].join('\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition':
        'attachment; filename="flubox-pedidos-completo.csv"',
    },
  });
}
