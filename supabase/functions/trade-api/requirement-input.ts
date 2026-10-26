import {normalizeSupplyPlan} from './supply-plan.ts';

export function normalizeRequirement(input:Record<string,any>) {
  const product=String(input.product||'').trim(),market=String(input.destination||input.market||'').trim();
  if(!product||!market||product.length>2000||market.length>2000)throw new Error('حدد المنتج والوجهة.');
  const match=String(input.quantity||'').trim().match(/^(\d+(?:[.,]\d+)?)\s*(FCL|MT|KG|UNIT)$/i);
  const quantity=typeof input.quantity==='number'?input.quantity:match?Number(match[1].replace(',','.')):NaN;
  const unit=String(input.unit||match?.[2]||'UNIT').toUpperCase();
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1e9||!['FCL','MT','KG','UNIT'].includes(unit)||(unit==='FCL'&&!Number.isInteger(quantity)))throw new Error('راجع الكمية ووحدتها.');
  if(match&&match[2].toUpperCase()!==unit)throw new Error('وحدة الكمية لا تتطابق مع الطلب.');
  if(!['CIF','CFR','FOB'].includes(input.incoterm)||!['L/C','T/T','OTHER'].includes(input.paymentPreference||input.payment))throw new Error('اختر شرط التجارة وطريقة الدفع.');
  const key=input.idempotencyKey===undefined?crypto.randomUUID():input.idempotencyKey;
  if(typeof key!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(key))throw new Error('تعذر قراءة مرجع المسودة.');
  const facts=input.knownFacts&&typeof input.knownFacts==='object'&&!Array.isArray(input.knownFacts)?input.knownFacts:{};
  const supplyPlan=normalizeSupplyPlan(facts.supplyPlan,{amount:quantity,unit});
  const {idempotencyKey:_,...rest}=input;
  return{key,payload:{...rest,product,market,quantityNumber:quantity,containerCount:unit==='FCL'?quantity:null,unit,packing:typeof input.packing==='string'?{display:input.packing}:input.packing||null,knownFacts:{...facts,...(supplyPlan?{supplyPlan}:{}),...(facts.buyer?{buyer:{...facts.buyer,whatsappStatus:'UNCONFIRMED'}}:{})}}};
}
