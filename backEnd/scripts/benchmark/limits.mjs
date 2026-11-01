// Start-only serialization leaves response work concurrent, while cooldowns also
// apply to readers already queued. A cooldown release cannot create a burst.
export function retryDelay(raw,now=Date.now()){
 if(!raw)return 0;
 const delay=/^\d+(\.\d+)?$/.test(raw)?Number(raw)*1000:Date.parse(raw)-now;
 return Number.isFinite(delay)?Math.max(0,delay):0;
}
export function startLimiter({spacing=105,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let queue=Promise.resolve(),next=0,cooldown=0;
 return {
  postpone(ms){cooldown=Math.max(cooldown,now()+ms)},
  take(){const slot=queue.then(async()=>{while(Math.max(next,cooldown)>now())await sleep(Math.max(next,cooldown)-now());const start=now();next=start+spacing;return start});queue=slot.catch(()=>{});return slot}
 };
}
