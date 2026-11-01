-- Fresh-project BYE schema. Generated migration; apply with Supabase CLI.
begin;

create table public.bye_schools (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80),
  name text not null,
  aliases jsonb not null default '[]' check (jsonb_typeof(aliases) = 'array'),
  schedule_url text not null unique,
  connector text,
  status text not null check (status in ('pending', 'setup_required', 'active')),
  capabilities jsonb not null,
  search_text text generated always as (lower(name || ' ' || aliases::text || ' ' || schedule_url)) stored,
  check (status <> 'active' or connector is not null)
);

create table public.bye_terms (
  school_id text not null references public.bye_schools(id),
  id text not null,
  name text not null,
  as_of timestamptz not null,
  primary key (school_id, id)
);

create table public.bye_courses (
  school_id text not null,
  term_id text not null,
  id text not null,
  code text not null,
  title text not null,
  search_text text generated always as (lower(code || ' ' || title)) stored,
  primary key (school_id, term_id, id),
  foreign key (school_id, term_id) references public.bye_terms(school_id, id)
);

create table public.bye_sections (
  school_id text not null,
  term_id text not null,
  id text not null,
  course_id text not null,
  units numeric,
  instructors jsonb not null check (jsonb_typeof(instructors) = 'array'),
  meetings jsonb not null check (jsonb_typeof(meetings) = 'array'),
  availability jsonb not null check (jsonb_typeof(availability) = 'object'),
  primary key (school_id, term_id, id),
  foreign key (school_id, term_id, course_id) references public.bye_courses(school_id, term_id, id)
);
create index bye_sections_course on public.bye_sections(school_id, term_id, course_id, id);

-- These are API-only tables. Even a signed-in browser cannot bypass the BYE API.
alter table public.bye_schools enable row level security;
alter table public.bye_terms enable row level security;
alter table public.bye_courses enable row level security;
alter table public.bye_sections enable row level security;
revoke all on public.bye_schools, public.bye_terms, public.bye_courses, public.bye_sections from public, anon, authenticated;
grant select, insert, update, delete on public.bye_schools, public.bye_terms, public.bye_courses, public.bye_sections to service_role;

