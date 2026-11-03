begin;
-- Catalog-derived work only. Never enqueue from an API read or user refresh.
create table public.bye_rmp_background (
 school_id text not null,
 instructor_id uuid not null,
 next_at timestamptz not null default now(),
 token uuid,
 lease_until timestamptz,
 primary key(school_id,instructor_id),
 foreign key(school_id,instructor_id) references public.bye_instructors(school_id,id) on delete cascade
);
alter table public.bye_rmp_background enable row level security;
revoke all on public.bye_rmp_background from public,anon,authenticated;
grant all on public.bye_rmp_background to service_role;

create function public.bye_rmp_background(action text,p jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.bye_rmp_background; t uuid;
begin
 -- Serialize claims across invocations; reuse the existing settings/kill switch.
 perform 1 from public.bye_rmp_settings where id and enabled for update;
 if not found then return '{}';end if;
 if action='claim' then
  if exists(select 1 from public.bye_rmp_background where lease_until>now()) then return '{}';end if;
  insert into public.bye_rmp_background(school_id,instructor_id)
   select i.school_id,i.id from public.bye_instructors i join public.bye_schools s on s.id=i.school_id
   where i.school_id='pasadena-city-college' and s.status='active'
   on conflict do nothing;
  select b.* into j from public.bye_rmp_background b join public.bye_schools s on s.id=b.school_id
   where b.next_at<=now() and s.status='active' order by b.next_at,b.instructor_id limit 1 for update of b;
  if not found then return '{}';end if;
  t:=gen_random_uuid();
  update public.bye_rmp_background set token=t,lease_until=now()+interval '3 minutes',next_at=now()+interval '1 hour'
   where school_id=j.school_id and instructor_id=j.instructor_id;
  return jsonb_build_object('school_id',j.school_id,'instructor_id',j.instructor_id,'token',t);
 elsif action in ('finish','fail') then
  update public.bye_rmp_background set token=null,lease_until=null,
   next_at=now()+case when action='finish' then interval '7 days' else interval '1 hour' end
   where school_id=p->>'school_id' and instructor_id=(p->>'instructor_id')::uuid
   and token=(p->>'token')::uuid and lease_until>now();
  return jsonb_build_object('ok',found);
 end if;
 raise exception 'Unknown background operation';
end;$$;
revoke all on function public.bye_rmp_background(text,jsonb) from public,anon,authenticated;
grant execute on function public.bye_rmp_background(text,jsonb) to service_role;
commit;
