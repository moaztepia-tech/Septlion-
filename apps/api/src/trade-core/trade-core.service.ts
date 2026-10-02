import {BadRequestException,Injectable,NotFoundException} from '@nestjs/common';
import {createHash,randomUUID} from 'crypto';
import {Prisma,QuoteStatus,TradeEventVisibility,TradeTransactionStatus} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {TenantContextService} from '../common/tenant/tenant-context.service';

const stable=(value:unknown)=>JSON.stringify(value,Object.keys(value as Record<string,unknown>).sort());
const hash=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
const ref=()=>`ST-${new Date().getUTCFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`;

@Injectable()
export class TradeCoreService{
 constructor(private prisma:PrismaService,private tenant:TenantContextService){}

 async commitAcceptedQuote(quoteId:string){
  const org=this.tenant.organizationId;
  return this.prisma.tenantTransaction(org,async tx=>{
   const existing=await tx.commercialLock.findUnique({where:{quoteId},include:{transaction:true}});
   if(existing)return existing;
   const quote=await tx.quote.findUnique({where:{id:quoteId},include:{items:true,revisions:{orderBy:{revisionNo:'desc'}},rfq:true}});
   if(!quote)throw new NotFoundException('Quote غير موجود');
   if(quote.buyerOrgId!==org)throw new BadRequestException('فقط المشتري يستطيع تثبيت العرض');
   if(quote.status!==QuoteStatus.ACCEPTED)throw new BadRequestException('يجب قبول العرض قبل التثبيت');
   const revision=quote.revisions.find(x=>x.status==='ACCEPTED')??quote.revisions[0];
   if(!revision)throw new BadRequestException('لا توجد نسخة عرض قابلة للتثبيت');
   const orderIntent=await tx.orderIntent.findUnique({where:{quoteId}});
   const snapshot={
    schemaVersion:1,quoteId:quote.id,quoteRevisionId:revision.id,revisionNo:revision.revisionNo,
    rfqId:quote.rfqId,buyerOrgId:quote.buyerOrgId,supplierOrgId:quote.supplierOrgId,
    currency:quote.currency,validUntil:quote.validUntil?.toISOString()??null,
    paymentTerms:quote.paymentTerms??null,shippingTerms:quote.shippingTerms??null,notes:quote.notes??null,
    items:quote.items.map(i=>({skuId:i.skuId,quantity:i.quantity.toString(),unitPrice:i.unitPrice.toString()})),
    acceptedSnapshot:revision.snapshot
   };
   const lock=await tx.commercialLock.create({data:{quoteId:quote.id,quoteRevisionId:revision.id,orderIntentId:orderIntent?.id,buyerOrgId:quote.buyerOrgId,supplierOrgId:quote.supplierOrgId,snapshot:snapshot as Prisma.InputJsonValue,snapshotHash:hash(snapshot),lockedByUserId:this.tenant.userId}});
   const transaction=await tx.tradeTransaction.create({data:{reference:ref(),commercialLockId:lock.id,buyerOrgId:quote.buyerOrgId,supplierOrgId:quote.supplierOrgId,status:TradeTransactionStatus.COMMITTED}});
   await tx.tradeMilestone.createMany({data:[['CONFIRMED','تم التأكيد'],['SUPPLY','التوريد / الإنتاج'],['QUALITY','فحص الجودة'],['DOCUMENTATION','المستندات'],['READY','جاهز للشحن'],['SHIPPED','تم الشحن'],['IN_TRANSIT','في الطريق'],['DELIVERED','تم التسليم']].map((x,i)=>({transactionId:transaction.id,code:x[0],label:x[1],sequence:i+1,status:i===0?'COMPLETED':'PENDING',completedAt:i===0?new Date():null})) as any});
   await tx.tradeEvent.create({data:{transactionId:transaction.id,sequence:1,type:'TRANSACTION_COMMITTED',visibility:TradeEventVisibility.BUYER,actorOrgId:org,actorUserId:this.tenant.userId,occurredAt:new Date(),payload:{commercialLockId:lock.id,snapshotHash:lock.snapshotHash} as Prisma.InputJsonValue}});
   await tx.outboxEvent.create({data:{organizationId:org,type:'TRANSACTION_COMMITTED',aggregateType:'TRADE_TRANSACTION',aggregateId:transaction.id,payload:{reference:transaction.reference} as Prisma.InputJsonValue}});
   return {...lock,transaction};
  });
 }

