'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {accessToken, edge} from '../../lib/api';
export default function CommandAccess() {
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function enter(){setBusy(true);setError('');try{
  await edge('me'); // Refresh an expired browser session before opening server access.
  const response=await fetch('/api/command-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:accessToken()})});
  if(!response.ok)throw new Error('يتطلب مركز القيادة عضوية تشغيلية فعالة في SEPTLION.');
  router.refresh();
 }catch(e){setError(e instanceof Error?e.message:'تعذر التحقق من الدخول')}finally{setBusy(false)}}
 return <main dir="rtl" className="buyer-section"><h1>الدخول إلى مركز القيادة</h1><p>تحقق من حسابك التشغيلي للمتابعة.</p><button className="primary-link" disabled={busy} onClick={enter}>{busy?'جارٍ التحقق…':'متابعة بالحساب الحالي'}</button> <a href="/account?next=/command-center">تسجيل الدخول</a>{error&&<p role="alert">{error}</p>}</main>;
}
