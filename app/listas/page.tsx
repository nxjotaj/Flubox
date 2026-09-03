import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { ListForm } from './list-form';

export const dynamic = 'force-dynamic';
export default async function ListsPage() {
  const user = await requireAuthenticatedUser('/listas');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/produtos');
  const lists = await getD1()
    .prepare(
      `SELECT l.id,l.name,l.created_at createdAt,COUNT(i.product_id) itemCount FROM product_lists l LEFT JOIN product_list_items i ON i.list_id=l.id WHERE l.organization_id=? GROUP BY l.id ORDER BY l.created_at DESC`,
    )
    .bind(account.organization.id)
    .all<{ id: string; name: string; createdAt: string; itemCount: number }>();
  return (
    <main className="simple-app-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <a href="/catalogo">Catálogo</a>
      </header>
      <section>
        <span className="eyebrow">Curadoria pessoal</span>
        <h1>Minhas listas</h1>
        <p>Organize produtos aprovados em vitrines e coleções próprias.</p>
        <ListForm />
        <div className="product-list">
          {lists.results.length === 0 ? (
            <div className="catalog-empty">
              Você ainda não criou nenhuma lista.
            </div>
          ) : (
            lists.results.map((list) => (
              <article key={list.id}>
                <div>
                  <strong>{list.name}</strong>
                  <small>{list.itemCount} produto(s)</small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
