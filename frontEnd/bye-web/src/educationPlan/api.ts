import {api,ApiError} from '../api';
import type {EducationPlan,SavedEducationPlan} from './types';
import {validateEducationPlan} from './validate';
export {exportPlanJson,parseImportedPlanJson} from './json';

export async function loadEducationPlan(signal?:AbortSignal):Promise<SavedEducationPlan|null>{
 const result=await api<{data:SavedEducationPlan|null}>('/me/education-plan',signal);
 return result.data;
}

export async function saveEducationPlan(expectedRevision:number,plan:EducationPlan,signal?:AbortSignal):Promise<SavedEducationPlan>{
 const checked=validateEducationPlan(plan);
 try{
  const result=await api<{data:SavedEducationPlan}>('/me/education-plan',signal,{expected_revision:expectedRevision,plan:checked});
  if(!result.data)throw new ApiError(502,'invalid_education_plan','Save response was empty.');
  return result.data;
 }catch(error){
  if(error instanceof ApiError&&error.status===409)throw new ApiError(409,'revision_conflict','The saved plan changed. Reload it before replacing it.');
  throw error;
 }
}
