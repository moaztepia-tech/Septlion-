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
async function refreshSession():Promise<string|null>{
 const refresh=typeof window==='undefined'?null:localStorage.getItem('septlion_refresh');if(!refresh)return null;
 const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:headers(),body:JSON.stringify({refresh_token:refresh})});
 const b=await r.json().catch(()=>null);if(!r.ok||!b?.access_token){clearSession();return null}saveSession(b);return b.access_token;
}
async function callEdge<T>(token:string,action:string,payload:Record<string,unknown>):Promise<{response:Response;body:any}>{
 const response=await fetch(`${SUPABASE_URL}/functions/v1/trade-api`,{method:'POST',headers:headers(token),body:JSON.stringify({action,...payload})});
 const body=await response.json().catch(()=>({error:'Invalid server response'}));return{response,body};
}
export async function edge<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
 let token=accessToken();if(!token)throw new Error('يلزم تسجيل الدخول');
 let {response,body}=await callEdge<T>(token,action,payload);
 if(response.status===401){token=await refreshSession();if(!token)throw new Error('انتهت الجلسة. سجل الدخول مرة أخرى.');({response,body}=await callEdge<T>(token,action,payload))}
 if(!response.ok)throw new Error(body?.error||'تعذر تنفيذ الطلب');return body;
}
export function saveSession(s:Session){if(typeof window==='undefined')return;localStorage.setItem('septlion_access',s.access_token);if(s.refresh_token)localStorage.setItem('septlion_refresh',s.refresh_token)}
export function accessToken(){return typeof window==='undefined'?null:localStorage.getItem('septlion_access')}
export function clearSession(){if(typeof window==='undefined')return;localStorage.removeItem('septlion_access');localStorage.removeItem('septlion_refresh')}
export function hasSession(){return Boolean(accessToken())}
