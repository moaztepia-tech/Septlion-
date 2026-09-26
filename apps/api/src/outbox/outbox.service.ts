import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * عامل الـOutbox يستخدم اتصالاً منفصلاً بقاعدة البيانات.
 * في الإنتاج يجب أن يكون WORKER_DATABASE_URL لدور PostgreSQL محدود ومخصص للـworker
 * مع BYPASSRLS، ولا يُستخدم أبداً لخدمة HTTP.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly log = new Logger(OutboxService.name);
  private readonly worker = new PrismaClient({ datasources: { db: { url: process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL } } });

  async onModuleInit() { await this.worker.$connect(); this.timer = setInterval(() => void this.tick(), 5000); }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.worker.$disconnect(); }

  async tick() {
    const events = await this.worker.outboxEvent.findMany({ where: { status: 'PENDING', availableAt: { lte: new Date() } }, take: 25, orderBy: { createdAt: 'asc' } });
    for (const e of events) {
      try {
        await this.worker.$transaction(async tx => {
          const locked = await tx.outboxEvent.updateMany({ where: { id: e.id, status: 'PENDING' }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });
          if (!locked.count) return;
          // TODO: route to the counterparty organization based on aggregate context.
          // For now operational events remain visible to the originating organization only.
          if (['MESSAGE_SENT', 'DOCUMENT_READY'].includes(e.type)) {
            await tx.notification.create({ data: { organizationId: e.organizationId, type: e.type === 'MESSAGE_SENT' ? 'MESSAGE' : 'DOCUMENT', title: e.type === 'MESSAGE_SENT' ? 'رسالة جديدة' : 'مستند جاهز', body: 'يوجد تحديث جديد داخل مساحة الصفقة.', entityId: e.aggregateId } });
          }
          await tx.outboxEvent.update({ where: { id: e.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
        });
      } catch (err: any) {
        this.log.error(err);
        await this.worker.outboxEvent.update({ where: { id: e.id }, data: { status: 'FAILED', lastError: String(err?.message || err).slice(0, 1000) } }).catch(() => undefined);
      }
    }
  }
}
