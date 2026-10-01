import { PrismaClient, UserRole, OrganizationType, ProductStatus, CatalogVisibility, MediaType } from '@prisma/client'; import * as bcrypt from 'bcrypt';
const prisma=new PrismaClient();
async function main(){
 const food=await prisma.sector.upsert({where:{code:'FOOD'},update:{},create:{code:'FOOD',name:'Food & Ingredients',description:'Food commodities and ingredients',policies:{create:{defaultCurrency:'USD',defaultUnit:'MT',minimumOrderQty:1,requiresCertificate:true,requiresOrigin:true,requiresPackingList:true,shippingRules:{allowedIncoterms:['FOB','CFR','CIF']},requiredDocuments:['COO','HEALTH_CERTIFICATE','PACKING_LIST']}}}});
 const buyer=await prisma.organization.create({data:{name:'Demo Buyer',legalName:'Demo Buyer LLC',country:'Kenya',organizationType:OrganizationType.BUYER}});
 const supplier=await prisma.organization.create({data:{name:'Demo Supplier',legalName:'Demo Supplier Ltd',country:'Egypt',organizationType:OrganizationType.SELLER}});
 const hash=await bcrypt.hash('ChangeMe123!',12);
 const u1=await prisma.user.create({data:{email:'buyer@demo.septlion.com',passwordHash:hash,firstName:'Demo',lastName:'Buyer',memberships:{create:{organizationId:buyer.id,role:UserRole.BUYER}}}});
 const u2=await prisma.user.create({data:{email:'sales@demo.septlion.com',passwordHash:hash,firstName:'Demo',lastName:'Sales',memberships:{create:{organizationId:supplier.id,role:UserRole.SALES}}}});
 const adminEmail=process.env.SEPTLION_ADMIN_EMAIL?.toLowerCase();const adminPassword=process.env.SEPTLION_ADMIN_PASSWORD;
 let adminEmailCreated:string|undefined;
 if(adminEmail&&adminPassword){
  if(adminPassword.length<12)throw new Error('SEPTLION_ADMIN_PASSWORD must be at least 12 characters');
  const adminHash=await bcrypt.hash(adminPassword,12);
  const admin=await prisma.user.upsert({where:{email:adminEmail},update:{isActive:true,passwordHash:adminHash},create:{email:adminEmail,passwordHash:adminHash,firstName:'Septlion',lastName:'Admin'}});
  await prisma.membership.upsert({where:{userId_organizationId:{userId:admin.id,organizationId:supplier.id}},update:{role:UserRole.ADMIN},create:{userId:admin.id,organizationId:supplier.id,role:UserRole.ADMIN}});
  adminEmailCreated=admin.email;
 }
 const product=await prisma.product.create({data:{organizationId:supplier.id,sectorId:food.id,name:'Premium White Sesame',slug:'premium-white-sesame',description:'Premium raw sesame for wholesale trade.',status:ProductStatus.ACTIVE,visibility:CatalogVisibility.PUBLIC,skus:{create:{organizationId:supplier.id,skuCode:'SESAME-WHITE-001',name:'Premium White Sesame 25 MT',unit:'MT',minimumOrderQty:5,currency:'USD',specifications:{origin:'Egypt',purity:'99.95%',moisture:'max 6%'},shipping:{incoterms:['FOB','CIF'],packing:'25kg bags / bulk'},media:{create:{type:MediaType.IMAGE,url:'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1600&q=80',sortOrder:0}}}}}});
 console.log({buyerId:buyer.id,supplierId:supplier.id,buyerEmail:u1.email,salesEmail:u2.email,adminEmail:adminEmailCreated,productId:product.id});
}
main().finally(()=>prisma.$disconnect());
