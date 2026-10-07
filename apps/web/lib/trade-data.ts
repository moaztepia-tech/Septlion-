import {edge,hasSession} from './api';
import {UiRequest} from './buyer-ui-store';
export type ServerRequirement={id:string;product:string;packing?:unknown;quantity?:string|number|null;unit?:string|null;market?:string|null;containerCount?:number|null;septlionScale?:string|null;incoterm?:string|null;deliveryPort?:string|null;deliveryCountry?:string|null;paymentPreference?:string|null;status:string;createdAt:string};
export type RequestDetail={request:UiRequest;rfq:{id:string;reference:string;status:string}|null;offer:{id:string;status:string;currentRevision:number}|null;transaction:{id:string;reference:string;status:string;updatedAt:string}|null};
const packing=(value:unknown)=>typeof value==='string'?value:value&&typeof value==='object'&&'display'in value?String(value.display):'تُحدد في الطلب';
export function mapRequirement(row:ServerRequirement):UiRequest{
  const containers=row.containerCount||0;
  const quantityLabel=containers?containers+' حاويات':row.quantity&&row.unit?row.quantity+' '+row.unit:'الكمية تُراجع في تفاصيل الطلب';
  return{id:row.id,product:row.product||'طلب توريد',packing:packing(row.packing),containers,quantityLabel,scale:row.septlionScale||'—',incoterm:row.incoterm||'—',destination:row.deliveryPort||row.deliveryCountry||row.market||'—',payment:row.paymentPreference||'—',status:row.status,createdAt:row.createdAt};
}
export async function tradeRequests():Promise<UiRequest[]>{
  if(!hasSession())throw new Error('سجل الدخول لعرض طلبات مؤسستك.');
  const result=await edge<{items:ServerRequirement[]}>('requirements.list');
  return result.items.map(mapRequirement);
}
export async function tradeRequestDetails(id:string):Promise<RequestDetail>{
  if(!hasSession())throw new Error('سجل الدخول لعرض هذا الطلب.');
  const result=await edge<{item:ServerRequirement;rfq:RequestDetail['rfq'];offer:RequestDetail['offer'];transaction:RequestDetail['transaction']}>('requirements.get',{id});
  return{request:mapRequirement(result.item),rfq:result.rfq,offer:result.offer&&['ISSUED','REVISED','ACCEPTED'].includes(result.offer.status)?result.offer:null,transaction:result.transaction};
}
export async function tradeRequest(id:string):Promise<UiRequest|null>{return(await tradeRequestDetails(id)).request;}
export async function createTradeRequirement(input:Record<string,unknown>){return edge<{item:ServerRequirement}>('requirements.create',{input});}
