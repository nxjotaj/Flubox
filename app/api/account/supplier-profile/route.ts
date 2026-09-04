import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';

const digits = (length: number) =>
  z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().length(length));
const schema = z.object({
  legalName: z.string().trim().min(2).max(160),
  tradeName: z.string().trim().min(2).max(120),
  cnpj: digits(14),
  stateRegistration: z.string().trim().max(30).optional(),
  responsibleName: z.string().trim().min(3).max(120),
  responsibleCpf: digits(11),
  responsibleEmail: z.email().transform((v) => v.toLowerCase()),
  responsiblePhone: z.string().trim().min(8).max(30),
  postalCode: z.string().trim().min(8).max(10),
  street: z.string().trim().min(3).max(150),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional(),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2),
  publicProfileEnabled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true'),
});

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'supplier')
    return Response.json(
      { error: 'Acesso exclusivo do fornecedor.' },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Revise os dados.' },
      { status: 422 },
    );
  const p = parsed.data;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        'UPDATE organizations SET legal_name=?,display_name=?,updated_at=? WHERE id=?',
      )
      .bind(p.legalName, p.tradeName, now, account.organization.id),
    getD1()
      .prepare(
        `UPDATE supplier_profiles SET cnpj=?,legal_name=?,trade_name=?,state_registration=?,responsible_name=?,responsible_cpf=?,responsible_email=?,responsible_phone=?,public_profile_enabled=?,updated_at=? WHERE organization_id=?`,
      )
      .bind(
        p.cnpj,
        p.legalName,
        p.tradeName,
        p.stateRegistration || null,
        p.responsibleName,
        p.responsibleCpf,
        p.responsibleEmail,
        p.responsiblePhone,
        p.publicProfileEnabled,
        now,
        account.organization.id,
      ),
    getD1()
      .prepare(
        `INSERT INTO addresses (id,organization_id,type,postal_code,street,number,complement,district,city,state,country,created_at,updated_at) VALUES (?,?,'primary',?,?,?,?,?,?,?,'BR',?,?) ON CONFLICT(organization_id,type) DO UPDATE SET postal_code=excluded.postal_code,street=excluded.street,number=excluded.number,complement=excluded.complement,district=excluded.district,city=excluded.city,state=excluded.state,updated_at=excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        account.organization.id,
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
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,created_at) VALUES (?,?,?,'supplier.profile_updated','supplier_profile',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        account.organization.id,
        requestId,
        now,
      ),
  ]);
  return Response.json({ updated: true, requestId });
}
