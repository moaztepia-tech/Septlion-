import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const dir=new URL('../../supabase/migrations/',import.meta.url);
export async function demandDatabase(){
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
  try{await pg.exec(sql)}catch(e){throw new Error(f+': '+e.message)}
 }
 await pg.exec('SET search_path=public');
 return pg;
}
