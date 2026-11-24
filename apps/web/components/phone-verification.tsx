'use client';
import {useEffect,useRef,useState} from 'react';
import {confirmPhoneVerification,PhoneChallenge,requestPhoneVerification,verifiedPhone} from '../lib/api';
import {normalizePhone} from '../lib/buyer-contact';
export function PhoneVerification({phone,onVerified,disabled=false}:{phone:string;onVerified:(phone:string)=>void;disabled?:boolean}){
 const[challenge,setChallenge]=useState<PhoneChallenge|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(''),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 const sequence=useRef(0),callback=useRef(onVerified);callback.current=onVerified;
 const normalized=normalizePhone(phone),valid=/^\+[1-9]\d{7,14}$/.test(normalized);
 useEffect(()=>{
  const id=++sequence.current;setChallenge(null);setCode('');setConfirmed('');setError('');callback.current('');
  if(valid)verifiedPhone().then(p=>{if(sequence.current===id&&p===normalized){setConfirmed(p);callback.current(p)}}).catch(()=>{});
  return()=>{sequence.current++};
 },[normalized,valid]);
 useEffect(()=>{if(!retryAt)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[retryAt]);
 async function send(){if(busy||!valid)return;const id=sequence.current;setBusy(true);setError('');try{const c=await requestPhoneVerification(normalized);if(sequence.current===id){setChallenge(c);setCode('');setRetryAt(Date.now()+60000);setNow(Date.now())}}catch(e){if(sequence.current===id)setError(e instanceof Error&&/[\u0600-\u06ff]/.test(e.message)?e.message:'تعذر إرسال رمز واتساب حاليًا. مسودتك محفوظة؛ حاول لاحقًا.')}finally{setBusy(false)}}
 async function confirm(){if(!challenge||busy)return;const id=sequence.current;setBusy(true);setError('');try{const p=await confirmPhoneVerification(challenge,code);if(sequence.current===id&&p===normalized){setConfirmed(p);callback.current(p);setCode('');setRetryAt(0)}}catch(e){if(sequence.current===id)setError(e instanceof Error&&/[\u0600-\u06ff]/.test(e.message)?e.message:'تعذر تأكيد الرمز. راجع الرمز واتصالك ثم أعد المحاولة.')}finally{setBusy(false)}}
 const remaining=Math.max(0,Math.ceil((retryAt-now)/1000));
 return <fieldset className="phone-verification" disabled={disabled||busy} aria-label="التحقق من رقم واتساب"><legend>تأكيد رقم التواصل</legend>{confirmed===normalized&&valid?<p role="status">تم التحقق من الرقم.</p>:<>
  <p>يصلك رمز على واتساب لتأكيد ملكية الرقم ومتابعة طلباتك؛ لا تحتاج إلى كلمة مرور.</p>
  <button type="button" className="secondary-link" disabled={!valid||remaining>0} onClick={()=>void send()}>{busy?'جارٍ التحقق…':remaining>0?'إعادة الإرسال بعد '+remaining+' ثانية':challenge?'إعادة إرسال الرمز':'إرسال رمز واتساب'}</button>
  {challenge&&<><label>رمز واتساب<input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} value={code} onChange={e=>setCode(e.target.value.replace(/[٠-٩]/g,n=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).replace(/\D/g,''))}/></label><button type="button" className="secondary-link" disabled={!/^\d{6,10}$/.test(code)} onClick={()=>void confirm()}>تأكيد الرقم</button></>}
 </>}{error&&<p role="alert">{error}</p>}</fieldset>;
}
