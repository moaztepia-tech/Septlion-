const API=process.env.NEXT_PUBLIC_API_URL||'/api';

type Session={accessToken:string;refreshToken:string;expiresAt?:string};
export async function api<T>(path:string,init:RequestInit={},token?:string):Promise<T>{
 const res=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{}),...(token?{Authorization:`Bearer ${token}`}:{})},cache:'no-store'});
 if(!res.ok){let message='Request failed';try{const b=await res.json();message=Array.isArray(b.message)?b.message.join(' · '):(b.message||message)}catch{}throw new Error(message)}
 return res.json();
}
export function saveSession(data:Session){localStorage.setItem('septlion_access',data.accessToken);localStorage.setItem('septlion_refresh',data.refreshToken);if(data.expiresAt)localStorage.setItem('septlion_session_expires',data.expiresAt)}
export function accessToken(){return typeof window==='undefined'?null:localStorage.getItem('septlion_access')}
export function refreshToken(){return typeof window==='undefined'?null:localStorage.getItem('septlion_refresh')}
export function clearSession(){if(typeof window==='undefined')return;['septlion_access','septlion_refresh','septlion_session_expires'].forEach(k=>localStorage.removeItem(k))}
export function hasSession(){return Boolean(accessToken())}
