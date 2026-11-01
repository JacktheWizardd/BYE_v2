import test from 'node:test';import assert from 'node:assert/strict';import {createProductionApi} from '../src/production.js';
const payload=()=>({expected_revision:0,plan:{version:1,fingerprint:'a'.repeat(64),pages:[{width:612,height:792}],purpose:'Personal plan',institution:'Example College',printed_units:4,exception:'',terms:[{id:'one',label:'Spring 2027',year:2027,basis:'semester',printed_units:4,reviewed:true,exception:'',entries:[{id:'one',kind:'course',code:'MATH 022',title:'Discrete mathematics',units:4,status:'unknown',source:{page:1,box:[10,10,100,40]},correction:'',exception:'',reviewed:true}]}]}});
test('plan API derives identity, validates before saving, and reports conflicts',async()=>{
 let member={role:'reader'},answer={data:null},calls=[];
 const handler=createProductionApi({url:'https://project.supabase.co',secret:'secret',publishableKey:'public',pepper:'a'.repeat(32),fetcher:async()=>Response.json({id:'verified-user'}),repository:{control:async()=>member,request:async(...args)=>{calls.push(args);return answer}}});
 const request=(body,method=body?'POST':'GET')=>handler(new Request('https://test/v1/me/education-plan',{method,headers:{authorization:'Bearer session','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
 assert.equal((await request()).status,200);assert.equal(calls.at(-1)[2].body.p_user_id,'verified-user');
 assert.equal((await request({...payload(),user_id:'victim'})).status,400);
 const p=payload();p.plan.terms[0].entries[0].reviewed=false;const before=calls.length;assert.equal((await request(p)).status,400);assert.equal(calls.length,before);
 answer={data:{revision:1}};assert.equal((await request(payload())).status,200);assert.equal(calls.at(-1)[2].body.p_plan.calculated_units,4);
 answer={error:'revision_conflict'};assert.equal((await request(payload())).status,409);
 assert.equal((await request({padding:'x'.repeat(1048576)})).status,413);
 member=null;assert.equal((await request()).status,403);assert.equal((await request(payload())).status,403);
});
