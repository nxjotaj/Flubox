import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
@Controller('exports')
export class ExportsController {
  constructor(private db: PrismaService) {}
  private async rows(search?: string) {
    return this.db.product.findMany({
      where: {
        archivedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { variants: true, files: { where: { kind: 'PRODUCT_IMAGE' } } },
      orderBy: { name: 'asc' },
    });
  }
  @Get('catalog.csv') async csv(
    @Res() res: Response,
    @Query('search') s?: string,
  ) {
    const xs = await this.rows(s),
      head = [
        'SKU',
        'Nome',
        'Descrição',
        'Categoria',
        'Marca',
        'Preço',
        'Estoque',
        'Reservado',
        'Peso(g)',
        'Comprimento(mm)',
        'Largura(mm)',
        'Altura(mm)',
        'GTIN',
        'NCM',
        'Variações',
        'Fotos',
      ],
      esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const lines = [
      head,
      ...xs.map((x) => [
        x.sku,
        x.name,
        x.description,
        x.category,
        x.brand,
        x.price,
        x.stockOnHand,
        x.reservedStock,
        x.weightGrams,
        x.lengthMm,
        x.widthMm,
        x.heightMm,
        x.gtin,
        x.ncm,
        x.variants.map((v) => v.sku).join('|'),
        x.files.map((f) => f.filename).join('|'),
      ]),
    ]
      .map((r) => r.map(esc).join(';'))
      .join('\r\n');
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="catalogo-flubox.csv"',
      })
      .send('\ufeff' + lines);
  }
  @Get('catalog.xlsx') async xlsx(
    @Res() res: Response,
    @Query('search') s?: string,
  ) {
    const xs = await this.rows(s),
      w = new ExcelJS.Workbook(),
      sh = w.addWorksheet('Catálogo');
    sh.columns = ([
      ['sku', 'SKU', 18],
      ['name', 'Nome', 35],
      ['description', 'Descrição', 50],
      ['category', 'Categoria', 22],
      ['brand', 'Marca', 18],
      ['price', 'Preço', 14],
      ['stockOnHand', 'Estoque', 12],
      ['reservedStock', 'Reservado', 12],
      ['weightGrams', 'Peso (g)', 12],
      ['lengthMm', 'Comprimento (mm)', 18],
      ['widthMm', 'Largura (mm)', 15],
      ['heightMm', 'Altura (mm)', 15],
      ['gtin', 'GTIN', 18],
      ['ncm', 'NCM', 14],
    ].map(([key, header, width]) => ({ key, header, width })) as any);
    xs.forEach((x) => sh.addRow(x));
    sh.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sh.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1769E0' },
    };
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="catalogo-flubox.xlsx"',
    });
    await w.xlsx.write(res);
    res.end();
  }
  @Get('orders.xlsx') async orders(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const xs = await this.db.order.findMany({
        where: {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        },
        include: { seller: true, payments: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      w = new ExcelJS.Workbook(),
      sh = w.addWorksheet('Pedidos');
    sh.columns = ([
      ['number', 'Pedido', 24],
      ['createdAt', 'Data', 22],
      ['seller', 'Lojista', 30],
      ['status', 'Status', 22],
      ['payment', 'Pagamento', 18],
      ['items', 'Itens', 10],
      ['total', 'Total', 15],
    ].map(([key, header, width]) => ({ key, header, width })) as any);
    xs.forEach((x) =>
      sh.addRow({
        number: x.number,
        createdAt: x.createdAt,
        seller: x.seller.companyName || x.seller.name,
        status: x.status,
        payment: x.payments[0]?.status || '',
        items: x.items.reduce((a, i) => a + i.quantity, 0),
        total: Number(x.total),
      }),
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="relatorio-pedidos.xlsx"',
    });
    await w.xlsx.write(res);
    res.end();
  }
}
