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
  const score=this.score(x);const status=score>=75?'QUALIFY_NOW':score>=55?'RESOLVE_BUYER':'WATCH';
  const data={sourceUrl:x.sourceUrl||null,type:x.type,status:status as any,market:x.market,product:x.product,quantity:x.quantity||null,buyerName:x.buyerName||null,publishedAt:x.publishedAt?new Date(x.publishedAt):null,deadlineAt:x.deadlineAt?new Date(x.deadlineAt):null,incoterm:x.incoterm||null,packing:x.packing||null,evidence:(x.evidence||null) as any,raw:(x.raw||null) as any,score,verification:'SOURCE_SIGNAL',intentPageCandidate:score>=70&&!!x.product&&!!x.market};
  return this.prisma.demandSignal.upsert({where:{source_sourceRecordId:{source:x.source,sourceRecordId:x.sourceRecordId}},create:{source:x.source,sourceRecordId:x.sourceRecordId,...data},update:data});
 }
 async list(){return this.prisma.demandSignal.findMany({orderBy:[{score:'desc'},{lastSeenAt:'desc'}],take:100})}
}
