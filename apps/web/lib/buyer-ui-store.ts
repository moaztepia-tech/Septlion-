export type UiRequest={id:string;product:string;packing:string;containers:number;scale:string;incoterm:string;destination:string;payment:string;status:string;createdAt:string};
export function browserRequests():UiRequest[]{
 if(typeof window==='undefined')return [];
 try{
  const rows=JSON.parse(localStorage.getItem('septlion_draft_requests')||'[]');
  return rows.map((x:any,i:number)=>({id:x.requirementId?String(x.requirementId).slice(0,8).toUpperCase():'DRAFT-'+(i+1),product:x.product?.name||'طلب توريد',packing:x.product?.packing||'تُحدد في الطلب',containers:x.containerCount||1,scale:x.septlionScale||'Micro',incoterm:x.incoterm||'—',destination:x.destination?.port||x.destination?.country||'—',payment:x.paymentPreference||'—',status:x.requirementId?'IDENTIFIED':'DRAFT',createdAt:x.createdAt||new Date().toISOString()}));
 }catch{return []}
}
export function activeRequest(){return browserRequests()[0]||null}