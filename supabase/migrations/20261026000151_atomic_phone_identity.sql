-- Auth is verified by trade-api before this server-only RPC. Serialize first
-- contact so concurrent requests cannot create two buyer organizations.
create or replace function core.provision_trade_identity(p_user_id text,p_email text default null)
returns jsonb language plpgsql security invoker set search_path=core,pg_catalog as $$
declare v_user core."User"%rowtype;v_member core."Membership"%rowtype;v_org text;v_created boolean:=false;v_now timestamp:=current_timestamp;
begin
 if p_user_id is null or length(p_user_id) not between 1 and 100 or length(coalesce(p_email,''))>254 then raise exception 'invalid_identity';end if;
 perform pg_advisory_xact_lock(hashtextextended('identity:'||p_user_id,0));
 select * into v_user from core."User" where id=p_user_id;
 if not found then
  insert into core."User"(id,email,"passwordHash","isActive","sessionVersion","createdAt","updatedAt")
   values(p_user_id,coalesce(nullif(p_email,''),p_user_id||'@user.invalid'),'SUPABASE_AUTH',true,1,v_now,v_now) returning * into v_user;
  v_created:=true;
 end if;
 if not v_user."isActive" then raise exception 'access_denied';end if;
 select * into v_member from core."Membership" where "userId"=p_user_id order by "createdAt",id limit 1;
 if not found then
  v_org:=gen_random_uuid()::text;
  insert into core."Organization"(id,name,"organizationType",status,"createdAt","updatedAt") values(v_org,'Buyer','BUYER','ACTIVE',v_now,v_now);
  insert into core."Membership"(id,"userId","organizationId",role,"createdAt") values(gen_random_uuid()::text,p_user_id,v_org,'BUYER',v_now) returning * into v_member;
  v_created:=true;
 end if;
 if v_created then
  insert into core."AuditLog"(id,"organizationId","userId",action,"entityType","entityId",metadata,"createdAt") values(gen_random_uuid()::text,v_member."organizationId",p_user_id,'CREATE','BuyerIdentity',p_user_id,jsonb_build_object('source','VERIFIED_AUTH_IDENTITY','role',v_member.role),v_now);
 end if;
 return jsonb_build_object('user',jsonb_build_object('id',v_user.id,'email',v_user.email,'firstName',v_user."firstName",'lastName',v_user."lastName",'isActive',v_user."isActive"),'membership',jsonb_build_object('id',v_member.id,'organizationId',v_member."organizationId",'role',v_member.role));
end $$;
revoke all on function core.provision_trade_identity(text,text) from public,anon,authenticated;
grant execute on function core.provision_trade_identity(text,text) to service_role;
notify pgrst,'reload schema';
