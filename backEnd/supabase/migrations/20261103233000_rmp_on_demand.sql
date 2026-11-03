begin;
-- RMP is fetched only when a reader opens an uncached professor. Remove the catalog crawler.
select cron.unschedule(jobid) from cron.job where jobname='bye-rmp-background';
drop function if exists public.bye_rmp_background(text,jsonb);
drop function if exists public.bye_rmp_scope();
drop table if exists public.bye_rmp_background;

-- Hard ceiling on upstream HTTP attempts per Pacific day; bye_rmp_usage keeps the counts (no reader data).
alter table public.bye_rmp_settings add column daily_request_cap integer not null default 200 check(daily_request_cap>=0);

create or replace function public.bye_rmp(action text,p jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.bye_rmp_settings;c public.bye_rmp_cache;t uuid;delay numeric;bytes bigint;today date:=(now() at time zone 'America/Los_Angeles')::date;
begin
select * into s from public.bye_rmp_settings where id for update;
if not s.enabled then return '{"disabled":true}';end if;
if action='cache' then
 select * into c from public.bye_rmp_cache where key=p->>'key' for update;
 -- Entries stay fresh for six months; an older entry is refetched on view and kept if the source fails.
 if not coalesce((p->>'force')::boolean,false) and c.checked_at>now()-interval '6 months' and c.data is not null then update public.bye_rmp_cache set last_used=now() where key=c.key;return jsonb_build_object('data',c.data,'checked_at',c.checked_at);end if;
 if c.lease_until>now() then return jsonb_build_object('busy',true,'data',c.data,'checked_at',c.checked_at);end if;
 t:=gen_random_uuid();insert into public.bye_rmp_cache(key,token,lease_until) values(p->>'key',t,now()+interval '30 seconds') on conflict(key) do update set token=t,lease_until=now()+interval '30 seconds';
 return jsonb_build_object('token',t,'data',c.data,'checked_at',c.checked_at);
elsif action='publish' then
 if octet_length((p->'data')::text)>4194304 then raise exception 'Cache entry too large';end if;
 update public.bye_rmp_cache set data=p->'data',checked_at=now(),last_used=now(),token=null,lease_until=null where key=p->>'key' and token=(p->>'token')::uuid and lease_until>now();
 if not found then raise exception 'Lease expired';end if;
 delete from public.bye_rmp_cache where key like '%"reviews"%' and (checked_at is null or checked_at<now()-interval '1 year') and coalesce(lease_until,now())<=now();
 select coalesce(sum(octet_length(data::text)),0) into bytes from public.bye_rmp_cache where key like '%"reviews"%';
 while bytes>52428800 or (select count(*) from public.bye_rmp_cache where key like '%"reviews"%')>5000 loop
 delete from public.bye_rmp_cache where key=(select key from public.bye_rmp_cache where key like '%"reviews"%' and coalesce(lease_until,now())<=now() order by last_used limit 1);
 if not found then exit;end if;
 select coalesce(sum(octet_length(data::text)),0) into bytes from public.bye_rmp_cache where key like '%"reviews"%';end loop;
 return '{"ok":true}';
elsif action='abandon' then update public.bye_rmp_cache set token=null,lease_until=null where key=p->>'key' and token=(p->>'token')::uuid;return '{}';
elsif action='manual_refresh' then
 select next_at into c.lease_until from public.bye_rmp_manual where key=(p->>'school')||':'||(p->>'instructor') for update;
 if c.lease_until>now() then return jsonb_build_object('retry_after',ceil(extract(epoch from(c.lease_until-now()))));end if;
 insert into public.bye_rmp_manual values((p->>'school')||':'||(p->>'instructor'),now()+make_interval(secs=>s.manual_refresh_seconds)) on conflict(key) do update set next_at=excluded.next_at;
 return '{}';
elsif action='acquire' then
 delete from public.bye_rmp_slots where expires_at<=now();
 if coalesce((select requests from public.bye_rmp_usage where day=today),0)>=s.daily_request_cap then
  return jsonb_build_object('retry_after',ceil(extract(epoch from(((today+1)::timestamp at time zone 'America/Los_Angeles')-now()))));end if;
 delay:=greatest(0,extract(epoch from(s.cooldown-now())),extract(epoch from(s.next_start-now())));
 if s.window_start>now()-interval '1 minute' and s.attempts>=60 then delay:=greatest(delay,extract(epoch from(s.window_start+interval '1 minute'-now())));end if;
 if (select count(*) from public.bye_rmp_slots)>=2 then delay:=greatest(delay,0.2);end if;
 if delay>0 then return jsonb_build_object('retry_after',delay);end if;
 t:=gen_random_uuid();insert into public.bye_rmp_slots values(t,now()+interval '16 seconds');
 update public.bye_rmp_settings set next_start=now()+interval '100 milliseconds',attempts=case when window_start>now()-interval '1 minute' then attempts+1 else 1 end,window_start=case when window_start>now()-interval '1 minute' then window_start else now() end where id;
 insert into public.bye_rmp_usage as u(day,requests) values(today,1) on conflict(day) do update set requests=u.requests+1;
 return jsonb_build_object('token',t);
elsif action='release' then
 update public.bye_rmp_settings set cooldown=greatest(cooldown,now()+make_interval(secs=>least(86400,greatest(0,coalesce((p->>'delay')::double precision,0))))) where id;
 delete from public.bye_rmp_slots where token=(p->>'token')::uuid;return '{}';
end if;raise exception 'Unknown RMP operation';end;$$;
revoke all on function public.bye_rmp(text,jsonb) from public,anon,authenticated;
grant execute on function public.bye_rmp(text,jsonb) to service_role;
select cron.schedule('bye-rmp-cleanup','17 * * * *',$job$delete from public.bye_rmp_cache where key like '%"reviews"%' and (checked_at is null or checked_at<now()-interval '1 year') and coalesce(lease_until,now())<=now();delete from public.bye_rmp_slots where expires_at<=now();$job$);
commit;
