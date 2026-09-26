import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}
  list() { return this.prisma.sector.findMany({ include: { policies: true }, orderBy: { name: 'asc' } }); }
  async get(code: string) { const sector = await this.prisma.sector.findUnique({ where: { code }, include: { policies: true } }); if (!sector) throw new NotFoundException('القطاع غير موجود'); return sector; }
}
