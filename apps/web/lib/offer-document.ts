export type OfferDocument = {
  offer: {id:string;status:string;currency:string;currentRevision:number;validUntil:string|null};
  revision: {revisionNo:number;issuedAt:string;snapshotHash:string;snapshot:{product?:string;testOnly?:boolean;items?:Array<{description:string;quantity:number;unit:string;unitPrice:number}>;terms?:Record<string,unknown>}};
  rfq: {reference:string}; buyer: {name:string;legalName?:string|null;country?:string|null};
};
export function offerDocumentModel(d:OfferDocument){
  const s=d.revision.snapshot, items=Array.isArray(s.items)?s.items:[], terms=s.terms||{};
  const testOnly=Boolean(s.testOnly)||/^TEST(?:\s|—|-|$)/i.test(s.product||'');
  const reference='OFR-'+new Date(d.revision.issuedAt).getUTCFullYear()+'-'+d.offer.id.replace(/-/g,'').toUpperCase()+'-R'+d.revision.revisionNo;
  const money=(n:number)=>n.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+d.offer.currency;
  const date=(v:string|null)=>v?new Date(v).toLocaleDateString('ar-EG',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}):'غير محدد';
  const total=items.reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unitPrice),0);
  const conditions=[['شرط التجارة',String(terms.incoterm||'غير محدد')],['شروط الدفع',String(terms.payment||'غير محدد')],['التسليم',String(terms.destination||'غير محدد')],['التعبئة',String(terms.packing||'غير محدد')]];
  const notice=testOnly?'TEST — للاختبار التقني فقط. هذا المستند غير ملزم ولا يمثل بيعًا أو شحنة أو التزامًا بالدفع.':String(terms.notice||'العرض يخضع للشروط الموضحة وتأكيد المواصفات والتوفر.');
  const rows=[['مرجع الطلب',d.rfq.reference],['العميل',d.buyer.legalName||d.buyer.name],['تاريخ الإصدار',date(d.revision.issuedAt)],['الصلاحية',date(d.offer.validUntil)],['المنتج',s.product||'حسب بنود العرض'],['الحالة',d.offer.status],...items.flatMap((x,i)=>[['البند '+(i+1),x.description],['الكمية وسعر الوحدة',x.quantity+' '+x.unit+' · '+money(x.unitPrice)],['إجمالي البند',money(x.quantity*x.unitPrice)]]),['إجمالي العرض',money(total)],...conditions];
  if(terms.notes)rows.push(['ملاحظات',String(terms.notes)]);rows.push(['الشروط العامة',notice]);
  return{reference,testOnly,items,total,money,date,conditions,notice,rows,notes:String(terms.notes||'')};
}

// High-resolution, multipage image PDF. Native canvas shapes Arabic and mixed
// RTL/LTR text. The adjacent print view also supports selectable-text browser PDF.
export function jpegPagesToPdf(pages:Uint8Array[],width:number,height:number):Uint8Array{
  if(!pages.length||pages.length>100||width<=0||height<=0)throw new Error('Invalid PDF pages');
  const encoder=new TextEncoder(),chunks:Uint8Array[]=[],offsets=[0];let length=0;
  const append=(v:string|Uint8Array)=>{const bytes=typeof v==='string'?encoder.encode(v):v;chunks.push(bytes);length+=bytes.byteLength};
  const object=(id:number,body:string|Uint8Array)=>{offsets[id]=length;append(id+' 0 obj\n');append(body);append('\nendobj\n')};
  append('%PDF-1.4\n% SEPTLION\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>');
  pages.forEach((jpeg,i)=>{
    const page=3+i*3,image=page+1,content=page+2;
    object(page,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 '+image+' 0 R >> >> /Contents '+content+' 0 R >>');
    offsets[image]=length;append(image+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.byteLength+' >>\nstream\n');append(jpeg);append('\nendstream\nendobj\n');
    const commands='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';object(content,'<< /Length '+encoder.encode(commands).byteLength+' >>\nstream\n'+commands+'endstream');
  });
  const xref=length,count=3+pages.length*3;append('xref\n0 '+count+'\n0000000000 65535 f \n');for(let id=1;id<count;id++)append(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
  append('trailer\n<< /Size '+count+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  const result=new Uint8Array(length);let cursor=0;for(const bytes of chunks){result.set(bytes,cursor);cursor+=bytes.length}return result;
}

export async function downloadOfferPdf(d:OfferDocument){
  const model=offerDocumentModel(d);await document.fonts.ready;
  const loaded=await document.fonts.load('500 18px Cairo','عرض سعر سبتليون');
  if(!loaded.length)throw new Error('لم يكتمل تحميل الخط العربي. أعد المحاولة أو استخدم الطباعة.');
  const logo=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('تعذر تحميل شعار المستند'));img.src='/brand/septlion-primary-navy.png'});
  const w=794,h=1123,scale=2,canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('تعذر تجهيز المستند');ctx.scale(scale,scale);
  const pages:Uint8Array[]=[];let y=0,pageNo=1;
  const line=(value:string,x:number,pos:number,size=15,bold=false,rtl=true)=>{ctx.font=(bold?'700':'500')+' '+size+'px Cairo';ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';ctx.fillStyle='#051945';ctx.fillText(value,x,pos)};
  const start=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(logo,50,42,185,185*logo.naturalHeight/logo.naturalWidth);line(model.testOnly?'عرض TEST غير ملزم':'عرض سعر',744,88,26,true);line('SEPTLION',744,123,13,true);ctx.fillStyle='#051945';ctx.fillRect(50,159,694,3);line(model.reference,50,189,10,false,false);y=230};
  const finish=async()=>{ctx.fillStyle='#D9DFEA';ctx.fillRect(50,1063,694,1);line('septlion.com · '+pageNo,50,1090,11,false,false);line(model.testOnly?'TEST — اختبار غير تجاري':'نسخة من العرض المحفوظ',744,1090,11);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('تعذر تجهيز صفحة PDF')),'image/jpeg',0.94));pages.push(new Uint8Array(await blob.arrayBuffer()))};
  const wrap=(value:string,max:number)=>{const lines:string[]=[];let current='';for(const word of value.split(/\s+/)){const joined=current?current+' '+word:word;if(ctx.measureText(joined).width<=max){current=joined;continue}if(current)lines.push(current);current='';for(const character of word){if(ctx.measureText(current+character).width>max&&current){lines.push(current);current=''}current+=character}}if(current)lines.push(current);return lines.length?lines:['—']};
  start();
  for(const [label,value]of model.rows){ctx.font='500 15px Cairo';const lines=wrap(value,520);
    if(y+54>1040){await finish();pageNo++;start()}
    line(label,744,y,12,true);
    for(const valueLine of lines){if(y+28>1040){await finish();pageNo++;start();line(label+' — تابع',744,y,12,true)}line(valueLine,580,y,15);y+=27}y+=19;
  }
  await finish();const bytes=jpegPagesToPdf(pages,canvas.width,canvas.height),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/pdf'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=model.reference+'.pdf';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