 async commitAcceptedOffer(offerId:string){
  const org=this.tenant.organizationId;
  return this.prisma.tenantTransaction(org,async tx=>{
   const existing=await tx.commercialLock.findUnique({where:{offerId},include:{transaction:true}});if(existing)return existing;
   const offer=await tx.septlionOffer.findFirst({where:{id:offerId,buyerOrgId:org},include:{revisions:{where:{status:'ACCEPTED'},orderBy:{revisionNo:'desc'},take:1}}});
   if(!offer)throw new NotFoundException('عرض Septlion غير موجود');if(offer.status!=='ACCEPTED')throw new BadRequestException('يجب قبول العرض قبل التثبيت');const revision=offer.revisions[0];if(!revision)throw new BadRequestException('لا توجد نسخة مقبولة');
   const snapshot={schemaVersion:2,offerId:offer.id,offerRevisionId:revision.id,revisionNo:revision.revisionNo,requirementId:offer.requirementId,rfqId:offer.rfqId,buyerOrgId:offer.buyerOrgId,operatorOrgId:offer.operatorOrgId,currency:offer.currency,validUntil:offer.validUntil?.toISOString()??null,commercial:revision.snapshot};
   const lock=await tx.commercialLock.create({data:{offerId:offer.id,offerRevisionId:revision.id,buyerOrgId:offer.buyerOrgId,supplierOrgId:offer.operatorOrgId,snapshot:snapshot as Prisma.InputJsonValue,snapshotHash:hash(snapshot),lockedByUserId:this.tenant.userId}});
   const transaction=await tx.tradeTransaction.create({data:{reference:ref(),commercialLockId:lock.id,buyerOrgId:offer.buyerOrgId,supplierOrgId:offer.operatorOrgId,status:TradeTransactionStatus.COMMITTED}});
   await tx.tradeMilestone.createMany({data:[['CONFIRMED','تم التأكيد'],['SUPPLY','التوريد / الإنتاج'],['QUALITY','فحص الجودة'],['DOCUMENTATION','المستندات'],['READY','جاهز للشحن'],['SHIPPED','تم الشحن'],['IN_TRANSIT','في الطريق'],['DELIVERED','تم التسليم']].map((x,i)=>({transactionId:transaction.id,code:x[0],label:x[1],sequence:i+1,status:i===0?'COMPLETED':'PENDING',completedAt:i===0?new Date():null})) as any});
   await tx.tradeEvent.create({data:{transactionId:transaction.id,sequence:1,type:'TRANSACTION_COMMITTED',visibility:TradeEventVisibility.BUYER,actorOrgId:org,actorUserId:this.tenant.userId,occurredAt:new Date(),payload:{commercialLockId:lock.id,snapshotHash:lock.snapshotHash,offerId} as Prisma.InputJsonValue}});
   await tx.outboxEvent.create({data:{organizationId:offer.operatorOrgId,type:'TRANSACTION_COMMITTED',aggregateType:'TRADE_TRANSACTION',aggregateId:transaction.id,payload:{reference:transaction.reference,offerId} as Prisma.InputJsonValue}});
   return{...lock,transaction};
  });
 }
 async getTransaction(id:string){
  const org=this.tenant.organizationId;
  return this.prisma.tenantTransaction(org,async tx=>{
   const row=await tx.tradeTransaction.findFirst({where:{id,OR:[{buyerOrgId:org},{supplierOrgId:org}]},include:{commercialLock:true,events:{where:{OR:[{visibility:'BUYER'},{actorOrgId:org}]},orderBy:{sequence:'asc'}}}});
   if(!row)throw new NotFoundException('الصفقة غير موجودة أو غير متاحة');
   return row;
  });
 }
}
