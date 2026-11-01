import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('semester directory isolation, deduplication, publication deadline and browser denial',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
 for(const name of ['20261030225302_production_backend.sql','20261031033859_schedule_discovery.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec("alter function bye_control(text,jsonb) rename to bye_control_core;create function bye_control(action text,p jsonb default '{}') returns jsonb language sql as 'select public.bye_control_core(action,p)'; update bye_schools set status='active';");
 for(const name of ['20261031235500_semester_discovery.sql','20261031235600_semester_status_alias.sql','20261101003000_preload_semesters.sql','20261101003100_preload_fifo.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const semesters=async(action,p={})=>(await db.query('select bye_semesters($1,$2::jsonb) d',[action,JSON.stringify(p)])).rows[0].d;
 const control=async(action,p={})=>(await db.query('select bye_control($1,$2::jsonb) d',[action,JSON.stringify(p)])).rows[0].d;
 const school_id='pasadena-city-college';
 await semesters('schedule');const j=await control('claim');assert.equal(j.kind,'directory');
 const terms=[{id:'202710',name:'Winter'}];await semesters('directory_finish',{id:j.id,token:j.lease_token,terms});
 assert.deepEqual(await semesters('list',{school_id}),[{...terms[0],imported:false,import_state:'queued'}]);
 assert.equal((await semesters('load',{school_id,term_id:'209999'})).error,'term_not_published');
 const first=await semesters('load',{school_id,term_id:'202710'}),second=await semesters('load',{school_id,term_id:'202710'});
 assert.equal(first.job_id,second.job_id);await semesters('preload');await semesters('preload');assert.equal((await db.query("select count(*) n from bye_jobs where term_id='202710' and status='queued'")).rows[0].n,1);assert.ok(first.server_observed_at);assert.equal(first.eligible_jobs_ahead,0);assert.equal(await control('claim'),null);
 await assert.rejects(semesters('load',{school_id:'other',term_id:'202710'}));
 await db.exec("update bye_worker set next_fetch_at=now()-interval '1 second'");const job=await control('claim');
 const catalog={term:{id:'202710',name:'Winter',as_of:new Date().toISOString()},courses:[{id:'MATH-001',code:'MATH 001',title:'Example'}],sections:[{id:'10001',course_id:'MATH-001',units:3,instructors:[],meetings:[],availability:{as_of:new Date().toISOString(),seats_open:3}}]};
 await control('stage',{id:job.id,token:job.lease_token,catalog});await control('finish',{id:job.id,token:job.lease_token,metrics:{}});
 assert.equal((await semesters('status',{school_id,term_id:'202710'})).imported,true);
 assert.equal((await db.query('select next_due=next_fetch_at ok from bye_refresh,bye_worker')).rows[0].ok,true);
 const before=(await db.query('select count(*) n from bye_jobs')).rows[0].n;
 await semesters('load',{school_id,term_id:'202710'});
 assert.equal((await db.query('select count(*) n from bye_jobs')).rows[0].n,before);
 await db.exec("update bye_term_directory set checked_at=now()-interval '2 days';update bye_worker set next_fetch_at=now()-interval '1 second'");
 await semesters('schedule');const directoryRetry=await control('claim');assert.equal(directoryRetry.kind,'directory');
 await control('fail',{id:directoryRetry.id,token:directoryRetry.lease_token,error:'source_unavailable',retry_seconds:900});
 assert.equal((await semesters('list',{school_id}))[0].id,'202710');
 assert.equal((await db.query('select terms from bye_term_directory')).rows[0].terms[0].id,'202710');
 await assert.rejects(semesters('directory_finish',{id:directoryRetry.id,token:directoryRetry.lease_token,terms:[]}));
 assert.equal((await db.query("select data->>'seats_open' count from bye_availability")).rows[0].count,'3');
 await db.exec('set role authenticated');await assert.rejects(semesters('list',{school_id}));await assert.rejects(db.query('select * from bye_term_directory'));
 }finally{await db.close()}
});
