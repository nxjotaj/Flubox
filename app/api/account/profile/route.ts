import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.email().transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(8).max(30),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().length(11)),
  postalCode: z.string().trim().min(8).max(10),
  street: z.string().trim().min(3).max(150),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional(),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2),
  bankName: z.string().trim().max(100).optional(),
  bankBranch: z.string().trim().max(20).optional(),
  bankAccount: z.string().trim().max(30).optional(),
  bankAccountType: z.enum(['checking', 'savings', 'payment']).optional(),
  pixKey: z.string().trim().max(140).optional(),
});
export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request);
  const auth = await getAuthenticatedUser();
  if (!auth)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(auth);
  if (!account || account.organization.type !== 'reseller')
    return Response.json(
      { error: 'Acesso exclusivo do revendedor.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Revise os dados da conta.',
        requestId,
      },
      { status: 422 },
    );
  const input = parsed.data;
  if (input.email !== account.user.email) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ email: input.email });
    if (error)
      return Response.json(
        {
          error: `Não foi possível solicitar a troca do e-mail: ${error.message}`,
          requestId,
        },
        { status: 422 },
      );
  }
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(`UPDATE users SET name=?,email=?,updated_at=? WHERE id=?`)
      .bind(input.name, input.email, now, account.user.id),
    getD1()
      .prepare(
        `UPDATE organizations SET display_name=?,updated_at=? WHERE id=?`,
      )
      .bind(input.name, now, account.organization.id),
    getD1()
      .prepare(
        `UPDATE reseller_profiles SET full_name=?,cpf=?,phone=?,bank_name=?,bank_branch=?,bank_account=?,bank_account_type=?,pix_key=?,updated_at=? WHERE organization_id=?`,
      )
      .bind(
        input.name,
        input.cpf,
        input.phone,
        input.bankName ?? null,
        input.bankBranch ?? null,
        input.bankAccount ?? null,
        input.bankAccountType ?? null,
        input.pixKey ?? null,
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
        input.postalCode,
        input.street,
        input.number,
        input.complement ?? null,
        input.district,
        input.city,
        input.state.toUpperCase(),
        now,
        now,
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'account.profile_updated','user',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        account.user.id,
        requestId,
        JSON.stringify({
          emailChangeRequested: input.email !== account.user.email,
        }),
        now,
      ),
  ]);
  return Response.json({
    updated: true,
    emailConfirmationRequired: input.email !== account.user.email,
    requestId,
  });
}
