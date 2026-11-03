// Shared deterministic checks. Source text is data; unsupported rules stay unknown.
export const alias=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/([a-z])0+(\d)/g,'$1$2');
export const plain=s=>String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/g,"'").replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim();
export const entries=plan=>(plan?.terms??[]).flatMap(t=>t.entries.map(e=>({...e,term:t})));
export function termKey(t){const season=t.label.match(/\b(winter|spring|summer|fall|autumn)\b/i)?.[1]?.toLowerCase();return Number.isInteger(t.year)&&season?`${t.year}-${({winter:1,spring:2,summer:3,fall:4,autumn:4})[season]}`:null;}
export function parseRule(raw,kind='before'){
 let text=plain(raw).toUpperCase();if(!text)return null;
 if(/ENROLLMENT IN OR COMPLETION OF|COMPLETION OF OR CONCURRENT ENROLLMENT|PRIOR OR CONCURRENT/.test(text))kind='either';
 text=text.replace(/ENROLLMENT IN OR COMPLETION OF|COMPLETION OF OR CONCURRENT ENROLLMENT|PRIOR OR CONCURRENT ENROLLMENT IN|ENROLLMENT IN|COMPLETION OF|WITH (?:A )?GRADE OF (?:"?C"?|BETTER)(?: OR BETTER)?|GRADE OF C OR BETTER/gi,' ').replace(/[.;]$/,'').trim();
 // Subject inheritance applies only within this rule, never between courses.
 let subject='';text=text.replace(/\b((?!(?:AND|OR)\b)[A-Z]{2,8})\s+([A-Z]?\d{1,4}[A-Z]{0,3})\b|\b([A-Z]?\d{1,4}[A-Z]{0,3})\b/g,(all,s,n,short)=>{if(s){subject=s;return `${s}_${n}`}return subject?`${subject}_${short}`:all});
 const tokens=text.match(/[A-Z]{2,8}_[A-Z]?\d{1,4}[A-Z]{0,3}|AND|OR|\(|\)|[^\s]+/g)??[];let i=0;
 function atom(){const token=tokens[i++];if(token==='('){const n=or();if(tokens[i++]!==')')throw Error();return n}if(!/^[A-Z]{2,8}_[A-Z]?\d{1,4}[A-Z]{0,3}$/.test(token??''))throw Error();return {op:'course',code:token.replace('_',' ')}}
 function and(){const args=[atom()];while(tokens[i]==='AND'){i++;args.push(atom())}return args.length===1?args[0]:{op:'and',args}}
 function or(){const args=[and()];while(tokens[i]==='OR'){i++;args.push(and())}return args.length===1?args[0]:{op:'or',args}}
 try{const tree=or();if(i!==tokens.length)throw Error();return {kind,raw:plain(raw),tree}}catch{return {kind,raw:plain(raw),tree:null}}
}
export function parseCatalog(html,url,hash){
 const year=plain(html).match(/\b(20\d{2})[–-](20\d{2}) Academic Catalog/)?.[0]?.replace(' Academic Catalog','')??null,courses={};
 for(const block of html.split(/<div class="courseblock">/).slice(1)){
  const field=name=>plain(block.match(new RegExp('<span[^>]*class="[^"]*'+name+'[^\"]*"[^>]*>([\\s\\S]*?)</span>','i'))?.[1]??'');
  const code=field('detail-code_html');if(!/^[A-Z]{2,8}\s+[A-Z]?\d{1,4}[A-Z]{0,3}$/.test(code))continue;
  const rules=[];for(const [label,kind] of [['Prerequisite','before'],['Corequisite','with']]){const raw=plain(block.match(new RegExp('<strong>'+label+'(?:\\(s\\))?:</strong>\\s*<em>([\\s\\S]*?)</em>','i'))?.[1]??'');if(raw)rules.push({...parseRule(raw,kind),id:`${hash}:${alias(code)}:${kind}`})}
  const transfer=plain(block.match(/Transfer Credit:([\s\S]*?)<\/em>/i)?.[1]??'');
  courses[alias(code)]={code,title:field('detail-title'),units:Number(field('detail-hours_html').match(/^\d+(?:\.\d+)?/)?.[0])||null,rules,uc_transferable:/\bUC\b/.test(transfer)&&!(/limit|counselor/i.test(transfer)),transfer_qualified:/limit|counselor/i.test(transfer),source:url,year};
 }return {year,courses};
}
export function parseCalendar(html,url){const dates={};for(const block of html.split(/<h2>/).slice(1)){const heading=plain(block.split('</h2>')[0]),key=heading.match(/(Fall|Winter|Spring|Summer) (20\d{2})/);if(!key)continue;for(const row of block.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>plain(m[1]));if(cells.length!==2||!/^(First|Last) Day of Classes/.test(cells[1])||!/^\w+ \d{1,2}, 20\d{2}$/.test(cells[0]))continue;const d=new Date(cells[0]+' 12:00:00 UTC');if(Number.isNaN(+d))continue;const id=`${key[1].toLowerCase()}-${key[2]}`;(dates[id]??={source:url,estimated:false})[/^First/.test(cells[1])?'start':'end']=d.toISOString().slice(0,10)}}return dates;}
export function parseGe(html,url){const body=html.split('id="calgetctextcontainer"')[1]?.split('id="csugetextcontainer"')[0]??'',areas={};
 for(const match of body.matchAll(/<h[34]>\s*<a[^>]*id="CalGETC(1A|1B|1C|Area2|3A|3B|Area4|5A|5B|5C|Area6)"[^>]*>[\s\S]*?<\/h[34]>([\s\S]*?)(?=<h[234]>|$)/g)){
  const area=match[1].replace('Area','');for(const cell of match[2].matchAll(/<td class="codecol">([\s\S]*?)<\/td>/g)){for(const a of cell[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)){const code=plain(a[1]);if(/^[A-Z]{2,8} [A-Z]?\d{1,4}[A-Z]{0,3}$/.test(code))(areas[alias(code)]??=[]).push(area)}}
 }return {areas,source:url,year:plain(html).match(/20\d{2}[–-]20\d{2} Academic Catalog/)?.[0]?.replace(' Academic Catalog','')??null};}
