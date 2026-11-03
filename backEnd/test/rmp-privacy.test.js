import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionApi} from '../src/production.js';
import {createRmp} from '../src/rmp.js';
import {runRmpRefresh} from '../src/rmp-refresh.js';
const school='pasadena-city-college',id='00000000-0000-0000-0000-000000000001';
const person={name:'Example Instructor',provisional:false};
const candidate={id:'1',name:person.name};
const checked_at=new Date().toISOString();
const cache=new Map([[JSON.stringify([school,'candidates',person.name]),{data:{candidates:[candidate],complete:true},checked_at}]]);

test('authenticated GET, POST and legacy refresh read only shared cache and preserve CORS',async()=>{
 const mutations=[],outbound=[];
 const repository={control:async(action,p)=>{assert.equal(p.user_id,'private-student');return {role:'reader'}},request:async(path,q,o)=>{
  if(path==='bye_instructors')return [person];if(path==='bye_rmp_settings')return [{enabled:true}];
  if(path==='bye_rmp_cache')return cache.has(q.key.slice(3))?[cache.get(q.key.slice(3))]:[];
  mutations.push([path,o]);throw Error('Unexpected mutation');
 }};
 const handler=createProductionApi({url:'https://project.supabase.co',secret:'server-secret',publishableKey:'public',pepper:'a'.repeat(32),allowedOrigin:'https://bye.test',repository,
  fetcher:async(url,o)=>{outbound.push(String(url));assert.equal(o.headers.authorization,'Bearer private-jwt');return Response.json({id:'private-student'})}});
 const base=`https://bye.test/v1/schools/${school}/instructors/${id}/rmp/`;
 for(const [operation,method,body] of [['candidates','GET'],['candidates','POST',{}],['profile','POST',{profile_id:'1'}],['refresh','POST',{profile_id:'1'}]]){
  const r=await handler(new Request(base+operation,{method,headers:{authorization:'Bearer private-jwt',cookie:'private-cookie', 'x-forwarded-for':'192.0.2.44',origin:'https://bye.test','content-type':'application/json'},body:body?JSON.stringify(body):undefined}));
  assert.equal(r.status,operation==='candidates'?200:409);assert.equal(r.headers.get('access-control-allow-origin'),'https://bye.test');
 }
 assert.deepEqual(mutations,[]);assert.ok(outbound.every(u=>u==='https://project.supabase.co/auth/v1/user'));
});

test('source requests contain only fixed headers and professor query variables, even with hostile incoming metadata',async()=>{
 const seen=[];
 const repo={request:async(path,q,o)=>{if(path==='bye_instructors')return [person];const {action}=o.body;return action==='cache'?{token:'private-job-id'}:action==='acquire'?{token:'private-slot-id'}:{}}};
 const teacher={id:btoa('Teacher-1'),legacyId:1,firstName:'Example',lastName:'Instructor',school:{id:btoa('School-2649'),legacyId:2649},ratings:{edges:[],pageInfo:{hasNextPage:false}}};
 const rmp=createRmp(repo,{fetcher:async(url,o)=>{seen.push({url,o});return Response.json({data:JSON.parse(o.body).query.includes('BYESearch')?{search:{teachers:{edges:[{node:teacher}],pageInfo:{hasNextPage:false}}}}:{node:teacher}})}});
 await rmp(new Request('https://bye.test/?student_id=private-student',{headers:{authorization:'Bearer private-jwt',cookie:'private-cookie','x-forwarded-for':'192.0.2.44','x-real-ip':'192.0.2.44'},method:'POST',body:'private-enrollment'}),school,id,'profile',{cacheOnly:false});
 assert.equal(seen.length,2);
 for(const {url,o} of seen){assert.equal(url,'https://www.ratemyprofessors.com/graphql');assert.equal(o.method,'POST');assert.equal(o.redirect,'error');assert.deepEqual(Object.keys(o.headers).sort(),['Accept','Content-Type','User-Agent']);assert.deepEqual(Object.keys(JSON.parse(o.body)).sort(),['query','variables']);const wire=JSON.stringify({url,headers:o.headers,body:o.body});for(const secret of ['private-jwt','private-student','private-cookie','192.0.2.44','private-enrollment','private-job-id','private-slot-id',id])assert.ok(!wire.includes(secret));}
 assert.deepEqual(JSON.parse(seen[0].o.body).variables,{query:{text:person.name,schoolID:btoa('School-2649')},count:20,cursor:null});
 assert.deepEqual(JSON.parse(seen[1].o.body).variables,{id:btoa('Teacher-1'),count:3,cursor:null,courseFilter:null});
});

