begin;
create table public.bye_education_plans (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision integer not null check(revision > 0),
 plan jsonb not null check(jsonb_typeof(plan)='object' and octet_length(plan::text)<=1048576),
 updated_at timestamptz not null default now()
);
alter table public.bye_education_plans enable row level security;
revoke all on public.bye_education_plans from public,anon,authenticated;
grant select,insert,update on public.bye_education_plans to service_role;
create function public.bye_education_plan(p_user_id uuid,p_action text,p_revision integer default null,p_plan jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_plan public.bye_education_plans; membership public.bye_memberships;
begin
 -- Lock the verified user's membership for both first-create and replacement.
 select * into membership from public.bye_memberships where user_id=p_user_id for update;
 if not found or membership.revoked_at is not null or membership.expires_at<=clock_timestamp() then return '{"error":"access_required"}';end if;
 select * into current_plan from public.bye_education_plans where user_id=p_user_id for update;
 if p_action='save' then
  if p_revision is null or p_revision<0 or p_revision<>coalesce(current_plan.revision,0) then return '{"error":"revision_conflict"}';end if;
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or octet_length(p_plan::text)>1048576 then return '{"error":"invalid_education_plan"}';end if;
  insert into public.bye_education_plans(user_id,revision,plan) values(p_user_id,1,p_plan)
  on conflict(user_id) do update set revision=public.bye_education_plans.revision+1,plan=excluded.plan,updated_at=now()
  returning * into current_plan;
 elsif p_action<>'read' then return '{"error":"invalid_request"}';end if;
 if current_plan.user_id is null then return jsonb_build_object('data',null);end if;
 return jsonb_build_object('data',jsonb_build_object('revision',current_plan.revision,'updated_at',current_plan.updated_at,'plan',current_plan.plan));
end;$$;
revoke all on function public.bye_education_plan(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.bye_education_plan(uuid,text,integer,jsonb) to service_role;
commit;
