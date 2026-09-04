import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { labelFor } from '@/lib/presentation';
import { getAccountContext } from '@/modules/identity/service';
import { EntityActions } from './entity-actions';
import { ModerationActions } from '../../admin-actions';
import {
  ResellerDetailTools,
  SupplierDetailTools,
} from '../../supplier-admin-tools';

export const dynamic = 'force-dynamic';
type Row = Record<string, unknown>;

const queries: Record<string, string> = {
  fornecedores: `SELECT o.id,o.display_name "Nome fantasia",o.legal_name "Razão social",o.administrative_notes "Observações administrativas",o.status "Status",sp.cnpj "CNPJ",sp.state_registration "Inscrição estadual",sp.responsible_name "Responsável",sp.responsible_email "E-mail responsável",sp.responsible_phone "Telefone",sp.reputation_basis_points "Reputação",s.status "Assinatura",s.current_period_end "Fim do período",o.created_at "Cadastro" FROM organizations o LEFT JOIN supplier_profiles sp ON sp.organization_id=o.id LEFT JOIN subscriptions s ON s.organization_id=o.id WHERE o.id=? AND o.type='supplier'`,
  revendedores: `SELECT o.id,o.display_name "Nome",o.legal_name "Nome legal",o.administrative_notes "Observações administrativas",o.status "Status",rp.cpf "CPF",rp.phone "Telefone",a.city "Cidade",a.state "UF",u.email "E-mail",o.created_at "Cadastro" FROM organizations o LEFT JOIN reseller_profiles rp ON rp.organization_id=o.id LEFT JOIN addresses a ON a.organization_id=o.id AND a.type='primary' LEFT JOIN organization_members m ON m.organization_id=o.id AND m.status='active' LEFT JOIN users u ON u.id=m.user_id WHERE o.id=? AND o.type='reseller' LIMIT 1`,
  usuarios: `SELECT m.id,COALESCE(u.name,u.email) "Nome",u.email "E-mail",u.status "Situação do usuário",o.display_name "Organização",o.type "Tipo de organização",r.name "Papel",m.status "Status",u.last_login_at "Último acesso",m.created_at "Acesso desde" FROM organization_members m JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id JOIN roles r ON r.id=m.role_id WHERE m.id=?`,
  catalogo: `SELECT p.id,p.title "Produto",p.sku "SKU",p.status "Status",p.description "Descrição",p.brand "Marca",p.gtin "GTIN",p.ncm "NCM",p.quality_score "Qualidade",o.display_name "Fornecedor",so.price_cents "Preço em centavos",so.suggested_retail_cents "Preço sugerido",p.created_at "Cadastro",p.updated_at "Atualização" FROM products p JOIN organizations o ON o.id=p.organization_id LEFT JOIN supplier_offers so ON so.product_id=p.id WHERE p.id=?`,
  disputas: `SELECT c.id,c.status "Status",c.type "Tipo",c.reason "Motivo",c.description "Descrição",c.resolution "Resolução",o.id "orderId",o.number "Pedido",org.display_name "Aberto por",c.created_at "Abertura",c.updated_at "Atualização" FROM support_cases c JOIN orders o ON o.id=c.order_id JOIN organizations org ON org.id=c.opened_by_organization_id WHERE c.id=?`,
};

function value(input: unknown) {
  if (input == null) return '—';
  if (typeof input === 'object') return JSON.stringify(input);
  if (typeof input === 'string') return input.replaceAll('_', ' ');
  if (typeof input === 'boolean') return input ? 'Sim' : 'Não';
  if (typeof input === 'number' || typeof input === 'bigint')
    return input.toString();
  return '—';
}

