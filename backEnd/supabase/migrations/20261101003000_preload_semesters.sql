create function public.bye_preload_semesters() returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record;n int:=0;
begin
for r in select d.school_id,t->>'id' term_id from public.bye_term_directory d join public.bye_schools s on s.id=d.school_id cross join lateral jsonb_array_elements(d.terms)t
 where s.status='active' and s.connector='pcc' and t->>'id' ~ '^[0-9]{6}$' and not exists(select 1 from public.bye_terms b where b.school_id=d.school_id and b.id=t->>'id') order by t->>'id' desc
loop perform public.bye_control('enqueue',jsonb_build_object('school_id',r.school_id,'term_id',r.term_id,'kind','catalog'));n:=n+1;end loop;
return jsonb_build_object('pending_terms',n);
end $$;
revoke all on function public.bye_preload_semesters() from public,anon,authenticated;
grant execute on function public.bye_preload_semesters() to service_role;
alter function public.bye_semesters(text,jsonb) rename to bye_semesters_core;
create function public.bye_semesters(action text,p jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;j public.bye_jobs;w public.bye_worker;ahead int;earliest timestamptz;
begin
if action='preload' then return public.bye_preload_semesters();end if;
result:=public.bye_semesters_core(action,p);
if action='directory_finish' then perform public.bye_preload_semesters();return result;end if;
if action='list' then
 return (select coalesce(jsonb_agg(t||jsonb_build_object('import_state',case when (t->>'imported')::boolean then 'ready' else coalesce((select status from public.bye_jobs where school_id=p->>'school_id' and term_id=t->>'id' order by created_at desc,id desc limit 1),'not_loaded') end) order by t->>'id' desc),'[]') from jsonb_array_elements(result)t);
end if;
if action in ('status','load') and not result ? 'error' then
 select * into j from public.bye_jobs where id=(result->>'job_id')::uuid;
 select * into w from public.bye_worker where id;
 earliest:=greatest(w.next_fetch_at,j.due_at,now());
 select count(*) into ahead from public.bye_jobs q where q.status='queued' and q.due_at<=earliest and (q.created_at,q.id)<(j.created_at,j.id);
 return result||jsonb_build_object('server_observed_at',now(),'eligible_jobs_ahead',case when j.status='queued' then ahead else 0 end,'global_next_fetch_at',w.next_fetch_at,'retry_not_before',case when j.attempts>0 and j.status='queued' then j.due_at end,'attempts',coalesce(j.attempts,0),'import_state',case when (result->>'imported')::boolean then 'ready' else coalesce(j.status,'not_loaded') end);
end if;
return result;
end $$;
revoke all on function public.bye_semesters(text,jsonb) from public,anon,authenticated;
grant execute on function public.bye_semesters(text,jsonb) to service_role;
