import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ForgotDto, LoginDto, RefreshDto, RegisterDto, ResetDto } from './auth.dto';
import { Public } from './auth.decorators';
@ApiTags('Autenticação') @Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @Public() @Post('register') register(@Body() dto: RegisterDto) { return this.service.register(dto); }
  @Public() @Post('login') login(@Body() dto: LoginDto, @Req() req: { headers: Record<string, string>; ip?: string }) { return this.service.login(dto, req.headers['user-agent'], req.ip); }
  @Public() @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.service.refresh(dto.refreshToken); }
  @Public() @Post('logout') logout(@Body() dto: RefreshDto) { return this.service.logout(dto.refreshToken); }
  @Public() @Post('forgot-password') forgot(@Body() dto: ForgotDto) { return this.service.forgot(dto.email); }
  @Public() @Post('reset-password') reset(@Body() dto: ResetDto) { return this.service.reset(dto.token, dto.password); }
}
