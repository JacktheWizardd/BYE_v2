import {expect,it} from 'vitest';import {byeScore} from './byeScore';
it.each([[4.4,3.7,62,58],[4.1,3.4,185,58],[3.2,2.9,54,53],[3.3,3.5,339,48],[5,1,0,50],[5,1,10,75],[5,1,1000,100],[1,5,1000,0],[3,3,5,50],[null,3,10,null],[4,null,10,null]])('BYE score %s / %s / %s', (r,d,n,expected)=>expect(byeScore(r,d,n)).toBe(expected));
