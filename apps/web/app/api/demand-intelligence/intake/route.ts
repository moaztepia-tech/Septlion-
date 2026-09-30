import {NextResponse} from 'next/server';

type IncomingSignal={type?:string;market?:string;product?:string;quantity?:string;published?:string;buyer?:string;source?:string;sourceUrl?:string;deadline?:string;incoterm?:string;packing?:string};

function normalize(x:IncomingSignal){
 const product=(x.product||'').trim();
 const market=(x.market||'').trim();
 const quantity=(x.quantity||'').trim();
 const type=(x.type||'RFQ').toUpperCase();
 const score=Math.min(100,30+(product?15:0)+(market?10:0)+(quantity?15:0)+(x.buyer?10:0)+(x.deadline?10:0)+(x.sourceUrl?10:0));
 const slug=[product,market,quantity].join(' ').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
 return {id:slug||'unresolved-signal',type,market,product,quantity,published:x.published||new Date().toISOString().slice(0,10),buyer:x.buyer||null,source:x.source||'External demand source',sourceUrl:x.sourceUrl||null,deadline:x.deadline||null,incoterm:x.incoterm||null,packing:x.packing||null,score,status:score>=75?'QUALIFY_NOW':score>=55?'RESOLVE_BUYER':'WATCH',intentPageCandidate:score>=70&&!!product&&!!market};
}

export async function POST(req:Request){
 try{
  const body=await req.json();
  const items=Array.isArray(body)?body:[body];
  if(items.length>100)return NextResponse.json({error:'Maximum 100 signals per request'},{status:400});
  const normalized=items.map(normalize).filter(x=>x.product&&x.market);
  return NextResponse.json({received:items.length,accepted:normalized.length,signals:normalized});
 }catch{return NextResponse.json({error:'Invalid JSON payload'},{status:400})}
}
export async function GET(){return NextResponse.json({service:'Septlion Demand Intake',status:'ready',accepts:['TENDER','RFQ','AUCTION']})}
