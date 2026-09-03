"use client";
import { ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
export function ProductMediaManager({
  productId,
  media,
}: {
  productId: string;
  media: { id: string; altText: string; sortOrder: number }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(form: FormData) {
    setBusy(true);
    const response = await fetch(`/api/products/${productId}/media`, {
      method: "POST",
      body: form,
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Imagem adicionada ao produto."
        : (result.error ?? "Falha no envio."),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  async function remove(id: string) {
    if (!confirm("Remover esta imagem do produto?")) return;
    setBusy(true);
    const response = await fetch(`/api/products/${productId}/media/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    setMessage(response.ok ? "Imagem removida." : "Falha ao remover.");
    if (response.ok) router.refresh();
  }
  return (
    <section className="product-media-manager">
      <header>
        <div>
          <h2>Fotos do produto</h2>
          <p>Até 10 imagens JPG, PNG ou WebP, com descrição acessível.</p>
        </div>
        <span>{media.length}/10</span>
      </header>
      <div className="product-media-grid">
        {media.map((item) => (
          <figure key={item.id}>
            <Image
              src={`/api/products/${productId}/media/${item.id}`}
              alt={item.altText}
              width={480}
              height={480}
              unoptimized
            />
            <figcaption>{item.altText}</figcaption>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove(item.id)}
            >
              <Trash2 /> Remover
            </button>
          </figure>
        ))}
      </div>
      {media.length < 10 && (
        <form action={upload}>
          <label>
            <ImagePlus /> Imagem
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <label>
            Descrição da imagem
            <input
              name="altText"
              minLength={3}
              required
              placeholder="Ex.: vista frontal do produto azul"
            />
          </label>
          <button disabled={busy}>
            {busy ? "Enviando…" : "Adicionar foto"}
          </button>
        </form>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
