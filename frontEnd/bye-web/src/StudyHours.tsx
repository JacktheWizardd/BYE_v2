import React,{useEffect,useRef,useState} from 'react';
export function parseStudyHours(text:string):number|null{
 if(!text.trim())return null;
 const value=Number(text);
 return Number.isFinite(value)&&value>=0&&value<=40&&Number.isInteger(value*2)?value:null;
}
export function StudyHours({code,value,disabled,busy,onCommit}:{code:string,value:number,disabled:boolean,busy:boolean,onCommit:(value:number)=>void}){
 const [text,setText]=useState(String(value)),[invalid,setInvalid]=useState(false),editing=useRef(false),cancelled=useRef(false),pending=useRef<number|null>(null);
 useEffect(()=>{if(!editing.current)setText(String(value))},[value]);
 useEffect(()=>{if(!busy&&pending.current!==null){const next=pending.current;pending.current=null;if(next!==value)onCommit(next)}},[busy,value]);
 const commit=()=>{editing.current=false;if(cancelled.current){cancelled.current=false;return;}const next=parseStudyHours(text);setInvalid(next===null);if(next!==null){setText(String(next));if(next!==value){if(busy)pending.current=next;else onCommit(next)}}};
 return <div className="wa-study-editor"><div className="wa-stepper"><button aria-label={'Less study for '+code} disabled={disabled||busy||value===0} onMouseDown={e=>e.preventDefault()} onClick={()=>{editing.current=false;setText(String(Math.max(0,value-.5)));setInvalid(false);onCommit(Math.max(0,value-.5))}}>−</button><input aria-label={'Study hours for '+code} aria-invalid={invalid||undefined} type="text" inputMode="decimal" enterKeyHint="done" value={text} disabled={disabled} onFocus={()=>{editing.current=true}} onChange={e=>{setText(e.target.value);setInvalid(false)}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}if(e.key==='Escape'){cancelled.current=true;editing.current=false;setText(String(value));setInvalid(false);e.currentTarget.blur()}}}/><button aria-label={'More study for '+code} disabled={disabled||busy||value===40} onMouseDown={e=>e.preventDefault()} onClick={()=>{editing.current=false;setText(String(Math.min(40,value+.5)));setInvalid(false);onCommit(Math.min(40,value+.5))}}>+</button></div>{invalid&&<small role="alert">Use 0–40 hours in half-hour steps.</small>}</div>
}
