import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { downloadPrivateDocument } from '@/modules/documents/storage';
import { requireAccountPermission } from '@/modules/identity/service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response('Faça login.', { status: 401 });
  const account = await requireAccountPermission(user, 'fulfillment.view');
  if (account.organization.type !== 'supplier')
    return new Response('Acesso negado.', { status: 403 });
  const ids = [
    ...new Set(
      new URL(request.url).searchParams
        .get('ids')
        ?.split(',')
        .filter(Boolean) ?? [],
    ),
  ].slice(0, 100);
  if (!ids.length) return new Response('Selecione pedidos.', { status: 422 });
  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  for (const orderId of ids) {
    const order = await getD1()
      .prepare(
        `SELECT o.number,fa.member_id assignedMemberId FROM orders o LEFT JOIN fulfillment_assignments fa ON fa.order_id=o.id WHERE o.id=? AND o.supplier_organization_id=?`,
      )
      .bind(orderId, account.organization.id)
      .first<{ number: string; assignedMemberId: string | null }>();
    if (
      !order ||
      (account.role.startsWith('supplier_operator_') &&
        order.assignedMemberId !== account.memberId)
    )
      continue;
    const documents = await getD1()
      .prepare(
        `SELECT type,storage_key storageKey,mime_type mimeType,file_name fileName FROM order_documents WHERE order_id=? AND type IN ('shipping_label','nfe_danfe','content_declaration') ORDER BY CASE WHEN type='shipping_label' THEN 0 ELSE 1 END,created_at`,
      )
      .bind(orderId)
      .all<{
        type: string;
        storageKey: string;
        mimeType: string;
        fileName: string;
      }>();
    for (const document of documents.results) {
      try {
        const bytes = await downloadPrivateDocument(document.storageKey);
        if (document.mimeType === 'application/pdf') {
          const source = await PDFDocument.load(bytes);
          const pages = await output.copyPages(source, source.getPageIndices());
          pages.forEach((page) => output.addPage(page));
        } else if (
          document.mimeType === 'image/jpeg' ||
          document.mimeType === 'image/png'
        ) {
          const image =
            document.mimeType === 'image/jpeg'
              ? await output.embedJpg(bytes)
              : await output.embedPng(bytes);
          const page = output.addPage([595, 842]);
          const scale = Math.min(555 / image.width, 802 / image.height);
          page.drawImage(image, {
            x: (595 - image.width * scale) / 2,
            y: (842 - image.height * scale) / 2,
            width: image.width * scale,
            height: image.height * scale,
          });
        } else {
          const page = output.addPage([595, 842]);
          page.drawText(`${order.number} - ${document.fileName}`, {
            x: 40,
            y: 780,
            size: 16,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
          page.drawText(
            'Formato WebP não pode ser incorporado ao PDF. Baixe o documento individual.',
            { x: 40, y: 745, size: 11, font },
          );
        }
      } catch {
        const page = output.addPage([595, 842]);
        page.drawText(`${order.number} - documento indisponível`, {
          x: 40,
          y: 780,
          size: 16,
          font,
          color: rgb(0.7, 0.1, 0.1),
        });
      }
    }
  }
  if (output.getPageCount() === 0)
    return new Response(
      'Nenhum documento disponível para os pedidos selecionados.',
      { status: 404 },
    );
  const bytes = await output.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="expedicao-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'cache-control': 'private, no-store',
    },
  });
}
