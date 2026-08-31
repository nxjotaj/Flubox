import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  StockAdjustmentDto,
  UpdateProductDto,
  VariantDto,
} from './products.dto';
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}
  list(search?: string, status?: string) {
    return this.prisma.product.findMany({
      where: {
        archivedAt: null,
        ...(status ? { status: status as never } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        files: {
          where: { kind: 'PRODUCT_IMAGE' },
          orderBy: { primary: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async find(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        files: true,
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!p) throw new NotFoundException('Produto não encontrado');
    return p;
  }
  async create(dto: CreateProductDto, actorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const p = await tx.product.create({
          data: {
            sku: dto.sku,
            name: dto.name,
            description: dto.description,
            category: dto.category,
            brand: dto.brand,
            price: dto.price,
            stockOnHand: dto.initialStock,
            weightGrams: dto.weightGrams,
            lengthMm: dto.lengthMm,
            widthMm: dto.widthMm,
            heightMm: dto.heightMm,
            gtin: dto.gtin,
            ncm: dto.ncm,
            status: 'ACTIVE',
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: p.id,
            actorId,
            type: 'ENTRY',
            quantity: dto.initialStock,
            balanceAfter: dto.initialStock,
            reason: 'Estoque inicial',
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            entityType: 'product',
            entityId: p.id,
            action: 'create',
            after: dto as never,
          },
        });
        return p;
      });
    } catch {
      throw new ConflictException('SKU já cadastrado');
    }
  }
  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const before = await this.find(id);
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          category: dto.category,
          brand: dto.brand,
          price: dto.price,
          weightGrams: dto.weightGrams,
          lengthMm: dto.lengthMm,
          widthMm: dto.widthMm,
          heightMm: dto.heightMm,
          gtin: dto.gtin,
          ncm: dto.ncm,
          status: dto.status,
          version: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          entityType: 'product',
          entityId: id,
          action: 'update',
          before: before as never,
          after: dto as never,
        },
      });
      return p;
    });
  }
  async adjust(id: string, dto: StockAdjustmentDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id } });
      if (!p) throw new NotFoundException('Produto não encontrado');
      const delta =
        dto.type === 'LOSS' ? -Math.abs(dto.quantity) : dto.quantity;
      const balance = p.stockOnHand + delta;
      if (balance < p.reservedStock || balance < 0)
        throw new ConflictException(
          'Ajuste deixaria o estoque abaixo da quantidade reservada',
        );
      const updated = await tx.product.update({
        where: { id },
        data: { stockOnHand: balance, version: { increment: 1 } },
      });
      await tx.stockMovement.create({
        data: {
          productId: id,
          actorId,
          type: dto.type,
          quantity: delta,
          balanceAfter: balance,
          reason: dto.reason,
          reference: dto.reference,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          entityType: 'product',
          entityId: id,
          action: 'stock_adjustment',
          reason: dto.reason,
          before: { stock: p.stockOnHand },
          after: { stock: balance, delta },
        },
      });
      return updated;
    });
  }
  async archive(id: string, actorId: string) {
    await this.find(id);
    return this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          entityType: 'product',
          entityId: id,
          action: 'archive',
        },
      }),
    ]);
  }
  async createVariant(productId:string,dto:VariantDto,actorId:string){await this.find(productId);const v=await this.prisma.productVariant.create({data:{productId,sku:dto.sku,name:dto.name,price:dto.price,stockOnHand:dto.stockOnHand,attributes:dto.attributes||{}}});await this.prisma.auditLog.create({data:{actorId,entityType:'variant',entityId:v.id,action:'create',after:dto as any}});return v}
  async updateVariant(productId:string,id:string,dto:VariantDto,actorId:string){const v=await this.prisma.productVariant.update({where:{id,productId},data:{sku:dto.sku,name:dto.name,price:dto.price,stockOnHand:dto.stockOnHand,attributes:dto.attributes||{}}});await this.prisma.auditLog.create({data:{actorId,entityType:'variant',entityId:id,action:'update',after:dto as any}});return v}
  async deleteVariant(productId:string,id:string,actorId:string){const v=await this.prisma.productVariant.update({where:{id,productId},data:{active:false}});await this.prisma.auditLog.create({data:{actorId,entityType:'variant',entityId:id,action:'deactivate'}});return v}
}
