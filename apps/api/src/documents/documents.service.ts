import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertWorkspaceAccess(tx: any, orgId: string, entityType: string, entityId: string) {
    let entity: any = null;
    if (entityType === 'RFQ') entity = await tx.rFQ.findUnique({ where: { id: entityId }, select: { buyerOrgId: true, supplierOrgId: true } });
    if (entityType === 'QUOTE') entity = await tx.quote.findUnique({ where: { id: entityId }, select: { buyerOrgId: true, supplierOrgId: true } });
    if (entityType === 'ORDER_INTENT') entity = await tx.orderIntent.findUnique({ where: { id: entityId }, select: { buyerOrgId: true, supplierOrgId: true } });
    if (!entity) throw new NotFoundException('مساحة العمل غير موجودة أو غير متاحة');
    if (![entity.buyerOrgId, entity.supplierOrgId].filter(Boolean).includes(orgId)) throw new ForbiddenException();
  }

  async prepare(orgId: string, userId: string, input: any) {
    if (!input?.fileName || !input?.mimeType || !input?.byteSize || !input?.entityType || !input?.entityId) throw new BadRequestException('بيانات الملف غير مكتملة');
    if (Number(input.byteSize) <= 0 || Number(input.byteSize) > 50 * 1024 * 1024) throw new BadRequestException('حجم الملف غير مسموح');
    const key = `commercial/${orgId}/${input.entityType}/${input.entityId}/${randomUUID()}`;
    return this.prisma.tenantTransaction(orgId, async tx => {
      await this.assertWorkspaceAccess(tx, orgId, input.entityType, input.entityId);
      const doc = await tx.commercialDocument.create({ data: { organizationId: orgId, uploadedById: userId, entityType: input.entityType, entityId: input.entityId, fileName: String(input.fileName).slice(0, 255), mimeType: String(input.mimeType).slice(0, 120), byteSize: BigInt(input.byteSize), storageKey: key, sha256: 'PENDING', visibilityToCounterparty: !!input.visibilityToCounterparty } });
      await tx.outboxEvent.create({ data: { organizationId: orgId, type: 'DOCUMENT_UPLOAD_PREPARED', aggregateType: 'CommercialDocument', aggregateId: doc.id, payload: { documentId: doc.id, storageKey: key } } });
      return { documentId: doc.id, storageKey: key, upload: { provider: 'OBJECT_STORAGE', method: 'PUT', note: 'استبدل هذا في الإنتاج بـ S3/R2 presigned URL من StorageAdapter' } };
    });
  }

  async complete(orgId: string, id: string, sha256: string) {
    if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new BadRequestException('SHA-256 غير صالح');
    return this.prisma.tenantTransaction(orgId, async tx => {
      const existing = await tx.commercialDocument.findFirst({ where: { id, organizationId: orgId } });
      if (!existing) throw new NotFoundException('المستند غير موجود');
      const doc = await tx.commercialDocument.update({ where: { id }, data: { sha256: sha256.toLowerCase(), status: 'READY' } });
      await tx.outboxEvent.create({ data: { organizationId: orgId, type: 'DOCUMENT_READY', aggregateType: 'CommercialDocument', aggregateId: id, payload: { documentId: id, entityType: doc.entityType, entityId: doc.entityId } } });
      return doc;
    });
  }

  list(orgId: string, entityType: any, entityId: string) {
    return this.prisma.tenantTransaction(orgId, async tx => {
      await this.assertWorkspaceAccess(tx, orgId, entityType, entityId);
      return tx.commercialDocument.findMany({ where: { entityType, entityId, status: 'READY', OR: [{ organizationId: orgId }, { visibilityToCounterparty: true }] }, orderBy: { createdAt: 'desc' } });
    });
  }
}
