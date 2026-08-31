import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]), PrismaModule, AuthModule, ProductsModule, UsersModule, OrdersModule, SettingsModule, DashboardModule, FilesModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
