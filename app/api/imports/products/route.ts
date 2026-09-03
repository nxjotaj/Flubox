import { readSheet } from 'read-excel-file/browser';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import {
  calculateProductQuality,
  canSubmitForReview,
} from '@/modules/catalog/quality';
import { requireAccountPermission } from '@/modules/identity/service';
const required = [
  'sku',
  'titulo',
  'descricao',
  'preco',
  'estoque',
  'prazo_dias',
];
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'products.manage');
    if (account.organization.type !== 'supplier')
      return Response.json(
        { error: 'Apenas fornecedores importam produtos.', requestId },
        { status: 403 },
      );
    if (account.organization.status !== 'active')
      return Response.json(
        {
          error:
            'Seu fornecedor precisa ser aprovado antes de importar produtos.',
          requestId,
        },
        { status: 403 },
      );
    const subscription = await getD1()
      .prepare('SELECT status FROM subscriptions WHERE organization_id=?')
      .bind(account.organization.id)
      .first<{ status: string }>();
    if (
      !subscription ||
      !['active', 'grace_period'].includes(subscription.status)
    )
      return Response.json(
        { error: 'Regularize a assinatura para importar produtos.', requestId },
        { status: 403 },
      );
    const form = await request.formData();
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith('.xlsx') ||
      file.size > 8 * 1024 * 1024
    )
      return Response.json(
        { error: 'Envie uma planilha XLSX de até 8 MB.', requestId },
        { status: 422 },
      );
    const rows = await readSheet(file);
    if (rows.length < 2)
      return Response.json(
        { error: 'A planilha não possui produtos.', requestId },
        { status: 422 },
      );
    if (rows.length > 501)
      return Response.json(
        {
          error:
            'Esta versão processa até 500 linhas por arquivo. Divida a planilha para preservar a operação.',
          requestId,
        },
        { status: 422 },
      );
    const headers = rows[0].map((value) =>
      String(value ?? '')
        .trim()
        .toLowerCase(),
    );
    const missing = required.filter((item) => !headers.includes(item));
    if (missing.length)
      return Response.json(
        {
          error: `Colunas obrigatórias ausentes: ${missing.join(', ')}.`,
          requestId,
        },
        { status: 422 },
      );
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const d1 = getD1();
    await d1
      .prepare(
        `INSERT INTO import_jobs (id,organization_id,file_name,status,total_rows,created_by,created_at) VALUES (?,?,?,'processing',?,?,?)`,
      )
      .bind(
        jobId,
        account.organization.id,
        file.name,
        rows.length - 1,
        account.user.id,
        now,
      )
      .run();
    let imported = 0,
      pending = 0,
      rejected = 0;
    for (let index = 1; index < rows.length; index++) {
      const values = Object.fromEntries(
        headers.map((header, column) => [
          header,
          String(rows[index][column] ?? '').trim(),
        ]),
      );
      const priceCents = Math.round(
        Number(values.preco.replace(',', '.')) * 100,
      );
      const stock = Number(values.estoque);
      const preparationDays = Number(values.prazo_dias);
      const errors: [string, string][] = [];
      if (!values.sku) errors.push(['sku', 'SKU obrigatório']);
      if (values.titulo.length < 5)
        errors.push(['titulo', 'Título deve ter ao menos 5 caracteres']);
      if (values.descricao.length < 10)
        errors.push(['descricao', 'Descrição deve ter ao menos 10 caracteres']);
      if (!Number.isInteger(priceCents) || priceCents <= 0)
        errors.push(['preco', 'Preço inválido']);
      if (!Number.isInteger(stock) || stock < 0)
        errors.push(['estoque', 'Estoque deve ser inteiro e não negativo']);
      if (!Number.isInteger(preparationDays) || preparationDays < 1)
        errors.push(['prazo_dias', 'Prazo deve ser ao menos 1 dia']);
      if (errors.length) {
        rejected++;
        for (const [column, error] of errors)
          await d1
            .prepare(
              `INSERT INTO import_errors (id,job_id,row_number,column_name,received_value,error,recommendation) VALUES (?,?,?,?,?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              jobId,
              index + 1,
              column,
              values[column] ?? null,
              error,
              'Corrija o valor e importe a linha novamente.',
            )
            .run();
        continue;
      }
      const productId = crypto.randomUUID();
      const qualityScore = calculateProductQuality({
        sku: values.sku,
        title: values.titulo,
        description: values.descricao,
        brand: values.marca,
        gtin: values.gtin,
        ncm: values.ncm,
        priceCents,
        stock,
        preparationDays,
      });
      const status = canSubmitForReview(qualityScore) ? 'approved' : 'draft';
      if (status === 'draft') pending++;
      else imported++;
      try {
        await d1.batch([
          d1
            .prepare(
              `INSERT INTO products (id,organization_id,sku,title,description,brand,gtin,ncm,status,quality_score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
            .bind(
              productId,
              account.organization.id,
              values.sku,
              values.titulo,
              values.descricao,
              values.marca || null,
              values.gtin || null,
              values.ncm || null,
              status,
              qualityScore,
              now,
              now,
            ),
          d1
            .prepare(
              `INSERT INTO supplier_offers (id,product_id,organization_id,price_cents,commission_basis_points,preparation_days,created_at,updated_at) VALUES (?,?,?, ?,1000,?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              productId,
              account.organization.id,
              priceCents,
              preparationDays,
              now,
              now,
            ),
          d1
            .prepare(
              `INSERT INTO inventory_movements (id,product_id,organization_id,type,quantity,reference_type,reference_id,created_by,created_at) VALUES (?,?,?,'initial',?,'import_job',?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              productId,
              account.organization.id,
              stock,
              jobId,
              account.user.id,
              now,
            ),
        ]);
      } catch {
        rejected++;
        await d1
          .prepare(
            `INSERT INTO import_errors (id,job_id,row_number,column_name,received_value,error,recommendation) VALUES (?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            jobId,
            index + 1,
            'sku',
            values.sku,
            'SKU duplicado ou registro inválido',
            'Use um SKU único dentro da organização.',
          )
          .run();
      }
    }
    const completedAt = new Date().toISOString();
    await d1
      .prepare(
        `UPDATE import_jobs SET status='completed',imported_rows=?,pending_rows=?,rejected_rows=?,completed_at=? WHERE id=?`,
      )
      .bind(imported, pending, rejected, completedAt, jobId)
      .run();
    return Response.json(
      { jobId, total: rows.length - 1, imported, pending, rejected, requestId },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'POST product import' });
    return Response.json(
      { error: 'Não foi possível processar a planilha.', requestId },
      { status: 500 },
    );
  }
}
