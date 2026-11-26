-- Team alerts by email and WhatsApp when a buyer request arrives.
-- Every new request (demand pages -> public."DemandRfqSubmission", customer site
-- -> core."RFQ") queues one email and one WhatsApp alert in public."TeamAlert".
-- The notify-team edge function sends them (Resend for email, CallMeBot for
-- WhatsApp) using its own secrets; until a channel is configured its alerts stay
-- PENDING and go out as soon as it is. A cron job retries every 10 minutes.
-- Queueing never blocks a request: any failure here is swallowed.

create table if not exists public."TeamAlert"(
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('demand_page','customer_site','test')),
  reference text not null,
  channel text not null check (channel in ('email','whatsapp')),
  subject text not null,
  body text not null,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED')),
  attempts integer not null default 0,
  "lastError" text,
  "createdAt" timestamptz not null default now(),
  "sentAt" timestamptz,
  unique (reference, channel)
);
create index if not exists "TeamAlert_status_createdAt_idx" on public."TeamAlert"(status, "createdAt");
alter table public."TeamAlert" enable row level security;
revoke all on public."TeamAlert" from anon, authenticated;
grant select, insert, update on public."TeamAlert" to service_role;

-- Calls an edge function with the project's own URL and anon key from the vault
-- (the same pattern push-demand-alert already uses).
create or replace function public.call_team_function(fn text, body jsonb)
returns void
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name='septlion_project_url' order by created_at desc limit 1);
  anon text := (select decrypted_secret from vault.decrypted_secrets where name='septlion_anon_key' order by created_at desc limit 1);
begin
  if base is null or anon is null then return; end if;
  perform net.http_post(
    url := base || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||anon,'apikey',anon),
    body := body
  );
exception when others then
  raise warning 'call_team_function(%) failed: %', fn, sqlerrm;
end;
$$;
revoke all on function public.call_team_function(text, jsonb) from public, anon, authenticated;

create or replace function public.queue_team_alert(p_source text, p_reference text, p_subject text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public."TeamAlert"(source, reference, channel, subject, body)
  values (p_source, p_reference, 'email', p_subject, p_body),
         (p_source, p_reference, 'whatsapp', p_subject, p_body)
  on conflict (reference, channel) do nothing;
  perform public.call_team_function('notify-team', jsonb_build_object('reference', p_reference));
exception when others then
  raise warning 'queue_team_alert(%) failed: %', p_reference, sqlerrm;
end;
$$;
revoke all on function public.queue_team_alert(text, text, text, text) from public, anon, authenticated;

-- Demand pages (public request form).
create or replace function public.on_demand_submission_team_alert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.queue_team_alert(
    'demand_page',
    NEW.reference,
    'طلب جديد من مشترٍ: ' || coalesce(NEW.product, 'منتج') || ' — ' || coalesce(NEW.country, ''),
    concat_ws(E'\n',
      'وصل طلب جديد من صفحات الطلب في septlion.com',
      'المرجع: ' || NEW.reference,
      'المنتج: ' || coalesce(NEW.product, '-'),
      'الكمية: ' || coalesce(NEW.quantity, '-'),
      'الدولة: ' || coalesce(NEW.country, '-') || coalesce(' / ' || nullif(NEW."destinationPort", ''), ''),
      'الشركة: ' || coalesce(NEW."companyName", '-'),
      'الاسم: ' || coalesce(NEW."contactName", '-'),
      'واتساب/هاتف: ' || coalesce(NEW.phone, '-'),
      'البريد: ' || coalesce(nullif(NEW.email, ''), '-'),
      case when coalesce(NEW.notes, '') <> '' then 'ملاحظات: ' || left(NEW.notes, 500) end,
      '',
      'افتح الطلب: https://www.septlion.com/demand-intelligence/workbench/'
    )
  );
  return NEW;
end;
$$;
drop trigger if exists demand_submission_team_alert on public."DemandRfqSubmission";
create trigger demand_submission_team_alert after insert on public."DemandRfqSubmission"
  for each row execute function public.on_demand_submission_team_alert();

-- Customer site (signed-in buyer requests). These had no alert at all, so they
-- also ring the team's phone push like demand-page requests do.
create or replace function core.on_rfq_team_alert()
returns trigger
language plpgsql
security definer
set search_path = core, public, pg_temp
as $$
declare
  q record;
  b jsonb;
  place text;
begin
  if NEW."supplierOrgId" is distinct from 'septlion-operator' then return NEW; end if;
  select product, quantity, unit, "containerCount", market, "deliveryCountry", "deliveryPort", incoterm, "sourceContext"
    into q from core."QualifiedRequirement" where id = NEW."requirementId";
  b := coalesce(q."sourceContext"->'buyer', '{}'::jsonb);
  place := coalesce(nullif(NEW."deliveryCountry", ''), nullif(q."deliveryCountry", ''), q.market, '-')
        || coalesce(' / ' || nullif(coalesce(NEW."deliveryPort", q."deliveryPort"), ''), '');
  perform public.queue_team_alert(
    'customer_site',
    NEW.reference,
    'طلب جديد من مشترٍ: ' || coalesce(q.product, 'منتج') || ' — ' || place,
    concat_ws(E'\n',
      'وصل طلب جديد من موقع العملاء septlion.com',
      'المرجع: ' || NEW.reference,
      'المنتج: ' || coalesce(q.product, '-'),
      'الكمية: ' || coalesce(trim(trailing '.' from trim(trailing '0' from q.quantity::text)) || ' ' || coalesce(q.unit, ''), '-'),
      'الوجهة: ' || place,
      'شرط التسليم: ' || coalesce(NEW.incoterm, q.incoterm, '-'),
      'الشركة: ' || coalesce(b->>'company', '-'),
      'الاسم: ' || coalesce(b->>'name', '-'),
      'واتساب: ' || coalesce(b->>'whatsapp', '-'),
      'البريد: ' || coalesce(b->>'email', '-'),
      '',
      'افتح الطلب: https://www.septlion.com/operations?rfq=' || NEW.id
    )
  );
  perform public.call_team_function('push-demand-alert', jsonb_build_object('event', 'NEW_RFQ', 'reference', NEW.reference));
  return NEW;
exception when others then
  raise warning 'on_rfq_team_alert(%) failed: %', NEW.reference, sqlerrm;
  return NEW;
end;
$$;
drop trigger if exists rfq_team_alert on core."RFQ";
create trigger rfq_team_alert after insert on core."RFQ"
  for each row execute function core.on_rfq_team_alert();

-- Retry anything still pending (a channel configured later, a provider hiccup).
-- cron.schedule replaces a job with the same name, so this is safe to re-run.
select cron.schedule('septlion-team-alerts-retry', '*/10 * * * *',
  $$select public.call_team_function('notify-team', '{"retry":true}'::jsonb) where exists (select 1 from public."TeamAlert" where status='PENDING' and "createdAt" > now() - interval '2 days')$$);
