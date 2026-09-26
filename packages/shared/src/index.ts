export type CommercialStage = 'DISCOVERY' | 'RFQ' | 'QUOTE' | 'ORDER_INTENT';
export type SheetLevel = 23 | 60 | 95;
export interface PublicSkuCard { id:string; name:string; skuCode:string; unit:string; minimumOrderQty:string|number; currency:string; }
