// Rebuilds the database from supabase/migrations alone, in version order, on an empty
// PostgreSQL with minimal stand-ins for Supabase-managed schemas (auth, vault, cron, net).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const dir=new URL('../supabase/migrations/',import.meta.url);
test('every migration applies in order to an empty database and recreates core and demand tables',async()=>{
 const pg=new PGlite({extensions:{pgcrypto}});
await pg.exec(`create extension pgcrypto; create schema extensions; create schema auth; create schema vault; create schema cron; create schema net; create schema graphql_public;
 create role anon; create role authenticated; create role service_role bypassrls; create role authenticator; create role supabase_admin; create role postgres_role;
 create function auth.uid() returns uuid language sql as 'select null::uuid'; create function auth.role() returns text language sql as 'select null::text'; create function auth.jwt() returns jsonb language sql as 'select null::jsonb';
 create table auth.users(id uuid primary key, email text, phone text, phone_confirmed_at timestamptz);
 create table vault.secrets(id uuid primary key default gen_random_uuid(), name text unique, secret text, created_at timestamptz default now());
 create view vault.decrypted_secrets as select id,name,secret as decrypted_secret,created_at from vault.secrets;
 create function vault.create_secret(s text, n text default null, d text default null) returns uuid language sql as $$ insert into vault.secrets(name,secret) values(n,s) returning id $$;
 create function cron.schedule(a text,b text,c text) returns bigint language sql as 'select 1::bigint';
 create function cron.unschedule(a text) returns boolean language sql as 'select true';
 create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as 'select 1::bigint';
 create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as 'select 1::bigint';
 create table net._http_response(id bigint, status_code int, content text, created timestamptz);
 create function extensions.digest(t text, a text) returns bytea language sql as 'select public.digest(t,a)';
 create function extensions.digest(t bytea, a text) returns bytea language sql as 'select public.digest(t,a)';
 create function extensions.gen_random_bytes(n int) returns bytea language sql as 'select public.gen_random_bytes(n)';
 set app.septlion_project_url='https://example.supabase.co'; set app.septlion_anon_key='test'; set app.septlion_vapid_private='test'; set app.septlion_operator_key_hash='${'0'.repeat(64)}';`);
 
 const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
 for(const f of files){
  const sql=(await readFile(new URL(f,dir),'utf8')).replace(/create extension if not exists (pg_cron|pg_net)[^;]*;/gi,'').replace(/ALTER ROLE authenticator SET[^;]*;/gi,'').replace(/NOTIFY pgrst[^;]*;/gi,'');
  try{await pg.exec(sql)}catch(e){assert.fail(f+': '+e.message)}
 }
 const counts=Object.fromEntries((await pg.query("select table_schema s,count(*)::int n from information_schema.tables where table_schema in ('public','core') and table_type='BASE TABLE' group by 1")).rows.map(r=>[r.s,r.n]));
 assert.deepEqual(counts,{core:48,public:30});
 await pg.close();
});
test('repository migrations hold no secret literals',async()=>{
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql'))){
  const sql=await readFile(new URL(f,dir),'utf8');
  assert.doesNotMatch(sql,/eyJ[A-Za-z0-9_-]{20,}/,f);
  assert.doesNotMatch(sql,/vault\.create_secret\('[^']{20,}'/,f);
  assert.doesNotMatch(sql,/'[a-f0-9]{64}'/,f);
 }
});
