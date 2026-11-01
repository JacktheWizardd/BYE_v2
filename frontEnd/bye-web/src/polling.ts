// One saved-availability reader per visible screen. This does not force a
// source import: the backend still owns its shared five-minute refresh policy.
export function pollAvailability(load:(signal:AbortSignal)=>Promise<void>,onError:(error:unknown)=>void,options:{interval?:()=>number,failureInterval?:number}={}){
 let stopped=false,running=false,resume=false,failures=0,retryAt=0,lastReadAt=Date.now(),scheduledAt=Infinity;
 let timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
 const active=()=>!stopped&&!document.hidden&&navigator.onLine!==false;
 const schedule=(delay:number)=>{clearTimeout(timer);scheduledAt=Date.now()+delay;if(active())timer=setTimeout(run,delay)};
 async function run(){
  if(!active())return;
  if(running){resume=true;return}
  if(Date.now()<retryAt){schedule(retryAt-Date.now());return}
  running=true;resume=false;controller=new AbortController();let delay=60_000;
  try{await load(controller.signal);failures=0;retryAt=0;delay=options.interval?.()??60_000}
  catch(error){if(!controller.signal.aborted){onError(error);failures++;const retry=(error as {retryAfter?:number})?.retryAfter??0;delay=Math.max(Math.min(300_000,(options.failureInterval??60_000)*2**Math.min(failures,3)),retry*1000);retryAt=Date.now()+delay}}
  finally{lastReadAt=Date.now();running=false;schedule(resume?0:delay)}
 }
 const changed=()=>{clearTimeout(timer);if(active())void run();else{resume=false;controller?.abort()}};
 document.addEventListener('visibilitychange',changed);
 window.addEventListener('online',changed);window.addEventListener('offline',changed);
 const adaptive=options.interval?setInterval(()=>{
  if(!active()||running)return;
  const due=Math.max(retryAt,lastReadAt+options.interval!());
  if(due<scheduledAt)schedule(Math.max(0,due-Date.now()));
 },5000):undefined;
 void run();
 return()=>{stopped=true;clearInterval(adaptive);clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',changed);window.removeEventListener('online',changed);window.removeEventListener('offline',changed)};
}
