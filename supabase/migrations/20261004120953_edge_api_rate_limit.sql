create table if not exists core."EdgeRateLimit"("userId" text not null,action text not null,"windowStart" timestamp(3) not null,count integer not null default 0,primary key("userId",action,"windowStart")); alter table core."EdgeRateLimit" enable row level security; revoke all on core."EdgeRateLimit" from anon,authenticated;
create or replace function core.check_edge_rate_limit(p_user_id text,p_action text,p_limit integer default 60) returns boolean language plpgsql security definer set search_path=core,pg_catalog as $$
declare v_window timestamp(3):=date_trunc('minute',current_timestamp);v_count integer;
begin
 insert into core."EdgeRateLimit"("userId",action,"windowStart",count) values(p_user_id,p_action,v_window,1) on conflict("userId",action,"windowStart") do update set count=core."EdgeRateLimit".count+1 returning count into v_count;
 if random()<0.02 then delete from core."EdgeRateLimit" where "windowStart"<current_timestamp-interval '1 day'; end if;
 return v_count<=greatest(1,p_limit);
end $$;
revoke all on function core.check_edge_rate_limit(text,text,integer) from public,anon,authenticated; grant execute on function core.check_edge_rate_limit(text,text,integer) to service_role;
