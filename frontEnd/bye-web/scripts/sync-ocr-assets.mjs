import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(app,'public','assets','ocr');
const require=createRequire(import.meta.url);

async function copy(from,to){
 await fs.mkdir(path.dirname(to),{recursive:true});
 await fs.copyFile(from,to);
}

async function download(url,to){
 const response=await fetch(url);if(!response.ok)throw Error(`Failed to download ${url} (${response.status})`);
 await fs.mkdir(path.dirname(to),{recursive:true});
 await fs.writeFile(to,Buffer.from(await response.arrayBuffer()));
}

const tess=path.dirname(require.resolve('tesseract.js/package.json'));
const tessRequire=createRequire(path.join(tess,'package.json'));
const core=path.dirname(tessRequire.resolve('tesseract.js-core/package.json'));
const pdf=path.dirname(require.resolve('pdfjs-dist/package.json'));

await fs.mkdir(path.join(out,'lang'),{recursive:true});
await copy(path.join(tess,'dist','worker.min.js'),path.join(out,'worker.min.js'));
for(const name of ['tesseract-core-simd-lstm.wasm.js','tesseract-core-simd-lstm.wasm','tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm']){
 await copy(path.join(core,name),path.join(out,name));
}
await copy(path.join(pdf,'build','pdf.worker.min.mjs'),path.join(out,'pdf.worker.min.mjs'));
const lang=path.join(out,'lang','eng.traineddata.gz');
try{await fs.access(lang)}catch{
 await download('https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/eng.traineddata.gz',lang);
}
console.log('Synced same-origin PDF/OCR assets into public/assets/ocr');
