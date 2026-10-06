export const NEXT_STAGE: Record<string, {status:string; milestoneCode:string; label:string}> = {
 COMMITTED:{status:'IN_EXECUTION',milestoneCode:'PREPARATION',label:'بدء التجهيز'},
 IN_EXECUTION:{status:'READY_TO_SHIP',milestoneCode:'PREPARATION',label:'تأكيد جاهزية الشحن'},
 READY_TO_SHIP:{status:'SHIPPED',milestoneCode:'READY_TO_SHIP',label:'تسجيل الشحن'},
 SHIPPED:{status:'IN_TRANSIT',milestoneCode:'IN_TRANSIT',label:'تسجيل بدء النقل'},
 IN_TRANSIT:{status:'DELIVERED',milestoneCode:'DELIVERED',label:'تسجيل التسليم'},
};
export function textValue(value:unknown,min:number,max:number,label:string):string {
 if(typeof value!=='string')throw new Error(label);
 const s=value.trim();if(s.length<min||s.length>max)throw new Error(label);return s;
}
export function actionKey(value:unknown):string {
 const s=textValue(value,12,100,'مفتاح العملية غير صالح');
 if(!/^[a-zA-Z0-9_-]+$/.test(s))throw new Error('مفتاح العملية غير صالح');return s;
}
export function expectedVersion(value:unknown):number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw new Error('نسخة الصفقة غير صالحة');return value;
}
export function advanceInput(body:Record<string,unknown>,currentStatus:string) {
 const next=NEXT_STAGE[currentStatus];
 const status=textValue(body.status,1,30,'حالة التنفيذ غير صالحة');
 // An exact retry may arrive after the status changed; SQL verifies its key
 // before checking the current version and transition.
 if(!Object.values(NEXT_STAGE).some(x=>x.status===status&&x.milestoneCode===body.milestoneCode))throw new Error('المرحلة لا تتطابق مع حالة التنفيذ');
 return {status,milestoneCode:String(body.milestoneCode),expectedVersion:expectedVersion(body.expectedVersion),key:actionKey(body.idempotencyKey),note:textValue(body.note,5,1000,'أضف مرجعًا أو وصفًا موثقًا للتحديث'),next};
}
export function reorderInput(body:Record<string,unknown>,unit:string|null) {
 const quantity=body.quantity==null?null:body.quantity;
 if(quantity!==null&&(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<=0||quantity>1000000000))throw new Error('أدخل كمية موجبة صالحة');
 if(quantity!==null&&['FCL','CONTAINER','CONTAINERS','TEU','FEU'].includes((unit||'').toUpperCase())&&!Number.isSafeInteger(quantity))throw new Error('عدد الحاويات يجب أن يكون عددًا صحيحًا');
 return {quantity,key:actionKey(body.idempotencyKey)};
}
export function rpcStatus(message:string):number {
 if(/not_found|not_available/.test(message))return /not_found/.test(message)?404:409;
 if(/access_denied|actor_not_active/.test(message))return 403;
 if(/conflict|stale_|already_|invalid_status_transition|offer_expired|revision_changed|claim_pending|evidence_required|milestone_mismatch/.test(message))return 409;
 return 400;
}
