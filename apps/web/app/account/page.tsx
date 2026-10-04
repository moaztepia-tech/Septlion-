'use client';
import{useState}from'react';
import{BuyerShell}from'../../components/buyer-shell';
import{clearSession,hasSession,signIn,signUp}from'../../lib/api';

export default function Account(){
 const[logged,setLogged]=useState(()=>typeof window!=='undefined'&&hasSession()),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const afterAuth=()=>{setLogged(true);const next=new URLSearchParams(window.location.search).get('next');if(next&&next.startsWith('/'))window.location.href=next};const login=async()=>{setBusy(true);setError('');try{await signIn(email,password);afterAuth()}catch(e:any){setError(e?.message||'تعذر تسجيل الدخول')}finally{setBusy(false)}};
 const logout=async()=>{clearSession();setLogged(false)};
 return <BuyerShell title="الحساب"><section className="buyer-section">
  <div className="profile-card"><div className="avatar" aria-hidden="true">S</div><div><small>BUYER PROFILE</small><h1>حساب SEPTLION</h1><p>بياناتك التجارية وذاكرة طلباتك في مكان واحد.</p></div></div>
  {!logged?<div className="action-card"><small>SECURE ACCESS</small><h2>تسجيل الدخول</h2><p>استخدم بيانات المؤسسة للوصول إلى طلباتك وعروضك وصفقاتك.</p><label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="primary-link wide" disabled={busy||!email||!password} onClick={login}>{busy?'جارٍ الدخول…':'تسجيل الدخول'}</button><button className="secondary-link wide" disabled={busy||!email||password.length<8} onClick={async()=>{setBusy(true);setError('');try{const r:any=await signUp(email,password);if(r.access_token)afterAuth();else setError('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لإكمال الدخول.')}catch(e:any){setError(e?.message||'تعذر إنشاء الحساب')}finally{setBusy(false)}}}>إنشاء حساب جديد</button></div>:
  <div className="settings-list"><a href="/requests"><span><small>التجارة</small><b>طلباتي وTrade Memory</b></span><i>←</i></a><a href="/notifications"><span><small>التواصل</small><b>التنبيهات</b></span><i>←</i></a><a href="/documents"><span><small>المستندات</small><b>ملفات الصفقة</b></span><i>←</i></a><button className="secondary-link" onClick={logout}>تسجيل الخروج</button></div>}
 </section></BuyerShell>
}