-- One transaction publishes a complete term snapshot. All keys are school-scoped;
-- a term or CRN reused by another school cannot collide or be overwritten.
create function public.bye_import_term(p_school_id text, p_term jsonb, p_courses jsonb, p_sections jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.bye_schools where id = p_school_id and connector is not null for update;
  if not found then raise exception 'School needs a connector'; end if;
  if exists (select 1 from public.bye_terms where school_id = p_school_id and id = p_term->>'id'
    and as_of > (p_term->>'as_of')::timestamptz) then
    raise exception 'An older import cannot replace a newer snapshot';
  end if;

  insert into public.bye_terms(school_id, id, name, as_of)
  values (p_school_id, p_term->>'id', p_term->>'name', (p_term->>'as_of')::timestamptz)
  on conflict (school_id, id) do update set name = excluded.name, as_of = excluded.as_of;

  insert into public.bye_courses(school_id, term_id, id, code, title)
  select p_school_id, p_term->>'id', c.id, c.code, c.title
  from jsonb_to_recordset(p_courses) as c(id text, code text, title text)
  on conflict (school_id, term_id, id) do update set code = excluded.code, title = excluded.title;

  insert into public.bye_sections(school_id, term_id, id, course_id, units, instructors, meetings, availability)
  select p_school_id, p_term->>'id', s.id, s.course_id, s.units, s.instructors, s.meetings, s.availability
  from jsonb_to_recordset(p_sections) as s(id text, course_id text, units numeric, instructors jsonb, meetings jsonb, availability jsonb)
  on conflict (school_id, term_id, id) do update set course_id = excluded.course_id, units = excluded.units,
    instructors = excluded.instructors, meetings = excluded.meetings, availability = excluded.availability;

  delete from public.bye_sections where school_id = p_school_id and term_id = p_term->>'id'
    and id not in (select s->>'id' from jsonb_array_elements(p_sections) s);
  delete from public.bye_courses where school_id = p_school_id and term_id = p_term->>'id'
    and id not in (select c->>'id' from jsonb_array_elements(p_courses) c);
  update public.bye_schools set status = 'active' where id = p_school_id;
end;
$$;
revoke all on function public.bye_import_term(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.bye_import_term(text, jsonb, jsonb, jsonb) to service_role;

insert into public.bye_schools(id, name, aliases, schedule_url, connector, status, capabilities)
values ('pasadena-city-college', 'Pasadena City College', '["PCC", "Pasadena"]',
  'https://findclasses.pasadena.edu/', 'pcc', 'setup_required',
  '{"schedules": true, "seats": true, "waitlists": true}');


create table public.bye_instructors(school_id text references public.bye_schools, id uuid default gen_random_uuid(), source_key text not null, name text not null, provisional boolean not null, primary key(school_id,id), unique(school_id,source_key));
create table public.bye_section_instructors(school_id text, term_id text, section_id text, instructor_id uuid, primary key(school_id,term_id,section_id,instructor_id), foreign key(school_id,term_id,section_id) references public.bye_sections(school_id,term_id,id), foreign key(school_id,instructor_id) references public.bye_instructors(school_id,id));
create table public.bye_meetings(school_id text,term_id text,section_id text, position int, data jsonb not null, primary key(school_id,term_id,section_id,position), foreign key(school_id,term_id,section_id) references public.bye_sections(school_id,term_id,id));
create table public.bye_availability(school_id text,term_id text,section_id text,data jsonb not null, primary key(school_id,term_id,section_id), foreign key(school_id,term_id,section_id) references public.bye_sections(school_id,term_id,id));
create table public.bye_memberships(user_id uuid primary key references auth.users(id),role text not null check(role in ('reader','owner')),expires_at timestamptz not null,revoked_at timestamptz,invite_id uuid);
create table public.bye_invites(id uuid primary key default gen_random_uuid(),code_hash text unique not null,note text,created_at timestamptz default now(),used_by uuid references auth.users(id),used_at timestamptz,revoked_at timestamptz);
create table public.bye_attempts(actor text,attempted_at timestamptz default now());
create index on public.bye_attempts(actor,attempted_at);
create table public.bye_jobs(id uuid primary key default gen_random_uuid(),school_id text references public.bye_schools,term_id text not null,kind text not null default 'catalog',status text not null default 'queued',attempts int not null default 0,created_at timestamptz default now(),due_at timestamptz default now(),finished_at timestamptz,error_code text,metrics jsonb);
create unique index bye_jobs_pending on public.bye_jobs(school_id,term_id) where status in ('queued','running');
create table public.bye_refresh(school_id text,term_id text,last_viewed timestamptz,last_success timestamptz,last_catalog timestamptz,next_due timestamptz default now(),primary key(school_id,term_id),foreign key(school_id,term_id) references public.bye_terms(school_id,id));
create table public.bye_worker(id boolean primary key default true check(id),job_id uuid,token uuid,lease_until timestamptz);
insert into public.bye_worker(id) values(true);
create table public.bye_staging(job_id uuid primary key references public.bye_jobs,token uuid not null,catalog jsonb not null);
alter table public.bye_schools drop constraint bye_schools_status_check;
alter table public.bye_schools add check(status in ('pending','setup_required','active','disabled'));
-- Normalized storage replaces the draft section JSON columns.
alter table public.bye_sections drop column instructors,drop column meetings,drop column availability;
create view public.bye_section_catalog with(security_invoker=true) as select s.*,
coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'provisional',i.provisional)) from public.bye_section_instructors si join public.bye_instructors i on i.school_id=si.school_id and i.id=si.instructor_id where si.school_id=s.school_id and si.term_id=s.term_id and si.section_id=s.id),'[]') instructors,
coalesce((select jsonb_agg(m.data order by m.position) from public.bye_meetings m where m.school_id=s.school_id and m.term_id=s.term_id and m.section_id=s.id),'[]') meetings,
(select a.data from public.bye_availability a where a.school_id=s.school_id and a.term_id=s.term_id and a.section_id=s.id) availability from public.bye_sections s;
create or replace function public.bye_import_term(p_school_id text,p_term jsonb,p_courses jsonb,p_sections jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare s jsonb;i jsonb; iid uuid; sk text;
begin
 perform 1 from public.bye_schools where id=p_school_id and connector is not null and status<>'disabled' for update;
 if not found or jsonb_array_length(p_sections)=0 then raise exception 'Invalid import';end if;
 if exists(select 1 from public.bye_terms where school_id=p_school_id and id=p_term->>'id' and as_of>(p_term->>'as_of')::timestamptz) then raise exception 'Older snapshot';end if;
 insert into public.bye_terms values(p_school_id,p_term->>'id',p_term->>'name',(p_term->>'as_of')::timestamptz) on conflict(school_id,id) do update set name=excluded.name,as_of=excluded.as_of;
 insert into public.bye_courses(school_id,term_id,id,code,title) select p_school_id,p_term->>'id',c.id,c.code,c.title from jsonb_to_recordset(p_courses)c(id text,code text,title text) on conflict(school_id,term_id,id) do update set code=excluded.code,title=excluded.title;
 for s in select value from jsonb_array_elements(p_sections) loop
 insert into public.bye_sections values(p_school_id,p_term->>'id',s->>'id',s->>'course_id',(s->>'units')::numeric) on conflict(school_id,term_id,id) do update set course_id=excluded.course_id,units=excluded.units;
 delete from public.bye_section_instructors where school_id=p_school_id and term_id=p_term->>'id' and section_id=s->>'id';
 for i in select value from jsonb_array_elements(s->'instructors') loop
 sk:=coalesce(nullif(lower(i->>'email'),''),'provisional:'||(p_term->>'id')||':'||(s->>'id')||':'||lower(i->>'name'));
 insert into public.bye_instructors(school_id,source_key,name,provisional) values(p_school_id,sk,i->>'name',nullif(i->>'email','') is null) on conflict(school_id,source_key) do update set name=excluded.name returning id into iid;
 insert into public.bye_section_instructors values(p_school_id,p_term->>'id',s->>'id',iid) on conflict do nothing;
 end loop;
 delete from public.bye_meetings where school_id=p_school_id and term_id=p_term->>'id' and section_id=s->>'id';
 insert into public.bye_meetings select p_school_id,p_term->>'id',s->>'id',ordinality::int,value from jsonb_array_elements(s->'meetings') with ordinality;
 insert into public.bye_availability values(p_school_id,p_term->>'id',s->>'id',s->'availability') on conflict(school_id,term_id,section_id) do update set data=excluded.data;
 end loop;
 -- Absence is not proof of cancellation: retain previously published sections.
 update public.bye_schools set status='active' where id=p_school_id;
end;$$;
create function public.bye_control(action text,p jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.bye_jobs; w public.bye_worker; inv public.bye_invites; r jsonb; t uuid; a text; c jsonb;
begin
 if action='membership' then return (select to_jsonb(m) from public.bye_memberships m where user_id=(p->>'user_id')::uuid and revoked_at is null and expires_at>now());
 elsif action='redeem' then
 -- Serialize by user and IP so concurrent requests cannot bypass the failure limit.
 perform pg_advisory_xact_lock(hashtextextended(p->>'actor',0));
 perform pg_advisory_xact_lock(hashtextextended(p->>'user_id',1));
 if exists(select 1 from public.bye_attempts where actor in(p->>'actor',p->>'user_id') and attempted_at>now()-interval '1 minute' group by actor having count(*)>=3) then return '{"error":"rate_limited"}';end if;
 select * into inv from public.bye_invites where code_hash=p->>'hash' for update;
 if not found or inv.used_at is not null or inv.revoked_at is not null then
 insert into public.bye_attempts(actor) values(p->>'actor'),(p->>'user_id'); return '{"error":"invalid_invite"}';end if;
 if exists(select 1 from public.bye_memberships where user_id=(p->>'user_id')::uuid and role='owner') then return '{"error":"already_owner"}';end if;
 update public.bye_invites set used_at=now(),used_by=(p->>'user_id')::uuid where id=inv.id;
 insert into public.bye_memberships values((p->>'user_id')::uuid,'reader',now()+interval '30 days',null,inv.id) on conflict(user_id) do update set expires_at=excluded.expires_at,revoked_at=null,invite_id=excluded.invite_id;
 return '{"ok":true}';
 elsif action='revoke_invite' then
 update public.bye_invites set revoked_at=now() where id=(p->>'id')::uuid;
 update public.bye_memberships set revoked_at=now() where invite_id=(p->>'id')::uuid;return '{"ok":true}';
 elsif action='enqueue' then
 perform 1 from public.bye_schools where id=p->>'school_id' and status<>'disabled' and connector is not null for update;
 if not found then raise exception 'School unavailable';end if;
 select * into j from public.bye_jobs where school_id=p->>'school_id' and term_id=p->>'term_id' and status in('queued','running');
 if not found then insert into public.bye_jobs(school_id,term_id,kind) values(p->>'school_id',p->>'term_id',coalesce(p->>'kind','catalog')) returning * into j;end if;
 return to_jsonb(j);
 elsif action='touch' then
 insert into public.bye_refresh(school_id,term_id,last_viewed) values(p->>'school_id',p->>'term_id',now()) on conflict(school_id,term_id) do update set last_viewed=excluded.last_viewed;
 return (select to_jsonb(f) from public.bye_refresh f where school_id=p->>'school_id' and term_id=p->>'term_id');
 elsif action='schedule' then
 for r in select jsonb_build_object('school_id',f.school_id,'term_id',f.term_id,'kind',case when f.last_catalog is null or f.last_catalog<now()-interval '1 day' then 'catalog' else 'availability' end) from public.bye_refresh f join public.bye_schools s on s.id=f.school_id where s.status='active' and f.next_due<=now() and (f.last_viewed>now()-interval '10 minutes' or f.last_catalog<now()-interval '1 day') loop perform public.bye_control('enqueue',r);end loop;
 delete from public.bye_attempts where attempted_at<now()-interval '1 day';return '{"ok":true}';
 elsif action='claim' then
 select * into w from public.bye_worker where id for update;
 if w.lease_until>now() then return null;end if;
 delete from public.bye_staging where job_id=w.job_id;
 update public.bye_refresh f set next_due=now()+interval '30 minutes' from public.bye_jobs old where old.id=w.job_id and old.attempts>=3 and f.school_id=old.school_id and f.term_id=old.term_id;
 update public.bye_jobs set status=case when attempts>=3 then 'failed' else 'queued' end,error_code='lease_expired' where id=w.job_id and status='running';
 select * into j from public.bye_jobs where status='queued' and due_at<=now() order by created_at limit 1 for update skip locked;
 if not found then return null;end if;
 t:=gen_random_uuid();update public.bye_worker set job_id=j.id,token=t,lease_until=now()+interval '120 seconds' where id;
 update public.bye_jobs set status='running',attempts=attempts+1 where id=j.id returning * into j;
 return to_jsonb(j)||jsonb_build_object('lease_token',t);
 elsif action in('stage','finish','fail') then
 select * into w from public.bye_worker where id for update;
 if w.token is distinct from (p->>'token')::uuid or w.job_id is distinct from (p->>'id')::uuid or w.lease_until<=now() then raise exception 'Lease expired';end if;
 select * into j from public.bye_jobs where id=w.job_id;
 if action='stage' then
 insert into public.bye_staging values(j.id,w.token,p->'catalog') on conflict(job_id) do update set token=excluded.token,catalog=excluded.catalog;return '{"ok":true}';
 elsif action='finish' then
 if exists(select 1 from public.bye_schools where id=j.school_id and status='disabled') then raise exception 'School disabled';end if;
 select catalog into c from public.bye_staging where job_id=j.id and token=w.token;
 if c is null then raise exception 'Missing staged data';end if;
 if j.kind='preview' then null;
 elsif j.kind='availability' then
 -- Fast refresh updates known sections only; catalog publication is separate.
 insert into public.bye_availability select j.school_id,j.term_id,s->>'id',s->'availability' from jsonb_array_elements(c->'sections') s join public.bye_sections b on b.school_id=j.school_id and b.term_id=j.term_id and b.id=s->>'id' on conflict(school_id,term_id,section_id) do update set data=excluded.data;
 else perform public.bye_import_term(j.school_id,c->'term',c->'courses',c->'sections');end if;
 update public.bye_jobs set status='succeeded',finished_at=now(),metrics=p->'metrics',error_code=null where id=j.id;
 if j.kind<>'preview' then
 insert into public.bye_refresh(school_id,term_id,last_success,last_catalog,next_due) values(j.school_id,j.term_id,now(),case when j.kind='catalog' then now() end,now()+interval '5 minutes') on conflict(school_id,term_id) do update set last_success=excluded.last_success,last_catalog=coalesce(excluded.last_catalog,public.bye_refresh.last_catalog),next_due=excluded.next_due;end if;
 else
 update public.bye_jobs set status=case when attempts>=3 then 'failed' else 'queued' end,due_at=now()+make_interval(secs=>greatest(coalesce((p->>'retry_seconds')::int,0),300*power(2,attempts-1)::int)),error_code=p->>'error',finished_at=case when attempts>=3 then now() end where id=j.id;
 update public.bye_refresh set next_due=now()+interval '30 minutes' where school_id=j.school_id and term_id=j.term_id;
 end if;
 delete from public.bye_staging where job_id=j.id;
 update public.bye_worker set lease_until=null,job_id=null,token=null where id;return '{"ok":true}';
 end if;raise exception 'Unknown control action';
end;$$;
-- No public or authenticated access to control RPCs, tables or derived views.
do $$ declare n text;begin
 foreach n in array array['bye_instructors','bye_section_instructors','bye_meetings','bye_availability','bye_memberships','bye_invites','bye_attempts','bye_jobs','bye_refresh','bye_worker','bye_staging'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from public,anon,authenticated',n);
 execute format('grant all on public.%I to service_role',n);
 end loop;
end $$;
revoke all on public.bye_section_catalog from public,anon,authenticated;
grant select on public.bye_section_catalog to service_role;
revoke all on function public.bye_control(text,jsonb) from public,anon,authenticated;
grant execute on function public.bye_control(text,jsonb) to service_role;
commit;
