import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('./api',()=>({api:vi.fn(),ApiError:class extends Error{status=503;code='themes_unavailable';retryAfter=60}}));
import {BothSides} from './BothSides';import {clearThemes,rememberThemes,themesKey} from './bothSides';
const reviews=[{id:'c1',text:'<b>Exams unlike the guide</b>',date:'2026-11-04 12:01:45 +0000 UTC',course:'MATH5A',rating:1,difficulty:4,grade:'D+',tags:['Tough grader'],would_take_again:false},{id:'c2',text:'Ran out of time',date:'2026-09-05 05:10:54 +0000 UTC',course:'MATH5A',rating:2,difficulty:4},{id:'c3',text:'Hard quizzes',date:'2025-12-22 00:00:00 +0000 UTC',course:'MATH5A',rating:2,difficulty:3},{id:'p1',text:'Clear lectures',date:'2022-08-30 00:00:00 +0000 UTC',course:'MATH5A',rating:5,difficulty:3,grade:'A',would_take_again:true}];
const render=(extra:object={})=>renderToStaticMarkup(React.createElement(BothSides<typeof reviews[number]>,{school:'pcc',id:'1',profileId:'42',lifetime:4,reviews,filter:'MATH5A',scope:'MATH 005A (this class)',hasMore:false,endpoint:'/schools/pcc/instructors/1/rmp',renderReview:r=>React.createElement('article',{className:'rmp-review'},r.text),...extra}));
beforeEach(()=>clearThemes());
it('shows both sides with counts, the recent-versus-lifetime gap and originals as inert text',()=>{
 const html=render();
 expect(html).toContain('Counted from 4 loaded reviews · MATH 005A (this class)');
 expect(html).toContain('lower than the lifetime 4');
 expect(html).toContain('D+ ×1');expect(html).toContain('Yes 0 · No 1');expect(html).toContain('Yes 1 · No 0');
 expect(html).toContain('&lt;b&gt;Exams unlike the guide&lt;/b&gt;');expect(html).not.toContain('<b>Exams');
 expect(html).toContain('Summarise repeated points');expect(html).not.toContain('Written by AI');
});
it('says when counts cover only part of the reviews and renders nothing without reviews',()=>{expect(render({hasMore:true})).toContain('These counts cover only what is loaded');expect(render({reviews:[]})).toBe('')});
it('labels generated themes as AI, with their basis and the reviews behind each point',()=>{
 rememberThemes(themesKey('pcc','1','42','MATH5A'),{state:'ready',model:'claude-haiku-5-5',checked_at:'2026-11-17T00:00:00Z',basis:{filter:'MATH5A',complete:false,source_records:100,reviews:90,critical:30,mixed:10,positive:50},critics:[{text:'Exams are harder than the study guides.',review_ids:['c1','c2','zz']}],conceded:[],fans:[]});
 const html=render();
 expect(html).toContain('Exams are harder than the study guides.');expect(html).toContain('3 reviews');
 expect(html).toContain('1 supporting review not loaded on this page');
 expect(html).toContain('Written by AI (claude-haiku-5-5) from 90 reviews: 30 critical, 10 mixed, 50 positive (first 100 records only)');
 expect(html).toContain('Nothing repeated by two or more reviews.');
});
