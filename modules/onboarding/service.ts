import { getD1, type PreparedStatement } from '@/db';
import type { AccountContext } from '@/modules/identity/service';
import type { OnboardingInput } from './schema';

export async function saveOnboarding(
  account: AccountContext,
  input: OnboardingInput,
  requestId: string,
): Promise<void> {
  if (account.organization.type !== input.type)
    throw new Error('PROFILE_TYPE_MISMATCH');
  const d1 = getD1();
  const now = new Date().toISOString();
  const orgId = account.organization.id;
  const statements: PreparedStatement[] = [];
  if (input.type === 'supplier') {
    statements.push(
      d1
        .prepare(
          `INSERT INTO supplier_profiles (organization_id, cnpj, legal_name, trade_name, state_registration, responsible_name, responsible_cpf, responsible_email, responsible_phone, reputation_basis_points, onboarding_step, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 10000, 2, ?, ?) ON CONFLICT(organization_id) DO UPDATE SET cnpj=excluded.cnpj, legal_name=excluded.legal_name, trade_name=excluded.trade_name, state_registration=excluded.state_registration, responsible_name=excluded.responsible_name, responsible_cpf=excluded.responsible_cpf, responsible_email=excluded.responsible_email, responsible_phone=excluded.responsible_phone, onboarding_step=2, updated_at=excluded.updated_at`,
        )
        .bind(
          orgId,
          input.cnpj,
          input.legalName,
          input.tradeName,
          input.stateRegistration ?? null,
          input.responsibleName,
          input.responsibleCpf,
          input.responsibleEmail.toLowerCase(),
          input.responsiblePhone,
          now,
          now,
        ),
    );
    statements.push(
      d1
        .prepare(
          `UPDATE organizations SET legal_name=?, display_name=?, updated_at=? WHERE id=?`,
        )
        .bind(input.legalName, input.tradeName, now, orgId),
    );
    statements.push(
      d1
        .prepare(
          `INSERT OR IGNORE INTO subscriptions (id, organization_id, status, monthly_amount_cents, grace_period_days, created_at, updated_at) VALUES (?, ?, 'pending', 1990, 7, ?, ?)`,
        )
        .bind(`subscription:${orgId}`, orgId, now, now),
    );
    for (const field of ['cnpj', 'responsible_cpf', 'responsible_email'])
      statements.push(
        d1
          .prepare(
            `INSERT INTO verifications (id, organization_id, field, status, source, created_at, updated_at) VALUES (?, ?, ?, 'pending', 'self_reported', ?, ?) ON CONFLICT(organization_id, field) DO UPDATE SET status='pending', source='self_reported', updated_at=excluded.updated_at`,
          )
          .bind(`verification:${orgId}:${field}`, orgId, field, now, now),
      );
  } else {
    statements.push(
      d1
        .prepare(
          `INSERT INTO reseller_profiles (organization_id, person_type, cpf, full_name, phone, onboarding_step, created_at, updated_at) VALUES (?, 'individual', ?, ?, ?, 2, ?, ?) ON CONFLICT(organization_id) DO UPDATE SET cpf=excluded.cpf, full_name=excluded.full_name, phone=excluded.phone, onboarding_step=2, updated_at=excluded.updated_at`,
        )
        .bind(orgId, input.cpf, input.fullName, input.phone, now, now),
    );
    statements.push(
      d1
        .prepare(
          `UPDATE organizations SET legal_name=?, display_name=?, status='active', updated_at=? WHERE id=?`,
        )
        .bind(input.fullName, input.fullName, now, orgId),
    );
    for (const field of ['cpf', 'email'])
      statements.push(
        d1
          .prepare(
            `INSERT INTO verifications (id, organization_id, field, status, source, created_at, updated_at) VALUES (?, ?, ?, 'pending', 'self_reported', ?, ?) ON CONFLICT(organization_id, field) DO UPDATE SET status='pending', updated_at=excluded.updated_at`,
          )
          .bind(`verification:${orgId}:${field}`, orgId, field, now, now),
      );
  }
  statements.push(
    d1
      .prepare(
        `INSERT INTO addresses (id, organization_id, type, postal_code, street, number, complement, district, city, state, country, created_at, updated_at) VALUES (?, ?, 'primary', ?, ?, ?, ?, ?, ?, ?, 'BR', ?, ?) ON CONFLICT(organization_id, type) DO UPDATE SET postal_code=excluded.postal_code, street=excluded.street, number=excluded.number, complement=excluded.complement, district=excluded.district, city=excluded.city, state=excluded.state, updated_at=excluded.updated_at`,
      )
      .bind(
        `address:${orgId}:primary`,
        orgId,
        input.address.postalCode,
        input.address.street,
        input.address.number,
        input.address.complement ?? null,
        input.address.district,
        input.address.city,
        input.address.state,
        now,
        now,
      ),
  );
  statements.push(
    d1
      .prepare(
        `INSERT INTO audit_logs (id, actor_user_id, organization_id, action, entity_type, entity_id, request_id, metadata, created_at) VALUES (?, ?, ?, 'onboarding.profile_saved', 'organization', ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        orgId,
        orgId,
        requestId,
        JSON.stringify({ profileType: input.type }),
        now,
      ),
  );
  await d1.batch(statements);
}
