import {pathToFileURL} from 'node:url';
export function assertStagingConfiguration(env=process.env){
 if(env.SEPTLION_DEPLOYMENT!=='staging')return;
 const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!env.NEXT_PUBLIC_SUPABASE_URL||!key)throw new Error('Staging requires its isolated Supabase URL and publishable key.');
 const url=new URL(env.NEXT_PUBLIC_SUPABASE_URL);
 if(url.protocol!=='https:'||url.hostname==='jfbmxowdmfdzyoauqgwn.supabase.co')throw new Error('Staging cannot target the production Supabase project.');
 if(key.startsWith('sb_publishable_'))return;
 let role;try{role=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role}catch{}
 if(role!=='anon')throw new Error('Use a publishable or legacy anon key; server secrets must never reach the browser.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assertStagingConfiguration();console.log('Staging configuration checked.');}
