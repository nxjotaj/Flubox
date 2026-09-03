import { z } from 'zod';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';

const keys = [
  'commission_basis_points',
  'supplier_monthly_fee_cents',
  'subscription_grace_days',
  'pix_expiration_minutes',
  'dispute_window_days',
  'max_upload_megabytes',
] as const;
const schema = z.object({
  values: z.record(z.enum(keys), z.string().regex(/^\d+$/)),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const admin = await requireAccountPermission(user, 'settings.manage');
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Revise os valores e informe uma justificativa.' },
      { status: 422 },
    );
  const now = new Date().toISOString();
  const statements = [];
  for (const [key, value] of Object.entries(parsed.data.values)) {
    statements.push(
      getD1()
        .prepare(
          `INSERT INTO system_settings (key,value,version,updated_by,updated_at) VALUES (?,?,1,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=system_settings.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        )
        .bind(key, value, admin.user.id, now),
    );
  }
  statements.push(
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'settings.updated','system_settings','platform',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        admin.organization.id,
        requestId,
        parsed.data.reason,
        JSON.stringify(parsed.data.values),
        now,
      ),
  );
  await getD1().batch(statements);
  return Response.json({
    saved: Object.keys(parsed.data.values).length,
    requestId,
  });
}
