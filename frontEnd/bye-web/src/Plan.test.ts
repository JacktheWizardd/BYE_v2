import {expect,it,vi} from 'vitest';vi.mock('./api',()=>({api:vi.fn(),ApiError:class extends Error{}}));import {layoutMeetings,conflicts,hours,backup,parseBackup,type Entry} from './Plan';
const entry=(id:string,start:string,end:string,date='2027-01-01'):Entry=>({id,course_id:'math',code:'MATH',title:'Math',units:3,instructors:[],meetings:[{days:[1],start_time:start,end_time:end,start_date:date,end_date:date,timezone:'America/Los_Angeles',format:'Lecture',room:null,building:null}]});
it('checks meeting times and dates, allowing touching endpoints',()=>{const a=entry('12345','09:00','10:00');expect(conflicts(a,entry('12346','09:30','10:30'))).toBe(true);expect(conflicts(a,entry('12346','10:00','11:00'))).toBe(false);expect(conflicts(a,entry('12346','09:30','10:30','2027-02-01'))).toBe(false);expect(hours(a)).toBe(1)});
it('round trips semesters and rejects invalid versions and duplicates',()=>{const plans=[{school_id:'pcc',term_id:'202730',sections:[entry('12345','09:00','10:00')],study:{math:2.5},weekend:false}];expect(parseBackup(backup(plans))).toEqual(plans);expect(()=>parseBackup('{"format":"other"}')).toThrow();expect(()=>parseBackup('{"format":"bye-backup","version":2}')).toThrow();expect(()=>parseBackup(backup([...plans,...plans]))).toThrow()});

it('assigns separate lanes to three concurrent meetings',()=>{const rows=layoutMeetings([entry('12345','09:00','11:00'),entry('12346','09:30','10:30'),entry('12347','10:00','12:00')],1);expect(rows.map(r=>r.lane)).toEqual([0,1,2]);expect(rows.every(r=>r.lanes===3)).toBe(true)});
it('rejects nested private fields and malformed meetings before import preview',()=>{const p={school_id:'pcc',term_id:'202730',sections:[{...entry('12345','09:00','10:00'),access_token:'private'}],study:{},weekend:false};expect(()=>parseBackup(backup([p] as any))).toThrow();expect(()=>parseBackup('null')).toThrow()});

import {removePlannedSection} from './Plan';
it('Undo removes only the added section and cleans its orphan study estimate',()=>{
 const first=entry('12345','09:00','10:00'),second={...entry('12346','11:00','12:00'),course_id:'english'};
 const plan={school_id:'pcc',term_id:'202670',sections:[first,second],study:{math:2,english:3},weekend:true};
 const other={...plan,term_id:'202730'};
 const result=removePlannedSection([plan,other],'pcc','202670','12345');
 expect(result[0].sections).toEqual([second]);expect(result[0].study).toEqual({english:3});expect(result[1]).toBe(other);
 const sibling={...first,id:'12347'};
 expect(removePlannedSection([{...plan,sections:[first,sibling]}],'pcc','202670','12345')[0].study.math).toBe(2);
});
