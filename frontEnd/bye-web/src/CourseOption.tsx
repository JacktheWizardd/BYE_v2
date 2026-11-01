import React,{useRef} from 'react';
import type {Course} from './api';
type Point={x:number,y:number};
export const movedSuggestion=(start:Point,end:Point)=>Math.abs(start.x-end.x)>10||Math.abs(start.y-end.y)>10;
export function CourseOption({course,index,active,onHighlight,onChoose}:{course:Course,index:number,active:boolean,onHighlight:()=>void,onChoose:(course:Course)=>void}){
 const gesture=useRef<{x:number,y:number,moved:boolean}|null>(null);
 return <li role="option" id={'option-'+index} aria-selected={active} onPointerEnter={e=>{if(e.pointerType==='mouse')onHighlight()}} onPointerDown={e=>{e.preventDefault();gesture.current={x:e.clientX,y:e.clientY,moved:false}}} onPointerMove={e=>{if(gesture.current&&movedSuggestion(gesture.current,{x:e.clientX,y:e.clientY}))gesture.current.moved=true}} onPointerCancel={()=>{gesture.current=null}} onPointerUp={e=>{const start=gesture.current;gesture.current=null;if(start&&!start.moved&&!movedSuggestion(start,{x:e.clientX,y:e.clientY})){e.preventDefault();onChoose(course)}}} onClick={()=>onChoose(course)}><b>{course.code}</b><span>{course.title}</span></li>
}
