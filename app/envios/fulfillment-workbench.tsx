'use client';

import {
  Barcode,
  CheckSquare,
  PackageCheck,
  Printer,
  Search,
  Send,
  UserRoundCog,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type FulfillmentRow = {
  id: string;
  number: string;
  status: string;
  reseller: string;
  deadline: string | null;
  totalUnits: number;
  itemSummary: string;
  labelUnits: number;
  fiscalCount: number;
  assignedMemberId: string | null;
  assignedName: string | null;
};
export function FulfillmentWorkbench({
  rows,
  operators,
  isOwner,
}: {
  rows: FulfillmentRow[];
  operators: { id: string; name: string }[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const scanner = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(new Set<string>());
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (filter === 'all' || row.status === filter) &&
          `${row.number} ${row.reseller} ${row.itemSummary}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [rows, filter, query],
  );
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  async function batch(action: 'accept' | 'ready') {
    if (!selected.size) return setMessage('Selecione ao menos um pedido.');
    setBusy(true);
    const response = await fetch('/api/fulfillment/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderIds: [...selected], action }),
    });
    const body = (await response.json()) as {
      updated?: number;
      skipped?: number;
      error?: string;
    };
    setMessage(
      response.ok
        ? `${body.updated} pedidos atualizados; ${body.skipped} ignorados por estado ou atribuição.`
        : (body.error ?? 'Falha na operação.'),
    );
    setBusy(false);
    if (response.ok) {
      setSelected(new Set());
      router.refresh();
    }
  }
  async function assign(orderId: string, memberId: string) {
    if (!memberId) return;
    const response = await fetch('/api/fulfillment/assign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, memberId }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Pedido atribuído.'
        : (body.error ?? 'Falha na atribuição.'),
    );
    if (response.ok) router.refresh();
  }
  async function scan(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawBarcode = form.get('barcode');
    const barcode = typeof rawBarcode === 'string' ? rawBarcode : '';
    setBusy(true);
    const response = await fetch('/api/fulfillment/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ barcode }),
    });
    const body = (await response.json()) as { order?: string; error?: string };
    setMessage(
      response.ok
        ? `${body.order} identificado e marcado como enviado.`
        : (body.error ?? 'Leitura não reconhecida.'),
    );
    event.currentTarget.reset();
    setBusy(false);
    scanner.current?.focus();
    if (response.ok) router.refresh();
  }
  return (
    <>
      <section className="fulfillment-toolbar surface-card">
        <div className="fulfillment-search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pedido, revendedor ou produto"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todos os status</option>
          <option value="ready_for_supplier">Novos para separar</option>
          <option value="preparing">Em separação</option>
          <option value="ready_to_ship">Prontos para envio</option>
          <option value="shipped">Enviados</option>
        </select>
        <button disabled={busy} onClick={() => void batch('accept')}>
          <CheckSquare /> Iniciar separação
        </button>
        <button disabled={busy} onClick={() => void batch('ready')}>
          <PackageCheck /> Marcar separados
        </button>
        <Link
          className={
            selected.size ? 'batch-print-link' : 'batch-print-link disabled'
          }
          href={
            selected.size
              ? `/envios/imprimir?ids=${[...selected].join(',')}`
              : '#'
          }
          target={selected.size ? '_blank' : undefined}
        >
          <Printer /> Imprimir lote ({selected.size})
        </Link>
      </section>
      <form className="barcode-console" onSubmit={scan}>
        <span>
          <Barcode />
          <b>Leitor de código de barras</b>
          <small>Leia a etiqueta para localizar e confirmar o pacote</small>
        </span>
        <input
          ref={scanner}
          name="barcode"
          autoComplete="off"
          placeholder="Leia ou digite o código da etiqueta"
          required
        />
        <button disabled={busy}>
          <Send /> Confirmar envio
        </button>
      </form>
      {message && <output className="operation-message">{message}</output>}
      <section className="fulfillment-summary">
        <article>
          <small>Na fila exibida</small>
          <strong>{visible.length}</strong>
        </article>
        <article>
          <small>Unidades para separar</small>
          <strong>
            {visible
              .filter((r) =>
                ['ready_for_supplier', 'preparing'].includes(r.status),
              )
              .reduce((s, r) => s + r.totalUnits, 0)}
          </strong>
        </article>
        <article>
          <small>Vencendo hoje/atrasados</small>
          <strong>
            {
              visible.filter(
                (r) =>
                  r.deadline &&
                  new Date(r.deadline).getTime() <= renderedAt + 86400000,
              ).length
            }
          </strong>
        </article>
      </section>
      <div className="fulfillment-list">
        {visible.map((row) => (
          <article
            key={row.id}
            className={`fulfillment-order status-border-${row.status}`}
          >
            <label className="row-check">
              <span className="sr-only">Selecionar {row.number}</span>
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onChange={() => toggle(row.id)}
              />
              <span />
            </label>
            <div className="fulfillment-order-main">
              <header>
                <Link href={`/pedidos/${row.id}`}>{row.number}</Link>
                <span className={`status-pill status-${row.status}`}>
                  {row.status.replaceAll('_', ' ')}
                </span>
              </header>
              <strong>{row.itemSummary}</strong>
              <small>
                {row.reseller} · {row.totalUnits} unidade(s)
              </small>
            </div>
            <div className="document-coverage">
              <span
                className={row.labelUnits >= row.totalUnits ? 'complete' : ''}
              >
                Etiquetas {row.labelUnits}/{row.totalUnits}
              </span>
              <span className={row.fiscalCount > 0 ? 'complete' : ''}>
                Fiscal {row.fiscalCount > 0 ? 'pronto' : 'pendente'}
              </span>
            </div>
            <div className="deadline-cell">
              <small>Prazo de postagem</small>
              <b>
                {row.deadline
                  ? new Date(row.deadline).toLocaleString('pt-BR')
                  : 'Aguardando liberação'}
              </b>
            </div>
            <div className="assignment-cell">
              <small>
                <UserRoundCog /> Responsável
              </small>
              {isOwner ? (
                <select
                  value={row.assignedMemberId ?? ''}
                  onChange={(e) => void assign(row.id, e.target.value)}
                >
                  <option value="">Não atribuído</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
                </select>
              ) : (
                <b>{row.assignedName ?? 'Sua fila'}</b>
              )}
            </div>
            <Link className="open-order" href={`/pedidos/${row.id}`}>
              Abrir
            </Link>
          </article>
        ))}
        {!visible.length && (
          <div className="empty-state surface-card">
            <PackageCheck />
            <strong>Nenhum pedido nesta fila</strong>
            <p>Altere os filtros ou aguarde novas liberações.</p>
          </div>
        )}
      </div>
    </>
  );
}
