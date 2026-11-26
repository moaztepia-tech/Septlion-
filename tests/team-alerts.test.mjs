// Team request alerts: recipients parse safely, and every new buyer request (demand
// pages and customer site) queues one email and one WhatsApp alert without ever
// blocking the request itself.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

const source=await readFile(new URL('../supabase/functions/notify-team/targets.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const sql=await readFile(new URL('../supabase/migrations/20261127010000_team_request_alerts.sql',import.meta.url),'utf8');

test('alert emails are cleaned and de-duplicated',()=>{
 assert.deepEqual(m.splitEmails(' A@x.com, a@x.com;b@y.org  nope '),['a@x.com','b@y.org']);
 assert.deepEqual(m.splitEmails(''),[]);
});
test('WhatsApp targets need a real number and an API key',()=>{
 assert.deepEqual(m.parseWhatsappTargets('+249 123 456 789:123456, 966500000000:abc123'),[{phone:'+249123456789',apikey:'123456'},{phone:'+966500000000',apikey:'abc123'}]);
 assert.deepEqual(m.parseWhatsappTargets('+249123456789'),[]);
 assert.deepEqual(m.parseWhatsappTargets('12:999,+249123456789:bad key!'),[]);
});
test('the alert queue stays private and the cron retry is scheduled',()=>{
 assert.match(sql,/revoke all on public\."TeamAlert" from anon, authenticated/);
 assert.match(sql,/cron\.schedule\('septlion-team-alerts-retry'/);
 assert.doesNotMatch(sql,/eyJ[A-Za-z0-9_-]{20,}/);
});

test('new requests from both entry points queue an email and a WhatsApp alert',async()=>{
 const pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec(`create extension pgcrypto; create schema core; create schema vault; create schema cron; create schema net;
  create role anon; create role authenticated; create role service_role bypassrls;
  create table vault.secrets(name text, secret text, created_at timestamptz default now());
  create view vault.decrypted_secrets as select name, secret as decrypted_secret, created_at from vault.secrets;
  insert into vault.secrets values ('septlion_project_url','https://example.supabase.co'),('septlion_anon_key','anon');
  create function cron.schedule(a text,b text,c text) returns bigint language sql as 'select 1::bigint';
  create function cron.unschedule(a text) returns boolean language sql as 'select true';
  create table net.calls(url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ insert into net.calls values (url, body) returning 1::bigint $$;
  create table public."DemandRfqSubmission"(id uuid primary key default gen_random_uuid(), reference text, product text, "companyName" text, "contactName" text, email text, phone text, country text, "destinationPort" text, quantity text, notes text);
  create table core."QualifiedRequirement"(id text primary key, product text, quantity numeric, unit text, "containerCount" int, market text, "deliveryCountry" text, "deliveryPort" text, incoterm text, "sourceContext" jsonb);
  create table core."RFQ"(id text primary key, "requirementId" text, "supplierOrgId" text, reference text, "deliveryCountry" text, "deliveryPort" text, incoterm text);`);
 await pg.exec(sql);

 await pg.exec(`insert into public."DemandRfqSubmission"(reference,product,"companyName","contactName",phone,country,quantity) values ('SRFQ-1','دقيق قمح','شركة النيل','أحمد','+249111222333','السودان','5 حاويات');
  insert into core."QualifiedRequirement" values ('q1','سكر',2.0000,'FCL',2,'Saudi Arabia','السعودية','جدة','CIF','{"buyer":{"name":"سارة","company":"مؤسسة جدة","whatsapp":"+966500000000","email":"s@x.com"}}');
  insert into core."RFQ" values ('r1','q1','septlion-operator','RFQ-1',null,null,null);
  insert into core."RFQ" values ('r2','q1','someone-else','RFQ-2',null,null,null);`);

 const rows=(await pg.query(`select source, reference, channel, status, subject, body from public."TeamAlert" order by reference, channel`)).rows;
 assert.deepEqual(rows.map(r=>[r.source,r.reference,r.channel,r.status]),[
  ['customer_site','RFQ-1','email','PENDING'],['customer_site','RFQ-1','whatsapp','PENDING'],
  ['demand_page','SRFQ-1','email','PENDING'],['demand_page','SRFQ-1','whatsapp','PENDING']]);
 const site=rows.find(r=>r.reference==='RFQ-1');
 assert.match(site.subject,/سكر — السعودية \/ جدة/);
 assert.match(site.body,/الكمية: 2 FCL/);
 assert.match(site.body,/واتساب: \+966500000000/);
 assert.match(site.body,/operations\?rfq=r1/);
 assert.match(rows.find(r=>r.reference==='SRFQ-1').body,/الشركة: شركة النيل/);

 const calls=(await pg.query(`select url from net.calls order by url`)).rows.map(r=>r.url);
 assert.deepEqual(calls,['https://example.supabase.co/functions/v1/notify-team','https://example.supabase.co/functions/v1/notify-team','https://example.supabase.co/functions/v1/push-demand-alert']);

 // A broken alert path must never lose the buyer's request.
 await pg.exec(`drop table public."TeamAlert" cascade;`);
 await pg.exec(`insert into core."RFQ" values ('r3','q1','septlion-operator','RFQ-3',null,null,null); insert into public."DemandRfqSubmission"(reference) values ('SRFQ-2');`);
 assert.equal((await pg.query(`select count(*)::int n from core."RFQ"`)).rows[0].n,3);
 assert.equal((await pg.query(`select count(*)::int n from public."DemandRfqSubmission"`)).rows[0].n,2);
 await pg.close();
});
