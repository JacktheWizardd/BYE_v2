import React from 'react';
import {expect,it,vi} from 'vitest';
import {CourseOption,movedSuggestion} from './CourseOption';
// Exercise the actual React handlers with a ref, including Safari's no-click path.
vi.mock('react',async original=>({...await original<typeof import('react')>(),useRef:(value:unknown)=>({current:value})}));
const course={id:'ENGL-C1001',code:'ENGL C1001',title:'CRITICAL THINKING AND WRITING'};
const event=(x=10,y=10,pointerType='touch')=>({clientX:x,clientY:y,pointerType,preventDefault:vi.fn()});
it('selects on touch release even when the browser suppresses the synthetic click',()=>{
 const choose=vi.fn(),highlight=vi.fn();const node=CourseOption({course,index:1,active:false,onHighlight:highlight,onChoose:choose});
 node.props.onPointerDown(event());node.props.onPointerUp(event(12,13));expect(choose).toHaveBeenCalledExactlyOnceWith(course);
});
it('does not select a class while scrolling or after pointer cancellation',()=>{
 const choose=vi.fn();const node=CourseOption({course,index:1,active:false,onHighlight:vi.fn(),onChoose:choose});
 node.props.onPointerDown(event());node.props.onPointerMove(event(10,50));node.props.onPointerUp(event());expect(choose).not.toHaveBeenCalled();
 node.props.onPointerDown(event());node.props.onPointerCancel();node.props.onPointerUp(event());expect(choose).not.toHaveBeenCalled();expect(movedSuggestion({x:0,y:0},{x:0,y:11})).toBe(true);
});
it('tracks mouse hover without changing the highlight during a touch drag',()=>{
 const highlight=vi.fn();const node=CourseOption({course,index:1,active:false,onHighlight:highlight,onChoose:vi.fn()});
 node.props.onPointerEnter(event());expect(highlight).not.toHaveBeenCalled();node.props.onPointerEnter(event(0,0,'mouse'));expect(highlight).toHaveBeenCalledOnce();
});
