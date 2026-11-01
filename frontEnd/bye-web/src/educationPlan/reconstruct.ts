import type {EducationPlan,PlanEntry,PlanTerm,TextItem,PageGeom} from './types';

const TERM_RE=/\b((?:Fall|Autumn|Spring|Summer|Winter)\s+(?:Semester\s+|Quarter\s+)?(20\d{2}))\b/i;
const COURSE_RE=/\b([A-Z]{2,6})\s*(0?\d{2,4}[A-Z]?)\b/;
const UNITS_RE=/\b(\d+(?:\.\d+)?)\s*(?:units?|credits?|hrs?|hours?)?\b/i;
const ALT_RE=/\b(or|choose one|select one|one of the following|alternative)\b/i;
const ELECTIVE_RE=/\b(elective|requirement|ge |general education|transfer)\b/i;

function slug(label:string,index:number){
 return `${label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'term'}-${index}`;
}
function entryId(termId:string,code:string,index:number){
 return `${termId}-${(code||'item').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${index}`;
}
function normalizeCourse(prefix:string,number:string){
 const digits=number.replace(/[^0-9A-Z]/gi,'');
 if(/^\d/.test(digits)&&digits.length<=4)return `${prefix.toUpperCase()} ${digits.padStart(3,'0')}`;
 return `${prefix.toUpperCase()} ${digits.toUpperCase()}`;
}
function boxOf(items:TextItem[]):[number,number,number,number]|null{
 if(!items.length)return null;
 const x0=Math.min(...items.map(i=>i.x));
 const y0=Math.min(...items.map(i=>i.y));
 const x1=Math.max(...items.map(i=>i.x+i.w));
 const y1=Math.max(...items.map(i=>i.y+i.h));
 if(!(x1>x0&&y1>y0))return null;
 return [x0,y0,x1,y1];
}
function yearFromLabel(label:string){
 const m=label.match(/(20\d{2})/);
 return m?Number(m[1]):null;
}
function basisFromLabel(label:string):PlanTerm['basis']{
 if(/quarter/i.test(label))return 'quarter';
 if(/fall|spring|summer|winter|semester|autumn/i.test(label))return 'semester';
 return 'unknown';
}
function groupLines(items:TextItem[]){
 const byPage=new Map<number,TextItem[]>();
 for(const item of items){
  if(!item.str.trim())continue;
  const list=byPage.get(item.page)??[];list.push(item);byPage.set(item.page,list);
 }
 const lines:{page:number,y:number,text:string,items:TextItem[]}[]=[];
 for(const [page,pageItems] of [...byPage.entries()].sort((a,b)=>a[0]-b[0])){
  const sorted=[...pageItems].sort((a,b)=>a.y-b.y||a.x-b.x);
  let current:{page:number,y:number,items:TextItem[]}|null=null;
  for(const item of sorted){
   const height=Math.max(item.h,8);
   if(!current||Math.abs(item.y-current.y)>height*0.6){
    if(current)lines.push({page:current.page,y:current.y,text:current.items.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim(),items:current.items});
    current={page,y:item.y,items:[item]};
   }else current.items.push(item);
  }
  if(current)lines.push({page:current.page,y:current.y,text:current.items.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim(),items:current.items});
 }
 return lines;
}

