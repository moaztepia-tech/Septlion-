import {Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';

export type DemandInput={
 source:string;sourceRecordId:string;sourceUrl?:string|null;type:'TENDER'|'RFQ'|'AUCTION';
 market:string;product:string;quantity?:string|null;buyerName?:string|null;publishedAt?:string|null;
 deadlineAt?:string|null;incoterm?:string|null;packing?:string|null;evidence?:unknown;raw?:unknown;
};

@Injectable()
export class DemandIntelligenceService{
 constructor(private readonly prisma:PrismaService){}

 score(x:DemandInput){
  let n=30;if(x.product)n+=15;if(x.market)n+=10;if(x.quantity)n+=15;if(x.buyerName)n+=10;if(x.deadlineAt)n+=10;if(x.sourceUrl)n+=10;
  return Math.min(n,100);
 }

 async ingest(x:DemandInput){
  const score=this.score(x);
  const status=score>=75?'QUALIFY_NOW':score>=55?'RESOLVE_BUYER':'WATCH';
  const data={sourceUrl:x.sourceUrl||null,type:x.type,status:status as any,market:x.market,product:x.product,quantity:x.quantity||null,buyerName:x.buyerName||null,publishedAt:x.publishedAt?new Date(x.publishedAt):null,deadlineAt:x.deadlineAt?new Date(x.deadlineAt):null,incoterm:x.incoterm||null,packing:x.packing||null,evidence:(x.evidence||null) as any,raw:(x.raw||null) as any,score,verification:'SOURCE_SIGNAL',intentPageCandidate:score>=70&&!!x.product&&!!x.market};
  const signal=await this.prisma.demandSignal.upsert({where:{source_sourceRecordId:{source:x.source,sourceRecordId:x.sourceRecordId}},create:{source:x.source,sourceRecordId:x.sourceRecordId,...data},update:data});
  if(score>=55) await this.promoteSignal(signal.id);
  return signal;
 }

 async promoteSignal(signalId:string){
  const signal=await this.prisma.demandSignal.findUniqueOrThrow({where:{id:signalId}});
  let buyerProfileId:string|undefined;
  if(signal.buyerName){
   const existing=await this.prisma.buyerProfile.findFirst({where:{canonicalName:{equals:signal.buyerName,mode:'insensitive'},country:signal.market}});
   const buyer=existing??await this.prisma.buyerProfile.create({data:{canonicalName:signal.buyerName,country:signal.market,confidence:35,provenance:{signalId:signal.id,source:signal.source}}});
   buyerProfileId=buyer.id;
  }
  const requirement=await this.prisma.qualifiedRequirement.findFirst({where:{sourceSignalId:signal.id}})??await this.prisma.qualifiedRequirement.create({data:{
   sourceSignalId:signal.id,buyerProfileId,product:signal.product,market:signal.market,status:signal.score>=75?'NEEDS_CLARIFICATION':'DRAFT',
   knownFacts:{product:signal.product,market:signal.market,quantity:signal.quantity,incoterm:signal.incoterm,packing:signal.packing,deadlineAt:signal.deadlineAt},
   criticalMissing:{fields:['normalizedQuantity','unit','deliveryPort','requiredSpecifications'].filter(Boolean)},confidence:signal.score
  }});
  const existingOpportunity=await this.prisma.opportunity.findFirst({where:{sourceSignalId:signal.id}});
  if(existingOpportunity)return existingOpportunity;
  const reference='OPP-'+signal.id.slice(0,8).toUpperCase();
  return this.prisma.opportunity.create({data:{
   reference,status:buyerProfileId?'QUALIFICATION':'BUYER_RESOLUTION',sourceSignalId:signal.id,buyerProfileId,requirementId:requirement.id,
   title:`${signal.product} — ${signal.market}`,market:signal.market,product:signal.product,
   nextAction:buyerProfileId?'Complete critical requirement fields':'Resolve and verify buyer identity',
   evidence:{source:signal.source,sourceUrl:signal.sourceUrl,verification:signal.verification,score:signal.score}
  }});
 }

 async list(){return this.prisma.demandSignal.findMany({orderBy:[{score:'desc'},{lastSeenAt:'desc'}],take:100})}
 async opportunities(){return this.prisma.opportunity.findMany({include:{buyerProfile:true,requirement:true,sourceSignal:true},orderBy:{updatedAt:'desc'},take:100})}
 async opportunity(id:string){return this.prisma.opportunity.findUnique({where:{id},include:{buyerProfile:true,requirement:true,sourceSignal:true,agentRuns:{orderBy:{createdAt:'desc'}}}})}
 async queueAgent(opportunityId:string,agentType:string,input:unknown,runtime='OPEN_DOTS'){
  return this.prisma.agentRun.create({data:{opportunityId,agentType,runtime,status:'QUEUED',input:input as any}});
 }

 async commandCenter(){
  const [signals,opportunities,pendingApprovals,agentRuns]=await Promise.all([
   this.prisma.demandSignal.count(),
   this.prisma.opportunity.groupBy({by:['status'],_count:{_all:true}}),
   this.prisma.humanApproval.count({where:{decision:'PENDING'}}),
   this.prisma.agentRun.groupBy({by:['status'],_count:{_all:true}})
  ]);
  return {signals,opportunities:Object.fromEntries(opportunities.map(x=>[x.status,x._count._all])),pendingApprovals,agents:Object.fromEntries(agentRuns.map(x=>[x.status,x._count._all]))};
 }

 async requestApproval(opportunityId:string,body:{action:any;title:string;summary?:string;payload?:unknown}){
  await this.prisma.opportunity.findUniqueOrThrow({where:{id:opportunityId}});
  const approval=await this.prisma.humanApproval.create({data:{opportunityId,action:body.action,title:body.title,summary:body.summary,payload:(body.payload??{}) as any}});
  await this.prisma.opportunity.update({where:{id:opportunityId},data:{status:'AWAITING_APPROVAL',nextAction:'Human approval required'}});
  return approval;
 }

 async decideApproval(id:string,decision:'APPROVED'|'REJECTED',decidedBy?:string){
  const approval=await this.prisma.humanApproval.update({where:{id},data:{decision,decidedBy,decidedAt:new Date()}});
  const nextStatus=decision==='APPROVED'?(approval.action==='START_SUPPLY_MATCHING'?'SUPPLY_MATCHING':approval.action==='BUILD_DEAL'?'DEAL_BUILDING':'APPROVED'):'QUALIFICATION';
  await this.prisma.opportunity.update({where:{id:approval.opportunityId},data:{status:nextStatus as any,nextAction:decision==='APPROVED'?'Execute approved action':'Review rejected action'}});
  return approval;
 }

 async addSupplyCandidate(opportunityId:string,body:any){
  await this.prisma.opportunity.findUniqueOrThrow({where:{id:opportunityId}});
  const candidate=await this.prisma.supplyCandidate.create({data:{opportunityId,supplierOrgId:body.supplierOrgId||null,supplierName:body.supplierName,country:body.country||null,source:body.source||null,sourceUrl:body.sourceUrl||null,capability:body.capability||null,compliance:body.compliance||null,commercial:body.commercial||null,logistics:body.logistics||null,confidence:Number(body.confidence||0),verified:!!body.verified}});
  await this.prisma.opportunity.update({where:{id:opportunityId},data:{status:'SUPPLY_MATCHING',nextAction:'Verify supply candidates and build deal economics'}});
  return candidate;
 }

 async createDealDraft(opportunityId:string,body:any){
  const last=await this.prisma.dealDraft.findFirst({where:{opportunityId},orderBy:{version:'desc'}});
  const n=(v:any)=>v==null?undefined:String(v);
  const ex=Number(body.exWorks||0),fr=Number(body.freight||0),qc=Number(body.qc||0),docs=Number(body.documents||0),duties=Number(body.duties||0),risk=Number(body.riskReserve||0);
  const landed=ex+fr+qc+docs+duties+risk;
  const margin=Number(body.grossMarginPct||0);
  const offer=body.offerPrice!=null?Number(body.offerPrice):(margin>=100?landed:landed/(1-margin/100));
  const deal=await this.prisma.dealDraft.create({data:{opportunityId,version:(last?.version??0)+1,currency:body.currency||'USD',exWorks:n(ex),freight:n(fr),qc:n(qc),documents:n(docs),duties:n(duties),riskReserve:n(risk),landedCost:n(landed),grossMarginPct:n(margin),offerPrice:n(offer),assumptions:body.assumptions||null}});
  await this.prisma.opportunity.update({where:{id:opportunityId},data:{status:'DEAL_BUILDING',economics:{landedCost:landed,grossMarginPct:margin,offerPrice:offer,currency:body.currency||'USD'},nextAction:'Request human approval before external commercial commitment'}});
  return deal;
 }

 async approvals(){return this.prisma.humanApproval.findMany({where:{decision:'PENDING'},include:{opportunity:true},orderBy:{createdAt:'asc'}})}
}
