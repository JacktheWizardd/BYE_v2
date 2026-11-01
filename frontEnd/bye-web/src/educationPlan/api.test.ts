import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getSession:vi.fn(async()=>({data:{session:{access_token:'test'}}})),refreshSession:vi.fn(async()=>({error:null}))}})}));
import {saveEducationPlan} from './api';
import type {EducationPlan} from './types';

const plan=():EducationPlan=>({
 version:1,
 fingerprint:'a'.repeat(64),
 pages:[{width:612,height:792}],
 purpose:'Personal plan',
 institution:'Example College',
 printed_units:4,
 exception:'',
 terms:[{
  id:'one',label:'Spring 2027',year:2027,basis:'semester',printed_units:4,reviewed:true,exception:'',
  entries:[{id:'one',kind:'course',code:'MATH 022',title:'Discrete mathematics',units:4,status:'unknown',source:{page:1,box:[10,10,100,40]},correction:'',exception:'',reviewed:true}],
 }],
});

beforeEach(()=>vi.unstubAllGlobals());

describe('education plan API client',()=>{
 it('posts expected revision and validated plan',async()=>{
  const fetcher=vi.fn(async()=>Response.json({data:{revision:1,updated_at:'2026-11-01T00:00:00Z',plan:plan()}}));
  vi.stubGlobal('fetch',fetcher);
  const saved=await saveEducationPlan(0,plan());
  expect(saved.revision).toBe(1);
  const body=JSON.parse((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].body as string);
  expect(body.expected_revision).toBe(0);
  expect(body.plan.calculated_units).toBe(4);
  expect(body.user_id).toBeUndefined();
 });

 it('surfaces revision conflicts without inventing a merge',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:{code:'revision_conflict',message:'conflict'}},{status:409})));
  await expect(saveEducationPlan(1,plan())).rejects.toMatchObject({status:409,code:'revision_conflict'});
 });
});
