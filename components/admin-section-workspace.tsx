'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Filter,
  Search,
} from 'lucide-react';

export type AdminWorkspaceRow = {
  key: string;
  id?: string;
  status?: string;
  searchText: string;
  cells: Record<string, string>;
  attention?: boolean;
};

const attentionStatuses = new Set([
  'onboarding',
  'pending',
  'pending_review',
  'pending_validation',
  'draft',
  'open',
  'in_mediation',
  'past_due',
  'suspended',
  'revoked',
  'failed',
  'overdue',
  'payment_expired',
  'paid_awaiting_documents',
  'awaiting_supplier',
  'preparing',
  'ready_to_ship',
  'shipping_overdue',
]);

const actionLabels: Record<string, string> = {
  fornecedores: 'Analisar cadastro',
  revendedores: 'Ver conta',
  usuarios: 'Gerenciar acesso',
  catalogo: 'Ver produto',
  pedidos: 'Abrir pedido',
  disputas: 'Mediar disputa',
  casos: 'Abrir conversa',
  estoque: 'Ajustar estoque',
};

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function saveCsv(
  columns: [string, string][],
  rows: AdminWorkspaceRow[],
  filename: string,
) {
  const lines = [
    columns.map(([, label]) => csvCell(label)).join(';'),
    ...rows.map((row) =>
      columns.map(([key]) => csvCell(row.cells[key] ?? '')).join(';'),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}

export function AdminSectionWorkspace({
  section,
  columns,
  rows,
  detailBase,
  detailQueryParam,
}: {
  section: string;
  columns: [string, string][];
  rows: AdminWorkspaceRow[];
  detailBase?: string;
  detailQueryParam?: string;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const statuses = useMemo(
    () =>
      [
        ...new Set(rows.map((row) => row.status).filter(Boolean) as string[]),
      ].sort(),
    [rows],
  );
  const attentionCount = rows.filter(
    (row) => row.attention || attentionStatuses.has(row.status ?? ''),
  ).length;
  const healthyCount = rows.length - attentionCount;
  const filtered = useMemo(() => {
    const term = normalize(search);
    return rows.filter((row) => {
      if (term && !normalize(row.searchText).includes(term)) return false;
      if (status !== 'all' && row.status !== status) return false;
      if (
        attentionOnly &&
        !row.attention &&
        !attentionStatuses.has(row.status ?? '')
      )
        return false;
      return true;
    });
  }, [attentionOnly, rows, search, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const visibleSelected = visible.every((row) => selected.has(row.key));
  const selectedRows = rows.filter((row) => selected.has(row.key));

  function resetPage() {
    setPage(1);
  }

  function toggleRow(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      const shouldSelect = !visible.every((row) => next.has(row.key));
      visible.forEach((row) => {
        if (shouldSelect) next.add(row.key);
        else next.delete(row.key);
      });
      return next;
    });
  }

  async function copyReference(row: AdminWorkspaceRow) {
    const value =
      row.cells.reference ??
      row.cells.requestId ??
      row.cells.entityId ??
      row.key;
    await navigator.clipboard.writeText(value);
  }

  return (
    <section className="admin-workspace" id="operations">
      <div className="workspace-summary" aria-label="Resumo da fila">
        <article>
          <span>Total na visão</span>
          <strong>{rows.length}</strong>
          <small>registros disponíveis</small>
        </article>
        <article className={attentionCount ? 'needs-attention' : ''}>
          <span>Exigem atenção</span>
          <strong>{attentionCount}</strong>
          <small>pendências e exceções</small>
        </article>
        <article className="healthy">
          <span>Fluxo regular</span>
          <strong>{healthyCount}</strong>
          <small>sem alerta operacional</small>
        </article>
      </div>

      <div className="surface-card admin-table-card operational-table">
        <div className="operations-bar">
          <div className="operations-tabs" aria-label="Visões rápidas">
            <button
              className={!attentionOnly ? 'active' : ''}
              type="button"
              onClick={() => {
                setAttentionOnly(false);
                resetPage();
              }}
            >
              Todos <span>{rows.length}</span>
            </button>
            <button
              className={attentionOnly ? 'active attention' : ''}
              type="button"
              onClick={() => {
                setAttentionOnly(true);
                resetPage();
              }}
            >
              <AlertTriangle /> Pendências <span>{attentionCount}</span>
            </button>
          </div>
          <div className="operations-actions">
            {selectedRows.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  saveCsv(
                    columns,
                    selectedRows,
                    `flubox-${section}-selecionados.csv`,
                  )
                }
              >
                <Download /> Exportar {selectedRows.length} selecionados
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                saveCsv(columns, filtered, `flubox-${section}.csv`)
              }
            >
              <Download /> Exportar visão
            </button>
          </div>
        </div>

        <div className="table-toolbar marketplace-toolbar">
          <label>
            <Search />
            <input
              aria-label="Pesquisar nesta área"
              placeholder="Buscar por nome, pedido, documento ou status"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
            />
          </label>
          {statuses.length > 0 && (
            <label className="status-filter">
              <Filter />
              <select
                aria-label="Filtrar por status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  resetPage();
                }}
              >
                <option value="all">Todos os status</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span>{filtered.length} resultados</span>
        </div>

        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="selection-cell">
                    <input
                      aria-label="Selecionar registros visíveis"
                      type="checkbox"
                      checked={visibleSelected}
                      onChange={toggleVisible}
                    />
                  </th>
                  {columns.map(([, label]) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th className="action-cell">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const detailHref =
                    detailBase && row.id
                      ? detailQueryParam
                        ? `${detailBase}?${detailQueryParam}=${encodeURIComponent(row.id)}`
                        : `${detailBase}/${encodeURIComponent(row.id)}`
                      : null;
                  return (
                    <tr key={row.key}>
                      <td className="selection-cell">
                        <input
                          aria-label={`Selecionar ${row.searchText}`}
                          type="checkbox"
                          checked={selected.has(row.key)}
                          onChange={() => toggleRow(row.key)}
                        />
                      </td>
                      {columns.map(([key], columnIndex) => (
                        <td key={key}>
                          {columnIndex === 0 && detailHref ? (
                            <a className="table-row-link" href={detailHref}>
                              {row.cells[key]}
                            </a>
                          ) : key === 'status' ? (
                            <span
                              className={`status-pill status-${row.status ?? ''}`}
                            >
                              {row.cells[key]}
                            </span>
                          ) : (
                            row.cells[key]
                          )}
                        </td>
                      ))}
                      <td className="action-cell">
                        <div className="row-actions">
                          {detailHref ? (
                            <a className="row-primary-action" href={detailHref}>
                              {actionLabels[section] ?? 'Abrir'}{' '}
                              <ArrowUpRight />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void copyReference(row)}
                            >
                              <Clipboard /> Copiar referência
                            </button>
                          )}
                          {section === 'pedidos' && row.id && (
                            <a
                              className="row-icon-action"
                              href={`/pedidos/${encodeURIComponent(row.id)}/imprimir`}
                              title="Imprimir pedido"
                              aria-label="Imprimir pedido"
                            >
                              <FileText />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Search />
            <strong>Nenhum resultado nesta visão</strong>
            <p>Altere a busca ou remova os filtros aplicados.</p>
          </div>
        )}

        <footer className="table-pagination">
          <span>
            Página {safePage} de {pages} · {filtered.length} registros
          </span>
          <div>
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ArrowLeft /> Anterior
            </button>
            <button
              type="button"
              disabled={safePage === pages}
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
            >
              Próxima <ArrowRight />
            </button>
          </div>
        </footer>
      </div>
      <div className="operation-hint">
        <CheckCircle2 />
        <span>
          Toda decisão sensível é concluída na tela de detalhes, com validação e
          registro de auditoria.
        </span>
      </div>
    </section>
  );
}
