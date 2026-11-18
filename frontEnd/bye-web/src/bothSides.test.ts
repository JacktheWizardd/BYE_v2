import {expect,it} from 'vitest';
import {bothSides,reviewTime,sideOf,themesMessage,rememberThemes,rememberedThemes,clearThemes,themesKey} from './bothSides';
const now=Date.UTC(2026,10,17);
const review=(id:string,rating:number|null,date:string|null,extra:object={})=>({id,text:id,date,course:'MATH5A',rating,difficulty:3,...extra});
it('reads RMP date strings without relying on Date.parse',()=>{expect(reviewTime('2026-11-04 12:01:45 +0000 UTC')).toBe(Date.UTC(2026,10,4));expect(reviewTime(null)).toBeNull();expect(reviewTime('yesterday')).toBeNull()});
it('puts 1–2 on the critical side, 4–5 on the positive side and leaves 3 and unrated out',()=>{expect([1,2,3,4,5,null].map(sideOf)).toEqual(['critical','critical','mixed','positive','positive',null])});
it('separates the recent average from the lifetime rating and flags a large gap',()=>{
 const rows=[review('a',1,'2026-11-04 00:00:00 +0000 UTC'),review('b',2,'2026-09-05 00:00:00 +0000 UTC'),review('c',2,'2025-12-22 00:00:00 +0000 UTC'),review('d',5,'2022-08-30 00:00:00 +0000 UTC'),review('e',5,'2021-12-02 00:00:00 +0000 UTC'),review('f',null,'2026-01-01 00:00:00 +0000 UTC')];
 const view=bothSides(rows,4,now);
 expect(view).toMatchObject({total:6,rated:5,average:3,recent:{average:1.7,count:3},trend:'lower',mixed:0});
 expect(bothSides(rows,2,now).trend).toBeNull();
 expect(bothSides(rows.slice(3),4,now).recent).toBeNull();
 expect(bothSides(rows,null,now).trend).toBeNull();
});
it('counts grades, tags and would-retake per side and shows the newest three as written',()=>{
 const rows=[review('old',1,'2019-01-01',{grade:'D+',tags:['Tough grader'],would_take_again:false}),review('n1',2,'2026-03-01',{grade:'Drop/Withdrawal',tags:['Tough grader','Test heavy']}),review('n2',1,'2026-02-01',{grade:'Drop/Withdrawal'}),review('n3',2,'2026-01-01'),review('mid',3,'2026-01-01'),review('fan',5,null,{grade:'A',would_take_again:true,tags:['Caring']})];
 const view=bothSides(rows,null,now);
 expect(view.critical).toMatchObject({count:4,grades:[{label:'Drop/Withdrawal',count:2},{label:'D+',count:1}],tags:[{label:'Tough grader',count:2},{label:'Test heavy',count:1}],retake:{yes:0,no:1}});
 expect(view.critical.latest.map(r=>r.id)).toEqual(['n1','n2','n3']);
 expect(view.positive).toMatchObject({count:1,grades:[{label:'A',count:1}],retake:{yes:1,no:0}});
 expect(view.mixed).toBe(1);
});
it('tolerates cached reviews from before grades and tags were stored',()=>{const view=bothSides([{id:'x',text:'t',date:null,course:null,rating:1,difficulty:null}],null,now);expect(view.critical).toMatchObject({count:1,grades:[],tags:[],retake:{yes:0,no:0}})});
it('keeps generated themes in memory only and explains each failure plainly',()=>{
 const key=themesKey('pcc','1','42','MATH5A');rememberThemes(key,{state:'insufficient',basis:{filter:'MATH5A',complete:true,source_records:2,reviews:2,critical:1,mixed:0,positive:1}});
 expect(rememberedThemes(key)?.state).toBe('insufficient');expect(rememberedThemes(themesKey('pcc','1','42',''))).toBeUndefined();clearThemes();expect(rememberedThemes(key)).toBeUndefined();
 expect(themesMessage('themes_limited','x')).toContain('tomorrow');expect(themesMessage('themes_not_configured','x')).toContain('not set up');expect(themesMessage(undefined,'Network down')).toBe('Network down');
});
