import {describe,expect,it} from 'vitest';
import {courseTermAssignments,reconstructEducationPlan} from './reconstruct';
import {pccContinuationItems,pccContinuationPages} from './fixtures/pcc-continuation';
import {recalculateDraft,reviewProgress,validateEducationPlan} from './validate';
import {parseImportedPlanJson} from './json';

const fingerprint='ab'.repeat(32);

describe('PCC continuation reconstruction',()=>{
 it('keeps COUN 010 in Fall 2026, MATH 022 in Spring 2027, MATH 010 in Spring 2028',()=>{
  const {plan,warnings}=reconstructEducationPlan({fingerprint,pages:pccContinuationPages,items:pccContinuationItems});
  const map=courseTermAssignments(plan);
  expect(map['COUN 010']).toBe('Fall 2026');
  expect(map['MATH 003']).toBe('Fall 2026');
  expect(map['MATH 022']).toBe('Spring 2027');
  expect(map['MATH 010']).toBe('Spring 2028');
  expect(plan.institution).toMatch(/Pasadena City College|PCC/);
  expect(warnings.some(w=>/before any term/i.test(w))).toBe(false);
 });

 it('preserves leading zeros and unknown status until review',()=>{
  const {plan}=reconstructEducationPlan({fingerprint,pages:pccContinuationPages,items:pccContinuationItems});
  const coun=plan.terms[0].entries.find(e=>e.code==='COUN 010')!;
  expect(coun.code).toBe('COUN 010');
  expect(coun.status).toBe('unknown');
  expect(coun.reviewed).toBe(false);
  expect(coun.source?.page).toBe(1);
 });
});

describe('review and JSON import',()=>{
 it('blocks save until every term and entry is reviewed',()=>{
  const {plan}=reconstructEducationPlan({fingerprint,pages:pccContinuationPages,items:pccContinuationItems});
  expect(reviewProgress(plan).complete).toBe(false);
  expect(()=>validateEducationPlan(plan)).toThrow(/Review every term|Review every entry/);
  const reviewed=recalculateDraft({
   ...plan,
   terms:plan.terms.map(t=>({...t,reviewed:true,entries:t.entries.map(e=>({...e,reviewed:true}))})),
  });
  const saved=validateEducationPlan(reviewed);
  expect(saved.terms[0].entries[0].code).toBe('COUN 010');
  expect(saved.calculated_units).toBeTypeOf('number');
 });

 it('marks imported JSON unreviewed so provenance stays explicit',()=>{
  const {plan}=reconstructEducationPlan({fingerprint,pages:pccContinuationPages,items:pccContinuationItems});
  const ready=recalculateDraft({
   ...plan,
   terms:plan.terms.map(t=>({...t,reviewed:true,entries:t.entries.map(e=>({...e,reviewed:true}))})),
  });
  const exported=JSON.stringify({plan:validateEducationPlan(ready)});
  const imported=parseImportedPlanJson(exported);
  expect(imported.terms.every(t=>!t.reviewed)).toBe(true);
  expect(imported.terms.every(t=>t.entries.every(e=>!e.reviewed))).toBe(true);
 });
});

describe('layout uncertainty',()=>{
 it('does not invent a semester when courses precede headings',()=>{
  const items=[
   {str:'MATH 099',page:1,x:72,y:80,w:70,h:12},
   {str:'Support course',page:1,x:160,y:80,w:100,h:12},
   {str:'3',page:1,x:520,y:80,w:12,h:12},
  ];
  const {plan,warnings}=reconstructEducationPlan({fingerprint,pages:[{width:612,height:792}],items});
  expect(plan.terms[0].label).toBe('Unassigned');
  expect(warnings[0]).toMatch(/before any term heading/i);
 });

 it('keeps alternatives out of confirmed course counts until resolved',()=>{
  const items=[
   {str:'Fall 2026',page:1,x:72,y:40,w:80,h:14},
   {str:'MATH 005A or MATH 005B College Algebra pathway 4',page:1,x:72,y:80,w:360,h:12},
  ];
  const {plan}=reconstructEducationPlan({fingerprint,pages:[{width:612,height:792}],items});
  const draft=recalculateDraft(plan);
  expect(draft.terms[0].entries[0].kind).toBe('alternative');
  expect(draft.terms[0].course_entries).toBe(0);
  expect(draft.terms[0].calculated_units).toBeNull();
 });
});
