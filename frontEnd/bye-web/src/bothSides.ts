// Both sides of a professor's reviews, computed from the loaded source reviews.
// Everything here is counting: no wording is generated in the browser.
export type SideReview={id:string,text:string,date:string|null,course:string|null,rating:number|null,difficulty:number|null,grade?:string|null,would_take_again?:boolean|null,tags?:string[]};
export type Side='critical'|'mixed'|'positive';
export type Tally={label:string,count:number};
export type SideStats<T>={count:number,grades:Tally[],tags:Tally[],retake:{yes:number,no:number},latest:T[]};
export type BothSides<T>={total:number,rated:number,average:number|null,recent:{average:number,count:number}|null,critical:SideStats<T>,positive:SideStats<T>,mixed:number,trend:'lower'|'higher'|null};
export type Theme={text:string,review_ids:string[]};
export type Themes={state:'ready'|'insufficient',basis:{filter:string|null,complete:boolean,source_records:number,reviews:number,critical:number,mixed:number,positive:number},critics?:Theme[],conceded?:Theme[],fans?:Theme[],model?:string,checked_at?:string,stale?:boolean};

export const RECENT_MONTHS=24;
// A gap this large between recent and lifetime ratings is worth pointing at.
export const TREND_GAP=0.7;
const MIN_RECENT=3;

export const sideOf=(rating:number|null):Side|null=>rating==null?null:rating<=2?'critical':rating>=4?'positive':'mixed';

// RMP dates look like "2026-11-04 12:01:45 +0000 UTC", which not every browser's Date.parse accepts.
export function reviewTime(date:string|null):number|null{
 const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(date??'');if(!m)return null;
 const t=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));return Number.isFinite(t)?t:null;
}
const round=(n:number)=>Math.round(n*10)/10;
const mean=(values:number[])=>values.length?round(values.reduce((a,b)=>a+b,0)/values.length):null;
function tally(values:string[],limit:number):Tally[]{
 const counts=new Map<string,number>();for(const v of values)counts.set(v,(counts.get(v)??0)+1);
 return [...counts].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,limit);
}
const newestFirst=<T extends SideReview>(rows:T[])=>[...rows].sort((a,b)=>(reviewTime(b.date)??-Infinity)-(reviewTime(a.date)??-Infinity));

function side<T extends SideReview>(rows:T[]):SideStats<T>{
 return {count:rows.length,grades:tally(rows.flatMap(r=>r.grade?[r.grade]:[]),4),tags:tally(rows.flatMap(r=>r.tags??[]),4),
  retake:{yes:rows.filter(r=>r.would_take_again===true).length,no:rows.filter(r=>r.would_take_again===false).length},latest:newestFirst(rows).slice(0,3)};
}

export function bothSides<T extends SideReview>(reviews:T[],lifetime:number|null,now=Date.now()):BothSides<T>{
 const rated=reviews.filter(r=>r.rating!=null),since=new Date(now);since.setUTCMonth(since.getUTCMonth()-RECENT_MONTHS);
 const recentRows=rated.filter(r=>{const t=reviewTime(r.date);return t!=null&&t>=since.getTime()});
 const recentAverage=recentRows.length>=MIN_RECENT?mean(recentRows.map(r=>r.rating!)):null;
 const recent=recentAverage==null?null:{average:recentAverage,count:recentRows.length};
 const gap=recent&&lifetime!=null?recent.average-lifetime:0;
 return {total:reviews.length,rated:rated.length,average:mean(rated.map(r=>r.rating!)),recent,
  critical:side(rated.filter(r=>sideOf(r.rating)==='critical')),positive:side(rated.filter(r=>sideOf(r.rating)==='positive')),
  mixed:rated.filter(r=>sideOf(r.rating)==='mixed').length,trend:gap<=-TREND_GAP?'lower':gap>=TREND_GAP?'higher':null};
}

// Generated themes stay in memory for the session only, like review bodies.
const themes=new Map<string,Themes>();
export const themesKey=(school:string,id:string,profile:string,filter:string)=>[school,id,profile,filter].join('\n');
export const rememberedThemes=(key:string)=>themes.get(key);
export function rememberThemes(key:string,value:Themes){themes.set(key,value);if(themes.size>50)themes.delete(themes.keys().next().value!)}
export function clearThemes(){themes.clear()}
export function themesMessage(code:string|undefined,fallback:string){
 return code==='themes_limited'?'Today’s AI summary limit is used up. Try again tomorrow.':code==='themes_not_configured'?'AI summaries are not set up on this server. The counts and reviews here are unaffected.':code==='themes_unavailable'?'The AI summary could not be produced just now. The counts and reviews here are unaffected.':code==='themes_disabled'?'AI summaries are switched off.':fallback;
}
