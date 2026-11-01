import React,{useEffect,useRef,useState} from 'react';import {formatAccessCode} from './access';
import {createGlitchCodeField,type GlitchCodeField,type GlitchPhase} from './glitchCodeField';
export type CodePhase=Exclude<GlitchPhase,'ok'>;
const rawCode=(value:string)=>value.replace(/[^a-z0-9]/gi,'').toUpperCase();
const clock=(s:number)=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
export function codeStatus(phase:CodePhase,count:number,secondsLeft=0):[string,string]{
 if(phase==='verify')return ['DISPLACING…','CHECKING'];
 if(phase==='wrong')return ['✕ NO MATCH','TRY AGAIN'];
 if(phase==='locked')return ['⚠ ACCESS DENIED','LOCKOUT '+clock(secondsLeft)];
 return ['GRID '+count+' / 8','HOLD PEEK TO ASSEMBLE'];
}
// The real password input sits invisibly on top of a canvas that draws the
// grid-displacement glitch. Typing always appends at the end so the visual
// slots stay in order; paste and autofill still go through onChange.
export function CodeInput({id,value,onChange,readOnly,disabled,phase='idle',secondsLeft=0,children}:{id:string,value:string,onChange:(value:string)=>void,readOnly?:boolean,disabled?:boolean,phase?:CodePhase,secondsLeft?:number,children?:React.ReactNode}){
 const canvas=useRef<HTMLCanvasElement>(null),field=useRef<GlitchCodeField|null>(null),[focused,setFocused]=useState(false),[peek,setPeek]=useState(false),[ready,setReady]=useState(false);
 const raw=rawCode(value),peekOff=!raw||phase==='verify'||phase==='locked'||!!disabled;
 useEffect(()=>{if(!canvas.current)return;let f:GlitchCodeField;try{f=createGlitchCodeField(canvas.current,{font:'Mono, "JetBrains Mono", ui-monospace, monospace'});field.current=f;setReady(true)}catch{setReady(false);return}return()=>{f.destroy();field.current=null}},[]);
 useEffect(()=>{field.current?.set({raw,phase,secondsLeft,focused,peek:peek&&!peekOff})},[raw,phase,secondsLeft,focused,peek,peekOff]);
 useEffect(()=>{if(peekOff)setPeek(false)},[peekOff]);
 const key=(e:React.KeyboardEvent<HTMLInputElement>)=>{if(readOnly||disabled||e.metaKey||e.ctrlKey||e.altKey)return;if(/^[a-z0-9]$/i.test(e.key)){e.preventDefault();if(raw.length<8)onChange(formatAccessCode(raw+e.key))}else if(e.key==='Backspace'){e.preventDefault();onChange(formatAccessCode(raw.slice(0,-1)))}};
 const [left,right]=codeStatus(phase,raw.length,secondsLeft);
 const hold=(on:boolean)=>()=>{if(!peekOff||!on)setPeek(on)};
 return <div className={'glitch-code is-'+phase}>
  <div className={'glitch-box'+(ready?' canvas-ready':' canvas-fallback')}><canvas ref={canvas} aria-hidden="true"/><input id={id} type={!ready&&peek&&!peekOff?'text':'password'} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} value={value} readOnly={readOnly} disabled={disabled} aria-invalid={phase==='wrong'||undefined} aria-describedby={id+'-strip'} onKeyDown={key} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>onChange(formatAccessCode(e.target.value))}/></div>
  <div className="glitch-strip" id={id+'-strip'}><span>{left}</span><span>{right}</span></div>
  <div className="glitch-actions"><button type="button" className="glitch-peek" aria-pressed={peek&&!peekOff} disabled={peekOff} onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerLeave={hold(false)} onPointerCancel={hold(false)} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();hold(true)()}}} onKeyUp={hold(false)} onBlur={hold(false)}>HOLD TO PEEK</button>{children}</div>
 </div>
}
