import {expect,it} from 'vitest';
import {revealShift,listTop,keepsWheel} from './listPane';
it('scrolls a professor row into the list only as far as needed',()=>{
 const list={top:286,bottom:794};
 expect(revealShift(list,{top:400,bottom:484})).toBe(0);
 expect(revealShift(list,{top:286,bottom:370})).toBe(0);
 expect(revealShift(list,{top:710,bottom:794})).toBe(0);
 expect(revealShift(list,{top:886,bottom:970})).toBe(176);
 expect(revealShift(list,{top:200,bottom:284})).toBe(-86);
 expect(revealShift(list,{top:250,bottom:334})).toBe(-36);
});
it('keeps the top of a row taller than the list in view',()=>{expect(revealShift({top:100,bottom:160},{top:140,bottom:260})).toBe(40)});
it('never sizes the list from above its sticky position',()=>{
 expect(listTop(285.6)).toBe(286);expect(listTop(16)).toBe(16);expect(listTop(0)).toBe(16);expect(listTop(-1899)).toBe(16);
});
it('keeps the wheel only for a list too long for the window that is fully on screen',()=>{
 expect(keepsWheel(2552,810,794)).toBe(true);
 expect(keepsWheel(536,810,794)).toBe(false);
 expect(keepsWheel(2552,420,486)).toBe(false);
});
