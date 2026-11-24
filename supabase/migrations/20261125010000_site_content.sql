-- Site texts the team edits from the team panel ("محتوى الموقع").
-- Anyone may read (the public pages show them); only ADMIN/SALES members may
-- write, and only through site_content_save, which also keeps every old value.
create table if not exists public."SiteContent"(
  key text primary key check (key ~ '^[a-z0-9_.]{1,80}$'),
  value text not null check (char_length(value) <= 2000),
  "updatedAt" timestamptz not null default now(),
  "updatedBy" text
);
create table if not exists public."SiteContentHistory"(
  id bigint generated always as identity primary key,
  key text not null,
  "oldValue" text,
  "newValue" text,
  "changedAt" timestamptz not null default now(),
  "changedBy" text
);
alter table public."SiteContent" enable row level security;
alter table public."SiteContentHistory" enable row level security;
drop policy if exists site_content_public_read on public."SiteContent";
create policy site_content_public_read on public."SiteContent" for select to anon, authenticated using (true);
revoke all on public."SiteContent" from anon, authenticated;
grant select on public."SiteContent" to anon, authenticated;
revoke all on public."SiteContentHistory" from anon, authenticated;

-- items: [{"key":"home.hero.title1","value":"..."}]; an empty value restores the built-in text.
create or replace function public.site_content_save(items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, core, pg_temp
as $$
declare
  uid text := auth.uid()::text;
  item jsonb;
  k text;
  v text;
  old text;
  n integer := 0;
begin
  if uid is null or not exists (
    select 1 from core."Membership" m where m."userId" = uid and m.role::text in ('ADMIN','SALES')
  ) then
    raise exception 'يتطلب تعديل محتوى الموقع حساب فريق سبتليون.' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 200 then
    raise exception 'قائمة التعديلات غير صالحة.' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(items) loop
    k := item->>'key';
    v := btrim(coalesce(item->>'value',''));
    if k is null or k !~ '^[a-z0-9_.]{1,80}$' then
      raise exception 'مفتاح محتوى غير صالح.' using errcode = '22023';
    end if;
    if char_length(v) > 2000 then
      raise exception 'النص أطول من المسموح (2000 حرف).' using errcode = '22023';
    end if;
    select value into old from public."SiteContent" where key = k;
    if v = '' then
      if old is not null then
        delete from public."SiteContent" where key = k;
        insert into public."SiteContentHistory"(key,"oldValue","newValue","changedBy") values (k, old, null, uid);
        n := n + 1;
      end if;
    elsif old is distinct from v then
      insert into public."SiteContent"(key,value,"updatedAt","updatedBy") values (k, v, now(), uid)
        on conflict (key) do update set value = excluded.value, "updatedAt" = now(), "updatedBy" = uid;
      insert into public."SiteContentHistory"(key,"oldValue","newValue","changedBy") values (k, old, v, uid);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.site_content_save(jsonb) from public, anon;
grant execute on function public.site_content_save(jsonb) to authenticated;
