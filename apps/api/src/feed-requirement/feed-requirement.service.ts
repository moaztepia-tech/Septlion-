import {BadRequestException,Injectable} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {CreateFeedRequirementDto} from './feed-requirement.dto';

const scale=(n:number)=>n<=7?'S-1':n<=19?'S-2':n<=49?'S-3':n<=99?'S-4':n<=299?'S-5':n<=999?'S-6':'S-7';
function phone(raw:string){
 const value=raw.trim().replace(/[^\d+]/g,'').replace(/(?!^)\+/g,'');
 const digits=value.replace('+','');
 if(digits.length<8||digits.length>15)throw new BadRequestException('Invalid WhatsApp number');
 return value.startsWith('+')?value:'+'+value;
}

@Injectable()
export class FeedRequirementService{
 constructor(private prisma:PrismaService){}
 async create(dto:CreateFeedRequirementDto){
  const whatsapp=phone(dto.buyer.whatsapp);
  const expectedScale=scale(dto.containerCount);
  if(dto.septlionScale!==expectedScale)throw new BadRequestException('Invalid Septlion scale');
  return this.prisma.$transaction(async tx=>{
   let contact=await tx.buyerContact.findFirst({where:{whatsapp},include:{buyerProfile:true},orderBy:{updatedAt:'desc'}});
   if(contact){
    contact=await tx.buyerContact.update({where:{id:contact.id},data:{name:dto.buyer.name.trim(),company:dto.buyer.company.trim(),email:dto.buyer.email?.trim().toLowerCase()||null},include:{buyerProfile:true}});
   }else{
    const profile=await tx.buyerProfile.create({data:{canonicalName:dto.buyer.company.trim(),verificationStatus:'UNVERIFIED',confidence:0,provenance:{source:'product_feed'}}});
    contact=await tx.buyerContact.create({data:{buyerProfileId:profile.id,name:dto.buyer.name.trim(),company:dto.buyer.company.trim(),whatsapp,email:dto.buyer.email?.trim().toLowerCase()||null},include:{buyerProfile:true}});
   }
   const requirement=await tx.qualifiedRequirement.create({data:{
    buyerProfileId:contact.buyerProfileId,buyerContactId:contact.id,source:'PRODUCT_FEED',status:'DRAFT',
    product:dto.product.nameEn,market:dto.destination.country,quantity:dto.containerCount,unit:'FCL',
    containerCount:dto.containerCount,septlionScale:expectedScale,deliveryCountry:dto.destination.country,deliveryPort:dto.destination.port,destinationCode:dto.destination.code,
    incoterm:dto.incoterm,paymentPreference:dto.paymentPreference,
    knownFacts:{product:{id:dto.product.id,name:dto.product.name,nameEn:dto.product.nameEn,packing:dto.product.packing},containerCount:dto.containerCount,septlionScale:expectedScale,incoterm:dto.incoterm,destination:{port:dto.destination.port,country:dto.destination.country,code:dto.destination.code||null},paymentPreference:dto.paymentPreference},
    fieldStates:{product:'CONFIRMED',packing:'CONFIRMED',containerCount:'CONFIRMED',incoterm:'CONFIRMED',destination:'CONFIRMED',paymentPreference:'CONFIRMED',buyer:'CONFIRMED'},
    productConfiguration:{productId:dto.product.id,packing:dto.product.packing},
    packing:{display:dto.product.packing},sourceContext:(dto.sourceContext||{source:'product_feed'}) as Prisma.InputJsonValue,confidence:85
   }});
   return {requirementId:requirement.id,status:requirement.status,buyerContactId:contact.id,whatsappStatus:contact.whatsappReachability};
  });
 }
}