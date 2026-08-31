import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.user.upsert({ where: { email: 'admin@flubox.local' }, update: {}, create: { email: 'admin@flubox.local', passwordHash: await bcrypt.hash('Admin@12345', 12), name: 'Administrador Flubox', companyName: 'Flubox', role: 'ADMIN', status: 'APPROVED', emailVerifiedAt: new Date(), approvedAt: new Date(), privacyAcceptedAt: new Date(), termsAcceptedAt: new Date() } });
  await prisma.product.upsert({ where: { sku: 'ORG-001' }, update: {}, create: { sku: 'ORG-001', name: 'Organizador Modular', description: 'Produto inicial para testes do fluxo operacional.', category: 'Casa', brand: 'Flubox', price: 49.9, stockOnHand: 25, weightGrams: 750, lengthMm: 320, widthMm: 240, heightMm: 120, status: 'ACTIVE', stockMovements: { create: { actorId: admin.id, type: 'ENTRY', quantity: 25, balanceAfter: 25, reason: 'Carga inicial' } } } });
}
void main().finally(() => prisma.$disconnect());