export function effectiveStatus(e,t,school,overrides=[],calendar={},now=new Date(),sectionDate=null){
 const override=overrides.find(o=>o.entry_id===e.id);if(override)return {status:override.status,source:'student',reason:override.reason};
 if(e.kind!=='course'||!['planned','enrolled'].includes(e.status)||school!=='pasadena-city-college')return {status:e.status,source:e.status_source??'import'};
 const season=t.label.match(/\b(winter|spring|summer|fall|autumn)\b/i)?.[1]?.toLowerCase().replace('autumn','fall');if(!season||!Number.isInteger(t.year))return {status:e.status,source:e.status_source??'import'};
 const exact=calendar[`${season}-${t.year}`],month=({fall:12,winter:2,spring:6,summer:8})[season];const end=sectionDate||exact?.end||new Date(Date.UTC(t.year,month,0)).toISOString().slice(0,10);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return today>end?{status:'completed',source:'auto',end,estimated:!sectionDate&&!exact?.end,calendar:exact?.source??null}:{status:e.status,source:e.status_source??'import'};
}
// Each solution chooses at most one option from a choose-one group.
export function evaluateRule(rule,target,plan,statuses={}){
 if(!rule?.tree||!termKey(target.term))return {state:'call',reason:'The rule or term needs interpretation.'};
 const all=entries(plan).flatMap(e=>e.kind==='alternative'?(e.options??[]).map(o=>({...e,code:o.code,choice:e.id})):e.kind==='course'?[{...e,choice:null}]:[]);
 let wrong=false,unknown=false;function solve(node){if(node.op==='course')return all.filter(e=>alias(e.code)===alias(node.code)&&e.id!==target.id).flatMap(e=>{const status=statuses[e.id]?.status??e.status;if(['not_taken'].includes(status))return [];const a=termKey(e.term),b=termKey(target.term);if(!a||!b||status==='unknown'){unknown=true;return []}const good=rule.kind==='with'?a===b:rule.kind==='either'?a<=b:a<b;if(!good){wrong=true;return []}return [{choices:e.choice?{[e.choice]:alias(e.code)}:{},witness:[{code:e.code,term:e.term.label,choice:!!e.choice}]}]});
 if(node.op==='or')return node.args.flatMap(solve);let result=[{choices:{},witness:[]}];for(const n of node.args){const next=solve(n);result=result.flatMap(a=>next.filter(b=>Object.keys(b.choices).every(k=>!a.choices[k]||a.choices[k]===b.choices[k])).map(b=>({choices:{...a.choices,...b.choices},witness:[...a.witness,...b.witness]}))).slice(0,200)}return result;}
 const solutions=solve(rule.tree);return solutions.length?{state:'ready',witness:solutions[0].witness}:{state:unknown?'call':wrong?'order':'missing',reason:unknown?'Completion or term is unknown.':wrong?'Required classes are in a different term order.':'A required course is missing.'};
}
export function allocateAreas(plan,classifications,statuses={}){
 const pool=[...new Map(entries(plan).filter(e=>e.kind==='course'&&e.units!==null&&e.units>=3&&!['waived','not_taken'].includes(statuses[e.id]?.status??e.status)).map(e=>[alias(e.code),e])).values()];
 let searches=0,truncated=false;const slots=['1A','1B','1C','2','3A','3B','4','4','5A','5B','6'];let best=[];
 function search(i,used,rows){if(++searches>20000){truncated=true;return}if(rows.length+slots.length-i<=best.length)return;if(i===slots.length){if(rows.length>best.length)best=rows;return}for(const e of pool){if(used.has(e.id)||!classifications[alias(e.code)]?.includes(slots[i]))continue;if(slots[i]==='4'&&rows.some(r=>r.area==='4'&&r.entry.code.split(' ')[0]===e.code.split(' ')[0]))continue;used.add(e.id);search(i+1,used,[...rows,{area:slots[i],slot:i,entry:e,status:statuses[e.id]?.status??e.status}]);used.delete(e.id)}search(i+1,used,rows)}
 search(0,new Set(),[]);const science=best.filter(r=>['5A','5B'].includes(r.area));const lab=entries(plan).find(e=>e.kind==='course'&&classifications[alias(e.code)]?.includes('5C')&&!['not_taken','waived'].includes(statuses[e.id]?.status??e.status)&&science.some(r=>r.entry.code.split(' ')[0]===e.code.split(' ')[0]));
 return {slots,assigned:best.map(r=>({...r,entry:{id:r.entry.id,code:r.entry.code,units:r.entry.units,term:r.entry.term.label}})),lab:lab?{code:lab.code,status:statuses[lab.id]?.status??lab.status}:null,scienceUnits:science.reduce((n,r)=>n+r.entry.units,0)+(lab&&!science.some(r=>r.entry.id===lab.id)?lab.units??0:0),qualified:truncated||entries(plan).some(e=>e.kind!=='course'||e.units===null)||best.some(r=>r.status==='unknown')};
}
export function evaluateArticulation(node,plan,agreement={}){if(agreement.requestedYear&&agreement.year!==agreement.requestedYear)return {state:'unavailable',reason:'The requested agreement year is unavailable.'};const list=entries(plan).filter(e=>e.kind==='course');if(node.op==='none')return {state:'after_transfer'};if(node.op==='course'){const e=list.find(e=>alias(e.code)===alias(node.code));return {state:e?'in_plan':'missing',course:e?.code,term:e?.term.label}}if(node.op==='or'){const results=node.args.map(n=>evaluateArticulation(n,plan,agreement));return results.find(r=>r.state==='in_plan')??{state:'depends',options:results}}if(node.op==='and'&&node.same_college&&new Set(list.filter(e=>node.args.some(n=>n.op==='course'&&alias(n.code)===alias(e.code))).map(e=>e.institution??plan.institution)).size>1)return {state:'depends',reason:'The series must be taken at the same college.'};if(node.op==='and'){const results=node.args.map(n=>evaluateArticulation(n,plan,agreement));return {state:results.every(r=>r.state==='in_plan')?'in_plan':'missing',results}}return {state:'unavailable'};}
export function ucPattern(plan,designations,statuses={}){
 const pool=[...new Map(entries(plan).filter(e=>e.kind==='course'&&e.units!==null&&e.units>=3&&!['not_taken','waived'].includes(statuses[e.id]?.status??e.status)).map(e=>[alias(e.code),e])).values()];
 const slots=['UC-E','UC-E','UC-M','breadth','breadth','breadth','breadth'];let best=[],visits=0;
 function walk(i,used,rows){if(++visits>20000||rows.length+slots.length-i<=best.length)return;if(i===slots.length){if(rows.length>best.length)best=rows;return}for(const e of pool){if(used.has(e.id))continue;const areas=designations[alias(e.code)]??[];for(const area of areas.filter(a=>slots[i]==='breadth'?['UC-H','UC-B','UC-S'].includes(a):a===slots[i])){used.add(e.id);walk(i+1,used,[...rows,{slot:i,code:e.code,area,status:statuses[e.id]?.status??e.status}]);used.delete(e.id)}}walk(i+1,used,rows)}walk(0,new Set(),[]);
 return {slots,assigned:best,breadthAreas:new Set(best.filter(r=>r.slot>=3).map(r=>r.area)).size,qualified:true,gradesVerified:false};
}
