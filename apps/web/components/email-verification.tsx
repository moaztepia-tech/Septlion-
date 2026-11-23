'use client';
import {useEffect,useRef,useState} from 'react';
import {confirmEmailVerification,EmailChallenge,requestEmailVerification,verifiedEmail} from '../lib/api';
import {normalizeEmail} from '../lib/buyer-contact';
export function EmailVerification({email,onVerified,disabled=false}:{email:string;onVerified:(email:string)=>void;disabled?:boolean}){
 const[challenge,setChallenge]=useState<EmailChallenge|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(''),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 const sequence=useRef(0),callback=useRef(onVerified);callback.current=onVerified;
 const normalized=normalizeEmail(email),valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)&&normalized.length<=254;
 useEffect(()=>{
  const id=++sequence.current;setChallenge(null);setCode('');setConfirmed('');setError('');callback.current('');
  if(valid)verifiedEmail().then(e=>{if(sequence.current===id&&e===normalized){setConfirmed(e);callback.current(e)}}).catch(()=>{});
  return()=>{sequence.current++};
 },[normalized,valid]);
 useEffect(()=>{if(!retryAt)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[retryAt]);
 async function send(){if(busy||!valid)return;const id=sequence.current;setBusy(true);setError('');try{const c=await requestEmailVerification(normalized);if(sequence.current===id){setChallenge(c);setCode('');setRetryAt(Date.now()+60000);setNow(Date.now())}}catch(e){if(sequence.current===id)setError(e instanceof Error&&/[؀-ۿ]/.test(e.message)?e.message:'تعذر إرسال الرمز حاليًا. مسودتك محفوظة؛ حاول لاحقًا.')}finally{setBusy(false)}}
 async function confirm(){if(!challenge||busy)return;const id=sequence.current;setBusy(true);setError('');try{const e=await confirmEmailVerification(challenge,code);if(sequence.current===id&&e===normalized){setConfirmed(e);callback.current(e);setCode('');setRetryAt(0)}}catch(e){if(sequence.current===id)setError(e instanceof Error&&/[؀-ۿ]/.test(e.message)?e.message:'تعذر تأكيد الرمز. راجع الرمز واتصالك ثم أعد المحاولة.')}finally{setBusy(false)}}
 const remaining=Math.max(0,Math.ceil((retryAt-now)/1000));
 return <fieldset className="phone-verification" disabled={disabled||busy} aria-label="التحقق من البريد الإلكتروني"><legend>تأكيد البريد الإلكتروني</legend>{confirmed===normalized&&valid?<p role="status">تم التحقق من البريد.</p>:<>
  <p>يصلك رمز على بريدك لتأكيده ومتابعة طلباتك من أي جهاز؛ لا تحتاج إلى كلمة مرور.</p>
  <button type="button" className="secondary-link" disabled={!valid||remaining>0} onClick={()=>void send()}>{busy?'جارٍ التحقق…':remaining>0?'إعادة الإرسال بعد '+remaining+' ثانية':challenge?'إعادة إرسال الرمز':'إرسال رمز إلى البريد'}</button>
  {challenge&&<><label>رمز التحقق<input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} value={code} onChange={e=>setCode(e.target.value.replace(/[٠-٩]/g,n=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).replace(/\D/g,''))}/></label><button type="button" className="secondary-link" disabled={!/^\d{6,10}$/.test(code)} onClick={()=>void confirm()}>تأكيد البريد</button></>}
 </>}{error&&<p role="alert">{error}</p>}</fieldset>;
}
