'use client';
import{useState}from'react';
import{BuyerShell}from'../../components/buyer-shell';
import{api,clearSession,hasSession,saveSession}from'../../lib/api';

export default function Account(){
 const[logged,setLogged]=useState(()=>typeof window!=='undefined'&&hasSession()),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[organizationId,setOrganizationId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const login=async()=>{setBusy(true);setError('');try{const s:any=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password,organizationId})});saveSession(s);setLogged(true)}catch(e:any){setError(e?.message||'تعذر تسجيل الدخول')}finally{setBusy(false)}};
 const logout=async()=>{clearSession();setLogged(false)};
 return <BuyerShell title="الحساب"><section className="buyer-section">
  <div className="profile-card"><div className="avatar" aria-hidden="true">S</div><div><small>BUYER PROFILE</small><h1>حساب SEPTLION</h1><p>بياناتك التجارية وذاكرة طلباتك في مكان واحد.</p></div></div>
  {!logged?<div className="action-card"><small>SECURE ACCESS</small><h2>تسجيل الدخول</h2><p>استخدم بيانات المؤسسة للوصول إلى طلباتك وعروضك وصفقاتك.</p><label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>معرّف المؤسسة<input value={organizationId} onChange={e=>setOrganizationId(e.target.value)} placeholder="Organization ID"/></label>{error&&<p role="alert">{error}</p>}<button className="primary-link wide" disabled={busy||!email||!password||!organizationId} onClick={login}>{busy?'جارٍ الدخول…':'تسجيل الدخول'}</button></div>:
  <div className="settings-list"><a href="/requests"><span><small>التجارة</small><b>طلباتي وTrade Memory</b></span><i>←</i></a><a href="/notifications"><span><small>التواصل</small><b>التنبيهات</b></span><i>←</i></a><a href="/documents"><span><small>المستندات</small><b>ملفات الصفقة</b></span><i>←</i></a><button className="secondary-link" onClick={logout}>تسجيل الخروج</button></div>}
 </section></BuyerShell>
}