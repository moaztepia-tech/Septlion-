import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * المحادثة لا تختار المشاركين من الـ client.
   * الأطراف تُشتق حصراً من الكيان التجاري نفسه لمنع إضافة مؤسسة ثالثة.
   */
  private async participantsForEntity(tx: any, entityType: string, entityId: string) {
    if (entityType === 'RFQ') {
      const x = await tx.rFQ.findUnique({ where: { id: entityId }, select: { buyerOrgId: true, supplierOrgId: true } });
      if (!x) throw new NotFoundException('RFQ غير موجود أو غير متاح');
      return [x.buyerOrgId, x.supplierOrgId].filter(Boolean);
    }
    if (entityType === 'QUOTE') {
      const x = await tx.quote.findUnique({ where: { id: entityId }, select: { buyerOrgId: true, supplierOrgId: true } });
      if (!x) throw new NotFoundException('Quote غير موجود أو غير متاح');
      return [x.buyerOrgId, x.supplierOrgId];
    }
    if (entityType === 'ORDER_INTENT') {
      const x = await tx.orderIntent.findUnique({ where: { id: entityId }, select: { buyerOrgId: true, supplierOrgId: true } });
      if (!x) throw new NotFoundException('Order Intent غير موجود أو غير متاح');
      return [x.buyerOrgId, x.supplierOrgId];
    }
    throw new BadRequestException('نوع مساحة العمل غير مدعوم');
  }

  async ensure(orgId: string, input: any) {
    return this.prisma.tenantTransaction(orgId, async tx => {
      const participantOrgIds = [...new Set(await this.participantsForEntity(tx, input.entityType, input.entityId))] as string[];
      if (!participantOrgIds.includes(orgId)) throw new ForbiddenException();
      let c = await tx.conversation.findUnique({
        where: { entityType_entityId: { entityType: input.entityType, entityId: input.entityId } },
        include: { participants: true },
      });
      if (c && !c.participants.some(p => p.organizationId === orgId)) throw new ForbiddenException();
      if (!c) {
        c = await tx.conversation.create({
          data: {
            entityType: input.entityType,
            entityId: input.entityId,
            participants: { create: participantOrgIds.map(organizationId => ({ organizationId })) },
          },
          include: { participants: true },
        });
      }
      return c;
    });
  }

  async messages(orgId: string, id: string) {
    return this.prisma.tenantTransaction(orgId, async tx => {
      const p = await tx.conversationParticipant.findUnique({ where: { conversationId_organizationId: { conversationId: id, organizationId: orgId } } });
      if (!p) throw new ForbiddenException();
      return tx.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' } });
    });
  }

  async send(orgId: string, userId: string, id: string, input: any) {
    return this.prisma.tenantTransaction(orgId, async tx => {
      const p = await tx.conversationParticipant.findUnique({ where: { conversationId_organizationId: { conversationId: id, organizationId: orgId } } });
      if (!p) throw new ForbiddenException();
      const body = String(input.body || '').trim().slice(0, 10000);
      if (!body && !input.documentId) throw new BadRequestException('الرسالة فارغة');
      const m = await tx.message.create({ data: { conversationId: id, senderUserId: userId, senderOrgId: orgId, type: input.type || 'TEXT', body, documentId: input.documentId } });
      await tx.outboxEvent.create({ data: { organizationId: orgId, type: 'MESSAGE_SENT', aggregateType: 'Conversation', aggregateId: id, payload: { messageId: m.id } } });
      return m;
    });
  }
}
