export type TradeSide='BUYER'|'OPERATOR';
export type TradeDocument={id:string;fileName:string;mimeType:string;byteSize:string|number;kind:string;createdAt:string;own:boolean;visibilityToCounterparty:boolean};
export type TradeClaim={id:string;status:string;description:string;resolution:{note?:string}|null;createdAt:string;resolvedAt:string|null};
export type TradeWorkspace={
 item:{id:string;reference:string;status:string;testOnly:boolean;version:number;updatedAt:string};
 commercialLock:{id:string;lockedAt:string;snapshotHash:string;offerId:string;snapshot:{items:Array<{description:string;quantity:number;unit:string}>;terms:Record<string,unknown>;testOnly:boolean}}|null;
 milestones:Array<{code:string;label:string;status:string;sequence:number;completedAt:string|null}>;
 receipt:{status:string;confirmedAt:string|null}|null;
 events:Array<{id:string;type:string;occurredAt:string;payload:{input?:{note?:string};note?:string;description?:string;fileName?:string}}>;
 claims:TradeClaim[];
 nextAction:{status:string;milestoneCode:string;label:string}|null;
};
export const statusNames:Record<string,string>={COMMITTED:'الطلب مثبت',IN_EXECUTION:'قيد التجهيز',READY_TO_SHIP:'جاهز للشحن',SHIPPED:'تم تسجيل الشحن',IN_TRANSIT:'قيد النقل',DELIVERED:'تم تسجيل التسليم',RECEIPT_REVIEW:'بانتظار تأكيد الاستلام',CLAIM_OPEN:'مطالبة قيد المعالجة',COMPLETED:'مكتملة',CANCELLED:'ملغاة'};
export const documentKinds=[['INVOICE','فاتورة'],['PACKING_LIST','قائمة التعبئة'],['BILL_OF_LADING','بوليصة الشحن'],['QUALITY_REPORT','تقرير الجودة'],['DELIVERY_PROOF','إثبات التسليم'],['OTHER','مستند آخر']] as const;
export const errorMessage=(error:unknown,fallback='تعذر إتمام العملية')=>error instanceof Error?error.message:fallback;
