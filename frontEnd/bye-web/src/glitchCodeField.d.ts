export type GlitchPhase='idle'|'verify'|'wrong'|'ok'|'locked';
export interface GlitchCodeField{set(state:{raw?:string,phase?:GlitchPhase,secondsLeft?:number,peek?:boolean,focused?:boolean}):void;destroy():void}
export function createGlitchCodeField(canvas:HTMLCanvasElement,opts?:{font?:string}):GlitchCodeField;
