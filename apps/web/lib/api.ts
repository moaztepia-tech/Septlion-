const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';

export type Session={access_token:string;refresh_token:string;expires_in?:number;user?:{id:string;email?:string}};
const headers=(token?:string)=>({'Content-Type':'application/json','apikey':SUPABASE_KEY,...(token?{Authorization:`Bearer ${token}`}:{})});

export async function signIn(email:string,password:string):Promise<Session>{
 const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:headers(),body:JSON.stringify({email,password})});
 const b=await r.json();if(!r.ok)throw new Error(b?.msg||b?.message||'تعذر تسجيل الدخول');saveSession(b);return b;
}
export async function signUp(email:string,password:string):Promise<any>{
 const r=await fetch(`${SUPABASE_URL}/auth/v1/signup`,{method:'POST',headers:headers(),body:JSON.stringify({email,password,data:{source:'septlion-platform'}})});
 const b=await r.json();if(!r.ok)throw new Error(b?.msg||b?.message||'تعذر إنشاء الحساب');if(b.access_token)saveSession(b);return b;
}
export async function edge<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
 const token=accessToken();if(!token)throw new Error('يلزم تسجيل الدخول');
 const r=await fetch(`${SUPABASE_URL}/functions/v1/trade-api`,{method:'POST',headers:headers(token),body:JSON.stringify({action,...payload})});
 const b=await r.json();if(!r.ok)throw new Error(b?.error||'تعذر تنفيذ الطلب');return b;
}
export function saveSession(s:Session){localStorage.setItem('septlion_access',s.access_token);localStorage.setItem('septlion_refresh',s.refresh_token)}
export function accessToken(){return typeof window==='undefined'?null:localStorage.getItem('septlion_access')}
export function clearSession(){if(typeof window==='undefined')return;localStorage.removeItem('septlion_access');localStorage.removeItem('septlion_refresh')}
export function hasSession(){return Boolean(accessToken())}

/** Compatibility adapter for legacy operator screens while their endpoints move to Edge Functions. */
export async function api<T>(path:string,init:RequestInit={},token?:string):Promise<T>{
 const legacy=process.env.NEXT_PUBLIC_API_URL;
 if(!legacy)throw new Error('هذه الشاشة قيد النقل إلى SEPTLION Edge Runtime.');
 const r=await fetch(`${legacy}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{}),...(token?{Authorization:`Bearer ${token}`}:{})},cache:'no-store'});
 const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.message||'Request failed');return b as T;
}
