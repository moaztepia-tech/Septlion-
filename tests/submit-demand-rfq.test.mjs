import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../supabase/functions/submit-demand-rfq/intake.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const bridge=createRequire(import.meta.url)('../sites/customer-client/public/septlion-bridge.js');
const sql=await readFile(new URL('../supabase/migrations/20261124030000_rfq_whatsapp_contact.sql',import.meta.url),'utf8');
const index=await readFile(new URL('../supabase/functions/submit-demand-rfq/index.ts',import.meta.url),'utf8');

const base={companyName:'Nile Bakeries',contactName:'Ahmed',country:'Sudan',quantity:'3 FCL'};

test('a WhatsApp number alone is enough to send a request',()=>{
 const r=m.normalizeIntake({...base,phone:'+249 912 345 678'});
 assert.equal(r.error,undefined);
 assert.equal(r.payload.phone,'+249912345678');
 assert.equal(r.payload.email,null);
 assert.equal(r.payload.productKey,'wheat_flour');
});

test('the buyer must leave at least one way back, and a lone number must be complete',()=>{
 assert.match(m.normalizeIntake(base).error,/WhatsApp number or an email/);
 assert.match(m.normalizeIntake({...base,phone:'0912'}).error,/country code/);
 assert.match(m.normalizeIntake({...base,email:'not-an-email'}).error,/email/);
 assert.equal(m.normalizeIntake({...base,email:'a@b.co',phone:'call me'}).payload.phone,'call me'); // the intent form's free phone field still works
 assert.match(m.normalizeIntake({contactName:'x'}).error,/company/);
});

test('bots filling the hidden field are dropped and the channel is a plain word',()=>{
 assert.equal(m.normalizeIntake({...base,phone:'+249912345678',website:'spam'}).honeypot,true);
 assert.equal(m.normalizeIntake({...base,phone:'+249912345678',channel:'customer_site'}).payload.channel,'customer_site');
 assert.equal(m.normalizeIntake({...base,phone:'+249912345678',channel:'<script>'}).payload.channel,'public_intent_form');
 assert.equal(m.cleanPhone('00966 55 123 4567'),'+966551234567');
});

test('the customer site builds the intake without any email code',()=>{
 const free={kind:'free',description:'دقيق زولانا 50 كجم',quantity:'3 حاويات',destination:'بورتسودان'};
 const p=bridge.buildIntake(free,{name:'أحمد',company:'مخابز النيل',whatsapp:'+249 912 345 678',email:''},{incoterm:'CIF',payment:'LC'});
 assert.equal(p.phone,'+249912345678');
 assert.equal(p.email,undefined);
 assert.equal(p.channel,'customer_site');
 assert.equal(p.country,'بورتسودان');
 assert.match(p.notes,/اعتماد مستندي/);
 assert.equal(m.normalizeIntake(p).error,undefined); // what the site sends, the server accepts
 const sku={kind:'sku',title:'زولانا أساسي 50 كجم',qty:2,dest:'السودان',port:'بورتسودان',incoterm:'CFR'};
 const q=bridge.buildIntake(sku,{name:'أحمد',company:'مخابز النيل',whatsapp:'249912345678',email:'ahmed@nile.sd'},{});
 assert.equal(q.quantity,'2 FCL');
 assert.equal(q.destinationPort,'بورتسودان');
 assert.equal(q.email,'ahmed@nile.sd');
 assert.throws(()=>bridge.buildIntake(free,{name:'أحمد',company:'x',whatsapp:'12',email:''},{}),/واتساب/);
 assert.throws(()=>bridge.buildIntake(free,{name:'أحمد',company:'x',whatsapp:'249912345678',email:'bad'},{}),/البريد/);
});

test('the database accepts a WhatsApp-only request and still refuses one with no contact',()=>{
 assert.match(sql,/ALTER COLUMN "email" DROP NOT NULL/);
 assert.match(sql,/CHECK \("email" IS NOT NULL OR "phone" IS NOT NULL\)/);
 assert.match(sql,/\(email_value IS NULL AND phone_value IS NULL\)/);
 assert.match(sql,/IF email_value IS NOT NULL AND email_value !~\*/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.create_public_demand_rfq\(JSONB\) FROM PUBLIC, anon, authenticated/);
 assert.match(index,/allowedOrigins/);
 assert.match(index,/>= 5\) return json\(req, \{ error: "Too many requests/);
});
