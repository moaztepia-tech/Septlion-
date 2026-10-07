import type {TradeWorkspace} from './trade-transaction';
export type TradeContext={requestId?:string;offerId?:string;transactionId?:string};
export function tradeNavigation(context:TradeContext={}) {
  return [
    {path:'/request',label:'الطلب',href:context.requestId?'/request?id='+encodeURIComponent(context.requestId):null},
    {path:'/offer',label:'العرض',href:context.offerId?'/offer?id='+encodeURIComponent(context.offerId):context.requestId?'/offer?requirement='+encodeURIComponent(context.requestId):null},
    ...([['/commit','التأكيد'],['/execution','التنفيذ'],['/documents','المستندات'],['/receive','الاستلام'],['/reorder','إعادة الطلب']]).map(([path,label])=>({path,label,href:context.transactionId?path+'?id='+encodeURIComponent(context.transactionId):null})),
  ];
}
export function buyerNextAction(workspace:TradeWorkspace) {
  const id=encodeURIComponent(workspace.item.id);
  if(workspace.claims.some(c=>['OPEN','UNDER_REVIEW'].includes(c.status)))return{owner:'Septlion',title:'مطالبتك قيد المعالجة',detail:'تأكيد الاستلام متوقف حتى إغلاق المطالبة. يمكنك مراجعة وصفها والمعالجة المسجلة.',href:'/receive?id='+id,label:'متابعة المطالبة'};
  if(workspace.item.status==='COMPLETED')return{owner:'أنت',title:'اكتملت الصفقة',detail:'يمكنك بدء طلب جديد من المواصفة السابقة، مع سعر وصلاحية وموعد شحن جديد.',href:'/reorder?id='+id,label:'إعادة الطلب'};
  if(['DELIVERED','RECEIPT_REVIEW'].includes(workspace.item.status))return{owner:'أنت',title:'راجع الاستلام',detail:'راجع الطلب والمستندات، ثم أكد المطابقة أو افتح مطالبة عند وجود مشكلة.',href:'/receive?id='+id,label:'مراجعة الاستلام'};
  if(workspace.item.status==='CANCELLED')return{owner:'—',title:'الصفقة ملغاة',detail:'يمكنك مراجعة سجلها أو العودة إلى طلباتك.',href:'/requests',label:'طلباتي'};
  return{owner:'Septlion',title:'تابع تحديثات التنفيذ',detail:'تظهر المراحل عند تسجيلها. آخر حالة مسجلة والمستندات المرتبطة بها متاحة هنا.',href:'/documents?id='+id,label:'مراجعة المستندات'};
}
export function canAcceptOffer(status:string,validUntil:string|null,now=Date.now()) {
  const expiry=validUntil?Date.parse(validUntil):NaN;
  return ['ISSUED','REVISED'].includes(status)&&Number.isFinite(expiry)&&expiry>now;
}
