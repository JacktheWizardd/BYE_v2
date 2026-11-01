begin;
alter table public.bye_worker add column next_fetch_at timestamptz;
create function public.bye_code_alias(value text) returns text language sql immutable strict set search_path='' as $$
select regexp_replace(regexp_replace(lower(value),'[^a-z0-9]','','g'),'([a-z])0+([0-9])','\1\2','g');
$$;
create function public.bye_search_courses(p_school text,p_term text,p_query text,p_offset int,p_limit int)
returns table(id text,code text,title text) language sql stable security invoker set search_path='' as $$
select c.id,c.code,c.title from public.bye_courses c where c.school_id=p_school and c.term_id=p_term
and (strpos(lower(c.code||' '||c.title),lower(p_query))>0 or strpos(public.bye_code_alias(c.code),public.bye_code_alias(p_query))>0)
order by case when lower(c.code)=lower(trim(p_query)) then 0 when public.bye_code_alias(c.code)=public.bye_code_alias(p_query) then 1 else 2 end,c.id
limit least(greatest(p_limit,0),101) offset greatest(p_offset,0);
$$;
revoke all on function public.bye_search_courses(text,text,text,int,int) from public,anon,authenticated;
grant execute on function public.bye_search_courses(text,text,text,int,int) to service_role;
create or replace function public.bye_control(action text,p jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
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
 if w.lease_until>now() or w.next_fetch_at>now() then return null;end if;
 delete from public.bye_staging where job_id=w.job_id;
 update public.bye_refresh f set next_due=now()+interval '30 minutes' from public.bye_jobs old where old.id=w.job_id and old.attempts>=3 and f.school_id=old.school_id and f.term_id=old.term_id;
 update public.bye_jobs set status=case when attempts>=3 then 'failed' else 'queued' end,error_code='lease_expired' where id=w.job_id and status='running';
 select * into j from public.bye_jobs where status='queued' and due_at<=now() order by created_at limit 1 for update skip locked;
 if not found then return null;end if;
 t:=gen_random_uuid();update public.bye_worker set job_id=j.id,token=t,lease_until=now()+interval '120 seconds',next_fetch_at=now()+interval '5 minutes' where id;
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
 update public.bye_worker set next_fetch_at=greatest(next_fetch_at,now()+make_interval(secs=>greatest(coalesce((p->>'retry_seconds')::int,0),300*power(2,j.attempts-1)::int))) where id;
 update public.bye_jobs set status=case when attempts>=3 then 'failed' else 'queued' end,due_at=now()+make_interval(secs=>greatest(coalesce((p->>'retry_seconds')::int,0),300*power(2,attempts-1)::int)),error_code=p->>'error',finished_at=case when attempts>=3 then now() end where id=j.id;
 update public.bye_refresh set next_due=now()+interval '30 minutes' where school_id=j.school_id and term_id=j.term_id;
 end if;
 delete from public.bye_staging where job_id=j.id;
 update public.bye_worker set lease_until=null,job_id=null,token=null where id;return '{"ok":true}';
 end if;raise exception 'Unknown control action';
end;$$;
commit;
