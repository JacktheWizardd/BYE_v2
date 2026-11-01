import {api,type Course} from './api';
export type CoursePage={data:Course[],next_cursor:string|null};
type SavedSearch={version:1,saved_at:string,page:CoursePage};
const key=(school:string,term:string,query:string)=>'bye-web:course-search:v1:'+JSON.stringify([school,term,query.trim().toUpperCase()]);
function valid(page:unknown):page is CoursePage{
 const p=page as CoursePage;
 return !!p&&Array.isArray(p.data)&&p.data.length<=8&&(p.next_cursor===null||typeof p.next_cursor==='string')&&p.data.every(c=>!!c&&typeof c.id==='string'&&!!c.id&&typeof c.code==='string'&&typeof c.title==='string')&&new Set(p.data.map(c=>c.id)).size===p.data.length;
}
// No TTL or eviction. Only course identities/titles and pagination metadata are saved.
export function savedCourseSearch(school:string,term:string,query:string):SavedSearch|null{
 try{const item=JSON.parse(localStorage.getItem(key(school,term,query))??'null');return item?.version===1&&typeof item.saved_at==='string'&&valid(item.page)?item:null}catch{return null}
}
export async function searchCourses(school:string,term:string,query:string,signal?:AbortSignal):Promise<CoursePage>{
 signal?.throwIfAborted();
 const saved=savedCourseSearch(school,term,query);if(saved)return saved.page;
 const page=await api<CoursePage>('/schools/'+encodeURIComponent(school)+'/terms/'+encodeURIComponent(term)+'/courses?q='+encodeURIComponent(query.trim())+'&limit=8',signal);
 signal?.throwIfAborted();
 if(!valid(page))throw Error('The course search response was incomplete.');
 try{localStorage.setItem(key(school,term,query),JSON.stringify({version:1,saved_at:new Date().toISOString(),page}))}catch{/* Full or unavailable browser storage must not break a successful search. */}
 return page;
}
