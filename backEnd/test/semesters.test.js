import test from 'node:test';import assert from 'node:assert/strict';import {runSync} from '../src/sync.js';import {createApi} from '../src/api.js';
test('directory work uses the shared claim and never imports a schedule',async()=>{
 const calls=[],repo={semesters:async(a)=>calls.push(a),control:async a=>a==='claim'?{id:'job',school_id:'pcc',kind:'directory',lease_token:'token'}:null,school:async()=>({status:'active',connector:'pcc'})};
 const connectors=new Map([['pcc',{terms:async()=>[{id:'202710',name:'Winter'}],importTerm:()=>{throw Error('unexpected import')}}]]);
 assert.equal((await runSync(repo,{connectors})).status,'succeeded');assert.deepEqual(calls,['schedule','directory_finish']);
});
test('published listing and shared load require membership and preserve the page contract',async()=>{
 let principal={role:'reader'};const calls=[];const repository={school:async()=>({status:'active',connector:'pcc'}),semesters:async(a,p)=>{calls.push([a,p]);return a==='list'?[{id:'202710',name:'Winter',imported:false}]:{imported:false,status:'queued'}}};
 const api=createApi({repository,authorize:async()=>principal});
 const request=(path,method='GET')=>api(new Request('https://test/v1/schools/pcc/terms'+path,{method}));
 const list=await request('?scope=published');assert.equal(list.status,200);assert.equal((await list.json()).data[0].imported,false);
 assert.equal((await request('/202710/load','POST')).status,202);assert.equal(calls.at(-1)[1].school_id,'pcc');
 principal=null;assert.equal((await request('?scope=published')).status,401);
});
