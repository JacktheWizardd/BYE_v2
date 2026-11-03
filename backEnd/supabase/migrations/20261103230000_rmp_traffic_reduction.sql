begin;
-- Bound source traffic: current/upcoming catalog only, one job per name, monthly refresh, failure backoff.
alter table public.bye_rmp_background
 add column failures int not null default 0,
 add column last_error text,
 add column last_requests int;
create table public.bye_rmp_usage(day date primary key,jobs int not null default 0,failures int not null default 0,requests int not null default 0);
alter table public.bye_rmp_usage enable row level security;
revoke all on public.bye_rmp_usage from public,anon,authenticated;
grant all on public.bye_rmp_usage to service_role;

-- Catalog-derived only: instructors teaching in terms whose classes have not ended. Never reader activity.
create function public.bye_rmp_scope() returns table(school_id text,instructor_id uuid,name text)
language sql stable security invoker set search_path='' as $$
 select distinct on (i.name) i.school_id,i.id,i.name
 from public.bye_instructors i
 join public.bye_schools s on s.id=i.school_id and s.status='active'
 join public.bye_section_instructors si on si.school_id=i.school_id and si.instructor_id=i.id
 where i.school_id='pasadena-city-college' and si.term_id in (
  select m.term_id from public.bye_meetings m where m.school_id='pasadena-city-college'
  group by m.term_id
  having max(case when m.data->>'end_date' ~ '^\d{4}-\d{2}-\d{2}$' then (m.data->>'end_date')::date end)>=(now() at time zone 'America/Los_Angeles')::date)
 order by i.name,i.provisional,i.id
$$;
revoke all on function public.bye_rmp_scope() from public,anon,authenticated;
grant execute on function public.bye_rmp_scope() to service_role;

create or replace function public.bye_rmp_background(action text,p jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.bye_rmp_background; t uuid; n int; requests int;
begin
 -- Serialize claims across invocations; reuse the existing settings/kill switch.
 perform 1 from public.bye_rmp_settings where id and enabled for update;
 if not found then return '{}';end if;
 if action='claim' then
  if exists(select 1 from public.bye_rmp_background where lease_until>now()) then return '{}';end if;
  -- The candidates cache is keyed by name, so keep one job per name (non-provisional first).
  delete from public.bye_rmp_background b using public.bye_instructors i
   where i.school_id=b.school_id and i.id=b.instructor_id and (
    not exists(select 1 from public.bye_rmp_scope() s where s.name=i.name)
    or exists(select 1 from public.bye_rmp_background b2 join public.bye_instructors i2 on i2.school_id=b2.school_id and i2.id=b2.instructor_id
     where i2.name=i.name and (i2.provisional,i2.id)<(i.provisional,i.id)));
  insert into public.bye_rmp_background(school_id,instructor_id)
   select s.school_id,s.instructor_id from public.bye_rmp_scope() s
   where not exists(select 1 from public.bye_rmp_background b join public.bye_instructors i on i.school_id=b.school_id and i.id=b.instructor_id where i.name=s.name)
   on conflict do nothing;
  select b.* into j from public.bye_rmp_background b join public.bye_schools s on s.id=b.school_id
   where b.next_at<=now() and s.status='active' order by b.next_at,b.instructor_id limit 1 for update of b;
  if not found then return '{}';end if;
  t:=gen_random_uuid();
  update public.bye_rmp_background set token=t,lease_until=now()+interval '3 minutes',next_at=now()+interval '1 hour'
   where school_id=j.school_id and instructor_id=j.instructor_id;
  return jsonb_build_object('school_id',j.school_id,'instructor_id',j.instructor_id,'token',t);
 elsif action in ('finish','fail') then
  requests:=case when jsonb_typeof(p->'requests')='number' then greatest(0,least(1000,(p->>'requests')::numeric))::int end;
  -- Jitter successful refreshes; back off failures 1h, 4h, 16h, 64h, then weekly.
  update public.bye_rmp_background b set token=null,lease_until=null,
   failures=case when action='finish' then 0 else b.failures+1 end,
   last_error=case when action='finish' then null when p->>'error' ~ '^[a-z_]{1,40}$' then p->>'error' else 'unknown' end,
   last_requests=requests,
   next_at=now()+case when action='finish' then interval '30 days'+random()*interval '72 hours'
    else least(interval '7 days',interval '1 hour'*power(4,b.failures)) end
   where school_id=p->>'school_id' and instructor_id=(p->>'instructor_id')::uuid
   and token=(p->>'token')::uuid and lease_until>now();
  get diagnostics n=row_count;
  if n>0 then
   insert into public.bye_rmp_usage as u values((now() at time zone 'America/Los_Angeles')::date,1,(action='fail')::int,coalesce(requests,0))
    on conflict(day) do update set jobs=u.jobs+1,failures=u.failures+excluded.failures,requests=u.requests+excluded.requests;
  end if;
  return jsonb_build_object('ok',n>0);
 end if;
 raise exception 'Unknown background operation';
end;$$;
revoke all on function public.bye_rmp_background(text,jsonb) from public,anon,authenticated;
grant execute on function public.bye_rmp_background(text,jsonb) to service_role;
commit;
