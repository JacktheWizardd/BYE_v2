import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {courseMatches,courseRank} from '../src/repository.js';

test('subject/code relevance beats incidental titles in both repositories, before pagination',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
  for(const file of ['20261030225302_production_backend.sql','20261031033859_schedule_discovery.sql','20261031035202_course_search_relevance.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec("insert into bye_terms values('pasadena-city-college','202730','Spring',now())");
  const courses=[{id:'AHSD-6421',code:'AHSD 6421',title:'MATH BASICS'},{id:'BUS-014A',code:'BUS 014A',title:'MATHEMATICAL ANALYSIS FOR BUSINESS'},{id:'MATH-001',code:'MATH 001',title:'PRECALCULUS'},{id:'MATH-005A',code:'MATH 005A',title:'SINGLE VARIABLE CALCULUS I'},{id:'MATH-005AH',code:'MATH 005AH',title:'HONORS SINGLE VARIABLE CALCULUS I'},{id:'MATH-C005A',code:'MATH C005A',title:'COMMON COURSE'}];
  for(const c of courses)await db.query("insert into bye_courses(school_id,term_id,id,code,title)values('pasadena-city-college','202730',$1,$2,$3)",[c.id,c.code,c.title]);
  const sql=async(q,offset=0,limit=100)=>(await db.query("select * from bye_search_courses('pasadena-city-college','202730',$1,$2,$3)",[q,offset,limit])).rows;
  for(const q of ['math','MATH',' MATH ','math5a','math 005a','mathc5a','variable calculus','calculus single','business','??','']){
   const expected=courses.filter(c=>courseMatches(c,q)).sort((a,b)=>courseRank(a,q)-courseRank(b,q)||a.id.localeCompare(b.id));
   assert.deepEqual((await sql(q)).map(c=>c.id),expected.map(c=>c.id),q);
  }
  assert.deepEqual((await sql('math',0,3)).map(c=>c.id),['MATH-001','MATH-005A','MATH-005AH']);
  assert.equal((await sql('math5a'))[0].id,'MATH-005A');
  assert.deepEqual((await sql('math',3,3)).map(c=>c.id),['MATH-C005A','AHSD-6421','BUS-014A']);
  assert.deepEqual(await sql('??'),[]);
 }finally{await db.close()}
});
