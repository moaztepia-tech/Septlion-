import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private hashRefresh(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() }, include: { memberships: { where: { organizationId: dto.organizationId } } } });
    const membership = user?.memberships[0];
    if (!user || !membership || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    return this.issue(user.id, membership.organizationId, membership.role, user.sessionVersion);
  }

  private async issue(userId: string, organizationId: string, role: any, sessionVersion: number) {
    const accessToken = await this.jwt.signAsync({ sub: userId, organizationId, role, sessionVersion }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' });
    const refreshToken = randomBytes(48).toString('base64url');
    const ttl = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    const expiresAt = new Date(Date.now() + ttl * 86400000);
    await this.prisma.refreshSession.create({ data: { userId, organizationId, tokenHash: this.hashRefresh(refreshToken), expiresAt } });
    return { accessToken, refreshToken, expiresAt };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefresh(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token غير صالح');
    const user = await this.prisma.user.findUnique({ where: { id: session.userId }, include: { memberships: { where: { organizationId: session.organizationId } } } });
    const membership = user?.memberships[0];
    if (!user || !membership || !user.isActive) throw new UnauthorizedException('المستخدم غير صالح');
    const result = await this.prisma.$transaction(async tx => {
      await tx.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      const newToken = randomBytes(48).toString('base64url');
      const ttl = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
      await tx.refreshSession.create({ data: { userId: user.id, organizationId: session.organizationId, tokenHash: this.hashRefresh(newToken), expiresAt: new Date(Date.now() + ttl * 86400000) } });
      return newToken;
    });
    const accessToken = await this.jwt.signAsync({ sub: user.id, organizationId: session.organizationId, role: membership.role, sessionVersion: user.sessionVersion }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' });
    return { accessToken, refreshToken: result };
  }

  async organizations(userId: string) {
    return this.prisma.membership.findMany({ where: { userId }, include: { organization: true }, orderBy: { createdAt: 'asc' } });
  }

  async switchOrganization(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, include: { user: true } });
    if (!membership || !membership.user.isActive) throw new UnauthorizedException('المؤسسة غير متاحة للمستخدم');
    return this.issue(userId, organizationId, membership.role, membership.user.sessionVersion);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshSession.updateMany({ where: { tokenHash: this.hashRefresh(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }
}
