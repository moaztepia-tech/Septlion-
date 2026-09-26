import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: process.env.JWT_ACCESS_SECRET! });
  }
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { memberships: { where: { organizationId: payload.organizationId } } } });
    const membership = user?.memberships[0];
    if (!user?.isActive || !membership || user.sessionVersion !== payload.sessionVersion) throw new UnauthorizedException('جلسة غير صالحة');
    return { sub: user.id, organizationId: membership.organizationId, role: membership.role, sessionVersion: user.sessionVersion };
  }
}
