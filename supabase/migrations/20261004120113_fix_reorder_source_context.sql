create or replace function core.reorder_trade_transaction(p_transaction_id text,p_buyer_org_id text,p_user_id text,p_quantity numeric default null)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog,public as $$
declare v_now timestamp(3):=current_timestamp; v_old_req core."QualifiedRequirement"%rowtype; v_old_rfq core."RFQ"%rowtype; v_new_req text:=gen_random_uuid()::text; v_new_rfq text:=gen_random_uuid()::text; v_ref text;
begin
 if not exists(select 1 from core."TradeTransaction" where id=p_transaction_id and "buyerOrgId"=p_buyer_org_id and status='COMPLETED') then raise exception 'reorder_not_available'; end if;
 select qr.* into v_old_req from core."QualifiedRequirement" qr join core."SeptlionOffer" o on o."requirementId"=qr.id join core."CommercialLock" l on l."offerId"=o.id join core."TradeTransaction" t on t."commercialLockId"=l.id where t.id=p_transaction_id;
 select r.* into v_old_rfq from core."RFQ" r where r."requirementId"=v_old_req.id;
 insert into core."QualifiedRequirement" select v_new_req,"buyerProfileId","buyerContactId",null,p_buyer_org_id,'REORDER',jsonb_build_object('reorderOf',p_transaction_id),'QUALIFIED',product,market,coalesce(p_quantity,quantity),unit,"containerCount","septlionScale","deliveryCountry","deliveryPort","destinationCode",incoterm,"paymentPreference","targetPrice",currency,"requiredDate","knownFacts","inferredFacts","fieldStates","criticalMissing","productConfiguration",specifications,packing,compliance,confidence,v_now,v_now from core."QualifiedRequirement" where id=v_old_req.id;
 v_ref:='RFQ-'||to_char(v_now,'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(v_new_rfq,'-',''),1,6));
 insert into core."RFQ"(id,"requirementId","buyerOrgId","supplierOrgId","sectorId",reference,status,"deliveryCountry","deliveryPort",incoterm,"requestedDocuments","requestedDate",notes,"createdAt","updatedAt") values(v_new_rfq,v_new_req,p_buyer_org_id,v_old_rfq."supplierOrgId",v_old_rfq."sectorId",v_ref,'OPEN',v_old_rfq."deliveryCountry",v_old_rfq."deliveryPort",v_old_rfq.incoterm,v_old_rfq."requestedDocuments",v_old_rfq."requestedDate",'Reorder of '||p_transaction_id,v_now,v_now);
 insert into core."RFQItem"(id,"rfqId","skuId",quantity,unit,"targetPrice","createdAt") select gen_random_uuid()::text,v_new_rfq,"skuId",coalesce(p_quantity,quantity),unit,"targetPrice",v_now from core."RFQItem" where "rfqId"=v_old_rfq.id;
 insert into core."Notification"(id,"organizationId","userId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,p_buyer_org_id,p_user_id,'RFQ','تم إنشاء إعادة الطلب','أعدنا فتح RFQ جديدًا من ذاكرة الصفقة السابقة.','RFQ',v_new_rfq,v_now);
 return jsonb_build_object('id',v_new_req,'rfqId',v_new_rfq,'reference',v_ref);
end $$;
revoke all on function core.reorder_trade_transaction(text,text,text,numeric) from public,anon,authenticated; grant execute on function core.reorder_trade_transaction(text,text,text,numeric) to service_role;
