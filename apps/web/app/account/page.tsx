'use client';
import{useEffect,useState}from'react';
import{BuyerShell}from'../../components/buyer-shell';
import{clearSession,hasSession,signIn,signUp}from'../../lib/api';
import{authReturnPath}from'../../lib/auth-return-path';

export default function Account(){
 const[logged,setLogged]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setLogged(hasSession()),[]);
 const afterAuth=()=>{setLogged(true);const next=authReturnPath(new URLSearchParams(window.location.search).get('next'),window.location.origin);if(next)window.location.href=next};const login=async()=>{setBusy(true);setError('');try{await signIn(email,password);afterAuth()}catch(e:any){setError(e?.message||'تعذر تسجيل الدخول')}finally{setBusy(false)}};
 const logout=async()=>{clearSession();for(const key of ['septlion_home_draft','septlion_composer_draft_v2','septlion_pending_requirement','septlion_feed_context','septlion_requirement_seed','septlion_requirement_context','septlion_active_request','septlion_active_transaction'])sessionStorage.removeItem(key);localStorage.removeItem('septlion_draft_requests');setLogged(false)};
 return <BuyerShell title="الحساب"><section className="buyer-section">
  <div className="profile-card"><div className="avatar" aria-hidden="true">S</div><div><small>BUYER PROFILE</small><h1>حساب SEPTLION</h1><p>بياناتك التجارية وذاكرة طلباتك في مكان واحد.</p></div></div>
  {!logged?<form className="action-card" onSubmit={e=>{e.preventDefault();void login()}}><small>SECURE ACCESS</small><h2>تسجيل الدخول</h2><p>استخدم بيانات المؤسسة للوصول إلى طلباتك وعروضك وصفقاتك.</p><label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button type="submit" className="primary-link wide" disabled={busy||!email||!password}>{busy?'جارٍ الدخول…':'تسجيل الدخول'}</button><button type="button" className="secondary-link wide" disabled={busy||!email||password.length<8} onClick={async()=>{setBusy(true);setError('');try{const r:any=await signUp(email,password);if(r.access_token)afterAuth();else setError('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لإكمال الدخول.')}catch(e:any){setError(e?.message||'تعذر إنشاء الحساب')}finally{setBusy(false)}}}>إنشاء حساب جديد</button></form>:
  <div className="settings-list"><a href="/requests"><span><small>التجارة</small><b>طلباتي وTrade Memory</b></span><i>←</i></a><a href="/notifications"><span><small>التواصل</small><b>التنبيهات</b></span><i>←</i></a><a href="/documents"><span><small>المستندات</small><b>ملفات الصفقة</b></span><i>←</i></a><button className="secondary-link" onClick={logout}>تسجيل الخروج</button></div>}
 </section></BuyerShell>
}
