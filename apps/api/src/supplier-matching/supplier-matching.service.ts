import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';

type PublicSku = {
  sku_id: string; organization_id: string; product_id: string; sector_id: string;
  sku_code: string; sku_name: string; unit: string; minimum_order_qty: any;
  currency: string; product_name: string; organization_name: string;
};

@Injectable()
export class SupplierMatchingService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService) {}

  async matchRfq(rfqId: string, limit = 20) {
    return this.prisma.tenantTransaction(this.tenant.organizationId, async tx => {
      const rfq = await tx.rFQ.findUnique({ where: { id: rfqId }, include: { items: true } });
      if (!rfq) throw new NotFoundException('RFQ غير موجود أو غير متاح');
      if (rfq.buyerOrgId !== this.tenant.organizationId) throw new BadRequestException('لا يمكنك مطابقة RFQ لا تملكه');

      const rows = await tx.$queryRaw<PublicSku[]>`SELECT * FROM septlion_public_skus(${rfq.sectorId}::uuid, 200)`;
      const required = new Map(rfq.items.map(i => [i.skuId, Number(i.quantity)]));

      const candidates = new Map<string, any>();
      for (const row of rows) {
        const needed = required.get(row.sku_id);
        if (needed == null) continue;
        if (Number(row.minimum_order_qty) > needed) continue;
        const current = candidates.get(row.organization_id) ?? { supplierOrgId: row.organization_id, supplierName: row.organization_name, score: 0, matchedItems: [] };
        current.score += 70;
        current.matchedItemIds ??= new Set<string>();
        current.matchedItemIds.add(row.sku_id);
        current.matchedItems.push({ skuId: row.sku_id, skuCode: row.sku_code, quantity: needed });
        candidates.set(row.organization_id, current);
      }

      return [...candidates.values()].filter(c => c.matchedItemIds?.size === rfq.items.length).map(c => ({ ...c, matchedItemIds: undefined })).sort((a, b) => b.score - a.score).slice(0, Math.min(Math.max(limit, 1), 50));
    });
  }
}
