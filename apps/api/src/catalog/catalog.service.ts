import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';

type PublicSkuRow = {
  sku_id: string;
  organization_id: string;
  product_id: string;
  sector_id: string;
  sku_code: string;
  sku_name: string;
  unit: string;
  minimum_order_qty: any;
  currency: string;
  product_name: string;
  organization_name: string;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantContextService) {}

  /** الاكتشاف العام يمر عبر function محكومة، وليس عبر قراءة tenant-private مباشرة. */
  async listPublic(sectorId?: string) {
    return this.prisma.$queryRaw<PublicSkuRow[]>`
      SELECT * FROM septlion_public_skus(${sectorId ?? null}::uuid, 50)
    `;
  }

  async publicSku(id: string) {
    const rows = await this.prisma.$queryRaw<PublicSkuRow[]>`
      SELECT * FROM septlion_public_skus(NULL::uuid, 200)
    `;

    const found = rows.find(row => row.sku_id === id);
    if (!found) throw new NotFoundException('SKU غير موجود أو غير منشور');

    // بعد إثبات أن SKU منشور، نقرأ تفاصيله من خلال tenant transaction
    // ولكن نمرر organizationId الخاص بالمالك المنشور فقط.
    return this.prisma.tenantTransaction(found.organization_id, async tx => {
      const sku = await tx.sKU.findFirst({
        where: { id, organizationId: found.organization_id },
        include: {
          media: { orderBy: { sortOrder: 'asc' } },
          product: { include: { sector: { include: { policies: true } } } },
        },
      });

      if (!sku || sku.product.status !== 'ACTIVE' || sku.product.visibility !== 'PUBLIC') {
        throw new NotFoundException('SKU غير موجود أو غير منشور');
      }

      return sku;
    });
  }

  async ownSku(id: string) {
    return this.prisma.tenantTransaction(this.tenant.organizationId, async tx => {
      const sku = await tx.sKU.findFirst({
        where: { id, organizationId: this.tenant.organizationId },
        include: { media: true, product: { include: { sector: { include: { policies: true } } } } },
      });
      if (!sku) throw new NotFoundException('SKU غير موجود');
      return sku;
    });
  }
}
