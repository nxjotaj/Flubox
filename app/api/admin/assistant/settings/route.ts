import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { assistantErrorResponse } from '@/modules/assistant/http';
import { z } from 'zod';

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
    const account = await requireAccountPermission(user, 'assistant.manage');
    const input = z
      .object({
        userLimit: z.coerce.number().int().min(1).max(500),
        organizationLimit: z.coerce.number().int().min(1).max(5000),
      })
      .parse(await request.json());
    const now = new Date().toISOString();
    const requestId = requestIdFrom(request);
    await getD1().batch([
      getD1()
        .prepare(
          `INSERT INTO system_settings (key,value,version,updated_by,updated_at) VALUES ('assistant_daily_user_limit',?,1,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=system_settings.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        )
        .bind(String(input.userLimit), account.user.id, now),
      getD1()
        .prepare(
          `INSERT INTO system_settings (key,value,version,updated_by,updated_at) VALUES ('assistant_daily_organization_limit',?,1,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=system_settings.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        )
        .bind(String(input.organizationLimit), account.user.id, now),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'assistant.settings_updated','assistant','limits',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          requestId,
          JSON.stringify(input),
          now,
        ),
    ]);
    return Response.json({ success: true });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
