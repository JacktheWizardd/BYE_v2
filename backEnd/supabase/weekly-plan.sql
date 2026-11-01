begin;
create table public.bye_weekly_plans(user_id uuid primary key references auth.users(id) on delete cascade,revision integer not null default 1,plans jsonb not null,updated_at timestamptz not null default now(),check(jsonb_typeof(plans)='array' and octet_length(plans::text)<=1048576));
alter table public.bye_weekly_plans enable row level security;
revoke all on public.bye_weekly_plans from public,anon,authenticated;
grant select,insert,update on public.bye_weekly_plans to service_role;
create function public.bye_weekly_plan(p_user_id uuid,p_revision integer default null,p_plans jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.bye_memberships; r public.bye_weekly_plans;
begin
select * into m from public.bye_memberships where user_id=p_user_id for update;
if not found or m.revoked_at is not null or m.expires_at<=clock_timestamp() then return '{"error":"access_required"}';end if;
select * into r from public.bye_weekly_plans where user_id=p_user_id for update;
if p_plans is not null then
 if p_revision is null or p_revision<>coalesce(r.revision,0) then return '{"error":"revision_conflict"}';end if;
 insert into public.bye_weekly_plans(user_id,plans) values(p_user_id,p_plans) on conflict(user_id) do update set plans=excluded.plans,revision=public.bye_weekly_plans.revision+1,updated_at=now() returning * into r;
end if;
return jsonb_build_object('data',jsonb_build_object('version',1,'revision',coalesce(r.revision,0),'plans',coalesce(r.plans,'[]'::jsonb),'updated_at',r.updated_at));
end;$$;
revoke all on function public.bye_weekly_plan(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.bye_weekly_plan(uuid,integer,jsonb) to service_role;
commit;
