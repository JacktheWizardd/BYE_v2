import React from 'react';
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StudyHours,parseStudyHours} from './StudyHours';
it('accepts finished half-hour estimates and rejects unfinished or invalid input',()=>{
 for(const text of ['0','2','2.5','40'])expect(parseStudyHours(text)).toBe(Number(text));
 for(const text of ['',' ','-1','40.5','2.25','NaN','abc'])expect(parseStudyHours(text)).toBeNull();
});
it('keeps the study input available while saving and offers a mobile Done key',()=>{
 const html=renderToStaticMarkup(<StudyHours code="MATH" value={2.5} disabled={false} busy={true} onCommit={()=>{throw Error('Must not save during render')}}/>);
 expect(html).toMatch(/input[^>]*inputMode="decimal"/);expect(html).toContain('enterKeyHint="done"');
 expect(html.match(/<input[^>]*>/)?.[0]).not.toContain('disabled');expect(html).toContain('value="2.5"');
});
