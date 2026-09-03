'use client';

import { Download, Search } from 'lucide-react';

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function ExportTableButton({
  selector,
  filename,
}: {
  selector: string;
  filename: string;
}) {
  function download() {
    const table = document.querySelector<HTMLTableElement>(selector);
    if (!table) return;
    const rows = [...table.querySelectorAll('tr')]
      .filter((row) => !row.hidden)
      .map((row) =>
        [...row.querySelectorAll('th,td')]
          .map((cell) => csvCell(cell.textContent?.trim() ?? ''))
          .join(';'),
      );
    const blob = new Blob([`\uFEFF${rows.join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <button type="button" onClick={download}>
      <Download /> Exportar CSV
    </button>
  );
}

export function TableSearch({ selector }: { selector: string }) {
  function filter(value: string) {
    const normalized = value.trim().toLocaleLowerCase('pt-BR');
    document
      .querySelectorAll<HTMLTableRowElement>(`${selector} tbody tr`)
      .forEach((row) => {
        row.hidden =
          Boolean(normalized) &&
          !row.textContent?.toLocaleLowerCase('pt-BR').includes(normalized);
      });
  }
  return (
    <label>
      <Search />
      <input
        aria-label="Pesquisar nesta área"
        placeholder="Pesquisar nesta área"
        onChange={(event) => filter(event.target.value)}
      />
    </label>
  );
}
