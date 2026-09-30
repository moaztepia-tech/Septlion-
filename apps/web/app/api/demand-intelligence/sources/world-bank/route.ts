import {NextResponse} from 'next/server';

const WB='https://search.worldbank.org/api/v2/procnotices';
const FLOUR_TERMS=['wheat flour','flour','milling','maize flour','fortified flour'];

function text(v:unknown){return typeof v==='string'?v:''}
function pick(r:any,...keys:string[]){for(const k of keys){if(r?.[k]!=null)return r[k]}return ''}
function relevant(r:any){
 const hay=[pick(r,'bid_description','notice_text','project_name'),pick(r,'sector'),pick(r,'procurement_category')].map(text).join(' ').toLowerCase();
 return FLOUR_TERMS.some(k=>hay.includes(k));
}
function normalize(r:any){
 const product=text(pick(r,'bid_description','notice_text'))||'Flour procurement';
 const market=text(pick(r,'country_name','project_ctry_name'))||'Unresolved market';
 const published=text(pick(r,'publication_date','noticedate'));
 const deadline=text(pick(r,'deadline_date','submission_date'));
 const id=String(pick(r,'id','project_id')||[product,market,published].join('-')).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
 return {id:'wb-'+id,type:'TENDER',market,product,quantity:'Not stated in source index',published,deadline:deadline||null,buyer:null,source:'World Bank Procurement Notices',sourceUrl:text(pick(r,'url'))||null,status:'RESOLVE_BUYER',verification:'SOURCE_NOTICE',intentPageCandidate:false};
}

export async function GET(){
 try{
  const url=new URL(WB);url.searchParams.set('format','json');url.searchParams.set('rows','100');url.searchParams.set('os','0');
  const res=await fetch(url,{next:{revalidate:3600}});
  if(!res.ok)return NextResponse.json({error:'World Bank source unavailable',status:res.status},{status:502});
  const raw=await res.json();
  const rows=Array.isArray(raw?.procnotices)?raw.procnotices:Object.values(raw?.procnotices||{});
  const signals=(rows as any[]).filter(relevant).map(normalize);
  return NextResponse.json({source:'World Bank Procurement Notices',fetched:rows.length,matched:signals.length,signals});
 }catch{return NextResponse.json({error:'Collector failed safely'},{status:502})}
}
