import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {expect,it} from 'vitest';import {SyncPill} from './Schedule';import {semesterSync,connectionSync} from './presentation';
it('explains queued work and device observation without inventing percentage progress',()=>{
 const refresh:any={status:'queued',imported:true,last_successful_check:'2026-10-31T12:00:00Z',next_eligible_at:'2026-10-31T12:10:00Z'};
 const html=renderToStaticMarkup(<SyncPill state={semesterSync(refresh,false,Date.parse('2026-10-31T12:01:00Z'))} course="Winter 2027" refresh={refresh} observedAt={Date.parse('2026-10-31T12:01:00Z')} onCheck={()=>{}}/>);
 expect(html).toContain('Update queued');expect(html).toContain('No PCC fetch before:');expect(html).toContain('Status read on this device:');expect(html).toContain('Check now');expect(html).not.toContain('role="progressbar"');expect(html).not.toMatch(/[0-9]+%/);
});
it('gives the same worker state precedence even when previous counts are fresh',()=>{
 const refresh:any={status:'running',last_successful_check:new Date().toISOString()};
 expect(semesterSync(refresh).label).toBe('Checking PCC');
 const html=renderToStaticMarkup(<SyncPill state={connectionSync(Date.now(),false,true)} refresh={refresh} checking onCheck={()=>{}}/>);
 expect(html).toContain('sync-activity running');expect(html).toMatch(/disabled/);expect(html).toContain('Checking BYE');
});

it('keeps the connection green while old PCC data and queued work remain separate',()=>{
 const refresh:any={imported:true,status:'queued',last_successful_check:'2020-01-01T00:00:00Z',next_eligible_at:null};
 const html=renderToStaticMarkup(<SyncPill state={connectionSync(Date.now())} refresh={refresh}/>);
 expect(html).toMatch(/sync-pill fresh/);expect(html).toContain('Connected to BYE');expect(html).toContain('PCC data: Update queued');expect(html).toContain('Semester last checked');
});
it('keeps remaining capacity distinct from enrolled counts and closed registration',async()=>{const {SeatAvailability}=await import('./Schedule');const html=renderToStaticMarkup(<SeatAvailability section={{id:'70720',availability:{seats_open:1,enrolled:27,capacity:28,source_status:'C',waitlist_count:0,waitlist_capacity:7,as_of:new Date().toISOString()}} as any}/>);expect(html).toContain('Closed · PCC registration status');expect(html).toContain('<b>27<small> /28</small>');expect(html).toContain('Remaining capacity: 1');expect(html).toContain('Enrolled seats');expect(html).toContain('Remaining capacity');expect(html).not.toContain('>Seats open<')});
it('uses the design protocol for enrollment and waitlist bars',async()=>{const {SeatAvailability}=await import('./Schedule');const render=(status:string,enrolled:number,open:number,wait:number|null,waitCap:number|null)=>renderToStaticMarkup(<SeatAvailability section={{id:'test',availability:{seats_open:open,enrolled,capacity:30,source_status:status,waitlist_count:wait,waitlist_capacity:waitCap,as_of:new Date().toISOString()}} as any}/>);expect(render('C',27,3,0,7)).toContain('data-tone="red" role="meter" aria-label="Enrolled seats"');expect(render('O',12,18,0,7)).toContain('data-tone="green" role="meter" aria-label="Enrolled seats"');expect(render('O',30,0,3,7)).toContain('data-tone="amber" role="meter" aria-label="Waitlist occupancy"');expect(render('C',30,0,7,7)).toContain('data-tone="red" role="meter" aria-label="Waitlist occupancy"');expect(render('O',12,18,null,null)).toContain('data-tone="grey" role="img" aria-label="Waitlist occupancy unavailable"');expect(render('O',12,18,0,7)).toContain('data-tone="grey" role="meter" aria-label="Waitlist occupancy"')});

it('marks near-capacity enrollment red even when PCC registration remains open',async()=>{const {SeatAvailability}=await import('./Schedule');const render=(enrolled:number)=>renderToStaticMarkup(<SeatAvailability section={{id:'10889',availability:{seats_open:30-enrolled,enrolled,capacity:30,source_status:'O',waitlist_count:0,waitlist_capacity:7,as_of:new Date().toISOString()}} as any}/>);for(const n of [27,29]){expect(render(n)).toContain('data-tone="red" role="meter" aria-label="Enrolled seats"');expect(render(n)).toContain('Nearly full · Seats open');expect(render(n)).not.toContain('Closed · PCC registration status')}expect(render(26)).toContain('data-tone="green" role="meter" aria-label="Enrolled seats"')});
