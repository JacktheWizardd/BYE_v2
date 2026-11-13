import React from 'react';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn(),ApiError:class extends Error{}}));
import {Plan,WATCH_LIMIT,type Entry,type Week} from './Plan';
import {Watches,watchSection,unwatchSection,promoteWatched,dropWatch,watchingOf,weekOf,fitOf,fitText,meetingLine} from './Watches';

const meeting=(days:number[],start:string|null,end:string|null,format_code='L')=>({days,start_time:start,end_time:end,start_date:'2027-01-04',end_date:'2027-05-14',timezone:'America/Los_Angeles',format:format_code==='OD'?'Online':'Lecture',format_code,room:'308',building:'R'});
const entry=(id:string,code:string,days:number[],start:string|null,end:string|null,format_code='L'):Entry=>({id,course_id:code,code,title:code+' title',units:4,instructors:[{id:'i-'+id,name:'Prof. '+id,provisional:false}],meetings:[meeting(days,start,end,format_code)]});
const math=entry('30421','MATH 005B',[1,3],'09:00','10:25'),phys=entry('31188','PHYS 004A',[1,3],'09:45','11:10'),cs=entry('31560','CS 011',[2,4],'14:15','15:40');
const week=(over:Partial<Week>={}):Week=>({school_id:'pcc',term_id:'202730',sections:[math],study:{'MATH 005B':3},weekend:false,...over});
const storeFor=(plans:Week[],over={})=>({missing:[] as string[],value:{version:1,revision:3,updated_at:null,plans},plans,draft:null,error:'',busy:false,conflict:false,reload:vi.fn(),persist:vi.fn(),...over});
const terms=[{id:'202710',name:'Winter 2027'},{id:'202730',name:'Spring 2027'}] as any;

