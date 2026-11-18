begin;
-- AI-written review themes (docs/REVIEW_THEMES.md). Generation happens only when a reader asks for a
-- professor/course whose themes are not cached. These settings bound and can stop that spending.
alter table public.bye_rmp_settings
 add column ai_enabled boolean not null default true,
 add column ai_daily_cap integer not null default 40 check(ai_daily_cap>=0);

-- Counts only: no reader, professor or request data.
create table public.bye_ai_usage(day date primary key,requests integer not null default 0);
alter table public.bye_ai_usage enable row level security;
revoke all on public.bye_ai_usage from public,anon,authenticated;
grant all on public.bye_ai_usage to service_role;

create function public.bye_ai(action text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.bye_rmp_settings;today date:=(now() at time zone 'America/Los_Angeles')::date;
begin
select * into s from public.bye_rmp_settings where id for update;
-- The RMP kill switch also stops themes: without review reads there is nothing to summarise.
if not s.enabled or not s.ai_enabled then return '{"disabled":true}';end if;
if action<>'acquire' then raise exception 'Unknown AI operation';end if;
if coalesce((select requests from public.bye_ai_usage where day=today),0)>=s.ai_daily_cap then
 return jsonb_build_object('retry_after',ceil(extract(epoch from(((today+1)::timestamp at time zone 'America/Los_Angeles')-now()))));end if;
insert into public.bye_ai_usage as u(day,requests) values(today,1) on conflict(day) do update set requests=u.requests+1;
return '{"ok":true}';
end;$$;
revoke all on function public.bye_ai(text) from public,anon,authenticated;
grant execute on function public.bye_ai(text) to service_role;
commit;
