import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'; import { AuditAction, Prisma, QuoteStatus, RFQStatus } from '@prisma/client'; import { PrismaService } from '../prisma/prisma.service'; import { TenantContextService } from '../common/tenant/tenant-context.service'; import { AuditService } from '../audit/audit.service'; import { CreateQuoteDto } from './dto/create-quote.dto'; import { ReviseQuoteDto } from './dto/revise-quote.dto';
@Injectable() export class QuoteService{
 constructor(private prisma:PrismaService,private tenant:TenantContextService,private audit:AuditService){}
 async create(dto:CreateQuoteDto){const org=this.tenant.organizationId;return this.prisma.tenantTransaction(org,async tx=>{const rfq=await tx.rFQ.findUnique({where:{id:dto.rfqId},include:{items:true}});if(!rfq)throw new NotFoundException('RFQ غير موجود');if(rfq.supplierOrgId!==org)throw new BadRequestException('RFQ غير موجه إلى مؤسستك');if(!( [RFQStatus.OPEN,RFQStatus.QUOTED,RFQStatus.NEGOTIATING] as RFQStatus[]).includes(rfq.status))throw new BadRequestException('RFQ لا يقبل عرضاً في حالته الحالية');if(!dto.items.length)throw new BadRequestException('Quote يجب أن يحتوي على عنصر');for(const i of dto.items){const sku=await tx.sKU.findFirst({where:{id:i.skuId,organizationId:org}});if(!sku)throw new BadRequestException('SKU غير مملوك للمورد');}const q=await tx.quote.create({data:{rfqId:rfq.id,buyerOrgId:rfq.buyerOrgId,supplierOrgId:org,status:QuoteStatus.SUBMITTED,currency:dto.currency,validUntil:dto.validUntil?new Date(dto.validUntil):undefined,paymentTerms:dto.paymentTerms,shippingTerms:dto.shippingTerms,notes:dto.notes,items:{create:dto.items.map(i=>({skuId:i.skuId,quantity:new Prisma.Decimal(i.quantity),unitPrice:new Prisma.Decimal(i.unitPrice)}))}},include:{items:true}});await tx.quoteRevision.create({data:{quoteId:q.id,revisionNo:1,status:'PROPOSED',currency:q.currency,validUntil:q.validUntil,paymentTerms:q.paymentTerms,shippingTerms:q.shippingTerms,notes:q.notes,snapshot:{items:dto.items} as unknown as Prisma.InputJsonValue}});if(rfq.status===RFQStatus.OPEN)await tx.rFQ.update({where:{id:rfq.id},data:{status:RFQStatus.QUOTED}});await this.audit.record(tx,{organizationId:org,userId:this.tenant.userId,action:AuditAction.QUOTE_SUBMITTED,entityType:'Quote',entityId:q.id,after:q});return q;});}
 mine(){return this.prisma.tenantTransaction(this.tenant.organizationId,tx=>tx.quote.findMany({orderBy:{createdAt:'desc'},include:{items:true,rfq:{select:{id:true,reference:true,status:true,buyerOrgId:true}}}}));}
 async get(id:string){return this.prisma.tenantTransaction(this.tenant.organizationId,async tx=>{const q=await tx.quote.findUnique({where:{id},include:{items:{include:{sku:true}},rfq:true,revisions:{orderBy:{revisionNo:'desc'}}}});if(!q)throw new NotFoundException('Quote غير موجود أو غير متاح');return q;});}

 async revise(id:string, dto:ReviseQuoteDto){
   const org=this.tenant.organizationId;
   return this.prisma.tenantTransaction(org,async tx=>{
     const quote=await tx.quote.findUnique({where:{id},include:{items:true,rfq:true}});
     if(!quote) throw new NotFoundException('Quote غير موجود');
     if(quote.supplierOrgId!==org) throw new BadRequestException('فقط المورد يستطيع تعديل العرض');
     if(!( [QuoteStatus.SUBMITTED,QuoteStatus.REVISED] as QuoteStatus[]).includes(quote.status)) throw new BadRequestException('Quote لا يقبل revision في حالته الحالية');
     if(!dto.items.length) throw new BadRequestException('يجب أن يحتوي العرض على عنصر واحد على الأقل');
     for(const item of dto.items){ const sku=await tx.sKU.findFirst({where:{id:item.skuId,organizationId:org}}); if(!sku) throw new BadRequestException('SKU غير مملوك للمورد'); }
     const last=await tx.quoteRevision.findFirst({where:{quoteId:id},orderBy:{revisionNo:'desc'}});
     const revisionNo=(last?.revisionNo ?? 0)+1;
     const snapshot={currency:dto.currency,validUntil:dto.validUntil ?? null,paymentTerms:dto.paymentTerms ?? null,shippingTerms:dto.shippingTerms ?? null,notes:dto.notes ?? null,items:dto.items};
     const rev=await tx.quoteRevision.create({data:{quoteId:id,revisionNo,status:'PROPOSED',currency:dto.currency,validUntil:dto.validUntil?new Date(dto.validUntil):undefined,paymentTerms:dto.paymentTerms,shippingTerms:dto.shippingTerms,notes:dto.notes,snapshot:snapshot as unknown as Prisma.InputJsonValue}});
     await tx.quoteRevision.updateMany({where:{quoteId:id,status:'PROPOSED',NOT:{id:rev.id}},data:{status:'SUPERSEDED'}});
     const updated=await tx.quote.update({where:{id},data:{status:QuoteStatus.REVISED,currency:dto.currency,validUntil:dto.validUntil?new Date(dto.validUntil):undefined,paymentTerms:dto.paymentTerms,shippingTerms:dto.shippingTerms,notes:dto.notes,items:{deleteMany:{},create:dto.items.map(i=>({skuId:i.skuId,quantity:new Prisma.Decimal(i.quantity),unitPrice:new Prisma.Decimal(i.unitPrice)}))}},include:{items:true}});
     await this.audit.record(tx,{organizationId:org,userId:this.tenant.userId,action:AuditAction.QUOTE_UPDATED,entityType:'Quote',entityId:id,before:quote,after:updated,metadata:{revisionId:rev.id,revisionNo}});
     return {quote:updated,revision:rev};
   });
 }

 async accept(id:string){
   const org=this.tenant.organizationId;
   return this.prisma.tenantTransaction(org,async tx=>{
     const quote=await tx.quote.findUnique({where:{id},include:{rfq:true}});
     if(!quote) throw new NotFoundException('Quote غير موجود');
     if(quote.buyerOrgId!==org) throw new BadRequestException('فقط المشتري يستطيع قبول العرض');
     if(!( [QuoteStatus.SUBMITTED,QuoteStatus.REVISED] as QuoteStatus[]).includes(quote.status)) throw new BadRequestException('Quote غير قابل للقبول');
     if(quote.validUntil && quote.validUntil < new Date()) throw new BadRequestException('انتهت صلاحية العرض');
     const updated=await tx.quote.update({where:{id},data:{status:QuoteStatus.ACCEPTED}}); await tx.quoteRevision.updateMany({where:{quoteId:id,status:'PROPOSED'},data:{status:'ACCEPTED'}});
     await tx.rFQ.update({where:{id:quote.rfqId},data:{status:RFQStatus.ACCEPTED}});
     await this.audit.record(tx,{organizationId:org,userId:this.tenant.userId,action:AuditAction.STATUS_CHANGE,entityType:'Quote',entityId:id,before:quote,after:updated});
     return updated;
   });
 }

}
