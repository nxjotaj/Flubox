import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import { FileKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { recognize } from 'tesseract.js';
@Injectable()
export class FilesService implements OnModuleInit {
  private sb: SupabaseClient;
  private bucket = 'flubox-private';
  constructor(
    private db: PrismaService,
    c: ConfigService,
  ) {
    this.sb = createClient(
      c.getOrThrow('SUPABASE_URL'),
      c.getOrThrow('SUPABASE_SECRET_KEY'),
      { auth: { persistSession: false } },
    );
  }
  async onModuleInit() {
    const { x } = { x: await this.sb.storage.getBucket(this.bucket) };
    if (x.error)
      await this.sb.storage.createBucket(this.bucket, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ],
      });
  }
  async upload(
    orderId: string,
    kind: FileKind,
    file: Express.Multer.File,
    user: any,
  ) {
    if (
      ![
        'PAYMENT_RECEIPT',
        'SHIPPING_LABEL',
        'INVOICE',
        'CONTENT_DECLARATION',
      ].includes(kind)
    )
      throw new BadRequestException('Tipo de documento inválido');
    if (
      !file ||
      !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(
        file.mimetype,
      ) ||
      file.size > 10 * 1024 * 1024
    )
      throw new BadRequestException(
        'Arquivo inválido. Use PDF, JPG, PNG ou WEBP até 10 MB',
      );
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { payments: true, files: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (user.role === 'SELLER' && order.sellerId !== user.id)
      throw new ForbiddenException();
    const key = `orders/${orderId}/${kind.toLowerCase()}-${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const up = await this.sb.storage
      .from(this.bucket)
      .upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
    if (up.error)
      throw new BadRequestException(
        'Falha no armazenamento: ' + up.error.message,
      );
    const saved = await this.db.fileObject.create({
      data: {
        ownerId: user.id,
        orderId,
        kind,
        storageKey: key,
        filename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        checksum: createHash('sha256').update(file.buffer).digest('hex'),
        scanStatus: 'accepted',
      },
    });
    if (kind === 'PAYMENT_RECEIPT' && file.mimetype.startsWith('image/')) {
      try {
        const result = await recognize(file.buffer, 'por');
        const text = result.data.text.replace(/\s+/g, ' ').trim();
        const values = [...text.matchAll(/(?:R\$\s*)?(\d{1,6}[.,]\d{2})/g)].map(
          (m) => Number(m[1].replace('.', '').replace(',', '.')),
        );
        const expected = Number(order.payments[0]?.amount || order.total),
          extracted = values.sort(
            (a, b) => Math.abs(a - expected) - Math.abs(b - expected),
          )[0];
        await this.db.payment.updateMany({
          where: { orderId },
          data: {
            receiptExtraction: {
              text: text.slice(0, 4000),
              extractedValue: extracted || null,
              expectedValue: expected,
              divergent: extracted
                ? Math.abs(extracted - expected) > 0.01
                : true,
            },
            receiptConfidence: result.data.confidence / 100,
            ...(extracted && Math.abs(extracted - expected) > 0.01
              ? {
                  status: 'REVIEW',
                  reviewReason:
                    'OCR identificou valor divergente no comprovante',
                }
              : {}),
          },
        });
      } catch {
        await this.db.payment.updateMany({
          where: { orderId },
          data: {
            receiptExtraction: {
              error: 'OCR não conseguiu processar o arquivo',
            },
            receiptConfidence: 0,
          },
        });
      }
    }
    const all = [...order.files, saved];
    if (
      order.payments.some((p) => p.status === 'CONFIRMED') &&
      all.some((f) => f.kind === 'SHIPPING_LABEL') &&
      all.some((f) => ['INVOICE', 'CONTENT_DECLARATION'].includes(f.kind))
    )
      await this.db.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
      });
    return saved;
  }
  async url(id: string, user: any) {
    const f = await this.db.fileObject.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!f) throw new NotFoundException('Arquivo não encontrado');
    if (user.role === 'SELLER' && f.order?.sellerId !== user.id)
      throw new ForbiddenException();
    const x = await this.sb.storage
      .from(this.bucket)
      .createSignedUrl(f.storageKey, 300);
    if (x.error) throw new BadRequestException(x.error.message);
    return { url: x.data.signedUrl, expiresIn: 300 };
  }
  async productImage(productId:string,file:Express.Multer.File,actorId:string){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.mimetype)||file.size>10485760)throw new BadRequestException('Imagem inválida');const product=await this.db.product.findUnique({where:{id:productId},include:{files:true}});if(!product)throw new NotFoundException('Produto não encontrado');const key=`products/${productId}/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`,up=await this.sb.storage.from(this.bucket).upload(key,file.buffer,{contentType:file.mimetype});if(up.error)throw new BadRequestException(up.error.message);return this.db.fileObject.create({data:{ownerId:actorId,productId,kind:'PRODUCT_IMAGE',storageKey:key,filename:file.originalname,contentType:file.mimetype,sizeBytes:file.size,checksum:createHash('sha256').update(file.buffer).digest('hex'),scanStatus:'accepted',primary:!product.files.some(f=>f.kind==='PRODUCT_IMAGE')}})}
  async primaryImage(productId:string,fileId:string){return this.db.$transaction(async tx=>{await tx.fileObject.updateMany({where:{productId,kind:'PRODUCT_IMAGE'},data:{primary:false}});return tx.fileObject.update({where:{id:fileId,productId},data:{primary:true}})})}
  async deleteProductImage(productId:string,fileId:string,actorId:string){const f=await this.db.fileObject.findUnique({where:{id:fileId,productId}});if(!f)throw new NotFoundException('Imagem não encontrada');await this.sb.storage.from(this.bucket).remove([f.storageKey]);await this.db.$transaction([this.db.fileObject.delete({where:{id:fileId}}),this.db.auditLog.create({data:{actorId,entityType:'product_image',entityId:fileId,action:'delete'}})]);return{success:true}}
}
