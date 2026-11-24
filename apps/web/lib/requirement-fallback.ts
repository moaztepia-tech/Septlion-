import {extractRequirement} from './requirement-input';

export type TradeField='product'|'quantity'|'destination'|'packing'|'incoterm'|'payment';
export type TradeFields=Record<TradeField,string>;
const mandatory:TradeField[]=['product','quantity','destination'];
const question:Record<string,string>={
  product:'ما المنتج أو الخدمة التي تحتاجها؟',
  quantity:'ما الكمية التقريبية ووحدتها؟ يمكنك قول «لا أعرف» إن لم تتحدد.',
  destination:'إلى أي دولة أو ميناء تريد التوريد؟ يمكنك قول «لا أعرف» إن لم تتحدد الوجهة.',
};
const locations:[RegExp,string][]=[
  [/مومباسا|mombasa/i,'مومباسا'],
  [/جدة|جده|jeddah/i,'جدة'],
  [/بورت\s*سودان|port\s*sudan/i,'بورتسودان'],
  [/دار\s*السلام|dar\s*es\s*salaam/i,'دار السلام'],
  [/دبي|dubai/i,'دبي'],
  [/الرياض|riyadh/i,'الرياض'],
  [/دوالا|douala/i,'دوالا'],
  [/جبل\s*علي|jebel\s*ali/i,'جبل علي'],
  [/نجامينا|n.?djamena/i,'نجامينا'],
  [/عدن|aden/i,'عدن'],
  [/الخرطوم|khartoum/i,'الخرطوم'],
];
export function interpretLocally(raw:string){
  const extracted=extractRequirement(raw);
  const fields:TradeFields={product:extracted.product||'',quantity:extracted.quantity||'',destination:extracted.destination||'',packing:extracted.packing||'',incoterm:extracted.incoterm||'',payment:extracted.payment||''};
  const location=locations.find(([regex])=>regex.test(raw));
  if(location)fields.destination=location[1];
  const missing=mandatory.filter(field=>!fields[field]);
  const summary=mandatory.map(field=>fields[field]).filter(Boolean).join(' · ');
  const ready=missing.length===0;
  const result=ready
    ? 'فهمت احتياجك: '+summary+'. يمكنك مراجعة التفاصيل قبل طلب عرض السعر، ولن نفترض شروطًا لم تحددها.'
    : (summary?'فهمت حتى الآن: '+summary+'. ':'')+question[missing[0]];
  return {result,ready,missing,fields,mode:'basic' as const};
}
