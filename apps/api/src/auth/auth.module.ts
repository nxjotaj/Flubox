import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller'; import { AuthService } from './auth.service'; import { JwtGuard } from './jwt.guard'; import { JwtStrategy } from './jwt.strategy'; import { RolesGuard } from './roles.guard';
@Module({ imports: [PassportModule, JwtModule.register({})], controllers: [AuthController], providers: [AuthService, JwtStrategy, { provide: APP_GUARD, useClass: JwtGuard }, { provide: APP_GUARD, useClass: RolesGuard }] })
export class AuthModule {}
