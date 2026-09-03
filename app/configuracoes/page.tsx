import { requireAuthenticatedUser } from "@/app/chatgpt-auth";
import { AppShell } from "@/components/app-shell";
import { getAccountContext } from "@/modules/identity/service";
import { redirect } from "next/navigation";
import { PrivacyForm } from "./privacy-form";
import { AdminSettingsForm } from "./admin-settings-form";
import { getD1 } from "@/db";
import { AccountProfileForm } from "./account-profile-form";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const user = await requireAuthenticatedUser("/configuracoes");
  const account = await getAccountContext(user);
  if (!account) redirect("/cadastro");
  if (account.organization.type === "platform") {
    const settings = await getD1()
      .prepare("SELECT key,value FROM system_settings ORDER BY key")
      .all<{ key: string; value: string }>();
    return (
      <AppShell account={account} activePath="/configuracoes">
        <section className="page-heading">
          <div>
            <span className="eyebrow">Governança da plataforma</span>
            <h1>Configurações administrativas</h1>
            <p>
              Parâmetros comerciais e operacionais centralizados. Cada alteração
              gera uma nova versão e registro de auditoria.
            </p>
          </div>
        </section>
        <AdminSettingsForm
          initial={Object.fromEntries(
            settings.results.map((item) => [item.key, item.value]),
          )}
        />
      </AppShell>
    );
  }
  if (account.organization.type === "reseller") {
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
            <span className="page-kicker">Minha conta</span>
            <h1>Perfil e configurações</h1>
            <p>Dados pessoais, endereço, recebimento e controles da conta.</p>
          </div>
        </section>
        {profile && <AccountProfileForm profile={profile} />}
        <section className="surface-card privacy-section">
          <h2>Privacidade e dados</h2>
          <a className="secondary-action" href="/api/privacy/export">
            Baixar meus dados
          </a>
          <PrivacyForm />
        </section>
      </AppShell>
    );
  }
  return (
    <AppShell account={account} activePath="/configuracoes">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Conta e privacidade</span>
          <h1>Configurações</h1>
        </div>
      </section>
      <section className="surface-card privacy-section">
        <h2>Seus dados</h2>
        <p>
          Exporte os dados estruturados vinculados à sua conta ou exerça um
          direito de titular. Registros financeiros e fiscais podem exigir
          retenção legal.
        </p>
        <a className="primary-link" href="/api/privacy/export">
          Baixar meus dados
        </a>
        <PrivacyForm />
      </section>
    </AppShell>
  );
}
