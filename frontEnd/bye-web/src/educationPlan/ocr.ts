import {createWorker,type Worker} from 'tesseract.js';
import type {TextItem} from './types';

type OcrBBox={x0:number,y0:number,x1:number,y1:number};
type OcrWord={text?:string,bbox:OcrBBox,words?:OcrWord[],paragraphs?:OcrWord[],lines?:OcrWord[]};

const OCR_BASE='/assets/ocr';
let shared:Worker|null=null;
let starting:Promise<Worker>|null=null;

async function worker():Promise<Worker>{
 if(shared)return shared;
 if(starting)return starting;
 starting=createWorker('eng',1,{
  workerPath:`${OCR_BASE}/worker.min.js`,
  corePath:`${OCR_BASE}`,
  langPath:`${OCR_BASE}/lang`,
  gzip:true,
  workerBlobURL:false,
  logger:()=>{},
 }).then(w=>{shared=w;return w}).finally(()=>{starting=null});
 return starting;
}

function collectWords(node:OcrWord|undefined,out:OcrWord[]){
 if(!node)return;
 if(node.words?.length){for(const word of node.words)collectWords(word,out);return}
 if(node.paragraphs?.length){for(const p of node.paragraphs)collectWords(p,out);return}
 if(node.lines?.length){for(const line of node.lines)collectWords(line,out);return}
 if(node.text?.trim()&&node.bbox)out.push(node);
}

/** OCR one rendered page into positioned text items using same-origin Tesseract assets. */
export async function ocrPageItems(page:number,canvas:HTMLCanvasElement):Promise<TextItem[]>{
 const w=await worker();
 const result=await w.recognize(canvas,{},{text:true,blocks:true});
 const data=result.data as unknown as {words?:OcrWord[],blocks?:OcrWord[]};
 const words:OcrWord[]=[];
 if(Array.isArray(data.words))words.push(...data.words);
 else if(Array.isArray(data.blocks))for(const block of data.blocks)collectWords(block,words);
 const pageWidth=Number(canvas.dataset.pageWidth||canvas.width);
 const pageHeight=Number(canvas.dataset.pageHeight||canvas.height);
 const sx=pageWidth/canvas.width;
 const sy=pageHeight/canvas.height;
 return words.filter(word=>word.text?.trim()).map(word=>{
  const box=word.bbox;
  return {
   str:word.text!.trim(),
   page,
   x:box.x0*sx,
   y:box.y0*sy,
   w:Math.max((box.x1-box.x0)*sx,1),
   h:Math.max((box.y1-box.y0)*sy,1),
  } satisfies TextItem;
 });
}

export async function disposeOcr(){
 if(shared){await shared.terminate();shared=null}
}
