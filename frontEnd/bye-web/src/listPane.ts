import {useEffect,useRef} from 'react';
import {readView,writeView} from './viewState';
// On wide screens the professor list scrolls on its own beside the report (.compare-v21 in wa.css).
// CSS alone would size the list as if the page header had already scrolled away, leaving its last rows under the
// window edge at the top of the page, so this measures where the list starts. It also remembers how far the list was
// scrolled, and keeps the open professor's row showing when the list resizes or another professor is opened.
const GAP=16; // the list's sticky top in wa.css; the same space is kept beneath it
const EDGE=8; // room left between a revealed row and the list's edge, so its outline is not cut off
type Edges={top:number,bottom:number};
/** How far a list must scroll to show a row: negative is up, 0 when the whole row already shows. */
export function revealShift(list:Edges,row:Edges){
 if(row.top<list.top)return row.top-list.top;
 return row.bottom>list.bottom?Math.min(row.bottom-list.bottom,row.top-list.top):0;
}
/** Where the list's top edge counts as starting: never above its sticky position, even when the page end pushes it up. */
export const listTop=(top:number)=>Math.max(GAP,Math.round(top));
/** Whether the list keeps the wheel to itself at its ends. Only a list too long for the window does, and only while all of
 *  it is on screen: a shorter one lets the page scroll on, which soon makes room for the whole list. */
export const keepsWheel=(content:number,windowHeight:number,bottom:number)=>content>windowHeight-2*GAP+1&&bottom<=windowHeight+1;
export function useListPane(key:string,selected?:string){
 const show=useRef<()=>void>(undefined),first=useRef(true);
 useEffect(()=>{
  const list=document.querySelector<HTMLElement>('.compare-v21');if(!list)return;
  const wide=matchMedia('(min-width:768px)'),store='listScroll:'+key;let top=0,frame=0;
  const shift=(inset=0)=>{const row=list.querySelector<HTMLElement>('.prof-row.open');if(!row)return 0;const box=list.getBoundingClientRect();return revealShift({top:box.top+inset,bottom:box.bottom-inset},row.getBoundingClientRect())};
  const reveal=()=>{if(wide.matches&&shift()!==0)list.scrollTop+=shift(EDGE)};
  const fit=()=>{
   if(!wide.matches)return;
   const next=listTop(list.getBoundingClientRect().top);
   if(next!==top){const showing=shift()===0;top=next;list.style.setProperty('--list-top',next+'px');if(showing)reveal()}
   list.toggleAttribute('data-scrolls',keepsWheel(list.scrollHeight,innerHeight,list.getBoundingClientRect().bottom));
  };
  const later=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  const remember=()=>writeView(store,list.scrollTop);
  fit();const saved=readView<number>(store,-1);if(saved>=0)list.scrollTop=saved;else reveal();
  addEventListener('scroll',fit,{passive:true});addEventListener('resize',fit);list.addEventListener('scroll',remember,{passive:true});
  const watch=typeof ResizeObserver==='undefined'?null:new ResizeObserver(later),main=list.closest('main');
  watch?.observe(list);if(main)watch?.observe(main);
  show.current=reveal;
  return()=>{cancelAnimationFrame(frame);removeEventListener('scroll',fit);removeEventListener('resize',fit);list.removeEventListener('scroll',remember);watch?.disconnect();show.current=undefined};
 },[key]);
 useEffect(()=>{if(first.current){first.current=false;return}show.current?.()},[selected]);
}
