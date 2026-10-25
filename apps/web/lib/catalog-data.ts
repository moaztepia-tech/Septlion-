export type CatalogProduct={id:string;name:string;description:string;sector:{id:string;name:string};skus:{id:string;name:string;unit:string;minimumOrderQty:number;specifications?:{packing?:string};media?:{type:string;url:string;sortOrder:number}[]}[]};
export async function publicCatalog():Promise<CatalogProduct[]>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('الكتالوج غير متاح حاليًا. يمكنك كتابة احتياجك.');
 const r=await fetch(`${url}/functions/v1/trade-api`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key},body:JSON.stringify({action:'catalog.public'})});
 const body=await r.json();if(!r.ok)throw new Error('تعذر تحميل الكتالوج. حاول مجددًا.');
 return (body.items||[]).filter((p:CatalogProduct)=>p.skus?.length>0);
}
