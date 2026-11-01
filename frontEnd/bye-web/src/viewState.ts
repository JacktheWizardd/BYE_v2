import {useEffect,useState} from 'react';
let user='',values:Record<string,unknown>={};const listeners=new Set<()=>void>();
const prefix='bye-web:views:v1:';
export function activateViews(id:string){user=id;try{const v=JSON.parse(sessionStorage.getItem(prefix+id)??'{}');values=v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{values={}}for(const fn of listeners)fn()}
export function clearViews(){try{sessionStorage.removeItem(prefix+user)}catch{}user='';values={};for(const fn of listeners)fn()}
export function readView<T>(key:string,fallback:T):T{const value=values[key];if(value===undefined||fallback!==null&&(typeof value!==typeof fallback||Array.isArray(value)!==Array.isArray(fallback)))return fallback;return value as T}
export function writeView(key:string,value:unknown){if(!user)return;values[key]=value;try{sessionStorage.setItem(prefix+user,JSON.stringify(values))}catch{}}
export function useViewState<T>(key:string,fallback:T):[T,(next:T|((old:T)=>T))=>void]{const [value,setValue]=useState<T>(()=>readView(key,fallback));useEffect(()=>{const reload=()=>setValue(readView(key,fallback));listeners.add(reload);reload();return()=>{listeners.delete(reload)}},[key]);return [value,next=>setValue(old=>{const value=typeof next==='function'?(next as (old:T)=>T)(old):next;writeView(key,value);return value})]}
export function searchDestination(){const route=readView('searchRoute','/search');return typeof route==='string'&&/^\/(search(?:\?|$)|results(?:\?|$)|report\/)/.test(route)?route:'/search'}
