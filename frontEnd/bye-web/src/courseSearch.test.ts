import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('./api',()=>({api:vi.fn()}));
import {api} from './api';import {searchCourses,savedCourseSearch} from './courseSearch';
let entries:Map<string,string>,remove:ReturnType<typeof vi.fn>;
beforeEach(()=>{entries=new Map();remove=vi.fn();vi.mocked(api).mockReset();vi.stubGlobal('localStorage',{getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>entries.set(k,v),removeItem:remove,clear:vi.fn()})});
afterEach(()=>vi.unstubAllGlobals());
const page={data:[{id:'MATH-005A',code:'MATH 005A',title:'Calculus I'}],next_cursor:'8'};
it('persists results across module reloads and reuses them without another API request',async()=>{
 vi.mocked(api).mockResolvedValue(page);await searchCourses('pcc','202710','MATH 005A');
 vi.resetModules();const reloaded=await import('./courseSearch');expect(await reloaded.searchCourses('pcc','202710','math 005a')).toEqual(page);expect(api).toHaveBeenCalledTimes(1);
 expect([...entries.values()][0]).not.toMatch(/access_token|availability|reviews|role/);expect(remove).not.toHaveBeenCalled();
});
it('does not expire or evict old searches, preserving exact zeros and school/semester scope',async()=>{
 vi.mocked(api).mockResolvedValue(page);
 await searchCourses('pcc','202710','MATH 005A');const k=[...entries.keys()][0],item=JSON.parse(entries.get(k)!);item.saved_at='2000-01-01';entries.set(k,JSON.stringify(item));
 expect(savedCourseSearch('pcc','202710','MATH 005A')?.page).toEqual(page);
 for(const args of [['other','202710','MATH 005A'],['pcc','202730','MATH 005A'],['pcc','202710','MATH 5A']])await searchCourses(...args as [string,string,string]);
 expect(api).toHaveBeenCalledTimes(4);expect(entries.size).toBe(4);expect(remove).not.toHaveBeenCalled();
});
it('preserves empty results and pagination metadata',async()=>{
 vi.mocked(api).mockResolvedValue({data:[],next_cursor:null});await searchCourses('pcc','term','NOT FOUND');expect(await searchCourses('pcc','term','NOT FOUND')).toEqual({data:[],next_cursor:null});expect(api).toHaveBeenCalledTimes(1);
});
it('does not store failed, cancelled or malformed responses',async()=>{
 vi.mocked(api).mockRejectedValueOnce(Error('offline'));await expect(searchCourses('pcc','term','MATH')).rejects.toThrow();expect(entries.size).toBe(0);
 vi.mocked(api).mockResolvedValueOnce({data:[]});await expect(searchCourses('pcc','term','MATH')).rejects.toThrow('incomplete');
 const c=new AbortController();vi.mocked(api).mockImplementationOnce(async()=>{c.abort();return page});await expect(searchCourses('pcc','term','MATH',c.signal)).rejects.toThrow();expect(entries.size).toBe(0);
});
it('keeps searches working when storage is blocked or full',async()=>{
 vi.mocked(api).mockResolvedValue(page);vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('quota')}});
 expect(await searchCourses('pcc','term','MATH')).toEqual(page);
});
