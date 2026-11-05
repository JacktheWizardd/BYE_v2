import type {PageGeom,TextItem} from '../types';

/** Sanitized PCC-like continuation layout for regression tests (no student PII). */
export const pccContinuationPages:PageGeom[]=[
 {width:612,height:792},
 {width:612,height:792},
 {width:612,height:792},
];

/**
 * Page 1 ends mid Fall 2026; page 2 continues Fall 2026 then opens Spring 2027;
 * page 3 opens Spring 2028. Verifies continuation does not shift semester ownership.
 */
export const pccContinuationItems:TextItem[]=[
 {str:'Pasadena City College',page:1,x:72,y:40,w:200,h:14},
 {str:'Education Plan',page:1,x:72,y:58,w:120,h:12},
 {str:'Fall 2026',page:1,x:72,y:120,w:90,h:14},
 {str:'COUN 010',page:1,x:72,y:150,w:70,h:12},
 {str:'College Success Strategies',page:1,x:160,y:150,w:180,h:12},
 {str:'1',page:1,x:520,y:150,w:20,h:12},
 {str:'ENGL 001A',page:1,x:72,y:180,w:80,h:12},
 {str:'Reading and Composition',page:1,x:160,y:180,w:170,h:12},
 {str:'4',page:1,x:520,y:180,w:20,h:12},
 // Continuation page with no repeated Fall heading — MATH 003 still Fall 2026.
 {str:'MATH 003',page:2,x:72,y:80,w:70,h:12},
 {str:'Intermediate Algebra',page:2,x:160,y:80,w:150,h:12},
 {str:'4',page:2,x:520,y:80,w:20,h:12},
 {str:'Spring 2027',page:2,x:72,y:140,w:100,h:14},
 {str:'MATH 022',page:2,x:72,y:170,w:70,h:12},
 {str:'Discrete Mathematics',page:2,x:160,y:170,w:150,h:12},
 {str:'4',page:2,x:520,y:170,w:20,h:12},
 {str:'Spring 2028',page:3,x:72,y:100,w:100,h:14},
 {str:'MATH 010',page:3,x:72,y:130,w:70,h:12},
 {str:'College Algebra',page:3,x:160,y:130,w:120,h:12},
 {str:'4',page:3,x:520,y:130,w:20,h:12},
 {str:'Plan total 17',page:3,x:72,y:200,w:100,h:12},
];
