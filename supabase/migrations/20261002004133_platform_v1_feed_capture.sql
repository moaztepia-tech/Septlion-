create table if not exists public."PlatformBuyerContact" (
  id uuid primary key,
  name text not null check (char_length(name) between 2 and 120),
  company text not null check (char_length(company) between 2 and 180),
  whatsapp text not null check (char_length(whatsapp) between 8 and 18),
  email text,
  whatsapp_status text not null default 'UNCONFIRMED' check (whatsapp_status in ('UNCONFIRMED','CONFIRMED','UNREACHABLE')),
  created_at timestamptz not null default now()
);
create index if not exists "PlatformBuyerContact_whatsapp_idx" on public."PlatformBuyerContact"(whatsapp);

create table if not exists public."PlatformRequirement" (
  id uuid primary key,
  buyer_contact_id uuid not null references public."PlatformBuyerContact"(id) on delete restrict,
  source text not null default 'PRODUCT_FEED' check (source in ('PRODUCT_FEED','AI_COMPOSER','REORDER')),
  status text not null default 'IDENTIFIED' check (status in ('DRAFT','IDENTIFIED','QUALIFIED','SUBMITTED','SOURCING','OFFER_READY','OFFER_SENT','ACCEPTED','REVISION_REQUESTED','EXPIRED')),
  product_id text not null,
  product_name text not null,
  product_configuration jsonb not null default '{}'::jsonb,
  container_count integer not null check (container_count >= 1),
  septlion_scale text not null check (septlion_scale in ('Micro','Nano','Zepto','Yocto','Ronto','Quecto','Septlion')),
  incoterm text not null check (incoterm in ('CIF','CFR','FOB')),
  destination jsonb not null,
  payment_preference text not null check (payment_preference in ('L/C','T/T','OTHER')),
  source_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists "PlatformRequirement_buyer_idx" on public."PlatformRequirement"(buyer_contact_id,created_at desc);
create index if not exists "PlatformRequirement_product_idx" on public."PlatformRequirement"(product_id,created_at desc);

alter table public."PlatformBuyerContact" enable row level security;
alter table public."PlatformRequirement" enable row level security;

drop policy if exists "platform_contact_anon_insert" on public."PlatformBuyerContact";
create policy "platform_contact_anon_insert" on public."PlatformBuyerContact" for insert to anon with check (true);
drop policy if exists "platform_requirement_anon_insert" on public."PlatformRequirement";
create policy "platform_requirement_anon_insert" on public."PlatformRequirement" for insert to anon with check (true);

revoke select, update, delete on public."PlatformBuyerContact" from anon;
revoke select, update, delete on public."PlatformRequirement" from anon;
grant insert on public."PlatformBuyerContact" to anon;
grant insert on public."PlatformRequirement" to anon;
