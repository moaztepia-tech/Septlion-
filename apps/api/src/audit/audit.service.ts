import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
@Injectable()
export class AuditService {
  record(tx: Prisma.TransactionClient, data: { organizationId: string; userId?: string; action: AuditAction; entityType: string; entityId: string; before?: unknown; after?: unknown; metadata?: unknown; }) {
    return tx.auditLog.create({ data: { organizationId: data.organizationId, userId: data.userId, action: data.action, entityType: data.entityType, entityId: data.entityId, before: data.before as Prisma.InputJsonValue | undefined, after: data.after as Prisma.InputJsonValue | undefined, metadata: data.metadata as Prisma.InputJsonValue | undefined } });
  }
}
