'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {edge} from '../../lib/api';
import './command-center.css';
type Sector={id:string;code:string;name:string;description?:string;updatedAt:string};
type Sku={skuCode:string;name:string;unit:string;minimumOrderQty:number|string;currency:string;packing:string};
type Product={id:string;name:string;slug:string;description?:string;sectorId:string;status:string;visibility:string;updatedAt:string;skus:(Omit<Sku,'packing'>&{specifications?:{packing?:string}})[]};
const emptySku=():Sku=>({skuCode:'',name:'',unit:'MT',minimumOrderQty:1,currency:'USD',packing:''});
const emptyProduct=()=>({id:'',name:'',slug:'',description:'',sectorId:'',expectedUpdatedAt:'',skus:[emptySku()]});
const emptySector=()=>({id:'',name:'',code:'',description:'',expectedUpdatedAt:''});
export default function CatalogManager({role,mode}:{role:'ADMIN'|'SALES';mode:string}){
 const[products,setProducts]=useState<Product[]>([]),[sectors,setSectors]=useState<Sector[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const[tab,setTab]=useState('product'),[product,setProduct]=useState(emptyProduct),[sector,setSector]=useState(emptySector),[busy,setBusy]=useState(false);
 const[confirm,setConfirm]=useState<{action:string;product:Product}|null>(null),[verified,setVerified]=useState(false);
 const key=useRef(''),pending=useRef(''),lock=useRef(false);
 const admin=role==='ADMIN';
 async function load(){setLoading(true);try{
  const [p,s]=await Promise.all([edge<{items:Product[]}>('catalog.list'),edge<{items:Sector[]}>('sectors.list')]);
  setProducts(p.items);setSectors(s.items);setError('');
 }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل البيانات')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(mode==='product'||mode==='sector')setTab(mode)},[mode]);
 async function mutate(action:string,input:Record<string,unknown>){
  if(lock.current)return false;lock.current=true;setBusy(true);setError('');setMessage('');
  const signature=JSON.stringify({action,input});if(pending.current!==signature){key.current=crypto.randomUUID();pending.current=signature}
  try{await edge(action,{input,key:key.current});pending.current='';setMessage('تم حفظ العملية في الخادم.');await load();return true}
  catch(e){setError(e instanceof Error?e.message:'تعذر الحفظ');return false}finally{lock.current=false;setBusy(false)}
 }
 async function saveProduct(e:FormEvent){e.preventDefault();if(await mutate('catalog.save',product))setProduct(emptyProduct())}
 async function saveSector(e:FormEvent){e.preventDefault();if(await mutate('sectors.save',sector))setSector(emptySector())}
 function editProduct(p:Product){setProduct({id:p.id,name:p.name,slug:p.slug,description:p.description||'',sectorId:p.sectorId,expectedUpdatedAt:p.updatedAt,skus:p.skus.map(s=>({skuCode:s.skuCode,name:s.name,unit:s.unit,minimumOrderQty:s.minimumOrderQty,currency:s.currency,packing:s.specifications?.packing||''}))});setTab('product')}
 function changeSku(i:number,field:keyof Sku,value:string){setProduct(p=>({...p,skus:p.skus.map((s,n)=>n===i?{...s,[field]:value}:s)}))}
 return <section className="command-data" aria-label="إدارة الكتالوج والقطاعات">
  <h2>الكتالوج والقطاعات</h2><p>صلاحيتك: {admin?'إدارة':'مبيعات · قراءة الكتالوج ومتابعة العمليات'}</p>
  <div className="command-actions"><button aria-pressed={tab==='product'} onClick={()=>setTab('product')}>المنتجات</button><button aria-pressed={tab==='sector'} onClick={()=>setTab('sector')}>القطاعات</button><button disabled={busy||loading} onClick={()=>void load()}>تحديث البيانات</button><a href="/operations">دورة الطلب والعرض والتنفيذ ←</a></div>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{loading&&<p role="status">جارٍ قراءة البيانات…</p>}
  {tab==='product'?<>
   <div className="command-records">{products.map(p=><article key={p.id}><h3>{p.name}</h3><p>{p.status} · {p.visibility}</p><p>{p.skus.map(s=>s.name).join(' · ')}</p>{admin&&<div className="command-actions">{p.status==='DRAFT'&&<><button disabled={busy} onClick={()=>editProduct(p)}>تعديل المسودة</button><button disabled={busy} onClick={()=>{setConfirm({action:'catalog.publish',product:p});setVerified(false)}}>مراجعة النشر</button></>}{p.status!=='ARCHIVED'&&<button disabled={busy} onClick={()=>{setConfirm({action:'catalog.archive',product:p});setVerified(false)}}>أرشفة</button>}</div>}</article>)}</div>
   {!loading&&!products.length&&<p>لا توجد منتجات محفوظة.</p>}
   {admin&&<form onSubmit={saveProduct}><h3>{product.id?'تعديل مسودة':'منتج جديد'}</h3><fieldset disabled={busy}><div className="command-fields">
    <label>اسم المنتج<input required maxLength={200} value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/></label>
    <label>رمز الرابط<input required dir="ltr" pattern="[a-z0-9](?:[a-z0-9]|-){1,119}" value={product.slug} onChange={e=>setProduct({...product,slug:e.target.value})}/></label>
    <label>القطاع<select required value={product.sectorId} onChange={e=>setProduct({...product,sectorId:e.target.value})}><option value="">اختر القطاع</option>{sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>الوصف<textarea required maxLength={4000} value={product.description} onChange={e=>setProduct({...product,description:e.target.value})}/></label>
   </div>{product.skus.map((sku,i)=><fieldset key={i}><legend>التعبئة {i+1}</legend><div className="command-fields">
    <label>رمز الصنف<input required readOnly={Boolean(product.id&&products.find(p=>p.id===product.id)?.skus.some(s=>s.skuCode===sku.skuCode))} pattern="(?:[A-Z0-9_]|-){2,60}" value={sku.skuCode} onChange={e=>changeSku(i,'skuCode',e.target.value)}/></label>
    <label>اسم التعبئة<input required maxLength={200} value={sku.name} onChange={e=>changeSku(i,'name',e.target.value)}/></label>
    <label>مواصفة التعبئة<input required maxLength={200} placeholder="50 كجم / شوال منسوج" value={sku.packing} onChange={e=>changeSku(i,'packing',e.target.value)}/></label>
    <label>الوحدة<select value={sku.unit} onChange={e=>changeSku(i,'unit',e.target.value)}>{['MT','KG','UNIT','FCL','CARTON'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>الحد الأدنى<input required type="number" step="0.0001" min="0.0001" max="1000000000" value={sku.minimumOrderQty} onChange={e=>changeSku(i,'minimumOrderQty',e.target.value)}/></label>
    <label>العملة<input required pattern="[A-Z]{3}" value={sku.currency} onChange={e=>changeSku(i,'currency',e.target.value)}/></label>
   </div></fieldset>)}<div className="command-actions"><button type="button" disabled={product.skus.length>=30} onClick={()=>setProduct({...product,skus:[...product.skus,emptySku()]})}>إضافة تعبئة</button><button>حفظ كمسودة خاصة</button><button type="button" onClick={()=>setProduct(emptyProduct())}>تفريغ الحقول</button></div></fieldset></form>}
  </>:<>
   <div className="command-records">{sectors.map(s=><article key={s.id}><h3>{s.name}</h3><p>{s.code}</p>{admin&&<button disabled={busy} onClick={()=>setSector({id:s.id,name:s.name,code:s.code,description:s.description||'',expectedUpdatedAt:s.updatedAt})}>تعديل</button>}</article>)}</div>
   {admin&&<form onSubmit={saveSector}><h3>{sector.id?'تعديل القطاع':'قطاع جديد'}</h3><fieldset disabled={busy}><div className="command-fields"><label>الاسم<input required maxLength={150} value={sector.name} onChange={e=>setSector({...sector,name:e.target.value})}/></label><label>الرمز<input required pattern="(?:[A-Z0-9_]|-){2,40}" value={sector.code} onChange={e=>setSector({...sector,code:e.target.value})}/></label><label>الوصف<textarea maxLength={2000} value={sector.description} onChange={e=>setSector({...sector,description:e.target.value})}/></label></div><div className="command-actions"><button>حفظ القطاع</button><button type="button" onClick={()=>setSector(emptySector())}>تفريغ الحقول</button></div></fieldset></form>}
  </>}
  {confirm&&<section className="command-confirm" aria-labelledby="publication-title"><h3 id="publication-title">{confirm.action==='catalog.publish'?'اعتماد نشر المنتج':'تأكيد أرشفة المنتج'}: {confirm.product.name}</h3><p>{confirm.action==='catalog.publish'?'سيظهر المنتج والتعبئات في اكتشف. تأكد من الهوية والمواصفات؛ النشر لا يؤكد المخزون أو السعر.':'سيختفي من الكتالوج العام وتبقى سجلات الصفقات محفوظة.'}</p>{confirm.action==='catalog.publish'&&<label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>راجعت هوية المنتج ومواصفات تعبئاته وأعتمد نشره.</label>}<div className="command-actions"><button disabled={busy||(confirm.action==='catalog.publish'&&!verified)} onClick={async()=>{if(await mutate(confirm.action,{id:confirm.product.id,expectedUpdatedAt:confirm.product.updatedAt,confirm:true,identityVerified:verified}))setConfirm(null)}}>تأكيد {confirm.action==='catalog.publish'?'النشر':'الأرشفة'}</button><button disabled={busy} onClick={()=>setConfirm(null)}>إلغاء</button></div></section>}
 </section>;
}
