import {ApiError} from './errors.js';
const fail=(message='Invalid Watches data.')=>{throw new ApiError(400,'invalid_watches',message)};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fields=(o,allowed)=>{if(!obj(o)||Object.keys(o).some(k=>!allowed.includes(k)))fail()};
const text=(s,max=160)=>{if(typeof s!=='string'||s.length>max||/[\u0000-\u001f]/.test(s))fail();return s.trim()};
export function validateWatchesState(value){
 fields(value,['goals','prereq_overrides','status_overrides']);for(const [key,max] of [['goals',20],['prereq_overrides',1000],['status_overrides',1000]])if(!Array.isArray(value[key])||value[key].length>max)fail();
 const ids=new Set();const goals=value.goals.map(g=>{fields(g,['id','kind','school','college','major','year']);if(!uuid(g.id)||ids.has(g.id)||!['transfer','graduate'].includes(g.kind))fail();ids.add(g.id);return {id:g.id,kind:g.kind,school:text(g.school),college:text(g.college),major:text(g.major),year:text(g.year,20)}});
 const keys=new Set();const prereq_overrides=value.prereq_overrides.map(o=>{fields(o,['entry_id','rule_id','reason']);if(!['placement','prior','ap','counselor'].includes(o.reason))fail();const entry_id=text(o.entry_id,80),rule_id=text(o.rule_id,200);if(keys.has(entry_id+rule_id))fail();keys.add(entry_id+rule_id);return {entry_id,rule_id,reason:o.reason}});
 const statuses=new Set();const status_overrides=value.status_overrides.map(o=>{fields(o,['entry_id','status','reason']);if(!['unknown','planned','enrolled','completed','waived','not_taken'].includes(o.status)||!['dropped','changed','not_taken','student'].includes(o.reason)||statuses.has(o.entry_id))fail();statuses.add(o.entry_id);return {entry_id:text(o.entry_id,80),status:o.status,reason:o.reason}});
 return {goals,prereq_overrides,status_overrides};
}
