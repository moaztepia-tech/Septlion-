import {Injectable,Logger,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {DemandIntelligenceService,DemandInput} from './demand-intelligence.service';

type Adapter=()=>Promise<DemandInput[]>;
const TERMS=(process.env.DEMAND_TERMS||'wheat flour,flour,milling,maize flour,fortified flour').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);

@Injectable()
export class DemandCollectorScheduler implements OnModuleInit,OnModuleDestroy{
 private readonly log=new Logger(DemandCollectorScheduler.name);private timer?:ReturnType<typeof setInterval>;private running=false;
 constructor(private readonly demand:DemandIntelligenceService){}
 onModuleInit(){if(process.env.DEMAND_COLLECTOR_ENABLED!=='true'){this.log.log('Demand collector scheduler disabled');return}const minutes=Math.max(60,Number(process.env.DEMAND_COLLECTOR_INTERVAL_MINUTES||360));void this.run();this.timer=setInterval(()=>void this.run(),minutes*60_000)}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
 private value(r:any,...keys:string[]){for(const k of keys)if(r?.[k]!=null)return String(r[k]);return ''}
 private relevant(...parts:string[]){const h=parts.join(' ').toLowerCase();return TERMS.some(t=>h.includes(t))}
 private async worldBank():Promise<DemandInput[]>{
  const source=process.env.WORLD_BANK_PROCUREMENT_URL||'https://search.worldbank.org/api/v2/procnotices';const u=new URL(source);u.searchParams.set('format','json');u.searchParams.set('rows','100');u.searchParams.set('os','0');
  const res=await fetch(u);if(!res.ok)throw new Error('World Bank status '+res.status);const raw=await res.json();const rows=Array.isArray(raw?.procnotices)?raw.procnotices:Object.values(raw?.procnotices||{});
  return (rows as any[]).filter(r=>this.relevant(this.value(r,'bid_description','notice_text','project_name'),this.value(r,'sector'),this.value(r,'procurement_category'))).map(r=>({source:'World Bank Procurement Notices',sourceRecordId:this.value(r,'id','project_id')||[this.value(r,'bid_description','notice_text'),this.value(r,'country_name','project_ctry_name'),this.value(r,'publication_date','noticedate')].join('|'),sourceUrl:this.value(r,'url')||null,type:'TENDER',market:this.value(r,'country_name','project_ctry_name')||'Unresolved market',product:this.value(r,'bid_description','notice_text')||'Procurement requirement',quantity:null,publishedAt:this.value(r,'publication_date','noticedate')||null,deadlineAt:this.value(r,'deadline_date','submission_date')||null,evidence:{adapter:'world-bank',retrievedAt:new Date().toISOString()},raw:r}));
 }
 private async jsonFeed():Promise<DemandInput[]>{
  const url=process.env.DEMAND_JSON_FEED_URL;if(!url)return[];const res=await fetch(url,{headers:process.env.DEMAND_JSON_FEED_TOKEN?{authorization:'Bearer '+process.env.DEMAND_JSON_FEED_TOKEN}:{}});if(!res.ok)throw new Error('JSON feed status '+res.status);const raw=await res.json();const rows=Array.isArray(raw)?raw:Array.isArray(raw?.items)?raw.items:[];
  return rows.filter((x:any)=>x.source&&x.sourceRecordId&&x.market&&x.product).map((x:any)=>({...x,type:x.type||'RFQ',evidence:{...(x.evidence||{}),adapter:'json-feed',retrievedAt:new Date().toISOString()}}));
 }
 async run(){
  if(this.running)return;this.running=true;try{
   const adapters:Adapter[]=[()=>this.worldBank(),()=>this.jsonFeed()];let accepted=0,failed=0;
   for(const adapter of adapters){try{for(const row of await adapter()){await this.demand.ingest(row);accepted++}}catch(e){failed++;this.log.warn(e instanceof Error?e.message:String(e))}}
   this.log.log(`Demand collector completed: ${accepted} signals persisted; ${failed} adapters failed`);
  }finally{this.running=false}
 }
}