it('tags sections in the order chosen and leaves the Plan and other semesters alone',()=>{
 const other=week({term_id:'202710'}),start=[other,week()];
 const one=watchSection(start,'pcc','202730',phys),two=watchSection(one,'pcc','202730',cs);
 const now=weekOf(two,'pcc','202730');
 expect(now.watching!.map(s=>s.id)).toEqual(['31188','31560']);expect(now.sections).toEqual([math]);expect(now.study).toEqual({'MATH 005B':3});
 expect(two.find(p=>p.term_id==='202710')).toBe(other);
 // Tagging twice, or tagging a section already in the Plan, changes nothing.
 expect(watchSection(two,'pcc','202730',phys)).toBe(two);expect(watchSection(two,'pcc','202730',math)).toBe(two);
 // A semester with no saved week yet gets one.
 expect(weekOf(watchSection([],'pcc','202730',phys),'pcc','202730')).toEqual({school_id:'pcc',term_id:'202730',sections:[],study:{},weekend:false,watching:[phys]});
});
it('stops at the server’s limit with a message the student can act on',()=>{
 const full=[week({watching:Array.from({length:WATCH_LIMIT},(_,i)=>entry(String(20000+i),'HIST 001',[5],'08:00','09:00'))})];
 expect(()=>watchSection(full,'pcc','202730',phys)).toThrow('Untag one first');
});
it('untagging removes only that tag and drops the empty list from what is saved',()=>{
 const start=[week({watching:[phys,cs]})],one=unwatchSection(start,'pcc','202730','31188');
 expect(weekOf(one,'pcc','202730').watching).toEqual([cs]);
 const none=weekOf(unwatchSection(one,'pcc','202730','31560'),'pcc','202730');
 expect('watching' in none).toBe(false);expect(none.sections).toEqual([math]);
 expect(unwatchSection(start,'pcc','202730','99999')).toBe(start);expect(unwatchSection(start,'pcc','202710','31188')).toBe(start);
 const w=week({watching:[phys]});expect(dropWatch(w,'99999')).toBe(w);expect('watching' in dropWatch(w,'31188')).toBe(false);
});
it('adding a watched section to the Plan moves it and never adds anything else',()=>{
 const start=[week({watching:[phys,cs]})],next=weekOf(promoteWatched(start,'pcc','202730','31560'),'pcc','202730');
 expect(next.sections.map(s=>s.id)).toEqual(['30421','31560']);expect(next.watching).toEqual([phys]);expect(next.study).toEqual({'MATH 005B':3});
 expect(promoteWatched(start,'pcc','202730','30421')).toBe(start);
 // Already in the Plan and still tagged: the tag goes, the Plan keeps one copy.
 const both=weekOf(promoteWatched([week({watching:[math]})],'pcc','202730','30421'),'pcc','202730');
 expect(both.sections).toEqual([math]);expect('watching' in both).toBe(false);
});
it('shows a tagged section once it is not already in the Plan',()=>{
 expect(watchingOf(week({watching:[math,phys]}))).toEqual([phys]);expect(watchingOf(week())).toEqual([]);
});
it('says how a watched section sits against the Plan and never calls an unknown schedule a fit',()=>{
 expect(fitOf(phys,[math])).toEqual({kind:'clash',with:['MATH 005B']});expect(fitText(fitOf(phys,[math]))).toBe('Clashes with MATH 005B');
 expect(fitOf(cs,[math])).toEqual({kind:'fits'});expect(fitText({kind:'fits'})).toBe('Fits your Plan');
 // Same times in different weeks of the semester do not clash.
 const late={...phys,meetings:[{...phys.meetings[0],start_date:'2027-06-01',end_date:'2027-07-01'}]};expect(fitOf(late,[math]).kind).toBe('fits');
 const online=entry('32001','HIST 001',[],null,null,'OD');expect(fitOf(online,[math])).toEqual({kind:'async'});expect(fitText({kind:'async'})).toContain('Online / async');
 const unannounced=entry('32002','ENGL 001B',[],null,null,'L');expect(fitOf(unannounced,[math])).toEqual({kind:'unknown'});expect(fitText({kind:'unknown'})).toContain('can’t check');
 expect(fitOf({...unannounced,meetings:[]},[math]).kind).toBe('unknown');
 // A lecture with a set time plus an online part fits; a set time plus an unannounced part stays unknown.
 expect(fitOf({...cs,meetings:[...cs.meetings,meeting([],null,null,'OD')]},[math]).kind).toBe('fits');
 expect(fitOf({...cs,meetings:[...cs.meetings,meeting([],null,null,'L')]},[math]).kind).toBe('unknown');
 // A known clash is reported even when another meeting is unannounced, and each class is named once.
 expect(fitOf({...phys,meetings:[...phys.meetings,meeting([],null,null,'L')]},[math,{...math,id:'30425'}])).toEqual({kind:'clash',with:['MATH 005B']});
 expect(fitOf(math,[math]).kind).toBe('fits');
});
it('writes meeting days and times in English',()=>{
 expect(meetingLine(phys)).toBe('Mon Wed 9:45 AM–11:10 AM');
 expect(meetingLine({...phys,meetings:[...phys.meetings,meeting([5],'09:00','11:50'),meeting([],null,null,'OD')]})).toBe('Mon Wed 9:45 AM–11:10 AM · Fri 9:00 AM–11:50 AM');
 expect(meetingLine(entry('32001','HIST 001',[],null,null,'OD'))).toBe('');
});
it('draws watched sections dotted beside the Plan and lists them with their fit',()=>{
 const plans=[week({watching:[phys,cs]})],html=renderToStaticMarkup(<Watches store={storeFor(plans)} school="pcc" term="202730" terms={terms} onTerm={vi.fn()}/>);
 expect(html).toContain('aria-label="Watches semester"');expect(html).toContain('Spring 2027');
 expect(html).toContain('<b>1</b> in Plan · <b>2</b> watching');expect(html).toContain('<strong>1 clash with your Plan</strong>');
 // The phone timeline shows Monday (MATH solid, PHYS dotted); the desktop week adds MATH and PHYS on Mon and Wed, CS on Tue and Thu.
 expect(html.match(/class="plan-block watching/g)).toHaveLength(1+2+2);expect(html.match(/class="plan-block (?!watching)/g)).toHaveLength(1+2);
 expect(html).toContain('<em class="watch-flag">Watching</em>');expect(html).toContain('title="Watching · PHYS 004A');
 expect(html).toContain('Watching · 2');expect(html).toContain('Clashes with MATH 005B');expect(html).toContain('Fits your Plan');
 expect(html).toContain('Prof. 31188 · CRN 31188');expect(html).toContain('Mon Wed 9:45 AM–11:10 AM');
 expect(html).toContain('aria-label="Add PHYS 004A · CRN 31188 to Plan"');expect(html).toContain('aria-label="Untag CS 011 · CRN 31560"');
 expect(html).toContain('href="#/report/i-31188?school=pcc&amp;term=202730&amp;course=PHYS+004A');
 // Watched hours are shown apart from the Plan's hours for the day.
 expect(html).toContain('<small>1.4 h</small><small class="watch-extra">+1.4 h</small>');
 expect(html.indexOf('PHYS 004A title')).toBeLessThan(html.indexOf('CS 011 title'));
});
it('explains the empty state, shows a watched weekend class and locks actions while the Plan is busy or stale',()=>{
 const empty=renderToStaticMarkup(<Watches store={storeFor([week()])} school="pcc" term="202730" terms={terms} onTerm={vi.fn()}/>);
 expect(empty).toContain('Nothing watched for Spring 2027 yet.');expect(empty).toContain('href="#/search"');expect(empty).not.toContain('plan-block watching');expect(empty).not.toContain('aria-label="Saturday"');
 const sat=entry('33001','KIN 010',[6],'10:00','12:00'),plans=[week({watching:[sat]})];
 const html=renderToStaticMarkup(<Watches store={storeFor(plans,{conflict:true,missing:['pcc:202730:33001'],error:'Your Plan changed in another tab. Reload before saving.'})} school="pcc" term="202730" terms={terms} onTerm={vi.fn()}/>);
 expect(html).toContain('aria-label="Saturday"');expect(html).not.toContain('aria-label="Sunday"');
 expect(html).toContain('No longer listed by PCC · saved snapshot');expect(html).toContain('role="alert"');
 expect(html.match(/<button[^>]*disabled=""[^>]*>(Add to Plan|Untag)/g)).toHaveLength(2);
 expect(html).not.toContain('clash with your Plan');expect(html).not.toContain('clashes with your Plan');
});
it('keeps watched sections off the Plan screen and out of its CRN list',()=>{
 const html=renderToStaticMarkup(<Plan store={storeFor([week({watching:[phys,cs]})])} school="pcc" term="202730" terms={terms} onTerm={vi.fn()}/>);
 expect(html).not.toContain('PHYS 004A');expect(html).not.toContain('CS 011');expect(html).not.toContain('watching');expect(html).toContain('Copy 1 CRNs');
});
