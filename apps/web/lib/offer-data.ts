import {edge,hasSession} from './api';
export type BuyerOffer={id:string;requirementId:string;rfqId:string;status:string;currency:string;validUntil:string|null;currentRevision:number;revision?:{id:string;revisionNo:number;snapshot:any}|null;revisions?:Array<{id:string;revisionNo:number;snapshot:any}>};
export async function buyerOffer(id:string){
 if(!hasSession())throw new Error('سجل الدخول لعرض هذا العرض.');
 const result=await edge<{item:BuyerOffer;revision:BuyerOffer['revision']}>('offers.get',{id});
 return {...result.item,revision:result.revision,revisions:result.revision?[result.revision]:[]};
}
export async function offerForRequirement(id:string){
 if(!hasSession())throw new Error('سجل الدخول لعرض عرض مؤسستك.');
 const result=await edge<{items:BuyerOffer[]}>('offers.list');
 const offer=result.items.find(x=>x.requirementId===id&&['ISSUED','REVISED','ACCEPTED'].includes(x.status));
 return offer?buyerOffer(offer.id):null;
}
export async function acceptBuyerOffer(id:string,revision:number,mode:'TEST'|'COMMERCIAL'){
 if(!hasSession())throw new Error('يلزم تسجيل الدخول');
 return edge<{transactionId:string;reference:string}>('offers.accept',{offerId:id,revision,mode});
}
