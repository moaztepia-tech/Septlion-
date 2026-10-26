-- Packing images use operator-approved HTTPS assets; no server-side URL fetching.
-- Server-only RPC: the Edge caller verifies Auth; this transaction rechecks the
-- actor in stored memberships. No role or organization from browser input is used.
create or replace function core.mutate_operator_catalog(p_user_id text,p_action text,p_input jsonb,p_key text)
returns jsonb language plpgsql security invoker set search_path=core,pg_catalog as $$
declare
 v_org constant text:='septlion-operator'; v_id text; v_before jsonb; v_after jsonb;
 v_sku_id text; v_product core."Product"%rowtype; v_sector core."Sector"%rowtype; v_sku jsonb;
 v_event core."AuditLog"%rowtype; v_now timestamp:=clock_timestamp(); v_entity text;
begin
 if not exists(select 1 from core."Membership" m join core."User" u on u.id=m."userId"
  join core."Organization" o on o.id=m."organizationId"
  where m."userId"=p_user_id and m."organizationId"=v_org and m.role='ADMIN' and u."isActive" and o.status='ACTIVE')
 then raise exception 'access_denied';end if;
 if p_action is null or p_action not in ('catalog.save','catalog.publish','catalog.archive','sectors.save')
 or p_key is null or p_key!~'^[a-zA-Z0-9_-]{12,100}$' or jsonb_typeof(p_input) is distinct from 'object'
 then raise exception 'invalid_catalog_input';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog:'||p_user_id||':'||p_key,0));
 select * into v_event from core."AuditLog" where "userId"=p_user_id and "organizationId"=v_org and metadata->>'catalogKey'=p_key;
 if found then
  if v_event.metadata->>'operation' is distinct from p_action or v_event.metadata->'input' is distinct from p_input then raise exception 'idempotency_conflict';end if;
  return jsonb_build_object('id',v_event."entityId",'idempotent',true);
 end if;
 v_id:=nullif(p_input->>'id','');
 if p_action='sectors.save' then
  if length(trim(coalesce(p_input->>'name',''))) not between 1 and 150 or coalesce(p_input->>'code','')!~'^[A-Z0-9_-]{2,40}$'
   or length(coalesce(p_input->>'description',''))>2000 then raise exception 'invalid_sector_input';end if;
  if v_id is not null then
   select * into v_sector from core."Sector" where id=v_id for update;
   if not found then raise exception 'sector_not_found';end if;
   if (p_input->>'expectedUpdatedAt')::timestamp is distinct from v_sector."updatedAt" then raise exception 'version_conflict';end if;
   v_before:=to_jsonb(v_sector);
   update core."Sector" set name=trim(p_input->>'name'),code=p_input->>'code',description=p_input->>'description',"updatedAt"=v_now where id=v_id;
  else
   v_id:=gen_random_uuid()::text;
   insert into core."Sector"(id,code,name,description,"createdAt","updatedAt") values(v_id,p_input->>'code',trim(p_input->>'name'),p_input->>'description',v_now,v_now);
  end if;
  select to_jsonb(s) into v_after from core."Sector" s where id=v_id;v_entity:='Sector';
 else
  if v_id is not null then
   select * into v_product from core."Product" where id=v_id and "organizationId"=v_org for update;
   if not found then raise exception 'product_not_found';end if;
   if (p_input->>'expectedUpdatedAt')::timestamp is distinct from v_product."updatedAt" then raise exception 'version_conflict';end if;
   v_before:=to_jsonb(v_product);
  elsif p_action<>'catalog.save' then raise exception 'product_not_found';end if;
  if p_action='catalog.save' then
   if v_id is not null and v_product.status<>'DRAFT' then raise exception 'catalog_conflict';end if;
   if length(trim(coalesce(p_input->>'name',''))) not between 1 and 200 or coalesce(p_input->>'slug','')!~'^[a-z0-9][a-z0-9-]{1,119}$'
    or length(coalesce(p_input->>'description',''))>4000 or jsonb_typeof(p_input->'skus') is distinct from 'array'
    or jsonb_array_length(p_input->'skus') not between 1 and 30 then raise exception 'invalid_product_input';end if;
   if not exists(select 1 from core."Sector" where id=p_input->>'sectorId') then raise exception 'sector_not_found';end if;
   if (select count(*)<>count(distinct value->>'skuCode') from jsonb_array_elements(p_input->'skus')) then raise exception 'duplicate_sku';end if;
   if v_id is null then
    v_id:=gen_random_uuid()::text;
    insert into core."Product"(id,"organizationId","sectorId",name,slug,description,status,visibility,"createdAt","updatedAt")
    values(v_id,v_org,p_input->>'sectorId',trim(p_input->>'name'),p_input->>'slug',p_input->>'description','DRAFT','PRIVATE',v_now,v_now);
   else
    update core."Product" set "sectorId"=p_input->>'sectorId',name=trim(p_input->>'name'),slug=p_input->>'slug',description=p_input->>'description',"updatedAt"=v_now where id=v_id;
   end if;
   for v_sku in select value from jsonb_array_elements(p_input->'skus') loop
    if coalesce(v_sku->>'skuCode','')!~'^[A-Z0-9_-]{2,60}$' or length(trim(coalesce(v_sku->>'name',''))) not between 1 and 200
     or coalesce(v_sku->>'unit','') not in ('MT','KG','UNIT','FCL','CARTON') or coalesce(v_sku->>'currency','')!~'^[A-Z]{3}$'
     or (v_sku->>'minimumOrderQty') is null or (v_sku->>'minimumOrderQty')::numeric<=0
     or (v_sku->>'minimumOrderQty')::numeric>1000000000 or (v_sku->>'minimumOrderQty')::numeric::text in ('NaN','Infinity','-Infinity')
     or length(trim(coalesce(v_sku->>'packing',''))) not between 1 and 200 then raise exception 'invalid_sku_input';end if;
    if exists(select 1 from core."SKU" where "organizationId"=v_org and "skuCode"=v_sku->>'skuCode' and "productId"<>v_id) then raise exception 'duplicate_sku';end if;
    insert into core."SKU"(id,"organizationId","productId","skuCode",name,unit,"minimumOrderQty",currency,specifications,"createdAt","updatedAt")
     values(gen_random_uuid()::text,v_org,v_id,v_sku->>'skuCode',trim(v_sku->>'name'),v_sku->>'unit',(v_sku->>'minimumOrderQty')::numeric,v_sku->>'currency',jsonb_build_object('packing',trim(v_sku->>'packing')),v_now,v_now)
     on conflict ("organizationId","skuCode") do update set name=excluded.name,unit=excluded.unit,"minimumOrderQty"=excluded."minimumOrderQty",currency=excluded.currency,
       specifications=coalesce(core."SKU".specifications,'{}'::jsonb)||excluded.specifications,"updatedAt"=v_now
     where core."SKU"."productId"=v_id returning id into v_sku_id;
    if not found then raise exception 'duplicate_sku';end if;
    if v_sku ? 'imageUrl' then
     if length(coalesce(v_sku->>'imageUrl',''))>2048 or (coalesce(v_sku->>'imageUrl','')<>'' and (v_sku->>'imageUrl'!~'^https://[A-Za-z0-9.-]+(:443)?/[^[:space:][:cntrl:]]*$')) then raise exception 'invalid_image_url';end if;
     delete from core."Media" where "skuId"=v_sku_id and type='IMAGE' and "sortOrder"=0;
     if coalesce(v_sku->>'imageUrl','')<>'' then insert into core."Media"(id,"skuId",type,url,"sortOrder","createdAt") values(gen_random_uuid()::text,v_sku_id,'IMAGE',v_sku->>'imageUrl',0,v_now);end if;
    end if;
   end loop;
  elsif p_action='catalog.publish' then
   if p_input->'confirm' is distinct from 'true'::jsonb or p_input->'identityVerified' is distinct from 'true'::jsonb then raise exception 'publication_confirmation_required';end if;
   if v_product.status<>'DRAFT' or length(trim(coalesce(v_product.description,'')))=0
    or not exists(select 1 from core."SKU" where "productId"=v_id and "organizationId"=v_org)
    or exists(select 1 from core."SKU" where "productId"=v_id and ("organizationId"<>v_org or length(trim(coalesce(specifications->>'packing','')))=0 or "minimumOrderQty"<=0)) then raise exception 'invalid_publication';end if;
   update core."Product" set status='ACTIVE',visibility='PUBLIC',"updatedAt"=v_now where id=v_id;
  else
   if p_input->'confirm' is distinct from 'true'::jsonb then raise exception 'archive_confirmation_required';end if;
   update core."Product" set status='ARCHIVED',visibility='PRIVATE',"updatedAt"=v_now where id=v_id;
  end if;
  select to_jsonb(p)||jsonb_build_object('skus',(select jsonb_agg(to_jsonb(s)) from core."SKU" s where s."productId"=v_id)) into v_after from core."Product" p where id=v_id;v_entity:='Product';
 end if;
 insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",before,after,metadata,"createdAt")
 values(gen_random_uuid()::text,v_org,p_user_id,case when v_before is null then 'CREATE'::core."AuditAction" else 'UPDATE'::core."AuditAction" end,v_entity,v_id,v_before,v_after,jsonb_build_object('catalogKey',p_key,'operation',p_action,'input',p_input),v_now);
 return jsonb_build_object('id',v_id,'idempotent',false);
end $$;
revoke all on function core.mutate_operator_catalog(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function core.mutate_operator_catalog(text,text,jsonb,text) to service_role;
grant select,insert,delete on core."Media" to service_role;
notify pgrst,'reload schema';
