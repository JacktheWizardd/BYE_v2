alter table public.bye_jobs add column queue_sequence bigint generated always as identity;
do $$declare d text;begin
 d:=pg_get_functiondef('public.bye_control_core(text,jsonb)'::regprocedure);
 d:=replace(d,'order by created_at limit 1 for update skip locked','order by created_at,queue_sequence limit 1 for update skip locked');execute d;
 d:=pg_get_functiondef('public.bye_semesters(text,jsonb)'::regprocedure);
 d:=replace(d,'(q.created_at,q.id)<(j.created_at,j.id)','(q.created_at,q.queue_sequence)<(j.created_at,j.queue_sequence)');execute d;
end $$;
