// Same privacy-friendly counter as apps/web/components/visit-beacon.tsx, for the static
// demand pages: no cookies, nothing stored in the browser, the server never keeps the IP.
export function visitBeacon(supabaseUrl){
 const url=JSON.stringify(String(supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/track-visit');
 return `<script>(function(){try{if(navigator.doNotTrack==='1'||!/(^|\\.)septlion\\.com$/.test(location.hostname))return;var u=${url},b=JSON.stringify({p:location.pathname,r:document.referrer||''});if(!(navigator.sendBeacon&&navigator.sendBeacon(u,new Blob([b],{type:'text/plain'}))))fetch(u,{method:'POST',body:b,keepalive:true,headers:{'Content-Type':'text/plain'}}).catch(function(){});}catch(e){}})();</script>`;
}
