import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { AccountProfileForm } from './account-profile-form';
import { AdminSettingsForm } from './admin-settings-form';
import { NotificationPreferencesForm } from './notification-preferences-form';
import { PlatformProfileForm } from './platform-profile-form';
import { PrivacyForm } from './privacy-form';
import {
  SupplierLogoForm,
  SupplierProfileForm,
  type SupplierSettingsProfile,
} from './supplier-profile-form';

export const dynamic = 'force-dynamic';
const defaultPreferences = {
  emailOperations: true,
  emailOrders: true,
  emailMessages: true,
  emailMarketing: false,
  browserNotifications: true,
};

async function preferences(userId: string, organizationId: string) {
  return (
    (await getD1()
      .prepare(
        `SELECT email_operations emailOperations,email_orders emailOrders,email_messages emailMessages,email_marketing emailMarketing,browser_notifications browserNotifications FROM notification_preferences WHERE user_id=? AND organization_id=?`,
      )
      .bind(userId, organizationId)
      .first<typeof defaultPreferences>()) ?? defaultPreferences
  );
}

function LegalAndPrivacy() {
  return (
    <section className="surface-card privacy-section">
      <div className="privacy-heading">
        <div>
          <h2>Documentos legais e seus dados</h2>
          <p>
            Consulte os documentos vigentes ou exerça seus direitos de titular.
          </p>
        </div>
        <div className="legal-links">
          <a href="/termos">Contrato de serviços</a>
          <a href="/privacidade">Política de privacidade</a>
          <a href="/api/privacy/export">Baixar meus dados</a>
        </div>
      </div>
      <PrivacyForm />
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireAuthenticatedUser('/configuracoes');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const notificationInitial = await preferences(
    account.user.id,
    account.organization.id,
  );
  if (account.organization.type === 'platform') {
    const [settings, org] = await Promise.all([
      getD1()
        .prepare('SELECT key,value FROM system_settings ORDER BY key')
        .all<{ key: string; value: string }>(),
      getD1()
        .prepare(
          `SELECT o.legal_name legalName,o.display_name displayName,COALESCE(a.postal_code,'') postalCode,COALESCE(a.street,'') street,COALESCE(a.number,'') number,COALESCE(a.complement,'') complement,COALESCE(a.district,'') district,COALESCE(a.city,'') city,COALESCE(a.state,'') state FROM organizations o LEFT JOIN addresses a ON a.organization_id=o.id AND a.type='primary' WHERE o.id=?`,
        )
        .bind(account.organization.id)
        .first<{
          legalName: string;
          displayName: string;
          postalCode: string;
          street: string;
          number: string;
          complement: string;
          district: string;
          city: string;
          state: string;
        }>(),
    ]);
    const values = Object.fromEntries(
      settings.results.map((item) => [item.key, item.value]),
    );
    return (
      <AppShell account={account} activePath="/configuracoes">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Administração</span>
            <h1>Configurações do Flubox</h1>
            <p>
              Gerencie sua conta, identidade, documentos, notificações e
              funcionamento da plataforma.
            </p>
          </div>
        </section>
        <div className="settings-sections">
          <PlatformProfileForm
            initial={{
              ...values,
              adminName: account.user.name ?? '',
              adminEmail: account.user.email,
              legalName: org?.legalName ?? '',
              displayName: org?.displayName ?? 'Flubox',
              postalCode: org?.postalCode ?? '',
              street: org?.street ?? '',
              number: org?.number ?? '',
              complement: org?.complement ?? '',
              district: org?.district ?? '',
              city: org?.city ?? '',
              state: org?.state ?? '',
            }}
          />
          <AdminSettingsForm initial={values} />
          <NotificationPreferencesForm initial={notificationInitial} />
        </div>
      </AppShell>
    );
  }
  if (account.organization.type === 'reseller') {
    const profile = await getD1()
      .prepare(
        `SELECT COALESCE(u.name,r.full_name) name,u.email,r.phone,r.cpf,(r.avatar_storage_key IS NOT NULL) hasAvatar,COALESCE(a.postal_code,'') postalCode,COALESCE(a.street,'') street,COALESCE(a.number,'') number,COALESCE(a.complement,'') complement,COALESCE(a.district,'') district,COALESCE(a.city,'') city,COALESCE(a.state,'') state,COALESCE(r.bank_name,'') bankName,COALESCE(r.bank_branch,'') bankBranch,COALESCE(r.bank_account,'') bankAccount,COALESCE(r.bank_account_type,'') bankAccountType,COALESCE(r.pix_key,'') pixKey FROM reseller_profiles r JOIN organization_members m ON m.organization_id=r.organization_id AND m.user_id=? JOIN users u ON u.id=m.user_id LEFT JOIN addresses a ON a.organization_id=r.organization_id AND a.type='primary' WHERE r.organization_id=?`,
      )
      .bind(account.user.id, account.organization.id)
      .first<{
        name: string;
        email: string;
        phone: string;
        cpf: string;
        hasAvatar: boolean;
        postalCode: string;
        street: string;
        number: string;
        complement: string;
        district: string;
        city: string;
        state: string;
        bankName: string;
        bankBranch: string;
        bankAccount: string;
        bankAccountType: string;
        pixKey: string;
      }>();
    return (
      <AppShell account={account} activePath="/configuracoes">
        <section className="page-heading">
          <div>
            <span className="page-kicker">Revendedor</span>
            <h1>Minha conta e configurações</h1>
            <p>
              Dados pessoais, endereço, recebimento, notificações e privacidade.
            </p>
          </div>
        </section>
        {profile && <AccountProfileForm profile={profile} />}
        <NotificationPreferencesForm initial={notificationInitial} />
        <LegalAndPrivacy />
      </AppShell>
    );
  }
  const supplier = await getD1()
    .prepare(
      `SELECT sp.legal_name legalName,sp.trade_name tradeName,sp.cnpj,COALESCE(sp.state_registration,'') stateRegistration,sp.responsible_name responsibleName,sp.responsible_cpf responsibleCpf,sp.responsible_email responsibleEmail,sp.responsible_phone responsiblePhone,sp.public_profile_enabled publicProfileEnabled,(sp.logo_storage_key IS NOT NULL) hasLogo,COALESCE(a.postal_code,'') postalCode,COALESCE(a.street,'') street,COALESCE(a.number,'') number,COALESCE(a.complement,'') complement,COALESCE(a.district,'') district,COALESCE(a.city,'') city,COALESCE(a.state,'') state FROM supplier_profiles sp LEFT JOIN addresses a ON a.organization_id=sp.organization_id AND a.type='primary' WHERE sp.organization_id=?`,
    )
    .bind(account.organization.id)
    .first<SupplierSettingsProfile>();
  return (
    <AppShell account={account} activePath="/configuracoes">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Fornecedor</span>
          <h1>Empresa e configurações</h1>
          <p>
            Administre os dados comerciais exibidos aos revendedores, endereço,
            notificações e documentos.
          </p>
        </div>
      </section>
      {supplier && <SupplierLogoForm hasLogo={supplier.hasLogo} />}
      {supplier && <SupplierProfileForm profile={supplier} />}
      <NotificationPreferencesForm initial={notificationInitial} />
      <LegalAndPrivacy />
    </AppShell>
  );
}