export default async function AdminEntityPage({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  const entityId = decodeURIComponent(id);
  if (section === 'pedidos') redirect(`/pedidos/${entityId}`);
  const query = queries[section];
  if (!query) notFound();
  const user = await requireAuthenticatedUser(`/admin/${section}/${id}`);
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'platform')
    redirect('/dashboard');
  const row = await getD1().prepare(query).bind(entityId).first<Row>();
  if (!row) notFound();
  const title = value(
    row['Nome fantasia'] ??
      row.Nome ??
      row.Produto ??
      row.Pedido ??
      row['E-mail'],
  );
  const status = value(row.Status ?? '');
  const orderId = typeof row.orderId === 'string' ? row.orderId : null;
  const supplierDocuments =
    section === 'fornecedores'
      ? await getD1()
          .prepare(
            `SELECT id,type,file_name fileName,status,expires_at expiresAt,created_at createdAt FROM documents WHERE organization_id=? ORDER BY created_at`,
          )
          .bind(entityId)
          .all<{
            id: string;
            type: string;
            fileName: string;
            status: string;
            expiresAt: string | null;
            createdAt: string;
          }>()
      : { results: [] };
  const feeExemptions =
    section === 'fornecedores'
      ? await getD1()
          .prepare(
            `SELECT type,starts_at startsAt,ends_at endsAt,reason FROM supplier_fee_exemptions WHERE organization_id=? AND status='active' AND (ends_at IS NULL OR ends_at::timestamptz>NOW()) ORDER BY created_at DESC`,
          )
          .bind(entityId)
          .all<{
            type: 'monthly_fee' | 'commission';
            startsAt: string;
            endsAt: string | null;
            reason: string;
          }>()
      : { results: [] };
  return (
    <AppShell account={account} activePath={`/admin/${section}`}>
      <section className="page-heading">
        <div>
          <a className="back-link" href={`/admin/${section}`}>
            <ArrowLeft /> Voltar
          </a>
          <span className="page-kicker">Detalhes e ações</span>
          <h1>{title}</h1>
          <p>Informações persistidas, histórico e comandos administrativos.</p>
        </div>
        <EntityActions section={section} id={entityId} status={status} />
      </section>
      <section className="surface-card detail-grid">
        {Object.entries(row)
          .filter(([key]) => !['id', 'orderId'].includes(key))
          .map(([key, item]) => (
            <div key={key}>
              <small>{key}</small>
              <strong>{value(item)}</strong>
            </div>
          ))}
      </section>
      {section === 'fornecedores' && (
        <SupplierDetailTools
          id={entityId}
          displayName={value(row['Nome fantasia'])}
          legalName={value(row['Razão social'])}
          notes={value(row['Observações administrativas'])}
          exemptions={feeExemptions.results}
        />
      )}
      {section === 'revendedores' && (
        <ResellerDetailTools
          id={entityId}
          displayName={value(row.Nome)}
          legalName={value(row['Nome legal'])}
          notes={value(row['Observações administrativas'])}
          phone={value(row.Telefone)}
          cpf={value(row.CPF)}
        />
      )}
      {section === 'fornecedores' && (
        <section className="surface-card detail-operation">
          <h2>Documentos empresariais</h2>
          {supplierDocuments.results.length ? (
            <div className="document-list">
              {supplierDocuments.results.map((document) => (
                <a
                  key={document.id}
                  href={`/api/documents/${document.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>{labelFor(document.type)}</strong>
                  <small>
                    {document.fileName} · {labelFor(document.status)}
                  </small>
                </a>
              ))}
            </div>
          ) : (
            <p>Nenhum documento enviado.</p>
          )}
        </section>
      )}
      {section === 'catalogo' && (
        <section className="surface-card detail-operation">
          <h2>Moderação posterior</h2>
          <p>
            Produtos elegíveis são publicados automaticamente. A administração
            pode suspender uma publicação com justificativa.
          </p>
          <ModerationActions productId={entityId} status={status} />
        </section>
      )}
      {section === 'disputas' && orderId && (
        <section className="surface-card detail-operation">
          <h2>Pedido relacionado</h2>
          <a className="primary-action" href={`/pedidos/${orderId}`}>
            Abrir pedido completo <ExternalLink />
          </a>
        </section>
      )}
    </AppShell>
  );
}
