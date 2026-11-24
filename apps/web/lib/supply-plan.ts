export type SupplyBatchPlan = {sequence:number;quantity:number;unit:string;plannedDate:string;notes:string};
export type SupplyPlan = {version:1;batches:SupplyBatchPlan[];terms:string;automaticPurchaseOrders:false};

export function normalizeSupplyPlan(value:unknown,total?:{amount:number;unit:string}):SupplyPlan|null {
  if(value===undefined||value===null)return null;
  const plan=value as SupplyPlan;
  if(plan.version!==1||!Array.isArray(plan.batches)||plan.batches.length<2||plan.batches.length>24||typeof plan.terms!=='string'||plan.terms.length>2000||plan.automaticPurchaseOrders!==false)throw new Error('راجع جدول التوريد: من دفعتين إلى 24 دفعة، بدون أوامر شراء تلقائية.');
  let lastDate='';
  const batches=plan.batches.map((b,i)=>{
    if(!b||typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<=0||b.quantity>1e9||!['FCL','MT','KG'].includes(b.unit)||(b.unit==='FCL'&&!Number.isInteger(b.quantity)))throw new Error('راجع كمية ووحدة كل دفعة. عدد الحاويات يجب أن يكون صحيحًا.');
    if(typeof b.plannedDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.plannedDate)||!Number.isFinite(Date.parse(b.plannedDate))||new Date(b.plannedDate).toISOString().slice(0,10)!==b.plannedDate||b.plannedDate<lastDate)throw new Error('حدد تاريخًا صحيحًا لكل دفعة، بالترتيب الزمني.');
    if(typeof b.notes!=='string'||b.notes.length>500)throw new Error('ملاحظات الدفعة تتجاوز 500 حرف.');
    lastDate=b.plannedDate;
    return{sequence:i+1,quantity:b.quantity,unit:b.unit,plannedDate:b.plannedDate,notes:b.notes.trim()};
  });
  const unit=batches[0].unit,sum=batches.reduce((n,b)=>n+b.quantity,0);
  if(batches.some(b=>b.unit!==unit)||sum>1e9)throw new Error('استخدم وحدة واحدة لجميع الدفعات.');
  if(total&&(unit!==total.unit||Math.abs(sum-total.amount)>1e-7*Math.max(1,total.amount)))throw new Error('مجموع كميات الدفعات يجب أن يساوي كمية الطلب، وبالوحدة نفسها.');
  return{version:1,batches,terms:plan.terms.trim(),automaticPurchaseOrders:false};
}
export function supplyPlanProblem(value:unknown,total?:{amount:number;unit:string}) {
  try{normalizeSupplyPlan(value,total);return '';}catch(e){return e instanceof Error?e.message:'راجع جدول التوريد.';}
}
