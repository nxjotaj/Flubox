import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import {
  storePrivateDocument,
  validateDocument,
} from '@/modules/documents/storage';
import { getAccountContext } from '@/modules/identity/service';
import { addBusinessDays } from '@/modules/logistics/sla';
import { selectAvailableOperator } from '@/modules/fulfillment/assignment';

const types = new Set([
  'nfe_danfe',
  'content_declaration',
  'shipping_label',
  'other',
]);
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await getAccountContext(user);
    if (!account)
      return Response.json(
        { error: 'Conta necessária.', requestId },
        { status: 403 },
      );
    const { id } = await params;
    const order = await getD1()
      .prepare(
        `SELECT o.id,o.status,o.reseller_organization_id resellerId,o.supplier_organization_id supplierId,COALESCE(SUM(i.quantity),0) totalUnits FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.id=? AND o.reseller_organization_id=? GROUP BY o.id`,
      )
      .bind(id, account.organization.id)
      .first<{
        id: string;
        status: string;
        resellerId: string;
        supplierId: string;
        totalUnits: number;
      }>();
    if (!order)
      return Response.json(
        { error: 'Pedido não encontrado.', requestId },
        { status: 404 },
      );
    if (!['awaiting_payment', 'paid_awaiting_documents'].includes(order.status))
      return Response.json(
        {
          error:
            'Os documentos só podem ser enviados enquanto o pedido aguarda o PIX ou a liberação documental.',
          requestId,
        },
        { status: 409 },
      );
    const form = await request.formData();
    const file = form.get('file');
    const rawType = form.get('type');
    const issuer = form.get('issuer');
    const type = typeof rawType === 'string' ? rawType : '';
    const quantityCovered = Number(form.get('quantityCovered') ?? 1);
    const rawBarcode = form.get('barcodeValue');
    const barcodeValue =
      typeof rawBarcode === 'string' ? rawBarcode.trim() : '';
    if (
      !(file instanceof File) ||
      !types.has(type) ||
      typeof issuer !== 'string' ||
      issuer.trim().length < 2
    )
      return Response.json(
        { error: 'Documento, tipo e emissor são obrigatórios.', requestId },
        { status: 422 },
      );
    if (
      type === 'shipping_label' &&
      (!Number.isInteger(quantityCovered) ||
        quantityCovered < 1 ||
        quantityCovered > Number(order.totalUnits))
    )
      return Response.json(
        { error: 'Informe quantas unidades esta etiqueta cobre.', requestId },
        { status: 422 },
      );
    if (type === 'shipping_label') {
      const coverage = await getD1()
        .prepare(
          `SELECT COALESCE(SUM(quantity_covered),0) covered FROM order_documents WHERE order_id=? AND type='shipping_label'`,
        )
        .bind(id)
        .first<{ covered: number }>();
      if (
        Number(coverage?.covered ?? 0) + quantityCovered >
        Number(order.totalUnits)
      )
        return Response.json(
          {
            error:
              'A cobertura das etiquetas ultrapassa a quantidade do pedido.',
            requestId,
          },
          { status: 409 },
        );
    }
    const validation = validateDocument(file);
    if (validation)
      return Response.json({ error: validation, requestId }, { status: 422 });
    const documentId = crypto.randomUUID();
    const key = `orders/${id}/documents/${documentId}`;
    const now = new Date().toISOString();
    await storePrivateDocument(key, file);
    const number = form.get('number');
    const issuedAt = form.get('issuedAt');
    await getD1().batch([
      getD1()
        .prepare(
          `INSERT INTO order_documents (id,order_id,type,number,issuer,issued_at,storage_key,file_name,mime_type,size_bytes,quantity_covered,barcode_value,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending',?,?)`,
        )
        .bind(
          documentId,
          id,
          type,
          typeof number === 'string' ? number : null,
          issuer.trim(),
          typeof issuedAt === 'string' ? issuedAt : null,
          key,
          file.name,
          file.type,
          file.size,
          type === 'shipping_label' ? quantityCovered : 1,
          type === 'shipping_label' && barcodeValue ? barcodeValue : null,
          account.user.id,
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO order_events (id,order_id,type,actor_user_id,metadata,created_at) VALUES (?,?,'document.added',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          account.user.id,
          JSON.stringify({ documentId, type }),
          now,
        ),
    ]);
    const completed = await getD1()
      .prepare(
        `SELECT
          COALESCE(SUM(quantity_covered) FILTER (WHERE type='shipping_label'),0) labels,
          COUNT(*) FILTER (WHERE type IN ('nfe_danfe','content_declaration')) fiscal
         FROM order_documents WHERE order_id=?`,
      )
      .bind(id)
      .first<{ labels: number; fiscal: number }>();
    let orderStatus = order.status;
    if (
      order.status === 'paid_awaiting_documents' &&
      Number(completed?.labels ?? 0) >= Number(order.totalUnits) &&
      Number(completed?.fiscal ?? 0) > 0
    ) {
      const readyAt = new Date().toISOString();
      const operator = await selectAvailableOperator(order.supplierId);
      const readyStatements = [
        getD1()
          .prepare(
            `UPDATE orders SET status='ready_for_supplier',updated_at=? WHERE id=? AND status='paid_awaiting_documents'`,
          )
          .bind(readyAt, id),
        getD1()
          .prepare(
            `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'documents.completed','paid_awaiting_documents','ready_for_supplier',?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            account.user.id,
            JSON.stringify({
              required: ['shipping_label', 'fiscal_document'],
              labelCoverage: completed?.labels,
              totalUnits: order.totalUnits,
            }),
            readyAt,
          ),
        getD1()
          .prepare(
            `INSERT INTO shipments (id,order_id,carrier,status,preparation_deadline,created_at,updated_at) VALUES (?,?,'pending','preparing',?,?,?) ON CONFLICT(order_id) DO UPDATE SET preparation_deadline=excluded.preparation_deadline,updated_at=excluded.updated_at`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            addBusinessDays(readyAt, 1),
            readyAt,
            readyAt,
          ),
      ];
      if (operator)
        readyStatements.push(
          getD1()
            .prepare(
              `INSERT INTO fulfillment_assignments (order_id,member_id,assigned_by,assigned_at) VALUES (?,?,?,?) ON CONFLICT(order_id) DO NOTHING`,
            )
            .bind(id, operator.memberId, account.user.id, readyAt),
        );
      const supplierUser = await getD1()
        .prepare(
          `SELECT u.id FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.status='active' ORDER BY m.created_at LIMIT 1`,
        )
        .bind(order.supplierId)
        .first<{ id: string }>();
      if (supplierUser)
        readyStatements.push(
          getD1()
            .prepare(
              `INSERT INTO notifications (id,user_id,organization_id,type,title,body,entity_type,entity_id,created_at) VALUES (?,?,?,'order.ready','Novo pedido liberado','Pagamento e documentos confirmados. O prazo de postagem é de 1 dia útil.','order',?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              supplierUser.id,
              order.supplierId,
              id,
              readyAt,
            ),
        );
      await getD1().batch(readyStatements);
      orderStatus = 'ready_for_supplier';
    }
    return Response.json(
      { id: documentId, status: 'pending', orderStatus, requestId },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'POST order document' });
    return Response.json(
      {
        error: 'Não foi possível anexar o documento.',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { detail: error.message }
          : {}),
        requestId,
      },
      { status: 500 },
    );
  }
}
