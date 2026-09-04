import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({
  adminName: z.string().trim().min(3).max(120),
  adminEmail: z.email().transform((v) => v.toLowerCase()),
  platform_admin_phone: z.string().trim().max(30),
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(120),
  platform_cnpj: z.string().trim().max(24),
  platform_support_phone: z.string().trim().max(30),
  platform_support_email: z.union([z.literal(''), z.email()]),
  platform_official_url: z.union([z.literal(''), z.url()]),
  platform_service_agreement: z.string().max(30000),
  platform_privacy_policy: z.string().max(30000),
  reason: z.string().trim().min(5).max(500),
  postalCode: z.string().trim().min(8).max(10),
  street: z.string().trim().min(3).max(150),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2),
});
const profileKeys = [
  'platform_cnpj',
  'platform_support_phone',
  'platform_support_email',
  'platform_official_url',
  'platform_service_agreement',
  'platform_privacy_policy',
  'platform_admin_phone',
] as const;

export async function PUT(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const admin = await requireAccountPermission(user, 'settings.manage');
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Revise os dados.' },
      { status: 422 },
    );
  const p = parsed.data;
  if (p.adminEmail !== admin.user.email) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ email: p.adminEmail });
    if (error)
      return Response.json(
        { error: `Não foi possível trocar o e-mail: ${error.message}` },
        { status: 422 },
      );
  }
  const now = new Date().toISOString();
  const statements = [
    getD1()
      .prepare('UPDATE users SET name=?,email=?,updated_at=? WHERE id=?')
      .bind(p.adminName, p.adminEmail, now, admin.user.id),
    getD1()
      .prepare(
        'UPDATE organizations SET legal_name=?,display_name=?,updated_at=? WHERE id=?',
      )
      .bind(p.legalName, p.displayName, now, admin.organization.id),
    getD1()
      .prepare(
        `INSERT INTO addresses (id,organization_id,type,postal_code,street,number,complement,district,city,state,country,created_at,updated_at) VALUES (?,?,'primary',?,?,?,?,?,?,?,'BR',?,?) ON CONFLICT(organization_id,type) DO UPDATE SET postal_code=excluded.postal_code,street=excluded.street,number=excluded.number,complement=excluded.complement,district=excluded.district,city=excluded.city,state=excluded.state,updated_at=excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        admin.organization.id,
        p.postalCode,
        p.street,
        p.number,
        p.complement || null,
        p.district,
        p.city,
        p.state.toUpperCase(),
        now,
        now,
      ),
  ];
  for (const key of profileKeys)
    statements.push(
      getD1()
        .prepare(
          `INSERT INTO system_settings (key,value,version,updated_by,updated_at) VALUES (?,?,1,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=system_settings.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        )
        .bind(key, p[key], admin.user.id, now),
    );
  statements.push(
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,created_at) VALUES (?,?,?,'platform.profile_updated','organization',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        admin.organization.id,
        admin.organization.id,
        requestId,
        p.reason,
        now,
      ),
  );
  await getD1().batch(statements);
  return Response.json({
    updated: true,
    emailConfirmationRequired: p.adminEmail !== admin.user.email,
    requestId,
  });
}
