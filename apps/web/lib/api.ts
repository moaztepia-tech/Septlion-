const API=process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api';
export async function api<T>(path:string,init:RequestInit={},token?:string):Promise<T>{const res=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{}),...(token?{Authorization:`Bearer ${token}`}:{})},cache:'no-store'});if(!res.ok){let message='Request failed';try{const b=await res.json();message=b.message||message}catch{}throw new Error(message)}return res.json();}
export function saveSession(data:{accessToken:string;refreshToken:string}){localStorage.setItem('septlion_access',data.accessToken);localStorage.setItem('septlion_refresh',data.refreshToken)}
export function accessToken(){return typeof window==='undefined'?null:localStorage.getItem('septlion_access')}
