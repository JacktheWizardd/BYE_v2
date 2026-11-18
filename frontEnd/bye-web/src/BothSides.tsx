import React,{useEffect,useRef,useState} from 'react';
import {api,ApiError} from './api';
import {bothSides,rememberThemes,rememberedThemes,themesKey,themesMessage,RECENT_MONTHS,type SideReview,type SideStats,type Tally,type Theme,type Themes} from './bothSides';

const tallies=(rows:Tally[])=>rows.map(t=>`${t.label} ×${t.count}`).join(' · ');
const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;

function Column<T extends SideReview>({title,range,stats,renderReview}:{title:string,range:string,stats:SideStats<T>,renderReview:(r:T)=>React.ReactNode}){
 return <div className="sides-column">
  <h4>{title} <small>{range}</small><b>{stats.count}</b></h4>
  {stats.count===0?<p className="help">None among the loaded reviews.</p>:<>
   <dl>
    <dt>Grades reported</dt><dd>{stats.grades.length?tallies(stats.grades):'Not reported'}</dd>
    <dt>Tags chosen</dt><dd>{stats.tags.length?tallies(stats.tags):'None'}</dd>
    <dt>Would retake</dt><dd>{stats.retake.yes+stats.retake.no?`Yes ${stats.retake.yes} · No ${stats.retake.no}`:'Not answered'}</dd>
   </dl>
   <p className="sides-latest">Most recent, as written</p>
   {stats.latest.map(r=><React.Fragment key={r.id}>{renderReview(r)}</React.Fragment>)}
  </>}
 </div>;
}

function ThemeList<T extends SideReview>({title,items,byId,renderReview}:{title:string,items:Theme[],byId:Map<string,T>,renderReview:(r:T)=>React.ReactNode}){
 return <div className="themes-list"><h5>{title}</h5>{items.length===0?<p className="help">Nothing repeated by two or more reviews.</p>:<ul>{items.map((item,i)=>{
  const loaded=item.review_ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]),missing=item.review_ids.length-loaded.length;
  return <li key={i}><details><summary>{item.text} <span>{plural(item.review_ids.length,'review')}</span></summary>{loaded.map(r=><React.Fragment key={r.id}>{renderReview(r)}</React.Fragment>)}{missing>0&&<p className="help">{plural(missing,'supporting review')} not loaded on this page. Use “Load more reviews” below to see {missing===1?'it':'them'}.</p>}</details></li>})}</ul>}</div>;
}

export function BothSides<T extends SideReview>({school,id,profileId,lifetime,reviews,filter,scope,hasMore,endpoint,renderReview}:{school:string,id:string,profileId:string,lifetime:number|null,reviews:T[],filter:string,scope:string,hasMore:boolean,endpoint:string,renderReview:(r:T)=>React.ReactNode}){
 const key=themesKey(school,id,profileId,filter);
 const [themes,setThemes]=useState<Themes|undefined>(()=>rememberedThemes(key)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const control=useRef<AbortController|null>(null);
 useEffect(()=>{setThemes(rememberedThemes(key));setError('');setBusy(false);return()=>control.current?.abort()},[key]);
 if(!reviews.length)return null;
 const view=bothSides(reviews,lifetime),byId=new Map(reviews.map(r=>[r.id,r]));
 async function summarise(){
  control.current?.abort();const mine=control.current=new AbortController();setBusy(true);setError('');
  try{const d=(await api<{data:Themes}>(endpoint+'/themes',mine.signal,{profile_id:profileId,filter})).data;if(mine.signal.aborted)return;rememberThemes(key,d);setThemes(d)}
  catch(e){if(!mine.signal.aborted)setError(themesMessage(e instanceof ApiError?e.code:undefined,(e as Error).message))}
  finally{if(!mine.signal.aborted)setBusy(false)}
 }
 return <section className="both-sides" aria-label="Both sides of the reviews">
  <div className="review-heading"><h3><span lang="ja">両面</span> Both sides</h3><span>Counted from {plural(view.total,'loaded review')} · {scope}</span></div>
  <div className="stats sides-tiles">
   <div className="rmp-tile"><span>Loaded</span><p><b>{view.average??'—'}</b><small>/5</small></p><span>{plural(view.rated,'rating')}</span></div>
   <div className="rmp-tile"><span>Last {RECENT_MONTHS} mo.</span><p><b>{view.recent?.average??'—'}</b><small>/5</small></p><span>{view.recent?plural(view.recent.count,'rating'):'Too few to average'}</span></div>
   <div className="rmp-tile"><span>Lifetime</span><p><b>{lifetime??'—'}</b><small>/5</small></p><span>All courses</span></div>
  </div>
  {view.trend&&<p className={'sides-trend is-'+view.trend}>Recent reviews here average {view.recent!.average}, {view.trend} than the lifetime {lifetime}. The headline rating may not describe the class as it is taught now.</p>}
  {hasMore&&<p className="help">More reviews exist for this filter. These counts cover only what is loaded; “Load more reviews” below widens them.</p>}
  <div className="sides-columns">
   <Column title="Critical" range="rated 1–2" stats={view.critical} renderReview={renderReview}/>
   <Column title="Positive" range="rated 4–5" stats={view.positive} renderReview={renderReview}/>
  </div>
  <p className="help">{view.mixed?plural(view.mixed,'review')+' rated 3 sit in between and are listed with the originals below.':'No reviews rated 3 among those loaded.'}</p>
  <div className="themes">
   <div className="themes-head"><h4>Repeated points <span className="tag">AI summary</span></h4><button className="button" disabled={busy} onClick={()=>void summarise()}>{busy?'Summarising…':themes?'Summarise again':'Summarise repeated points'}</button></div>
   {!themes&&!error&&!busy&&<p className="help">Optional. Sends the review text for this filter (no account or personal data) to an AI model and lists only points that two or more reviews make.</p>}
   {error&&<p role="alert">{error}</p>}
   {themes?.state==='insufficient'&&<p className="help">Only {plural(themes.basis.reviews,'written review')} for this filter, which is too few to call anything a repeated point. Read them directly below.</p>}
   {themes?.state==='ready'&&<>
    <ThemeList title="Critics repeat" items={themes.critics??[]} byId={byId} renderReview={renderReview}/>
    <ThemeList title="Critics still credit" items={themes.conceded??[]} byId={byId} renderReview={renderReview}/>
    <ThemeList title="Fans repeat" items={themes.fans??[]} byId={byId} renderReview={renderReview}/>
    <p className="help">Written by AI ({themes.model}) from {plural(themes.basis.reviews,'review')}: {themes.basis.critical} critical, {themes.basis.mixed} mixed, {themes.basis.positive} positive{themes.basis.complete?'':' (first 100 records only)'}{themes.checked_at?' · '+new Date(themes.checked_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}. It can miss or misread a point. Open a point to check it against the reviews behind it.</p>
   </>}
  </div>
 </section>;
}
