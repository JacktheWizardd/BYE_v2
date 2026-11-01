/** Shared visual rules; see docs/DESIGN_PROTOCOL_AUDIT.md for owner overrides. */
export type Tone='red'|'green'|'amber'|'grey';
export function enrollmentTone(enrolled:number|null,capacity:number|null,remaining:number|null,status?:string|null):Tone{
 if(status==='C'||remaining===0)return 'red';
 if(enrolled!=null&&capacity!=null&&capacity>0&&enrolled/capacity>=.9)return 'red';
 return status==='O'?'green':'grey';
}
export function waitlistTone(count:number|null,capacity:number|null):Tone{
 return count==null||capacity==null||capacity<=0||count===0?'grey':count>=capacity?'red':'amber';
}
export function accessDays(used:string|null,revoked:string|null,now=Date.now()){
 return !used||revoked?0:Math.max(0,Math.min(30,Math.ceil((Date.parse(used)+30*86400000-now)/86400000)));
}
export const accessTone=(days:number):Tone=>days<=0?'red':days<=7?'amber':'green';
export const courseSwatch=(index:number)=>`var(--bye-c${index%5+1})`;
