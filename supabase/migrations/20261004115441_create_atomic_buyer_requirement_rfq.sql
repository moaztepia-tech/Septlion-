create or replace function core.create_buyer_requirement(p_org_id text,p_user_id text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog,public as $$
declare
 v_now timestamp(3):=current_timestamp; v_req text:=gen_random_uuid()::text; v_product_id text; v_sku_id text; v_rfq text:=gen_random_uuid()::text;
 v_name text:=nullif(btrim(p_input->>'product'),''); v_market text:=nullif(btrim(coalesce(p_input->>'market',p_input->>'destination')),'');
 v_qty numeric; v_containers integer; v_unit text:=coalesce(nullif(p_input->>'unit',''),'UNIT'); v_scale text; v_ref text;
begin
 if v_name is null or v_market is null then raise exception 'product_and_market_required'; end if;
 if nullif(p_input->>'quantityNumber','') is not null then v_qty:=(p_input->>'quantityNumber')::numeric; end if;
 if nullif(p_input->>'containerCount','') is not null then v_containers:=greatest(0,(p_input->>'containerCount')::integer); end if;
 v_scale:=case when v_containers is null or v_containers=0 then null when v_containers<=7 then 'S-1' when v_containers<=19 then 'S-2' when v_containers<=49 then 'S-3' when v_containers<=99 then 'S-4' when v_containers<=299 then 'S-5' when v_containers<=999 then 'S-6' else 'S-7' end;
 insert into core."QualifiedRequirement"("id","organizationId","source","sourceContext","status","product","market","quantity","unit","containerCount","septlionScale","deliveryCountry","deliveryPort","destinationCode","incoterm","paymentPreference","knownFacts","packing","confidence","createdAt","updatedAt")
 values(v_req,p_org_id,case when p_input->>'source'='PRODUCT_FEED' then 'PRODUCT_FEED'::core."RequirementSource" else 'AI_COMPOSER'::core."RequirementSource" end,coalesce(p_input->'sourceContext','{}'::jsonb),'QUALIFIED',v_name,v_market,v_qty,v_unit,nullif(v_containers,0),v_scale,p_input->>'deliveryCountry',coalesce(p_input->>'deliveryPort',p_input->>'destination'),p_input->>'destinationCode',p_input->>'incoterm',coalesce(p_input->>'paymentPreference',p_input->>'payment'),coalesce(p_input->'knownFacts',p_input),p_input->'packing',100,v_now,v_now);
 select id into v_product_id from core."Product" where "organizationId"='septlion-operator' and lower(name)=lower(v_name) limit 1;
 if v_product_id is null then
   v_product_id:=gen_random_uuid()::text;
   insert into core."Product"(id,"organizationId","sectorId",name,slug,status,visibility,"createdAt","updatedAt") values(v_product_id,'septlion-operator','sector-general-trade',v_name,'managed-'||substr(replace(v_product_id,'-',''),1,12),'ACTIVE','PRIVATE',v_now,v_now);
 end if;
 select id into v_sku_id from core."SKU" where "productId"=v_product_id order by "createdAt" limit 1;
 if v_sku_id is null then
   v_sku_id:=gen_random_uuid()::text;
   insert into core."SKU"(id,"organizationId","productId","skuCode",name,unit,"minimumOrderQty",currency,specifications,shipping,"createdAt","updatedAt") values(v_sku_id,'septlion-operator',v_product_id,'M-'||upper(substr(replace(v_sku_id,'-',''),1,10)),v_name,v_unit,1,coalesce(nullif(p_input->>'currency',''),'USD'),coalesce(p_input->'specifications','{}'::jsonb),jsonb_build_object('packing',p_input->'packing'),v_now,v_now);
 end if;
 v_ref:='RFQ-'||to_char(v_now,'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_rfq,'-',''),1,6));
 insert into core."RFQ"(id,"requirementId","buyerOrgId","supplierOrgId","sectorId",reference,status,"deliveryCountry","deliveryPort",incoterm,notes,"createdAt","updatedAt")
 values(v_rfq,v_req,p_org_id,'septlion-operator','sector-general-trade',v_ref,'OPEN',p_input->>'deliveryCountry',coalesce(p_input->>'deliveryPort',p_input->>'destination'),p_input->>'incoterm','Created from qualified SEPTLION requirement',v_now,v_now);
 insert into core."RFQItem"(id,"rfqId","skuId",quantity,unit,"createdAt") values(gen_random_uuid()::text,v_rfq,v_sku_id,coalesce(v_qty,v_containers::numeric,1),v_unit,v_now);
 insert into core."Notification"(id,"organizationId","userId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,p_org_id,p_user_id,'RFQ','تم تسجيل طلبك','تم تأهيل طلبك وفتح RFQ لإعداد العرض.','RFQ',v_rfq,v_now);
 return jsonb_build_object('requirementId',v_req,'rfqId',v_rfq,'reference',v_ref,'scale',v_scale);
end $$;
revoke all on function core.create_buyer_requirement(text,text,jsonb) from public,anon,authenticated;
grant execute on function core.create_buyer_requirement(text,text,jsonb) to service_role;
