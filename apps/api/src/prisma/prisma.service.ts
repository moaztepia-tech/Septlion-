import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  async tenantTransaction<T>(organizationId: string, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!organizationId) throw new Error('Tenant context is required');
    return this.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
      return callback(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
