import type {EducationPlan} from './types';

export function exportPlanJson(plan:EducationPlan):string{
 return JSON.stringify(plan,null,2);
}

export function parseImportedPlanJson(text:string):EducationPlan{
 let data:unknown;
 try{data=JSON.parse(text)}catch{throw Error('That file is not valid JSON.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Education-plan JSON must be an object.');
 const root=data as Record<string,unknown>;
 const plan=(root.plan&&typeof root.plan==='object'?root.plan:data) as EducationPlan;
 return {
  ...plan,
  terms:(plan.terms??[]).map(term=>({
   ...term,
   reviewed:false,
   entries:(term.entries??[]).map(entry=>({...entry,reviewed:false})),
  })),
 };
}
