import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import {validateWeeklyPlans,refreshPlans,WATCH_LIMIT} from '../src/weekly-plan.js';
const saved=(id,course_id='math')=>({id,course_id,code:'MATH 005B',title:'Calculus II',units:5,instructors:[{id:'i1',name:'Example Instructor',provisional:false}],meetings:[{days:[1,3],start_time:'09:00',end_time:'10:25',start_date:null,end_date:null,timezone:'America/Los_Angeles',format:'Lecture',format_code:'L',room:'308',building:'R',campus:null}]});
test('watching is optional, follows the section rules and has its own limit',()=>{
 const p={school_id:'pcc',term_id:'202730',sections:[saved('10001')],study:{math:2},weekend:false};
 assert.deepEqual(validateWeeklyPlans([p]),[p]);
 const tagged={...p,watching:[saved('10002'),saved('10003','phys')]};
 assert.deepEqual(validateWeeklyPlans([tagged]),[tagged]);
 assert.deepEqual(validateWeeklyPlans([{...p,watching:[]}])[0].watching,[]);
 // The same section may sit in the Plan and in watching; the app shows it once.
 assert.equal(validateWeeklyPlans([{...p,watching:[saved('10001')]}])[0].watching.length,1);
 assert.throws(()=>validateWeeklyPlans([{...p,watching:[saved('10002'),saved('10002')]}]),/Invalid weekly Plan/);
 assert.throws(()=>validateWeeklyPlans([{...p,watching:'10002'}]));
 assert.throws(()=>validateWeeklyPlans([{...p,watching:[{...saved('10002'),access_token:'private'}]}]));
 assert.throws(()=>validateWeeklyPlans([{...p,watching:[{...saved('10002'),id:'1234'}]}]));
 assert.throws(()=>validateWeeklyPlans([{...p,watching:[{...saved('10002'),meetings:[{...saved('1').meetings[0],start_time:'25:00'}]}]}]));
 assert.throws(()=>validateWeeklyPlans([{...p,watching:Array.from({length:WATCH_LIMIT+1},(_,i)=>saved(String(20000+i)))}]));
 assert.equal(validateWeeklyPlans([{...p,watching:Array.from({length:WATCH_LIMIT},(_,i)=>saved(String(20000+i)))}])[0].watching.length,WATCH_LIMIT);
 // Study hours belong to classes in the Plan, never to a class that is only watched.
 assert.throws(()=>validateWeeklyPlans([{...p,sections:[],study:{math:2},watching:[saved('10002')]}]));
 assert.throws(()=>validateWeeklyPlans([{...p,watched:[]}]));
});
test('refreshing uses the school’s current section for Plan and watched sections alike',async()=>{
 const now={units:4,instructors:[{id:'i2',name:'New Instructor',provisional:false}],meetings:[{...saved('1').meetings[0],start_time:'11:00',end_time:'12:25'}]};
 const listed={'pcc:202730:10001':{course_id:'math',...now},'pcc:202730:10002':{course_id:'phys',...now}},asked=[];
 const lookup=async(school,term,id)=>{asked.push(id);return listed[[school,term,id].join(':')]??null};
 const plans=[{school_id:'pcc',term_id:'202730',sections:[saved('10001'),saved('10009')],study:{},weekend:false,watching:[saved('10002','phys'),saved('10008','phys')]},{school_id:'pcc',term_id:'202710',sections:[],study:{},weekend:false}];
 assert.deepEqual(await refreshPlans(plans,lookup),['pcc:202730:10009','pcc:202730:10008']);
 assert.deepEqual(asked,['10001','10009','10002','10008']);
 for(const fresh of [plans[0].sections[0],plans[0].watching[0]]){assert.equal(fresh.meetings[0].start_time,'11:00');assert.equal(fresh.units,4);assert.equal(fresh.instructors[0].name,'New Instructor');assert.equal(fresh.code,'MATH 005B')}
 // Sections the school no longer lists keep the snapshot that was saved.
 assert.equal(plans[0].sections[1].meetings[0].start_time,'09:00');assert.equal(plans[0].watching[1].meetings[0].start_time,'09:00');
 assert.equal('watching' in plans[1],false);
 // Saving is strict: a watched section filed under another course is refused, exactly as a Plan section is.
 const wrong=[{school_id:'pcc',term_id:'202730',sections:[],study:{},weekend:false,watching:[saved('10002','math')]}];
 await assert.rejects(refreshPlans(wrong,lookup,true),e=>e.status===400&&e.code==='invalid_plan');
 await assert.rejects(refreshPlans([{...wrong[0],watching:undefined,sections:[saved('10002','math')]}],lookup,true),e=>e.code==='invalid_plan');
 assert.deepEqual(await refreshPlans(wrong,lookup),[]);
 // A section in both lists is reported missing once.
 assert.deepEqual(await refreshPlans([{school_id:'pcc',term_id:'202730',sections:[saved('10009')],study:{},weekend:false,watching:[saved('10009')]}],lookup),['pcc:202730:10009']);
});
test('weekly Plans reject duplicate semesters and invalid hours',()=>{const p={school_id:'pcc',term_id:'202730',sections:[],study:{},weekend:false};assert.deepEqual(validateWeeklyPlans([p]),[p]);assert.throws(()=>validateWeeklyPlans([p,p]));assert.throws(()=>validateWeeklyPlans([{...p,study:{foo:99}}]));});
test('new SQL and shared RMP cooldown work',async()=>{const db=new PGlite();try{await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';create schema auth;create table auth.users(id uuid primary key);create table bye_memberships(user_id uuid primary key,expires_at timestamptz,revoked_at timestamptz);");for(const file of ['weekly-plan.sql','migrations/20261031043108_rmp_cache.sql','rmp-long-cache.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));await db.exec('update bye_rmp_settings set enabled=true');const call=async(action,p={})=>(await db.query('select bye_rmp($1,$2::jsonb) d',[action,JSON.stringify(p)])).rows[0].d;assert.deepEqual(await call('manual_refresh',{school:'pcc',instructor:'a'}),{});assert.ok((await call('manual_refresh',{school:'pcc',instructor:'a'})).retry_after>1700);await db.exec('set role authenticated');await assert.rejects(db.query('select * from bye_weekly_plans'));}finally{await db.close()}});
test('weekly collection serializes revisions, isolates identities and denies expired access',async()=>{const db=new PGlite();try{await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table bye_memberships(user_id uuid primary key,expires_at timestamptz,revoked_at timestamptz);");await db.exec(await readFile(new URL('../supabase/weekly-plan.sql',import.meta.url),'utf8'));const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';await db.query('insert into auth.users values($1),($2)',[a,b]);await db.query("insert into bye_memberships values($1,now()+interval '1 day',null),($2,now()+interval '1 day',null)",[a,b]);const call=async(u,rev=null,p=null)=>(await db.query('select bye_weekly_plan($1,$2,$3::jsonb) d',[u,rev,p===null?null:JSON.stringify(p)])).rows[0].d;assert.equal((await call(a,0,[])).data.revision,1);assert.equal((await call(b)).data.revision,0);const both=await Promise.all([call(a,1,[]),call(a,1,[])]);assert.equal(both.filter(x=>x.error==='revision_conflict').length,1);assert.equal((await call(a)).data.revision,2);await db.query('update bye_memberships set revoked_at=now() where user_id=$1',[a]);assert.equal((await call(a)).error,'access_required');await db.query("update bye_memberships set expires_at=now()-interval '1 second' where user_id=$1",[b]);assert.equal((await call(b)).error,'access_required');}finally{await db.close()}});
test('refresh request SQL coalesces jobs and denies browser RPC calls',async()=>{const db=new PGlite();try{await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create table bye_schools(id text primary key,status text);create table bye_terms(school_id text,id text);create table bye_refresh(school_id text,term_id text,next_due timestamptz);create table bye_jobs(id int generated always as identity,school_id text,term_id text,kind text,status text default 'queued',due_at timestamptz);create function bye_control(text,jsonb) returns jsonb language sql as 'select ''{}''::jsonb';create function bye_semesters(text,jsonb) returns jsonb language sql as 'select jsonb_build_object(''status'',''queued'')';insert into bye_schools values('pcc','active');insert into bye_terms values('pcc','term');insert into bye_refresh values('pcc','term',now()+interval '5 minutes');");await db.exec(await readFile(new URL('../supabase/request-refresh.sql',import.meta.url),'utf8'));for(let i=0;i<2;i++)await db.query("select bye_request_refresh('pcc','term')");assert.equal((await db.query('select count(*)::int n from bye_jobs')).rows[0].n,1);assert.equal((await db.query('select due_at>now() future from bye_jobs')).rows[0].future,true);await db.exec('set role authenticated');await assert.rejects(db.query("select bye_request_refresh('pcc','term')"));}finally{await db.close()}});
