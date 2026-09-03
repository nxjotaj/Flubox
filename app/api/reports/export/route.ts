import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';

type ReportRow = {
  number: string;
  status: string;
  supplier: string;
  reseller: string;
  total: number;
  createdAt: string;
};
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response('Faça login.', { status: 401 });
  const account = await getAccountContext(user);
  if (!account) return new Response('Conta não encontrada.', { status: 403 });
  const format = new URL(request.url).searchParams.get('format') ?? 'xlsx';
  const admin = account.organization.type === 'platform';
  const where = admin
    ? ''
    : account.organization.type === 'supplier'
      ? 'WHERE o.supplier_organization_id=?'
      : 'WHERE o.reseller_organization_id=?';
  const statement = getD1().prepare(
    `SELECT o.number,o.status,s.display_name supplier,r.display_name reseller,o.total_cents total,o.created_at createdAt FROM orders o JOIN organizations s ON s.id=o.supplier_organization_id JOIN organizations r ON r.id=o.reseller_organization_id ${where} ORDER BY o.created_at DESC`,
  );
  const rows = admin
    ? await statement.all<ReportRow>()
    : await statement.bind(account.organization.id).all<ReportRow>();
  if (format === 'pdf') {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([842, 595]);
    let y = 555;
    const heading = () => {
      page.drawText('Flubox - Relatorio operacional', {
        x: 35,
        y,
        size: 17,
        font: bold,
        color: rgb(0.09, 0.09, 0.09),
      });
      y -= 28;
      page.drawText(
        'Pedido | Status | Fornecedor | Revendedor | Valor | Data',
        { x: 35, y, size: 8, font: bold },
      );
      y -= 16;
    };
    heading();
    for (const row of rows.results) {
      if (y < 35) {
        page = pdf.addPage([842, 595]);
        y = 555;
        heading();
      }
      const line =
        `${row.number} | ${row.status} | ${row.supplier} | ${row.reseller} | R$ ${(Number(row.total) / 100).toFixed(2)} | ${new Date(row.createdAt).toLocaleDateString('pt-BR')}`.slice(
          0,
          145,
        );
      page.drawText(line, { x: 35, y, size: 7, font });
      y -= 13;
    }
    const bytes = await pdf.save();
    return new Response(Buffer.from(bytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="flubox-relatorio.pdf"',
      },
    });
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Flubox';
  const sheet = workbook.addWorksheet('Pedidos');
  sheet.columns = [
    { header: 'Pedido', key: 'number', width: 24 },
    { header: 'Status', key: 'status', width: 24 },
    { header: 'Fornecedor', key: 'supplier', width: 28 },
    { header: 'Revendedor', key: 'reseller', width: 28 },
    { header: 'Valor', key: 'value', width: 16 },
    { header: 'Data', key: 'date', width: 20 },
  ];
  rows.results.forEach((row) =>
    sheet.addRow({
      number: row.number,
      status: row.status,
      supplier: row.supplier,
      reseller: row.reseller,
      value: Number(row.total) / 100,
      date: new Date(row.createdAt),
    }),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF171717' },
  };
  sheet.getColumn('value').numFmt = 'R$ #,##0.00';
  sheet.getColumn('date').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.autoFilter = 'A1:F1';
  const bytes = await workbook.xlsx.writeBuffer();
  return new Response(Buffer.from(bytes), {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="flubox-relatorio.xlsx"',
    },
  });
}