test('default cache reads serve retained stale data, reject expired data and never schedule work',async()=>{
 for(const days of [30,91]){const repo={request:async(path)=>{if(path==='bye_instructors')return [person];if(path==='bye_rmp_settings')return [{enabled:true}];if(path==='bye_rmp_cache')return [{data:{candidates:[candidate],complete:true},checked_at:new Date(Date.now()-days*86400000).toISOString()}];throw Error('No mutation permitted')}};
 const run=createRmp(repo,{fetcher:async()=>{throw Error('No source permitted')}});
 if(days===30){const d=await run(new Request('https://bye.test'),school,id,'candidates');assert.equal(d.stale,true);}else await assert.rejects(run(new Request('https://bye.test'),school,id,'candidates'),{code:'rmp_cache_miss'});
 }
});

test('background runner is idle without a claim and records failures without leaking source errors',async()=>{
 let calls=[];const repo={request:async(path,q,o)=>{calls.push(o?.body?.action);return {}}};
 assert.deepEqual(await runRmpRefresh(repo,{fetcher:async()=>{throw Error('No fetch')}}),{status:'idle'});assert.deepEqual(calls,['claim']);
 calls=[];repo.request=async(path,q,o)=>{if(path==='bye_instructors')throw Error('sensitive');calls.push(o.body.action);return o.body.action==='claim'?{token:'internal-job',school_id:school,instructor_id:id}:{};};
 assert.deepEqual(await runRmpRefresh(repo),{status:'failed'});assert.deepEqual(calls,['claim','fail']);
});

test('scheduled catalog claim fills candidates, profiles and first review page without student input',async()=>{
 const entries=new Map(),actions=[],requests=[];
 const repo={request:async(path,q,o)=>{
  if(path==='bye_instructors')return [person];const {action,p}=o.body;
  if(path==='rpc/bye_rmp_background'){actions.push(action);return action==='claim'?{token:'private-job-id',school_id:school,instructor_id:id}:{};}
  if(action==='cache')return !p.force&&entries.has(p.key)?entries.get(p.key):{token:'cache-lease'};
  if(action==='publish')entries.set(p.key,{data:p.data,checked_at});
  return action==='acquire'?{token:'slot'}:{};
 }};
 const teacher={id:btoa('Teacher-1'),legacyId:1,firstName:'Example',lastName:'Instructor',school:{id:btoa('School-2649'),legacyId:2649},ratings:{edges:[],pageInfo:{hasNextPage:false}}};
 const result=await runRmpRefresh(repo,{fetcher:async(url,o)=>{requests.push(o.body);return Response.json({data:JSON.parse(o.body).query.includes('BYESearch')?{search:{teachers:{edges:[{node:teacher}],pageInfo:{hasNextPage:false}}}}:{node:teacher}})}});
 assert.deepEqual(result,{status:'succeeded'});assert.deepEqual(actions,['claim','finish']);assert.equal(requests.length,3);assert.equal(entries.size,3);
 assert.ok(requests.every(body=>!body.includes('private-job-id')));
 const read=createRmp({request:async(path,q)=>path==='bye_instructors'?[person]:path==='bye_rmp_settings'?[{enabled:true}]:[entries.get(q.key.slice(3))]});
 assert.equal((await read(new Request('https://bye.test'),school,id,'profile')).profile.id,'1');
});
