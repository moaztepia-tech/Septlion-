// Read-only release checks: never send an OTP, create a user or mutate trade data.
import {assertStagingConfiguration} from './assert-staging-config.mjs';
assertStagingConfiguration({...process.env,SEPTLION_DEPLOYMENT:'staging'});
const backend=process.env.NEXT_PUBLIC_SUPABASE_URL,publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,origin=process.env.SEPTLION_STAGING_ORIGIN;
if(!backend||!publicKey||!origin)throw new Error('Set the staging Supabase URL, publishable key and SEPTLION_STAGING_ORIGIN.');
const base=new URL(backend),site=new URL(origin);
if(base.hostname==='jfbmxowdmfdzyoauqgwn.supabase.co')throw new Error('Staging must use an isolated backend, not the existing production project.');
if(base.protocol!=='https:'||site.protocol!=='https:')throw new Error('Staging endpoints must use HTTPS.');
async function get(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});const data=await response.json().catch(()=>null);return{response,data}}
const settings=await get(new URL('/auth/v1/settings',base),{headers:{apikey:publicKey}});
if(!settings.response.ok||settings.data?.external?.phone!==true||settings.data?.phone_autoconfirm!==false)throw new Error('Phone authentication must be enabled with phone autoconfirm disabled. Configure the WhatsApp provider before release.');
const catalog=await get(new URL('/functions/v1/trade-api',base),{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json',Origin:site.origin},body:JSON.stringify({action:'catalog.public'})});
if(!catalog.response.ok||!Array.isArray(catalog.data?.items))throw new Error('Published catalog endpoint is not ready. Deploy staging migrations and the Edge function.');
if(catalog.response.headers.get('access-control-allow-origin')!==site.origin)throw new Error('The staging browser origin is not explicitly allowed by trade-api CORS.');
const health=await get(new URL('/api/health',site));if(!health.response.ok||health.data?.status!=='ok'||health.data?.configured!==true||health.data?.environment!=='staging')throw new Error('The full Next.js server runtime is not ready.');
console.log(JSON.stringify({status:'passed',checks:['phone-provider-enabled','autoconfirm-disabled','catalog-contract','explicit-staging-cors','next-server-runtime'],publicProducts:catalog.data.items.length},null,2));
