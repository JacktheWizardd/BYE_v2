import {extractPdfDocument,readLocalPdf} from './pdfReader';
import {ocrPageItems} from './ocr';
import {reconstructEducationPlan} from './reconstruct';
import type {EducationPlan,ExtractedDocument} from './types';

export type ProcessResult={
 document:ExtractedDocument;
 plan:EducationPlan;
 warnings:string[];
};

/** Local-only PDF import: never uploads the document bytes. */
export async function processLocalEducationPlanPdf(file:File,onProgress?:(message:string)=>void):Promise<ProcessResult>{
 onProgress?.('Reading local PDF…');
 const {bytes,fingerprint}=await readLocalPdf(file);
 const document=await extractPdfDocument(bytes,fingerprint,{
  ocrPage:ocrPageItems,
  onProgress,
 });
 onProgress?.('Reconstructing terms and courses…');
 const {plan,warnings}=reconstructEducationPlan({
  fingerprint:document.fingerprint,
  pages:document.pages,
  items:document.items,
 });
 return {document,plan,warnings:[...document.warnings,...warnings]};
}
