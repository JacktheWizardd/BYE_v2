import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {normalizePccSchedule} from '../src/connectors.js';import {createRmp} from '../src/rmp.js';import {PGlite} from '@electric-sql/pglite';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
test('pinned v1 catalog preserves published codes and provenance without fabricating sections',async()=>{
 const manifest=await json('../reference/v1/manifest.json'),bytes=await readFile(new URL('../reference/v1/pcc-fall-2026-courses.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.catalog.file_sha256);
 const data=JSON.parse(bytes);assert.equal(data.retrieved,'2026-10-18');assert.equal(data.courses.length,1101);assert.equal(new Set(data.courses.map(x=>x[0])).size,1101);
 assert.ok(data.courses.some(x=>x[0]==='MATH 005A'));assert.ok(data.courses.some(x=>x[0]==='MATH 005AH'));assert.equal(data.sections,undefined);
});
test('legacy Summer example retains all hybrid meetings and unknown counts',async()=>{
 const rows=await json('fixtures/v1/pcc-summer-2026-eth014.json');
 // The original fixture omits termCode. Add only its explicit file-level term for this test.
 const data=normalizePccSchedule(rows.map(r=>({...r,termCode:'202650'})),'202650','2026-10-18T00:00:00Z');
 assert.equal(data.sections.length,14);assert.equal(data.sections.find(s=>s.id==='91004').meetings.length,2);
 assert.ok(data.sections.every(s=>s.availability.seats_open===null));assert.ok(data.sections.every(s=>s.availability.source_status==='C'));
});
test('synthetic legacy records retain suffixes, date-specific meetings and source restrictions',async()=>{
 const f=await json('fixtures/v1/fall-2026-synthetic.json'),d=normalizePccSchedule(f.rows,'202670','2026-10-18T00:00:00Z');
 assert.equal(d.sections.find(s=>s.id==='81016').meetings.length,3);
 for(const code of ['MATH 005A','MATH 005AH','MATH 005AL','ENGL C1000H'])assert.ok(d.courses.some(c=>c.code===code));
 assert.equal(d.sections.find(s=>s.id==='90001').availability.source_status,'R');
});
test('legacy ambiguous names cannot automatically establish production RMP links',async()=>{
 const f=await json('fixtures/v1/rmp-ambiguous-identities.json');
 for(const item of f.cases){
 const repo={request:async path=>path==='bye_instructors'?[{name:item.name,provisional:false}]:path==='bye_rmp_settings'?[{enabled:true}]:[{checked_at:new Date().toISOString(),data:{complete:true,candidates:item.candidates}}]};
 const api=createRmp(repo,{fetcher:()=>{throw Error('No live source permitted')}});
 const result=await api(new Request('https://test'),'pasadena-city-college','test','profile',{cacheOnly:true});
 assert.equal(result.state,'needs_selection');assert.equal(result.profile,undefined);
 }
});
test('reference storage denies browser reads and cannot alter live data',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
 for(const file of ['20261030225302_production_backend.sql','20261101040000_v1_course_reference.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec("insert into bye_course_reference values('test','pasadena-city-college','202670','2026-10-18','https://github.com/JacktheWizardd/BYE_frontend','blob','sha','[[\"MATH 005A\",\"Example\"]]');");
 assert.equal((await db.query('select count(*) n from bye_terms')).rows[0].n,0);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from bye_course_reference'));
 }finally{await db.close()}
});
