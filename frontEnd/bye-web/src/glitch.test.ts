import {it,expect,vi,afterEach} from 'vitest';
import {createGlitchCodeField} from './glitchCodeField';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
function setup(reduce=false){
 const draw=vi.fn();const context=new Proxy({drawImage:draw,createRadialGradient:()=>({addColorStop(){}})},{get:(t:any,k)=>k in t?t[k]:()=>{}});
 const canvas=()=>({width:0,height:0,getContext:()=>context,getBoundingClientRect:()=>({width:440,height:170})});
 const frames:Function[]=[];
 vi.stubGlobal('document',{createElement:canvas});vi.stubGlobal('devicePixelRatio',1);
 vi.stubGlobal('matchMedia',()=>({matches:reduce}));
 vi.stubGlobal('requestAnimationFrame',(fn:Function)=>{frames.push(fn);return frames.length});
 vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}});
 vi.stubGlobal('IntersectionObserver',class{observe(){} disconnect(){}});
 return {field:createGlitchCodeField(canvas() as any),frames};
}
it('cancels delayed transitions on phase changes and destruction',()=>{
 vi.useFakeTimers();const {field}=setup();field.set({raw:'ABCDEFGH'});field.set({peek:true});expect(vi.getTimerCount()).toBeGreaterThan(0);
 field.set({phase:'verify',peek:false});expect(vi.getTimerCount()).toBe(0);
 field.set({phase:'locked',secondsLeft:30});expect(vi.getTimerCount()).toBeGreaterThan(0);
 field.destroy();expect(vi.getTimerCount()).toBe(0);field.set({peek:true});expect(vi.getTimerCount()).toBe(0);
});
it('reduced motion draws on changes without a continuous animation loop',()=>{
 const {field,frames}=setup(true);field.set({raw:'ABCDEFGH'});const count=frames.length;frames[0](1000);expect(frames.length).toBe(count);field.destroy();
});
it('rejects unavailable canvas so the native input fallback can remain visible',()=>{
 vi.stubGlobal('document',{createElement:()=>({getContext:()=>null})});
 expect(()=>createGlitchCodeField({getContext:()=>null} as any)).toThrow('Canvas unavailable');
});
it('renders simulated checking, rejection and lockout expiry without retaining old callbacks',()=>{
 vi.useFakeTimers();const {field,frames}=setup();
 field.set({raw:'ABCDEFGH'});field.set({phase:'verify'});frames.shift()!(100);
 field.set({phase:'wrong'});field.set({peek:true});field.set({peek:false});
 field.set({phase:'locked',secondsLeft:1});field.set({phase:'idle',secondsLeft:0});
 expect(vi.getTimerCount()).toBe(0);field.destroy();vi.runAllTimers();
});
