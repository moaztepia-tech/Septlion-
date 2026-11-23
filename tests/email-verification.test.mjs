import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../apps/web/lib/api.ts',import.meta.url),'utf8');
const load=s=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:99,target:9}}).outputText).toString('base64')+'#'+crypto.randomUUID());
const verifiedUser={id:'email-buyer',email:'buyer@example.com',email_confirmed_at:'2026-01-01T00:00:00Z'};
const session={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:4102444800,user:verifiedUser};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
async function setup(t){
 const original={window:globalThis.window,fetch:globalThis.fetch,url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY};
 const values=new Map();globalThis.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://auth.fixture.invalid';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fixture';
 t.after(()=>{globalThis.window=original.window;globalThis.fetch=original.fetch;for(const[k,v]of [['NEXT_PUBLIC_SUPABASE_URL',original.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',original.key]]){if(v===undefined)delete process.env[k];else process.env[k]=v}});
 return{api:await load(source),values};
}
test('guest gets a free email code and verifies before a session is saved',async t=>{
 const{api}=await setup(t),calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return response(String(url).endsWith('/otp')?{}:String(url).endsWith('/verify')?session:verifiedUser)};
 const challenge=await api.requestEmailVerification(' Buyer@Example.com ');assert.equal(challenge.type,'email');assert.equal(api.hasSession(),false);
 assert.deepEqual(JSON.parse(calls[0].options.body),{email:'buyer@example.com',create_user:true});
 assert.equal(await api.confirmEmailVerification(challenge,'123456'),'buyer@example.com');
 assert.deepEqual(JSON.parse(calls[1].options.body),{email:'buyer@example.com',token:'123456',type:'email'});
 assert.equal(api.hasSession(),true);assert.equal(api.sessionUserId(),'email-buyer');
});
test('provider failure, wrong code and forged success never create a session',async t=>{
 const{api}=await setup(t);globalThis.fetch=async()=>response({message:'Email rate limit exceeded'},429);await assert.rejects(api.requestEmailVerification('buyer@example.com'),/rate limit/);assert.equal(api.hasSession(),false);
 globalThis.fetch=async()=>response({});const c=await api.requestEmailVerification('buyer@example.com');
 globalThis.fetch=async()=>response({message:'Token expired'},403);await assert.rejects(api.confirmEmailVerification(c,'123456'),/Token expired/);assert.equal(api.hasSession(),false);
 for(const user of [{...verifiedUser,email_confirmed_at:null},{...verifiedUser,email:'other@example.com'}]){globalThis.fetch=async()=>response({...session,user});await assert.rejects(api.confirmEmailVerification(c,'123456'));assert.equal(api.hasSession(),false);}
 await assert.rejects(api.requestEmailVerification('not-an-email'));
});
test('signed-in user adds an email through email_change and keeps the same identity',async t=>{
 const{api}=await setup(t);api.saveSession(session);const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return response(String(url).endsWith('/verify')?session:verifiedUser)};
 const c=await api.requestEmailVerification('buyer@example.com');assert.equal(c.type,'email_change');assert.equal(calls[0].options.method,'PUT');assert.deepEqual(JSON.parse(calls[0].options.body),{email:'buyer@example.com'});
 assert.equal(await api.confirmEmailVerification(c,'123456'),'buyer@example.com');
 globalThis.fetch=async()=>response({});const other=await api.requestEmailVerification('buyer@example.com');globalThis.fetch=async()=>response({...session,user:{...verifiedUser,id:'other'}});await assert.rejects(api.confirmEmailVerification(other,'123456'));
});
const{verifiedBuyerContact}=await load(await readFile(new URL('../supabase/functions/trade-api/phone-input.ts',import.meta.url),'utf8'));
test('Edge accepts an Auth-confirmed email, keeps WhatsApp unconfirmed, and rejects UI claims',()=>{
 const buyer={name:'معاذ',company:'SEPTLION',whatsapp:'+20 101 234 5678',email:'Buyer@Example.com',whatsappStatus:'VERIFIED'};
 const r=verifiedBuyerContact({buyer},verifiedUser);
 assert.equal(r.whatsappStatus,'UNCONFIRMED');assert.equal(r.verifiedBy,'EMAIL');assert.equal(r.email,'buyer@example.com');assert.equal(r.whatsapp,'+201012345678');
 for(const user of [{...verifiedUser,email_confirmed_at:null},{...verifiedUser,email:'other@example.com'},{email:verifiedUser.email,user_metadata:{email_confirmed_at:'2026-01-01'}},{...verifiedUser,email_confirmed_at:'2999-01-01T00:00:00Z'}])assert.throws(()=>verifiedBuyerContact({buyer},user),/phone_verification_required/);
 assert.throws(()=>verifiedBuyerContact({buyer:{...buyer,email:''}},verifiedUser),/phone_verification_required/);
 assert.throws(()=>verifiedBuyerContact({buyer:{...buyer,whatsapp:'12'}},verifiedUser),/invalid_buyer_contact/);
});
