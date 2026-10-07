export type UiRequest={id:string;product:string;packing:string;containers:number;quantityLabel?:string;scale:string;incoterm:string;destination:string;payment:string;status:string;createdAt:string};
export function browserRequests():UiRequest[]{
 if(typeof window==='undefined')return [];
 try{
  const rows=JSON.parse(localStorage.getItem('septlion_draft_requests')||'[]');
  return rows.map((x:any,i:number)=>({id:x.requirementId?String(x.requirementId).slice(0,8).toUpperCase():'DRAFT-'+(i+1),product:x.product?.name||'طلب توريد',packing:x.product?.packing||'تُحدد في الطلب',containers:x.containerCount||1,scale:x.septlionScale||'S-1',incoterm:x.incoterm||'—',destination:x.destination?.port||x.destination?.country||'—',payment:x.paymentPreference||'—',status:x.requirementId?'IDENTIFIED':'DRAFT',createdAt:x.createdAt||new Date().toISOString()}));
 }catch{return []}
}
export function activeRequest(id?:string|null){const rows=browserRequests();if(!id)return rows[0]||null;return rows.find(r=>r.id===id)||null}
export function rememberActiveRequest(id:string){if(typeof window!=='undefined')sessionStorage.setItem('septlion_active_request',id)}
export function activeRequestId(){return typeof window==='undefined'?null:sessionStorage.getItem('septlion_active_request')}
