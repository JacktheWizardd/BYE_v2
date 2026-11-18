import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createRmp} from '../src/rmp.js';
import {createThemes,basis,sideOf} from '../src/themes.js';
import {createProductionApi} from '../src/production.js';

const school='pasadena-city-college';
const global=(kind,id)=>btoa(kind+'-'+id);
// Eight reviews: r1-r3 critical, r4 mixed, r5-r8 positive.
const ratings=[1,2,1,3,5,4,5,5];
const nodes=()=>ratings.map((helpfulRating,i)=>({id:'review'+(i+1),comment:'Comment '+(i+1),helpfulRating,difficultyRating:3,date:'2026-0'+(i+1)+'-04 12:01:45 +0000 UTC',class:'MATH5A',grade:i===0?'D+':i===4?'A':null,wouldTakeAgain:i>3?1:i===0?0:null,ratingTags:i===0?'Tough grader--Lecture heavy--Tough grader':null}));
const teacher=(edges=nodes().map(node=>({node})))=>({id:global('Teacher',1),legacyId:1,firstName:'Example',lastName:'Instructor',school:{id:global('School',2649),legacyId:2649},avgRating:4,avgDifficulty:3,numRatings:8,wouldTakeAgainPercent:60,courseCodes:[{courseName:'MATH5A'}],ratings:{edges,pageInfo:{hasNextPage:false,endCursor:null}}});
const modelReply=value=>Response.json({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}]});
const good={critics:[{point:'Exams are harder than the study guides.',ids:['r1','r2','r3']}],conceded:[{point:'Gives partial credit.',ids:['r2','r4']}],fans:[{point:'Lectures are clear.',ids:['r5','r6','r8']}]};

function setup({reply=()=>modelReply(good),key='test-key',gate={ok:true},edges}={}){
 const store=new Map(),source=[],model=[],rpc=[];
 const repository={request:async(path,_q,options)=>{
  if(path==='bye_instructors')return [{id:'test',name:'Example Instructor',provisional:false}];
  if(path==='rpc/bye_ai'){rpc.push('ai:'+options.body.action);return gate}
  const {action,p}=options.body;rpc.push(action);
  if(action==='acquire')return {token:'slot'};
  if(action==='cache')return store.has(p.key)?store.get(p.key):{token:'fill'};
  if(action==='publish')store.set(p.key,{data:p.data,checked_at:new Date().toISOString()});
  return {};
 }};
 const fetcher=async(url,options)=>{
  if(String(url)==='https://api.anthropic.com/v1/messages'){model.push({url:String(url),options});return reply(options)}
  source.push(JSON.parse(options.body));const q=source.at(-1);
  return Response.json({data:q.query.includes('BYESearch')?{search:{teachers:{edges:[{node:teacher(edges)}],pageInfo:{hasNextPage:false,endCursor:null}}}}:{node:teacher(edges)}});
 };
 const rmp=createRmp(repository,{fetcher,themes:createThemes({key,fetcher})});
 const call=(operation,query='')=>rmp(new Request('https://bye.test/v1'+query),school,'test',operation,{cacheOnly:false});
 return {call,store,source,model,rpc};
}

test('reviews carry grade, would-take-again and de-duplicated tags, with unknowns left empty',async()=>{
 const s=setup(),d=await s.call('profile');
 assert.deepEqual([d.reviews[0].grade,d.reviews[0].would_take_again,d.reviews[0].tags],['D+',false,['Tough grader','Lecture heavy']]);
 assert.deepEqual([d.reviews[1].grade,d.reviews[1].would_take_again,d.reviews[1].tags],[null,null,[]]);
 assert.equal(d.reviews[4].would_take_again,true);
 assert.match(s.source.at(-1).query,/grade wouldTakeAgain ratingTags/);
});

test('sides and basis are counted without a model',()=>{
 assert.deepEqual([1,2,3,4,5,null].map(sideOf),['critical','critical','mixed','positive','positive',null]);
 assert.deepEqual(basis(ratings.map(rating=>({rating})),{filter:'MATH5A'}),{filter:'MATH5A',complete:true,source_records:8,reviews:8,critical:3,mixed:1,positive:4});
});

test('themes cite real reviews from the right side, are cached, and reuse the cached review page',async()=>{
 const s=setup(),d=await s.call('themes','?filter=MATH5A');
 assert.equal(d.state,'ready');assert.equal(d.model,'claude-haiku-5-5');
 assert.deepEqual(d.basis,{filter:'MATH5A',complete:true,source_records:8,reviews:8,critical:3,mixed:1,positive:4});
 assert.deepEqual(d.critics,[{text:'Exams are harder than the study guides.',review_ids:['review1','review2','review3']}]);
 assert.deepEqual(d.conceded[0].review_ids,['review2','review4']);
 assert.deepEqual(d.fans[0].review_ids,['review5','review6','review8']);
 const again=await s.call('themes','?filter=MATH5A');
 assert.deepEqual(again.critics,d.critics);
 assert.equal(s.model.length,1,'one model call per review set');
 assert.equal(s.source.length,2,'one name search and one review page');
 assert.equal(s.rpc.filter(a=>a==='ai:acquire').length,1);
 assert.ok([...s.store.keys()].every(k=>!k.includes('themes')||k.includes('"reviews"')),'themes follow review retention');
});

test('unsupported, wrong-side, oversized and link-bearing points are dropped',async()=>{
 const reply=()=>modelReply({critics:[
  {point:'Supported by positive reviews only.',ids:['r5','r6']},
  {point:'Only one real review.',ids:['r1','r99','nope']},
  {point:'See https://example.test for answers.',ids:['r1','r2']},
  {point:'x'.repeat(201),ids:['r1','r2']},
  {point:'  Kept   point. ',ids:['r1','r1','r3']}],fans:'not a list'});
 const d=await setup({reply}).call('themes');
 assert.deepEqual(d.critics,[{text:'Kept point.',review_ids:['review1','review3']}]);
 assert.deepEqual([d.fans,d.conceded],[[],[]]);
});

