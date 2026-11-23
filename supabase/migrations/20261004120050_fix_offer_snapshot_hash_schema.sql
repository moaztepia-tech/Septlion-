create or replace function core.issue_septlion_offer(p_rfq_id text,p_user_id text,p_snapshot jsonb,p_currency text default 'USD',p_valid_until timestamp default null)
returns jsonb language plpgsql security definer set search_path=core,pg_catalog,public,extensions as $$
declare v_now timestamp(3):=current_timestamp; v_rfq core."RFQ"%rowtype; v_offer text; v_rev text; v_hash text;
begin
 select * into v_rfq from core."RFQ" where id=p_rfq_id for update; if not found then raise exception 'rfq_not_found'; end if;
 select id into v_offer from core."SeptlionOffer" where "rfqId"=p_rfq_id; if v_offer is not null then raise exception 'offer_already_exists'; end if;
 v_offer:=gen_random_uuid()::text; v_rev:=gen_random_uuid()::text; v_hash:=encode(extensions.digest(convert_to(coalesce(p_snapshot,'{}'::jsonb)::text,'UTF8'),'sha256'::text),'hex');
 insert into core."SeptlionOffer"(id,"requirementId","rfqId","buyerOrgId","operatorOrgId",status,"currentRevision",currency,"validUntil","createdAt","updatedAt") values(v_offer,v_rfq."requirementId",p_rfq_id,v_rfq."buyerOrgId",'septlion-operator','ISSUED',1,coalesce(nullif(p_currency,''),'USD'),p_valid_until,v_now,v_now);
 insert into core."SeptlionOfferRevision"(id,"offerId","revisionNo",status,snapshot,"snapshotHash","issuedById","issuedAt","createdAt") values(v_rev,v_offer,1,'ISSUED',coalesce(p_snapshot,'{}'::jsonb),v_hash,p_user_id,v_now,v_now);
 update core."RFQ" set status='QUOTED',"updatedAt"=v_now where id=p_rfq_id;
 insert into core."Notification"(id,"organizationId",type,title,body,"entityType","entityId","createdAt") values(gen_random_uuid()::text,v_rfq."buyerOrgId",'QUOTE','العرض جاهز','تم إصدار عرض SEPTLION لطلبك.','QUOTE',v_offer,v_now);
 return jsonb_build_object('offerId',v_offer,'revisionId',v_rev,'snapshotHash',v_hash);
end $$;
revoke all on function core.issue_septlion_offer(text,text,jsonb,text,timestamp) from public,anon,authenticated; grant execute on function core.issue_septlion_offer(text,text,jsonb,text,timestamp) to service_role;
