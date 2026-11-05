/** Structured education-plan model shared by local review and the persistence API. */
export type SourceRef={page:number,box:[number,number,number,number]};
export type PlanEntry={
 id:string;
 kind:'course'|'requirement'|'alternative'|'conditional'|'bundle';
 code:string;
 title:string;
 units:number|null;
 status:'unknown'|'planned'|'enrolled'|'completed'|'waived';
 source:SourceRef|null;
 correction:string;
 exception:string;
 reviewed:boolean;
};
export type PlanTerm={
 id:string;
 label:string;
 year:number|null;
 basis:'semester'|'quarter'|'unknown';
 printed_units:number|null;
 reviewed:boolean;
 exception:string;
 entries:PlanEntry[];
 calculated_units?:number|null;
 course_entries?:number;
 requirement_entries?:number;
};
export type EducationPlan={
 version:1;
 fingerprint:string;
 pages:{width:number,height:number}[];
 purpose:string;
 institution:string;
 printed_units:number|null;
 terms:PlanTerm[];
 exception:string;
 calculated_units?:number|null;
};
export type TextItem={str:string,page:number,x:number,y:number,w:number,h:number};
export type PageGeom={width:number,height:number};
export type ExtractedDocument={
 fingerprint:string;
 pages:PageGeom[];
 items:TextItem[];
 pageImages:string[];
 warnings:string[];
};
export type SavedEducationPlan={revision:number,updated_at:string,plan:EducationPlan};
export const MAX_LOCAL_PDF_BYTES=20*1024*1024;
export const MAX_PLAN_PAGES=30;
export const MAX_PLAN_JSON_BYTES=1_048_576;
