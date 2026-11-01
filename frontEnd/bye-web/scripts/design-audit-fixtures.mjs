// Deterministic read-only fixtures. No authentication or API writes.
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {writeFile,mkdir} from 'node:fs/promises';
const out='/tmp/bye-design-audit';await mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {Plan}=await server.ssrLoadModule('/src/Plan.tsx');
 const {Owner}=await server.ssrLoadModule('/src/Owner.tsx');
 const {CodeInput}=await server.ssrLoadModule('/src/CodeInput.tsx');
 const {SeatAvailability}=await server.ssrLoadModule('/src/Schedule.tsx');
 const {WaHeader,WaBottomNav}=await server.ssrLoadModule('/src/WaShell.tsx');
 const e=React.createElement;
 const section=(id,course,days,start,end,format_code='LEC')=>({id,course_id:course,code:course,title:'Audit fixture',units:3,instructors:[{id:'test',name:'Example Instructor'}],meetings:[{days,start_time:start,end_time:end,start_date:'2027-01-04',end_date:'2027-02-11',format_code,format:format_code==='LAB'?'Lab':'Lecture',room:'308',building:null,timezone:'America/Los_Angeles'}]});
 const sections=[section('10889','MATH 005B',[1,3],'09:00','11:00'),section('10890','CS 003A',[1,3],'10:00','12:00','LAB'),section('10891','HIST 001',[],null,null,'OD'),section('10892','ENG 001',[],null,null,'TBA')];
 const week={school_id:'pcc',term_id:'202710',sections,study:{'MATH 005B':2.5,'CS 003A':4},weekend:false};
 const store={missing:[],value:{plans:[week],version:1,revision:1,updated_at:null},plans:[week],draft:null,error:'',busy:false,conflict:false,reload:async()=>{},persist:async()=>true};
 const shell=(body,path='/plan')=>e(React.Fragment,null,e(WaHeader,{term:'Winter 2027',path,status:null}),e('main',{className:'app'},body),e(WaBottomNav,{path}));
 const wrap=body=>'<!doctype html><html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="http://localhost:5173/src/wa-tokens.css"><link rel="stylesheet" href="http://localhost:5173/src/wa.css"><body>'+render(body)+'</body></html>';
 const fixtures={plan:shell(e(Plan,{store,school:'pcc',term:'202710',terms:[{id:'202710',name:'Winter 2027'},{id:'202730',name:'Spring 2027'}],onTerm:()=>{}})),'plan-failed':shell(e(Plan,{store:{...store,draft:[week],error:'Could not save. Your changes are unsaved.'},school:'pcc',term:'202710',onTerm:()=>{}})),owner:shell(e(Owner,{member:{role:'owner'},login:null,onLock:async()=>{}}),'/owner'),unlock:e('main',{className:'app unlock-screen'},e('div',{className:'access'},e('h1',null,'Welcome to BYE.'),...['idle','verify','wrong','locked'].map(phase=>e(CodeInput,{key:phase,id:'code-'+phase,value:'ABCD-EFGH',onChange:()=>{},phase,secondsLeft:30}))))};
 fixtures.meters=shell(e('div',{className:'report'},...[['open',12,'O',0],['nearly-full',29,'O',3],['full',30,'C',7],['unknown',null,null,null]].map(([name,enrolled,status,wait])=>e('article',{key:name,className:'section-card'},e('div',null,e('h3',null,name)),e(SeatAvailability,{section:{availability:{enrolled,capacity:30,seats_open:enrolled===null?null:30-enrolled,source_status:status,waitlist_count:wait,waitlist_capacity:7,as_of:'2026-11-01T08:00:00Z'}}})))));
 for(const [name,node] of Object.entries(fixtures))await writeFile(out+'/'+name+'.html',wrap(node));
}finally{await server.close()}
