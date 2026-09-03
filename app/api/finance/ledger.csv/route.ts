import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
function cell(value: unknown) {
  const raw =
    value == null
      ? ''
      : typeof value === 'string' || typeof value === 'number'
        ? `${value}`
        : JSON.stringify(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const account = await getAccountContext(user);
  if (!account) return new Response('Conta necessária', { status: 403 });
  const result = await getD1()
    .prepare(
      `SELECT created_at,account,direction,amount_cents,currency,status,reference_type,reference_id,external_reference FROM ledger_entries WHERE organization_id=? ORDER BY created_at DESC`,
    )
    .bind(account.organization.id)
    .all<Record<string, unknown>>();
  const columns = [
    'created_at',
    'account',
    'direction',
    'amount_cents',
    'currency',
    'status',
    'reference_type',
    'reference_id',
    'external_reference',
  ];
  const csv = [
    columns.map(cell).join(','),
    ...result.results.map((row) =>
      columns.map((column) => cell(row[column])).join(','),
    ),
  ].join('\r\n');
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="flubox-ledger.csv"',
      'cache-control': 'private, no-store',
    },
  });
}
