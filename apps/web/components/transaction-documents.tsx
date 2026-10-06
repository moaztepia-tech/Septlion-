'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import {edge} from '../lib/api';
import {TradeDocument,TradeSide,documentKinds,errorMessage} from '../lib/trade-transaction';

export function TransactionDocuments({transactionId,side,onChanged}:{transactionId:string;side:TradeSide;onChanged?:()=>void}) {
 const[rows,setRows]=useState<TradeDocument[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState('');
 const[file,setFile]=useState<File|null>(null),[kind,setKind]=useState('OTHER'),[share,setShare]=useState(false),[progress,setProgress]=useState('');
 const retry=useRef<{signature:string;key:string}|null>(null),input=useRef<HTMLInputElement>(null),generation=useRef(0);
 const load=useCallback(async()=>{const g=++generation.current;setLoading(true);try{const r=await edge<{items:TradeDocument[]}>('documents.list',{transactionId,side});if(g===generation.current){setRows(r.items);setError('');}}catch(e){if(g===generation.current)setError(errorMessage(e));}finally{if(g===generation.current)setLoading(false);}},[transactionId,side]);
 useEffect(()=>{setFile(null);setMessage('');retry.current=null;void load();return()=>{generation.current++;};},[load]);
 async function upload(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();if(!file||busy)return;setError('');setMessage('');
  if(file.size<1||file.size>10*1024*1024){setError('اختر ملفًا غير فارغ لا يتجاوز 10 ميجابايت.');return;}
  if(!['application/pdf','image/png','image/jpeg'].includes(file.type)){setError('الأنواع المسموحة: PDF وPNG وJPEG.');return;}
  setBusy(true);setProgress('التحقق من الملف…');
  try {
   const bytes=await file.arrayBuffer();const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
   const signature=JSON.stringify([transactionId,side,file.name,file.size,sha256,kind,share]);if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()};
   const prepared=await edge<{documentId:string;status:string;uploadUrl?:string}>('documents.prepare',{transactionId,side,fileName:file.name,mimeType:file.type,byteSize:file.size,sha256,kind,visibilityToCounterparty:share,idempotencyKey:retry.current.key});
   if(prepared.status!=='READY') {
    if(!prepared.uploadUrl)throw new Error('تعذر تجهيز رفع الملف.');setProgress('جارٍ رفع الملف…');
    const form=new FormData();form.append('cacheControl','3600');form.append('file',file);
    const uploaded=await fetch(prepared.uploadUrl,{method:'PUT',body:form});
    if(!uploaded.ok){const result=await uploaded.json().catch(()=>null);if(!/already exists|duplicate/i.test(result?.message||result?.error||''))throw new Error('تعذر رفع الملف. أعد المحاولة بنفس الملف.');}
    setProgress('التحقق من محتوى الملف وحفظه…');await edge('documents.complete',{documentId:prepared.documentId,side});
   }
   setMessage('تم حفظ المستند والتحقق من حجمه وبصمته.');setFile(null);if(input.current)input.current.value='';retry.current=null;await load();onChanged?.();
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);setProgress('');}
 }
 async function download(d:TradeDocument){if(downloading)return;setDownloading(d.id);setError('');try{const r=await edge<{url:string;fileName:string}>('documents.download',{documentId:d.id,side});const a=document.createElement('a');a.href=r.url;a.download=r.fileName;a.rel='noreferrer';document.body.append(a);a.click();a.remove();}catch(e){setError(errorMessage(e));}finally{setDownloading('');}}
 return <section className="transaction-documents" aria-labelledby={'documents-'+side}><div className="workspace-heading"><div><small>TRANSACTION DOCUMENTS</small><h2 id={'documents-'+side}>مستندات التنفيذ</h2></div><button type="button" className="secondary-link" disabled={loading||busy} onClick={()=>void load()}>تحديث الملفات</button></div>
  <form className="document-upload" onSubmit={upload}><label className="wide">الملف<input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" required disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);setMessage('');}}/><small>PDF أو PNG أو JPEG · حتى 10 ميجابايت</small></label><label>نوع المستند<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}>{documentKinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="share-document"><input type="checkbox" checked={share} disabled={busy} onChange={e=>setShare(e.target.checked)}/>إظهار المستند للطرف الآخر في هذه الصفقة</label><button type="submit" className="primary-link" disabled={!file||busy}>{busy?progress:'رفع المستند وحفظه'}</button></form>
  {error&&<p className="workspace-error" role="alert">{error}</p>}{message&&<p className="workspace-success" role="status">{message}</p>}
  {loading?<p role="status">جارٍ تحميل المستندات…</p>:rows.length===0?<p className="workspace-muted">لا توجد مستندات تنفيذ جاهزة لهذه الصفقة.</p>:<ul className="transaction-file-list">{rows.map(d=><li key={d.id}><div><b dir="auto">{d.fileName}</b><small>{documentKinds.find(x=>x[0]===d.kind)?.[1]||'مستند'} · {(Number(d.byteSize)/1024).toFixed(1)} KB · {new Date(d.createdAt).toLocaleDateString('ar')}</small><span>{d.visibilityToCounterparty?'مشترك مع طرفي الصفقة':'خاص بمؤسستك'}</span></div><button type="button" className="secondary-link" disabled={Boolean(downloading)} onClick={()=>void download(d)}>{downloading===d.id?'جارٍ التنزيل…':'تنزيل الملف'}</button></li>)}</ul>}
 </section>;
}
