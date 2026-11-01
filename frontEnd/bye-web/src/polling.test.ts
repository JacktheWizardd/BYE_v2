import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {pollAvailability} from './polling';
let doc:EventTarget&{hidden:boolean},win:EventTarget,network:{onLine:boolean};
beforeEach(()=>{vi.useFakeTimers();doc=Object.assign(new EventTarget(),{hidden:false});win=new EventTarget();network={onLine:true};vi.stubGlobal('document',doc);vi.stubGlobal('window',win);vi.stubGlobal('navigator',network)});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
it('pauses hidden/offline, resumes immediately, and cleans up on navigation',async()=>{
 const load=vi.fn(async()=>{}),stop=pollAvailability(load,vi.fn());
 await vi.advanceTimersByTimeAsync(60_000);expect(load).toHaveBeenCalledTimes(2);
 doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(120_000);expect(load).toHaveBeenCalledTimes(2);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(0);expect(load).toHaveBeenCalledTimes(3);
 network.onLine=false;win.dispatchEvent(new Event('offline'));await vi.advanceTimersByTimeAsync(120_000);expect(load).toHaveBeenCalledTimes(3);
 network.onLine=true;win.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(0);expect(load).toHaveBeenCalledTimes(4);
 stop();await vi.advanceTimersByTimeAsync(120_000);win.dispatchEvent(new Event('online'));expect(load).toHaveBeenCalledTimes(4);
});
it('backs off failures and honours Retry-After without overwriting saved results',async()=>{
 const load=vi.fn().mockRejectedValueOnce({retryAfter:180}).mockResolvedValue(undefined),error=vi.fn(),stop=pollAvailability(load,error);
 await vi.advanceTimersByTimeAsync(179_999);expect(load).toHaveBeenCalledTimes(1);expect(error).toHaveBeenCalledTimes(1);
 win.dispatchEvent(new Event('online'));expect(load).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);expect(load).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(60_000);expect(load).toHaveBeenCalledTimes(3);stop();
});
it('allows only one in-flight reader and aborts it when leaving the screen',async()=>{
 let signal:AbortSignal|undefined;
 const load=vi.fn((s:AbortSignal)=>{signal=s;return new Promise<void>((_resolve,reject)=>s.addEventListener('abort',()=>reject(s.reason)))});
 const error=vi.fn(),stop=pollAvailability(load,error);win.dispatchEvent(new Event('online'));
 await vi.advanceTimersByTimeAsync(120_000);expect(load).toHaveBeenCalledTimes(1);stop();
 await vi.advanceTimersByTimeAsync(0);expect(signal?.aborted).toBe(true);expect(error).not.toHaveBeenCalled();
});

it('uses adaptive success intervals and red failure delays without changing source checks',async()=>{
 let delay=5000;const load=vi.fn(async()=>{}),stop=pollAvailability(load,vi.fn(),{interval:()=>delay,failureInterval:300000});
 await vi.advanceTimersByTimeAsync(4999);expect(load).toHaveBeenCalledTimes(1);
 delay=1800000;await vi.advanceTimersByTimeAsync(1);expect(load).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(1799999);expect(load).toHaveBeenCalledTimes(2);
 delay=600000;await vi.advanceTimersByTimeAsync(1);expect(load).toHaveBeenCalledTimes(3);
 await vi.advanceTimersByTimeAsync(600000);expect(load).toHaveBeenCalledTimes(4);stop();
});

it('shortens a pending green timer when the real status becomes red',async()=>{
 const began=Date.now();const load=vi.fn(async()=>{});
 const stop=pollAvailability(load,vi.fn(),{interval:()=>Date.now()-began<300000?1800000:300000});
 await vi.advanceTimersByTimeAsync(299999);expect(load).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(2);expect(load).toHaveBeenCalledTimes(2);stop();
});
