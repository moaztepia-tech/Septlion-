revoke execute on function public.submit_platform_feed_requirement(jsonb) from authenticated;

create or replace function public.submit_platform_feed_requirement(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_id uuid;
  requirement_id uuid;
  p_name text := trim(payload #>> '{buyer,name}');
  p_company text := trim(payload #>> '{buyer,company}');
  p_whatsapp text := trim(payload #>> '{buyer,whatsapp}');
  p_email text := nullif(trim(payload #>> '{buyer,email}'),'');
  p_count integer := (payload->>'containerCount')::integer;
  p_scale text := payload->>'septlionScale';
  p_incoterm text := payload->>'incoterm';
  p_payment text := payload->>'paymentPreference';
  recent_count integer;
begin
  if char_length(p_name) < 2 or char_length(p_name) > 120 or char_length(p_company) < 2 or char_length(p_company) > 180 then raise exception 'invalid buyer'; end if;
  if p_whatsapp !~ '^\+[0-9]{8,15}$' then raise exception 'invalid whatsapp'; end if;
  if p_email is not null and (char_length(p_email) > 254 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'invalid email'; end if;
  if p_count < 1 or p_count > 100000 then raise exception 'invalid quantity'; end if;
  if p_incoterm not in ('CIF','CFR','FOB') then raise exception 'invalid incoterm'; end if;
  if p_payment not in ('L/C','T/T','OTHER') then raise exception 'invalid payment'; end if;
  if p_scale not in ('Micro','Nano','Zepto','Yocto','Ronto','Quecto','Septlion') then raise exception 'invalid scale'; end if;
  if (p_count <= 7 and p_scale <> 'Micro') or
     (p_count between 8 and 19 and p_scale <> 'Nano') or
     (p_count between 20 and 49 and p_scale <> 'Zepto') or
     (p_count between 50 and 99 and p_scale <> 'Yocto') or
     (p_count between 100 and 299 and p_scale <> 'Ronto') or
     (p_count between 300 and 999 and p_scale <> 'Quecto') or
     (p_count >= 1000 and p_scale <> 'Septlion') then raise exception 'scale mismatch'; end if;

  select count(*) into recent_count
  from public."PlatformBuyerContact"
  where whatsapp=p_whatsapp and created_at > now()-interval '1 hour';
  if recent_count >= 5 then raise exception 'rate limit'; end if;

  contact_id := gen_random_uuid();
  requirement_id := gen_random_uuid();
  insert into public."PlatformBuyerContact"(id,name,company,whatsapp,email) values(contact_id,p_name,p_company,p_whatsapp,p_email);
  insert into public."PlatformRequirement"(id,buyer_contact_id,source,status,product_id,product_name,product_configuration,container_count,septlion_scale,incoterm,destination,payment_preference,source_context)
  values(requirement_id,contact_id,'PRODUCT_FEED','IDENTIFIED',payload #>> '{product,id}',payload #>> '{product,nameEn}',
    jsonb_build_object('name',payload #>> '{product,name}','packing',payload #>> '{product,packing}'),p_count,p_scale,p_incoterm,payload->'destination',p_payment,coalesce(payload->'sourceContext','{}'::jsonb));
  return requirement_id;
end $$;

revoke all on function public.submit_platform_feed_requirement(jsonb) from public;
revoke execute on function public.submit_platform_feed_requirement(jsonb) from authenticated;
grant execute on function public.submit_platform_feed_requirement(jsonb) to anon;
