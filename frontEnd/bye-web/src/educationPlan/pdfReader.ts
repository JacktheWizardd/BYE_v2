import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import type {ExtractedDocument,PageGeom,TextItem} from './types';
import {MAX_LOCAL_PDF_BYTES,MAX_PLAN_PAGES} from './types';

let workerReady=false;
function ensureWorker(){
 if(workerReady)return;
 GlobalWorkerOptions.workerSrc='/assets/ocr/pdf.worker.min.mjs';
 workerReady=true;
}

export async function fingerprintBytes(bytes:ArrayBuffer):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function readLocalPdf(file:File):Promise<{bytes:ArrayBuffer,fingerprint:string}>{
 if(file.type&&file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw Error('Choose a local PDF education plan.');
 if(file.size<=0)throw Error('That PDF is empty.');
 if(file.size>MAX_LOCAL_PDF_BYTES)throw Error('PDF is larger than the 20 MiB local processing limit.');
 const bytes=await file.arrayBuffer();
 return {bytes,fingerprint:await fingerprintBytes(bytes)};
}

function asTextItem(item:Record<string,unknown>,page:number,viewportHeight:number):TextItem|null{
 if(typeof item.str!=='string'||!item.str||!Array.isArray(item.transform))return null;
 const tx=item.transform as number[];
 const x=tx[4];
 const fontHeight=Math.hypot(tx[2],tx[3])||Math.abs(tx[0])||10;
 const y=viewportHeight-(tx[5]+fontHeight);
 const w=typeof item.width==='number'?item.width:Math.max(item.str.length*fontHeight*0.5,4);
 return {str:item.str,page,x,y,w,h:fontHeight};
}

export async function extractPdfDocument(bytes:ArrayBuffer,fingerprint:string,options?:{ocrPage?:(page:number,canvas:HTMLCanvasElement)=>Promise<TextItem[]>,onProgress?:(message:string)=>void}):Promise<ExtractedDocument>{
 ensureWorker();
 const warnings:string[]=[];
 const loading=getDocument({data:bytes,useSystemFonts:true,disableFontFace:false});
 const pdf:PDFDocumentProxy=await loading.promise;
 if(pdf.numPages<1)throw Error('PDF has no pages.');
 if(pdf.numPages>MAX_PLAN_PAGES)throw Error(`PDF has ${pdf.numPages} pages; the importer accepts at most ${MAX_PLAN_PAGES}.`);
 const pages:PageGeom[]=[];
 const items:TextItem[]=[];
 const pageImages:string[]=[];

 for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
  options?.onProgress?.(`Reading page ${pageNumber} of ${pdf.numPages}…`);
  const page=await pdf.getPage(pageNumber);
  const viewport=page.getViewport({scale:1});
  pages.push({width:viewport.width,height:viewport.height});
  const textContent=await page.getTextContent();
  const pageItems=textContent.items
   .map(item=>asTextItem(item as unknown as Record<string,unknown>,pageNumber,viewport.height))
   .filter((v):v is TextItem=>!!v);
  const chars=pageItems.reduce((n,i)=>n+i.str.replace(/\s+/g,'').length,0);

  const renderScale=Math.min(2,1400/Math.max(viewport.width,1));
  const renderViewport=page.getViewport({scale:renderScale});
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(renderViewport.width);
  canvas.height=Math.ceil(renderViewport.height);
  canvas.dataset.pageWidth=String(viewport.width);
  canvas.dataset.pageHeight=String(viewport.height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas rendering is unavailable in this browser.');
  await page.render({canvas,canvasContext:ctx,viewport:renderViewport}).promise;
  pageImages.push(canvas.toDataURL('image/jpeg',0.72));

  if(chars>=24)items.push(...pageItems);
  else if(options?.ocrPage){
   options.onProgress?.(`OCR on page ${pageNumber} (little selectable text)…`);
   const ocrItems=await options.ocrPage(pageNumber,canvas);
   if(ocrItems.length)items.push(...ocrItems);
   else warnings.push(`Page ${pageNumber} produced little text even after OCR.`);
  }else{
   warnings.push(`Page ${pageNumber} has little selectable text; OCR was unavailable.`);
   items.push(...pageItems);
  }
  page.cleanup();
 }
 await pdf.cleanup();
 return {fingerprint,pages,items,pageImages,warnings};
}
