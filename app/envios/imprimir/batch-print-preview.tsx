'use client';
import { Printer } from 'lucide-react';
import { useRef } from 'react';
export function BatchPrintPreview({ ids }: { ids: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  return (
    <main className="batch-print-preview">
      <header>
        <div>
          <small>Impressão intercalada</small>
          <h1>Etiquetas e documentos fiscais</h1>
          <p>
            A ordem segue cada pedido: etiqueta e documento fiscal
            correspondente.
          </p>
        </div>
        <button onClick={() => frame.current?.contentWindow?.print()}>
          <Printer /> Imprimir todo o lote
        </button>
      </header>
      <iframe
        ref={frame}
        src={`/api/fulfillment/print?ids=${encodeURIComponent(ids)}`}
        title="Lote de documentos para impressão"
      />
    </main>
  );
}
