import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {}
  async register(dto: RegisterDto) {
    if (!dto.acceptTerms || !dto.acceptPrivacy) throw new ForbiddenException('Aceite os termos e a política de privacidade');
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('E-mail já cadastrado');
    return this.prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(dto.password, 12), name: dto.name, companyName: dto.companyName, taxId: dto.taxId, status: 'PENDING_APPROVAL', emailVerifiedAt: new Date(), termsAcceptedAt: new Date(), privacyAcceptedAt: new Date() }, select: { id: true, email: true, name: true, status: true } });
  }
  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Credenciais inválidas');
    if (user.status !== 'APPROVED') throw new ForbiddenException(`Conta ${user.status.toLowerCase()}`);
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role }, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '15m' });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.session.create({ data: { userId: user.id, refreshTokenHash: createHash('sha256').update(refreshToken).digest('hex'), userAgent, ipHash: ip ? createHash('sha256').update(ip).digest('hex') : undefined, expiresAt: new Date(Date.now() + 14 * 86400000) } });
    return { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  }
  async refresh(refreshToken: string) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'APPROVED') throw new UnauthorizedException('Sessão expirada');
    const accessToken = await this.jwt.signAsync({ sub: session.user.id, role: session.user.role }, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '15m' });
    return { accessToken, user: { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role } };
  }
  async logout(refreshToken: string) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.session.updateMany({ where: { refreshTokenHash: hash }, data: { revokedAt: new Date() } });
    return { success: true };
  }
  async forgot(email: string) {
    const user=await this.prisma.user.findUnique({where:{email:email.toLowerCase()}}); if(!user)return{success:true};
    const token=randomBytes(32).toString('hex'),tokenHash=createHash('sha256').update(token).digest('hex');
    await this.prisma.$transaction([this.prisma.passwordReset.create({data:{userId:user.id,tokenHash,expiresAt:new Date(Date.now()+3600000)}}),this.prisma.notification.create({data:{userId:user.id,channel:'EMAIL',type:'PASSWORD_RESET',title:'Recuperação de senha',body:`Token de recuperação: ${token}`,status:'pending'}})]);
    return {success:true,...(this.config.get('NODE_ENV')==='development'?{developmentToken:token}:{})};
  }
  async reset(token:string,password:string){const hash=createHash('sha256').update(token).digest('hex'),r=await this.prisma.passwordReset.findUnique({where:{tokenHash:hash}});if(!r||r.usedAt||r.expiresAt<new Date())throw new UnauthorizedException('Token inválido ou expirado');await this.prisma.$transaction([this.prisma.user.update({where:{id:r.userId},data:{passwordHash:await bcrypt.hash(password,12)}}),this.prisma.passwordReset.update({where:{id:r.id},data:{usedAt:new Date()}}),this.prisma.session.updateMany({where:{userId:r.userId},data:{revokedAt:new Date()}})]);return{success:true}}
}