/** Reconstruct a draft plan from positioned text. Continuation pages keep the open term until a new heading appears. */
export function reconstructEducationPlan(input:{fingerprint:string,pages:PageGeom[],items:TextItem[],institutionHint?:string}):{plan:EducationPlan,warnings:string[]}{
 const warnings:string[]=[];
 const lines=groupLines(input.items);
 const terms:PlanTerm[]=[];
 let current:PlanTerm|null=null;
 let institution=input.institutionHint??'';
 let printedUnits:number|null=null;
 let purpose='Imported education plan';

 for(const line of lines){
  if(!institution){
   const school=line.text.match(/\b((?:Pasadena City College|PCC|[A-Z][A-Za-z&.\- ]{3,40}(?:College|University|Institute)))\b/);
   if(school)institution=school[1].replace(/\s+/g,' ').trim();
  }
  const total=line.text.match(/\b(?:total|grand total|plan total)\b[^0-9]{0,12}(\d+(?:\.\d+)?)/i);
  if(total&&!/semester|term|quarter/i.test(line.text))printedUnits=Number(total[1]);

  const termMatch=line.text.match(TERM_RE);
  if(termMatch){
   const label=termMatch[1].replace(/\s+/g,' ').replace(/\bAutumn\b/i,'Fall').replace(/\s+(Semester|Quarter)\s+/i,' ');
   const normalized=label.replace(/\b(Fall|Spring|Summer|Winter)\b/i,m=>m[0].toUpperCase()+m.slice(1).toLowerCase());
   current={id:slug(normalized,terms.length+1),label:normalized,year:yearFromLabel(normalized),basis:basisFromLabel(normalized),printed_units:null,reviewed:false,exception:'',entries:[]};
   terms.push(current);
   const termTotal=line.text.match(/\b(?:units?|credits?)\b[^0-9]{0,8}(\d+(?:\.\d+)?)/i);
   if(termTotal)current.printed_units=Number(termTotal[1]);
   continue;
  }

  const courseMatch=line.text.match(COURSE_RE);
  if(!courseMatch){
   if(current){
    const onlyUnits=line.text.match(/^\s*(?:units?|credits?|total)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*$/i);
    if(onlyUnits&&current.printed_units==null)current.printed_units=Number(onlyUnits[1]);
   }
   continue;
  }

  if(!current){
   warnings.push(`Course ${courseMatch[0]} appeared before any term heading; left unassigned until review.`);
   current={id:slug('Unassigned',terms.length+1),label:'Unassigned',year:null,basis:'unknown',printed_units:null,reviewed:false,exception:'No printed term heading preceded these courses.',entries:[]};
   terms.push(current);
  }

  const code=normalizeCourse(courseMatch[1],courseMatch[2]);
  const after=line.text.slice(courseMatch.index!+courseMatch[0].length).replace(/^[\s·|:.–-]+/,'').trim();
  const unitsMatch=after.match(UNITS_RE)||line.text.match(new RegExp(`${courseMatch[0]}.*?${UNITS_RE.source}`,'i'));
  let units:number|null=null;
  let title=after;
  if(unitsMatch){
   units=Number(unitsMatch[1]);
   title=after.replace(unitsMatch[0],'').replace(/[\s·|:.–-]+$/g,'').trim();
  }
  title=title.replace(/\s{2,}/g,' ').trim();
  const alt=ALT_RE.test(line.text);
  const kind:PlanEntry['kind']=alt?'alternative':ELECTIVE_RE.test(line.text)&&!COURSE_RE.test(title)?'requirement':'course';
  const box=boxOf(line.items);
  const entry:PlanEntry={
   id:entryId(current.id,code,current.entries.length+1),
   kind,
   code,
   title,
   units,
   status:'unknown',
   source:box?{page:line.page,box}:null,
   correction:'',
   exception:alt?'Choice not yet confirmed.':'',
   reviewed:false,
  };
  current.entries.push(entry);
 }

 if(!terms.length){
  warnings.push('No term headings or courses were recognized. Import stayed empty for manual review.');
 }

 const plan:EducationPlan={
  version:1,
  fingerprint:input.fingerprint,
  pages:input.pages,
  purpose,
  institution:institution||'Unknown institution',
  printed_units:printedUnits,
  terms,
  exception:'',
 };
 return {plan,warnings};
}

/** Locate regression-sensitive course→term assignments for tests and review checks. */
export function courseTermAssignments(plan:EducationPlan):Record<string,string>{
 const map:Record<string,string>={};
 for(const term of plan.terms)for(const entry of term.entries){
  if(entry.code&&!(entry.code in map))map[entry.code]=term.label;
 }
 return map;
}
