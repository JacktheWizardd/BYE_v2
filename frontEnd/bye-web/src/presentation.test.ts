import {expect,it} from 'vitest';import {nameMatches,seatState,syncState,orderLoaded} from './presentation';import {sortInstructors,topScore} from './Compare';import type {Section} from './api';
it('matches every name prefix and strips diacritics',()=>{expect(nameMatches('Hassan Kasfy','kas')).toBe(true);expect(nameMatches('Christine Loritsch','chris lor')).toBe(true);expect(nameMatches('Christine Loritsch','tsch')).toBe(false);expect(nameMatches('José García','jose gar')).toBe(true);expect(nameMatches('Hassan Kasfy','xyz')).toBe(false)});
it.each([[28,28,0,'ok'],[2,30,93,'bad'],[4,30,87,'warn'],[18,30,40,'ok'],[0,30,100,'bad']])('seat occupancy %s/%s', (open,cap,width,kind)=>expect(seatState(open,cap,0)).toMatchObject({width,kind}));
it('guards unknown, zero and inconsistent capacities',()=>{for(const [open,cap] of [[null,30],[3,null],[3,0],[35,30]])expect(seatState(open,cap,0).kind).toBe('unknown')});
it('derives sync states without claiming a PCC outage',()=>{const now=Date.now(),section=(age:number|null)=>({availability:age==null?null:{as_of:new Date(now-age).toISOString()}} as Section);expect(syncState([]).kind).toBe('unknown');expect(syncState([section(1000)],false,now).kind).toBe('fresh');expect(syncState([section(1000),section(null)],false,now).kind).toBe('partial');expect(syncState([section(300000)],false,now).kind).toBe('stale');expect(syncState([section(1000)],true,now).detail).not.toContain('PCC unreachable')});
it('keeps nulls last in both directions and preserves ties',()=>{const people=[{id:'b',name:'B'},{id:'a',name:'A'},{id:'c',name:'C'}],data:any={a:{profile:{rating:4.4,difficulty:3.7,review_count:62}},b:{profile:{rating:4.1,difficulty:3.4,review_count:185}}};expect(sortInstructors(people,data,'bye').map(p=>p.id)).toEqual(['b','a','c']);expect(sortInstructors(people,data,'bye',true).map(p=>p.id)).toEqual(['b','a','c']);expect(topScore(data,['a','b','c'])).toBe(58);expect(topScore({},['a'])).toBeNull()});
it('review ordering only rearranges loaded values and keeps missing values last',()=>{const rows=[{date:null,rating:null},{date:'2020-01-01',rating:5},{date:'2024-01-01',rating:1}];expect(orderLoaded(rows,'All')).toEqual(rows);expect(orderLoaded(rows,'Highest')[0].rating).toBe(5);expect(orderLoaded(rows,'Lowest')[0].rating).toBe(1);expect(orderLoaded(rows,'Most recent')[0].date).toBe('2024-01-01');expect(rows[0].rating).toBeNull()});

it('keeps stale timestamps while distinguishing queue, source work and read failure',async()=>{
 const {coordinatedSync}=await import('./presentation');const now=Date.now(),sections=[{availability:{as_of:new Date(now-360000).toISOString()}}] as Section[];
 const r:any={status:'queued'};expect(coordinatedSync(sections,false,now,r).label).toBe('Update queued');
 expect(coordinatedSync(sections,false,now,{...r,status:'running'}).label).toBe('Checking PCC');
 expect(coordinatedSync(sections,true,now,r).label).toBe('Couldn’t reload saved counts');
 expect(coordinatedSync(sections,false,now).label).toBe('Older counts');expect(coordinatedSync([],false,now).label).toBe('Not checked yet');
});

it('uses recorded semester checks on search and maps exact status polling intervals',async()=>{
 const {semesterSync,statusPollDelay}=await import('./presentation'),now=Date.now();
 const base:any={imported:true,status:'succeeded',last_failure:null,last_successful_check:new Date(now-1000).toISOString()};
 expect(semesterSync(base,false,now).label).toBe('Semester checked');
 expect(statusPollDelay(semesterSync(base,false,now))).toBe(1800000);
 const old={...base,last_successful_check:new Date(now-300000).toISOString()};
 expect(statusPollDelay(semesterSync(old,false,now))).toBe(300000);
 expect(statusPollDelay(semesterSync({...old,status:'queued'},false,now))).toBe(600000);
 expect(statusPollDelay(semesterSync(null,false,now))).toBe(5000);
 expect(statusPollDelay(semesterSync({...base,last_successful_check:null,status:'queued'},false,now))).toBe(5000);
 expect(semesterSync(base,true,now).kind).toBe('stale');
 expect(semesterSync({...base,last_successful_check:new Date(now+1000).toISOString()},false,now).kind).toBe('unknown');
});

it('labels preparation and import outcomes without asking users to load queued terms',async()=>{const {importLabel}=await import('./presentation');expect(['not_loaded','queued','running','failed','ready'].map(importLabel)).toEqual(['Preparing','Queued','Importing','Import failed',''])});

it('separates BYE connection health from source age and refresh outcomes',async()=>{
 const {connectionSync}=await import('./presentation');
 expect(connectionSync(Date.parse('2020-01-01')).kind).toBe('fresh');
 expect(connectionSync(null).kind).toBe('unknown');
 expect(connectionSync(Date.now(),true).kind).toBe('stale');
 expect(connectionSync(Date.now(),false,true).kind).toBe('partial');
 expect(connectionSync(Date.now(),false,false,false).label).toBe('Offline');
});
