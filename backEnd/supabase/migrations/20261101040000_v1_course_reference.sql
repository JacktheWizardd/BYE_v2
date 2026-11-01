-- Historical source data only; never participates in live schedule publication.
create table public.bye_course_reference (
 id text primary key,
 school_id text not null references public.bye_schools(id),
 term_id text not null,
 retrieved_on date not null,
 source_url text not null,
 source_blob_sha text not null,
 payload_sha256 text not null,
 courses jsonb not null check(jsonb_typeof(courses)='array')
);
alter table public.bye_course_reference enable row level security;
revoke all on public.bye_course_reference from public,anon,authenticated;
grant select,insert on public.bye_course_reference to service_role;
