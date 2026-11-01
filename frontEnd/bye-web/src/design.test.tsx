import React from 'react';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('./api',()=>({api:vi.fn(),ApiError:class extends Error{}}));
import {enrollmentTone,waitlistTone,accessDays,accessTone,courseSwatch} from './design';
import {Plan} from './Plan';
import {WaBottomNav} from './WaShell';
it('applies the documented seat and waitlist colors at all boundaries',()=>{
 expect(enrollmentTone(26,30,4,'O')).toBe('green');expect(enrollmentTone(27,30,3,'O')).toBe('red');expect(enrollmentTone(29,30,1,'O')).toBe('red');expect(enrollmentTone(1,30,29,'C')).toBe('red');expect(enrollmentTone(null,null,null,null)).toBe('grey');
 expect(waitlistTone(0,7)).toBe('grey');expect(waitlistTone(1,7)).toBe('amber');expect(waitlistTone(7,7)).toBe('red');expect(waitlistTone(null,7)).toBe('grey');
});
it('uses amber for ending access and zero/red for expiry or revocation',()=>{
 const now=Date.parse('2026-11-01T12:00:00Z');expect(accessDays('2026-10-31T12:00:00Z',null,now)).toBe(29);expect(accessDays('2026-10-31','2026-11-01',now)).toBe(0);expect(accessDays('2026-09-01',null,now)).toBe(0);expect(accessTone(0)).toBe('red');expect(accessTone(7)).toBe('amber');expect(accessTone(8)).toBe('green');expect(courseSwatch(6)).toBe('var(--bye-c2)');
});
it('always offers named Plan semesters, including semesters without saved sections',()=>{
 const p={school_id:'pcc',term_id:'202710',sections:[],study:{},weekend:false};
 const store={missing:[],value:{version:1,revision:1,updated_at:null,plans:[p]},plans:[p],draft:null,error:'',busy:false,conflict:false,reload:vi.fn(),persist:vi.fn()};
 const html=renderToStaticMarkup(<Plan store={store} school="pcc" term="202710" terms={[{id:'202710',name:'Winter 2027'},{id:'202730',name:'Spring 2027'}] as any} onTerm={vi.fn()}/>);
 expect(html).toContain('aria-label="Plan semester"');expect(html).toContain('value="202730"');expect(html).toContain('Spring 2027');
});
it('visibly labels disabled Watches as coming soon',()=>{expect(renderToStaticMarkup(<WaBottomNav path="/plan"/>)).toContain('<small>Coming soon</small>')});
