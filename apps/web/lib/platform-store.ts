export async function persistFeedRequirement(payload:Record<string,unknown>){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('Platform persistence is not configured');
 const res=await fetch(url+'/rest/v1/rpc/submit_platform_feed_requirement',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},
  body:JSON.stringify({payload})
 });
 if(!res.ok)throw new Error('Could not save requirement');
 return (await res.json()) as string;
}