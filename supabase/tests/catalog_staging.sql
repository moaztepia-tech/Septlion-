-- Synthetic staging verification only. All fixtures and commercial rows roll back.
begin;
do $$
declare
 admin_id text:=gen_random_uuid()::text; buyer_id text:=gen_random_uuid()::text;
 buyer_org text:=gen_random_uuid()::text; sector_id text:=gen_random_uuid()::text;
 product_id text; sku_id text; media_id text; req jsonb; replay jsonb; payload jsonb;
 draft jsonb; stamp text; offer jsonb; accepted jsonb; request_key text:=gen_random_uuid()::text;
begin
 insert into core."Organization"(id,name,"organizationType",status,"updatedAt") values('septlion-operator','TEST operator','BOTH','ACTIVE',now()),(buyer_org,'TEST buyer','BUYER','ACTIVE',now());
 insert into core."Sector"(id,code,name,"updatedAt") values(sector_id,'TEST-STAGING','TEST sector',now()),('sector-general-trade','GENERAL','TEST General',now());
 insert into core."User"(id,email,"passwordHash","updatedAt") values(admin_id,admin_id||'@fixture.invalid','TEST',now()),(buyer_id,buyer_id||'@fixture.invalid','TEST',now());
 insert into core."Membership"(id,"userId","organizationId",role) values(gen_random_uuid()::text,admin_id,'septlion-operator','ADMIN'),(gen_random_uuid()::text,buyer_id,buyer_org,'BUYER');
 perform set_config('role','service_role',true);
 draft:=jsonb_build_object('name','TEST catalog item','slug','test-staging-'||admin_id,'sectorId',sector_id,'description','TEST noncommercial','skus',jsonb_build_array(jsonb_build_object('skuCode','TEST-'||upper(substr(admin_id,1,8)),'name','TEST pack','unit','FCL','minimumOrderQty',1,'currency','USD','packing','TEST 1L','imageUrl','https://assets.fixture.invalid/first.jpg')));
 begin
  perform core.mutate_operator_catalog(buyer_id,'catalog.save',draft,gen_random_uuid()::text);
  raise exception 'expected buyer rejection';
 exception when others then if sqlerrm<>'access_denied' then raise;end if;end;
 product_id:=core.mutate_operator_catalog(admin_id,'catalog.save',draft,gen_random_uuid()::text)->>'id';
 select id into sku_id from core."SKU" where "productId"=product_id;
 select id into media_id from core."Media" where "skuId"=sku_id;
 select "updatedAt"::text into stamp from core."Product" where id=product_id;
 draft:=draft||jsonb_build_object('id',product_id,'expectedUpdatedAt',stamp,'skus',jsonb_build_array((draft->'skus'->0)||jsonb_build_object('imageUrl','')));
 perform core.mutate_operator_catalog(admin_id,'catalog.save',draft,gen_random_uuid()::text);
 if not exists(select 1 from core."Media" where id=media_id and url='') then raise exception 'media identity lost';end if;
 select "updatedAt"::text into stamp from core."Product" where id=product_id;
 perform core.mutate_operator_catalog(admin_id,'catalog.publish',jsonb_build_object('id',product_id,'expectedUpdatedAt',stamp,'confirm',true,'identityVerified',true),gen_random_uuid()::text);
 payload:=jsonb_build_object('product','TEST catalog item','market','TEST destination','quantityNumber',2,'unit','FCL','containerCount',2,'incoterm','CIF','paymentPreference','L/C','catalogProductId',product_id,'variants',jsonb_build_array(jsonb_build_object('skuId',sku_id,'containers',2)),'source','PRODUCT_FEED');
 req:=core.create_buyer_requirement_v2(buyer_org,buyer_id,payload,request_key);
 replay:=core.create_buyer_requirement_v2(buyer_org,buyer_id,payload,request_key);
 if replay->>'idempotent'<>'true' or replay->>'requirementId'<>req->>'requirementId' then raise exception 'request replay failed';end if;
 if (select count(*) from core."RFQItem" where "rfqId"=req->>'rfqId' and "skuId"=sku_id and quantity=2)<>1 then raise exception 'selected packing lost';end if;
 offer:=core.issue_septlion_offer(req->>'rfqId',admin_id,jsonb_build_object('testOnly',true,'items',jsonb_build_array(jsonb_build_object('description','TEST item','quantity',2,'unit','FCL','unitPrice',1)),'terms',jsonb_build_object('incoterm','CIF','payment','LC')),'USD',(now()+interval '1 day')::timestamp);
 accepted:=core.accept_trade_offer_v3(offer->>'offerId',buyer_org,buyer_id,1,'TEST');
 if accepted->>'transactionId' is null then raise exception 'acceptance failed';end if;
 perform core.save_buyer_account_profile(buyer_org,buyer_id,jsonb_build_object('name','TEST Buyer','company','TEST Company','whatsapp','+201012345678','email',''));
 if has_table_privilege('service_role','core."Media"','DELETE') or has_table_privilege('service_role','core."RFQItem"','DELETE') then raise exception 'unnecessary delete privilege';end if;
end $$;
rollback;
select jsonb_build_object('passed',true,'rolledBack',true,'coverage','service-role ADMIN/buyer authorization, draft, image identity/removal, publication, selected SKU RFQ and replay, no delete privileges') as catalog_verification;
