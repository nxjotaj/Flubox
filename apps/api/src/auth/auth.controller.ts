import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { Public } from './auth.decorators';
@ApiTags('Autenticação') @Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @Public() @Post('register') register(@Body() dto: RegisterDto) { return this.service.register(dto); }
  @Public() @Post('login') login(@Body() dto: LoginDto, @Req() req: { headers: Record<string, string>; ip?: string }) { return this.service.login(dto, req.headers['user-agent'], req.ip); }
}
