import {Injectable,Logger,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {DemandIntelligenceService,DemandInput} from './demand-intelligence.service';

const SOURCE=process.env.WORLD_BANK_PROCUREMENT_URL||'https://search.worldbank.org/api/v2/procnotices';
const TERMS=['wheat flour','flour','milling','maize flour','fortified flour'];

@Injectable()
export class DemandCollectorScheduler implements OnModuleInit,OnModuleDestroy{
 private readonly log=new Logger(DemandCollectorScheduler.name);
 private timer?:NodeJS.Timeout;
 constructor(private readonly demand:DemandIntelligenceService){}
 onModuleInit(){
  if(process.env.DEMAND_COLLECTOR_ENABLED!=='true'){this.log.log('Demand collector scheduler disabled');return}
  const minutes=Math.max(60,Number(process.env.DEMAND_COLLECTOR_INTERVAL_MINUTES||360));
  void this.run();
  this.timer=setInterval(()=>void this.run(),minutes*60_000);
 }
 onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
 private value(r:any,...keys:string[]){for(const k of keys)if(r?.[k]!=null)return String(r[k]);return ''}
 private isRelevant(r:any){const h=[this.value(r,'bid_description','notice_text','project_name'),this.value(r,'sector'),this.value(r,'procurement_category')].join(' ').toLowerCase();return TERMS.some(t=>h.includes(t))}
 async run(){
  try{
   const u=new URL(SOURCE);u.searchParams.set('format','json');u.searchParams.set('rows','100');u.searchParams.set('os','0');
   const res=await fetch(u);if(!res.ok)throw new Error('source status '+res.status);
   const raw=await res.json();const rows=Array.isArray(raw?.procnotices)?raw.procnotices:Object.values(raw?.procnotices||{});
   let accepted=0;
   for(const r of (rows as any[]).filter(x=>this.isRelevant(x))){
    const sourceRecordId=this.value(r,'id','project_id')||[this.value(r,'bid_description','notice_text'),this.value(r,'country_name','project_ctry_name'),this.value(r,'publication_date','noticedate')].join('|');
    const input:DemandInput={source:'World Bank Procurement Notices',sourceRecordId,sourceUrl:this.value(r,'url')||null,type:'TENDER',market:this.value(r,'country_name','project_ctry_name')||'Unresolved market',product:this.value(r,'bid_description','notice_text')||'Flour procurement',quantity:null,publishedAt:this.value(r,'publication_date','noticedate')||null,deadlineAt:this.value(r,'deadline_date','submission_date')||null,evidence:{sourceIndex:true},raw:r};
    await this.demand.ingest(input);accepted++;
   }
   this.log.log(`Demand collector completed: ${accepted} relevant signals persisted`);
  }catch(e){this.log.error('Demand collector failed safely',e instanceof Error?e.stack:undefined)}
 }
}
