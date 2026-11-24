import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../apps/web/lib/api.ts',import.meta.url),'utf8');
const load=s=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:99,target:9}}).outputText).toString('base64')+'#'+crypto.randomUUID());
const verifiedUser={id:'phone-buyer',phone:'201012345678',phone_confirmed_at:'2026-01-01T00:00:00Z'};
const session={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:4102444800,user:verifiedUser};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
async function setup(t){
 const original={window:globalThis.window,fetch:globalThis.fetch,url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY};
 const values=new Map();globalThis.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://auth.fixture.invalid';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fixture';
 t.after(()=>{globalThis.window=original.window;globalThis.fetch=original.fetch;for(const[k,v]of [['NEXT_PUBLIC_SUPABASE_URL',original.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',original.key]]){if(v===undefined)delete process.env[k];else process.env[k]=v}});
 return{api:await load(source),values};
}
test('guest requests a real WhatsApp channel and verifies before creating the saved session',async t=>{
 const{api}=await setup(t),calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return response(String(url).endsWith('/otp')?{}:String(url).endsWith('/verify')?session:verifiedUser)};
 const challenge=await api.requestPhoneVerification('+20 1012345678');assert.equal(challenge.type,'sms');assert.equal(api.hasSession(),false);assert.deepEqual(JSON.parse(calls[0].options.body),{phone:'+201012345678',channel:'whatsapp',create_user:true});
 assert.equal(await api.confirmPhoneVerification(challenge,'123456'),'+201012345678');assert.equal(api.hasSession(),true);assert.equal(api.sessionUserId(),'phone-buyer');assert.equal(calls.length,3);
});
test('provider unavailable and wrong OTP preserve a guest draft without fabricating a session',async t=>{
 const{api}=await setup(t);globalThis.fetch=async()=>response({message:'Phone provider disabled'},422);await assert.rejects(api.requestPhoneVerification('+201012345678'),/provider disabled/);assert.equal(api.hasSession(),false);
 globalThis.fetch=async()=>response({});const c=await api.requestPhoneVerification('+201012345678');globalThis.fetch=async()=>response({message:'Token expired'},403);await assert.rejects(api.confirmPhoneVerification(c,'123456'),/Token expired/);assert.equal(api.hasSession(),false);
});
test('verification rejects forged success without confirmed Auth phone and mismatched numbers',async t=>{
 const{api}=await setup(t);globalThis.fetch=async()=>response({});const c=await api.requestPhoneVerification('+201012345678');
 for(const user of [{...verifiedUser,phone_confirmed_at:null},{...verifiedUser,phone:'966555555555'}]){globalThis.fetch=async()=>response({...session,user});await assert.rejects(api.confirmPhoneVerification(c,'123456'));assert.equal(api.hasSession(),false)}
});
test('signed-in phone change preserves the current identity and rejects another user',async t=>{
 const{api}=await setup(t);api.saveSession(session);const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return response(String(url).endsWith('/verify')?session:verifiedUser)};
 const c=await api.requestPhoneVerification('+201012345678');assert.equal(c.type,'phone_change');assert.equal(calls[0].options.method,'PUT');assert.equal(JSON.parse(calls[0].options.body).channel,'whatsapp');await api.confirmPhoneVerification(c,'123456');assert.equal(api.sessionUserId(),'phone-buyer');
 globalThis.fetch=async()=>response({});const other=await api.requestPhoneVerification('+201012345678');globalThis.fetch=async()=>response({...session,user:{...verifiedUser,id:'other'}});await assert.rejects(api.confirmPhoneVerification(other,'123456'));assert.equal(api.sessionUserId(),'phone-buyer');
});
test('logout or account changes during OTP verification cannot restore or overwrite a session',async t=>{
 const{api}=await setup(t);globalThis.fetch=async()=>response({});const c=await api.requestPhoneVerification('+201012345678');let finish;globalThis.fetch=()=>new Promise(resolve=>{finish=resolve});const pending=api.confirmPhoneVerification(c,'123456');api.clearSession();finish(response(session));await assert.rejects(pending);assert.equal(api.hasSession(),false);
});
const{verifiedBuyerContact}=await load(await readFile(new URL('../supabase/functions/trade-api/phone-input.ts',import.meta.url),'utf8'));
test('Edge uses confirmed Auth phone, ignores UI claims, and validates required buyer identity',()=>{
 const buyer={name:'معاذ',company:'SEPTLION',whatsapp:'+201012345678',email:null,whatsappStatus:'UNCONFIRMED'};
 assert.equal(verifiedBuyerContact({buyer},verifiedUser).whatsappStatus,'VERIFIED');
 for(const user of [{...verifiedUser,phone_confirmed_at:null},{...verifiedUser,phone:'966555555555'},{phone:verifiedUser.phone,user_metadata:{phone_confirmed_at:'2026-01-01'}}])assert.throws(()=>verifiedBuyerContact({buyer:{...buyer,whatsappStatus:'VERIFIED'}},user),/phone_verification_required/);
 assert.throws(()=>verifiedBuyerContact({buyer:{...buyer,name:''}},verifiedUser),/invalid_buyer_contact/);
});
