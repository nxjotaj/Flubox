import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  PlugZap,
  RefreshCw,
  Rocket,
  Store,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
const money = (value: number | null) =>
  value == null
    ? '—'
    : (value / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
const labels = { mercado_livre: 'Mercado Livre', shopee: 'Shopee' } as const;

type Connection = {
  id: string;
  provider: keyof typeof labels;
  displayName: string;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};
type Listing = {
  id: string;
  provider: keyof typeof labels;
  account: string;
  title: string | null;
  sku: string | null;
  status: string;
  pricingMode: string;
  marginBasisPoints: number | null;
  fixedPriceCents: number | null;
  costCents: number | null;
  priceCents: number | null;
  stock: number;
  externalUrl: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
};
type Product = {
  id: string;
  title: string;
  sku: string;
  costCents: number;
  stock: number;
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAuthenticatedUser('/integracoes');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/dashboard');
  const notice = await searchParams;
  const [connections, listings, products, alerts] = await Promise.all([
    getD1()
      .prepare(
        `SELECT id,provider,display_name displayName,status,last_synced_at lastSyncedAt,last_error lastError FROM sales_channel_connections WHERE organization_id=? ORDER BY created_at`,
      )
      .bind(account.organization.id)
      .all<Connection>(),
    getD1()
      .prepare(
        `SELECT l.id,c.provider,c.display_name account,p.title,COALESCE(v.sku,p.sku,l.external_sku) sku,l.status,l.pricing_mode pricingMode,l.margin_basis_points marginBasisPoints,l.fixed_price_cents fixedPriceCents,l.cost_snapshot_cents costCents,l.published_price_cents priceCents,l.published_stock stock,l.external_url externalUrl,l.last_error lastError,l.last_synced_at lastSyncedAt FROM sales_channel_listings l JOIN sales_channel_connections c ON c.id=l.connection_id LEFT JOIN products p ON p.id=l.product_id LEFT JOIN product_variants v ON v.id=l.variant_id WHERE l.organization_id=? ORDER BY l.updated_at DESC`,
      )
      .bind(account.organization.id)
      .all<Listing>(),
    getD1()
      .prepare(
        `SELECT p.id,p.title,p.sku,o.price_cents costCents,COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0)-COALESCE((SELECT SUM(quantity) FROM inventory_reservations WHERE product_id=p.id AND status='active' AND expires_at>?),0) stock FROM products p JOIN supplier_offers o ON o.product_id=p.id JOIN organizations org ON org.id=p.organization_id AND org.status='active' JOIN subscriptions s ON s.organization_id=org.id AND s.status IN ('active','grace_period') WHERE p.status='approved' ORDER BY p.title LIMIT 200`,
      )
      .bind(new Date().toISOString())
      .all<Product>(),
    getD1()
      .prepare(
        `SELECT type,status,error,received_at receivedAt FROM sales_channel_events e JOIN sales_channel_connections c ON c.id=e.connection_id WHERE c.organization_id=? AND e.type IN ('question','return','cancellation') ORDER BY received_at DESC LIMIT 8`,
      )
      .bind(account.organization.id)
      .all<{
        type: string;
        status: string;
        error: string | null;
        receivedAt: string;
      }>(),
  ]);
  const activeConnections = connections.results.filter(
    (item) => item.status === 'active',
  );
  const steps = [
    connections.results.length > 0,
    listings.results.length > 0,
    listings.results.some((item) => item.status === 'active'),
    connections.results.some((item) => item.lastSyncedAt),
  ];
  return (
    <div className="integration-workspace">
      <section className="page-heading integration-heading">
        <div>
          <span className="page-kicker">
            <PlugZap /> Hub multicanal
          </span>
          <h1>Integrações</h1>
          <p>
            Publique seu catálogo e acompanhe vendas sem compartilhar a senha da
            sua loja.
          </p>
        </div>
        <span className="integration-mode">Ambiente de desenvolvimento</span>
      </section>
      {(notice.erro ||
        notice.conectado ||
        notice.publicado ||
        notice.sincronizados) && (
        <div
          className={`integration-notice ${notice.erro ? 'error' : 'success'}`}
        >
          {notice.erro
            ? `Não foi possível concluir: ${notice.erro}`
            : 'Operação concluída com segurança.'}
        </div>
      )}

      <section className="integration-guide surface-card">
        <div>
          <span>Primeiros passos</span>
          <h2>Sua operação multicanal</h2>
        </div>
        <ol>
          {[
            'Conectar uma conta',
            'Importar ou criar anúncio',
            'Publicar o primeiro produto',
            'Validar sincronização',
          ].map((label, index) => (
            <li className={steps[index] ? 'done' : ''} key={label}>
              {steps[index] ? <CheckCircle2 /> : <CircleDashed />}
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="integration-section">
        <div className="section-title">
          <div>
            <span className="page-kicker">
              <Store /> Canais de venda
            </span>
            <h2>Contas conectadas</h2>
          </div>
          <small>{activeConnections.length} ativa(s)</small>
        </div>
        <div className="channel-grid">
          {(['mercado_livre', 'shopee'] as const).map((provider) => {
            const connection = connections.results.find(
              (item) => item.provider === provider,
            );
            return (
              <article className="channel-card surface-card" key={provider}>
                <div className={`channel-mark ${provider}`}>
                  {provider === 'mercado_livre' ? 'ML' : 'S'}
                </div>
                <div>
                  <h3>{labels[provider]}</h3>
                  <p>
                    {connection
                      ? connection.displayName
                      : 'Nenhuma conta conectada'}
                  </p>
                </div>
                <span
                  className={`status-pill status-${connection?.status ?? 'disconnected'}`}
                >
                  {connection?.status ?? 'desconectado'}
                </span>
                {connection?.status === 'active' ? (
                  <div className="channel-actions">
                    <form action="/api/integrations/reconcile" method="post">
                      <input
                        type="hidden"
                        name="connectionId"
                        value={connection.id}
                      />
                      <button className="secondary-action">
                        <RefreshCw /> Sincronizar
                      </button>
                    </form>
                    <form
                      action={`/api/integrations/connections/${connection.id}`}
                      method="post"
                    >
                      <button className="secondary-action">Desconectar</button>
                    </form>
                  </div>
                ) : (
                  <form action="/api/integrations/connect" method="post">
                    <input type="hidden" name="provider" value={provider} />
                    <button className="primary-action">
                      <PlugZap /> {connection ? 'Reconectar' : 'Conectar'}
                    </button>
                  </form>
                )}
                {connection?.lastError && (
                  <small className="channel-error">
                    <AlertTriangle /> {connection.lastError}
                  </small>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="integration-publisher surface-card">
        <div>
          <span className="page-kicker">
            <Rocket /> Novo anúncio
          </span>
          <h2>Leve um produto para sua loja</h2>
          <p>
            Defina sua margem ou o preço final. O estoque líquido será
            compartilhado automaticamente.
          </p>
        </div>
        {activeConnections.length ? (
          <form action="/api/integrations/listings" method="post">
            <label>
              Conta
              <select name="connectionId" required>
                {activeConnections.map((item) => (
                  <option value={item.id} key={item.id}>
                    {labels[item.provider]} · {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Produto
              <select
                name="productId"
                defaultValue={notice.produto ?? ''}
                required
              >
                <option value="" disabled>
                  Selecione no catálogo
                </option>
                {products.results.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title} · {item.sku} · {money(item.costCents)} ·{' '}
                    {item.stock} un.
                  </option>
                ))}
              </select>
            </label>
            <label>
              Regra de preço
              <select name="pricingMode">
                <option value="margin">Margem percentual</option>
                <option value="fixed">Preço final</option>
              </select>
            </label>
            <label>
              Margem (%) ou preço (R$)
              <input
                name="value"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue="30"
                required
              />
            </label>
            <label>
              Estoque de segurança
              <input
                name="safetyStock"
                type="number"
                min="0"
                step="1"
                defaultValue="1"
                required
              />
            </label>
            <button className="primary-action">Validar e publicar</button>
          </form>
        ) : (
          <div className="integration-empty">
            Conecte ao menos uma conta para publicar.
          </div>
        )}
      </section>

      <section className="integration-section">
        <div className="section-title">
          <div>
            <span className="page-kicker">Catálogo externo</span>
            <h2>Meus anúncios</h2>
          </div>
          <small>{listings.results.length} anúncio(s)</small>
        </div>
        {listings.results.length ? (
          <div className="listing-table">
            <div className="listing-row listing-header">
              <span>Produto</span>
              <span>Canal</span>
              <span>Preço e margem</span>
              <span>Estoque</span>
              <span>Status</span>
              <span>Ações</span>
            </div>
            {listings.results.map((listing) => (
              <article className="listing-row" key={listing.id}>
                <div>
                  <strong>{listing.title ?? 'Anúncio não vinculado'}</strong>
                  <small>{listing.sku ?? 'Sem SKU'}</small>
                  {!listing.title && (
                    <form
                      className="listing-link-form"
                      action={`/api/integrations/listings/${listing.id}`}
                      method="post"
                    >
                      <input type="hidden" name="action" value="link" />
                      <select name="productId" required>
                        <option value="">Vincular produto…</option>
                        {products.results.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.title} · {item.sku}
                          </option>
                        ))}
                      </select>
                      <button>Vincular</button>
                    </form>
                  )}
                </div>
                <div>
                  <strong>{labels[listing.provider]}</strong>
                  <small>{listing.account}</small>
                </div>
                <div>
                  <strong>{money(listing.priceCents)}</strong>
                  <small>
                    Custo {money(listing.costCents)} ·{' '}
                    {listing.pricingMode === 'margin'
                      ? `${(listing.marginBasisPoints ?? 0) / 100}%`
                      : 'preço fixo'}
                  </small>
                  {listing.title && (
                    <form
                      className="listing-price-form"
                      action={`/api/integrations/listings/${listing.id}`}
                      method="post"
                    >
                      <input type="hidden" name="action" value="price" />
                      <select name="pricingMode">
                        <option value="margin">Margem %</option>
                        <option value="fixed">Preço R$</option>
                      </select>
                      <input
                        name="value"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={
                          listing.pricingMode === 'margin'
                            ? (listing.marginBasisPoints ?? 0) / 100
                            : (listing.fixedPriceCents ?? 0) / 100
                        }
                      />
                      <button>Salvar</button>
                    </form>
                  )}
                </div>
                <strong>{listing.stock} un.</strong>
                <span className={`status-pill status-${listing.status}`}>
                  {listing.status}
                </span>
                <div className="listing-actions">
                  {listing.externalUrl && (
                    <a
                      href={listing.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir anúncio"
                    >
                      <ExternalLink />
                    </a>
                  )}
                  {listing.status === 'active' && (
                    <form action="/api/integrations/simulate" method="post">
                      <input
                        type="hidden"
                        name="listingId"
                        value={listing.id}
                      />
                      <button>Simular venda</button>
                    </form>
                  )}
                  <form
                    action={`/api/integrations/listings/${listing.id}`}
                    method="post"
                  >
                    <input
                      type="hidden"
                      name="action"
                      value={listing.status === 'paused' ? 'activate' : 'pause'}
                    />
                    <button>
                      {listing.status === 'paused' ? 'Ativar' : 'Pausar'}
                    </button>
                  </form>
                  <form
                    action={`/api/integrations/listings/${listing.id}`}
                    method="post"
                  >
                    <input type="hidden" name="action" value="unlink" />
                    <button>Desvincular</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="integration-empty">
            Seus anúncios publicados e importados aparecerão aqui.
          </div>
        )}
      </section>

      {alerts.results.length > 0 && (
        <section className="integration-section">
          <div className="section-title">
            <h2>Pós-venda e alertas</h2>
          </div>
          <div className="integration-alerts">
            {alerts.results.map((alert, index) => (
              <article key={`${alert.receivedAt}-${index}`}>
                <AlertTriangle />
                <div>
                  <strong>{alert.type.replaceAll('_', ' ')}</strong>
                  <small>
                    {new Date(alert.receivedAt).toLocaleString('pt-BR')} ·{' '}
                    {alert.status}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