test('a malformed or failed model reply is an error and is never cached',async()=>{
 for(const reply of [()=>modelReply('I cannot help with that.'),()=>new Response('',{status:500}),()=>Response.json({content:[]})]){
  const s=setup({reply});await assert.rejects(s.call('themes'),{code:'themes_unavailable',status:503});
  assert.ok([...s.store.keys()].every(k=>!k.includes('themes')));
 }
 await assert.rejects(setup({reply:()=>new Response('',{status:429})}).call('themes'),{code:'themes_limited',status:429});
});

test('no key, the kill switch and the daily cap all stop before any model call',async()=>{
 const off=setup({key:''});await assert.rejects(off.call('themes'),{code:'themes_not_configured',status:503});assert.equal(off.model.length,0);
 const disabled=setup({gate:{disabled:true}});await assert.rejects(disabled.call('themes'),{code:'themes_disabled'});assert.equal(disabled.model.length,0);
 const capped=setup({gate:{retry_after:120}});await assert.rejects(capped.call('themes'),{code:'themes_limited',status:429,retryAfter:120});assert.equal(capped.model.length,0);
});

test('too few reviews returns counts only and never contacts the model',async()=>{
 const s=setup({edges:nodes().slice(0,4).map(node=>({node}))}),d=await s.call('themes');
 assert.equal(d.state,'insufficient');assert.equal(d.basis.reviews,4);assert.equal(s.model.length,0);assert.equal(s.rpc.includes('ai:acquire'),false);
});

test('the model request carries review data only: no reader, session or instructor identity',async()=>{
 const upstream=[];
 const cache=new Map();
 const repository={control:async()=>({role:'reader'}),request:async(path,_q,o)=>{
  if(path==='bye_instructors')return [{name:'Example Instructor',provisional:false}];
  if(path==='rpc/bye_ai')return {ok:true};
  const {action,p}=o.body;if(action==='cache')return cache.get(p.key)??{token:'lease'};if(action==='publish')cache.set(p.key,{data:p.data,checked_at:new Date().toISOString()});
  return action==='acquire'?{token:'slot'}:{};
 }};
 const handler=createProductionApi({url:'https://project.supabase.co',secret:'server-secret',publishableKey:'public',pepper:'a'.repeat(32),allowedOrigin:'https://bye.test',repository,aiKey:'model-key',
  fetcher:async(url,o)=>{
   if(String(url)==='https://project.supabase.co/auth/v1/user')return Response.json({id:'private-student'});
   if(String(url)==='https://api.anthropic.com/v1/messages'){upstream.push(o);return modelReply(good)}
   return Response.json({data:JSON.parse(o.body).query.includes('BYESearch')?{search:{teachers:{edges:[{node:teacher()}],pageInfo:{hasNextPage:false,endCursor:null}}}}:{node:teacher()}});
  }});
 const id='00000000-0000-0000-0000-000000000001';
 const request=(method,body)=>handler(new Request(`https://bye.test/v1/schools/${school}/instructors/${id}/rmp/themes`,{method,headers:{authorization:'Bearer private-jwt',cookie:'private-cookie','x-forwarded-for':'192.0.2.44',origin:'https://bye.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
 const response=await request('POST',{filter:'MATH5A'});
 assert.equal(response.status,200);assert.equal((await response.json()).data.state,'ready');
 assert.equal(upstream.length,1);
 const sent=upstream[0];
 assert.deepEqual(Object.keys(sent.headers).sort(),['anthropic-version','content-type','x-api-key']);
 assert.equal(sent.redirect,'error');
 const text=JSON.stringify(sent.headers)+sent.body;
 for(const secret of ['private-jwt','private-cookie','192.0.2.44','private-student','server-secret','Example','Instructor',id,'review1'])assert.ok(!text.includes(secret),secret+' must not reach the model');
 assert.deepEqual(Object.keys(JSON.parse(JSON.parse(sent.body).messages[0].content.split('\n')[1])[0]).sort(),['course','date','difficulty','grade','key','rating','tags','text']);
 assert.notEqual((await request('GET')).status,200,'themes are POST only');
});

test('bye_ai enforces the kill switches and the daily cap, counts usage and denies browser roles',async()=>{
 const db=new PGlite();try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';");
  const migration=name=>readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
  await db.exec(await migration('20261031043108_rmp_cache'));
  await db.exec(await migration('20261118090000_review_themes'));
  const call=async action=>(await db.query('select bye_ai($1) d',[action])).rows[0].d;
  assert.equal((await call('acquire')).disabled,true,'RMP kill switch stops themes');
  await db.exec('update bye_rmp_settings set enabled=true,ai_daily_cap=2');
  assert.equal((await call('acquire')).ok,true);assert.equal((await call('acquire')).ok,true);
  const limited=await call('acquire');assert.ok(limited.retry_after>0&&limited.retry_after<=90000);
  assert.equal((await db.query('select requests from bye_ai_usage')).rows[0].requests,2);
  await db.exec('update bye_rmp_settings set ai_enabled=false,ai_daily_cap=40');
  assert.equal((await call('acquire')).disabled,true);
  await db.exec('update bye_rmp_settings set ai_enabled=true');await assert.rejects(call('release'));
  await db.exec('set role authenticated');await assert.rejects(call('acquire'));await assert.rejects(db.query('select * from bye_ai_usage'));
 }finally{await db.close()}
});
