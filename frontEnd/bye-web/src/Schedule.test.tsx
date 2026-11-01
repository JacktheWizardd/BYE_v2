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
