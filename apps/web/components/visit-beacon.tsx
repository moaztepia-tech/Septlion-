'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

// Visitor counter: no cookies, nothing stored in the browser, and the server
// never keeps the IP address. Team pages are not counted.
const TEAM=/^\/(command-center|operations|ops|demand-intelligence\/workbench)(\/|$)/;
export function VisitBeacon(){
  const path=usePathname()||'/';
  useEffect(()=>{
    try{
      if(TEAM.test(path)||navigator.doNotTrack==='1'||!/(^|\.)septlion\.com$/.test(location.hostname))return;
      const base=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!base)return;
      const url=`${base}/functions/v1/track-visit`,body=JSON.stringify({p:path,r:document.referrer||''});
      if(!(navigator.sendBeacon&&navigator.sendBeacon(url,new Blob([body],{type:'text/plain'}))))fetch(url,{method:'POST',body,keepalive:true,headers:{'Content-Type':'text/plain'}}).catch(()=>{});
    }catch{/* counting must never break the page */}
  },[path]);
  return null;
}
