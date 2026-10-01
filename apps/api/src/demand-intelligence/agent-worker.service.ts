import {Injectable,Logger,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';

type AgentResult={status?:'SUCCEEDED'|'NEEDS_HUMAN';output?:unknown;evidence?:unknown};

@Injectable()
export class AgentWorker implements OnModuleInit,OnModuleDestroy{
 private readonly log=new Logger(AgentWorker.name);
 private timer?:ReturnType<typeof setInterval>;
 private running=false;
 constructor(private readonly prisma:PrismaService){}

 onModuleInit(){
  if(process.env.AGENT_WORKER_ENABLED!=='true'){this.log.log('Agent worker disabled');return}
  const seconds=Math.max(10,Number(process.env.AGENT_WORKER_INTERVAL_SECONDS||30));
  void this.tick();this.timer=setInterval(()=>void this.tick(),seconds*1000);
 }
 onModuleDestroy(){if(this.timer)clearInterval(this.timer)}

 private async tick(){
  if(this.running)return;this.running=true;
  try{
   const job=await this.prisma.agentRun.findFirst({where:{status:'QUEUED'},orderBy:{createdAt:'asc'}});
   if(!job)return;
   const claimed=await this.prisma.agentRun.updateMany({where:{id:job.id,status:'QUEUED'},data:{status:'RUNNING',startedAt:new Date()}});
   if(!claimed.count)return;
   try{
    const result=await this.execute(job.runtime||'INTERNAL',job.agentType,job.input);
    await this.prisma.agentRun.update({where:{id:job.id},data:{status:result.status||'SUCCEEDED',output:(result.output??{}) as any,evidence:(result.evidence??{}) as any,finishedAt:new Date()}});
   }catch(e){
    await this.prisma.agentRun.update({where:{id:job.id},data:{status:'FAILED',error:e instanceof Error?e.message:String(e),finishedAt:new Date()}});
   }
  }finally{this.running=false}
 }

 private async execute(runtime:string,agentType:string,input:unknown):Promise<AgentResult>{
  if(runtime==='INTERNAL')return this.internal(agentType,input);
  const endpoint=process.env.AGENT_RUNTIME_WEBHOOK_URL;
  if(!endpoint)throw new Error('AGENT_RUNTIME_WEBHOOK_URL is required for external agent runtime');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),60_000);
  try{
   const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.AGENT_RUNTIME_TOKEN?{'authorization':`Bearer ${process.env.AGENT_RUNTIME_TOKEN}`}:{})},body:JSON.stringify({runtime,agentType,input}),signal:controller.signal});
   if(!res.ok)throw new Error(`Agent runtime returned ${res.status}`);
   return await res.json() as AgentResult;
  }finally{clearTimeout(timeout)}
 }

 private internal(agentType:string,input:unknown):AgentResult{
  if(agentType==='QUALIFICATION_GAP_ANALYSIS'){
   const x=(input??{}) as any;const required=['product','market','quantity','unit','deliveryCountry','deliveryPort','incoterm','requiredDate','specifications'];
   const missing=required.filter(k=>x[k]==null||x[k]==='');
   return {status:missing.length?'NEEDS_HUMAN':'SUCCEEDED',output:{missing,complete:missing.length===0},evidence:{engine:'deterministic-v1'}};
  }
  if(agentType==='DEAL_READINESS'){
   const x=(input??{}) as any;const checks={buyerVerified:!!x.buyerVerified,requirementQualified:!!x.requirementQualified,supplyVerified:!!x.supplyVerified,economicsReady:!!x.economicsReady};
   return {status:Object.values(checks).every(Boolean)?'SUCCEEDED':'NEEDS_HUMAN',output:{checks,ready:Object.values(checks).every(Boolean)},evidence:{engine:'deterministic-v1'}};
  }
  return {status:'NEEDS_HUMAN',output:{reason:'No internal handler for agent type',agentType},evidence:{engine:'internal-router'}};
 }
}
