import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
async function importLocal(path, replacements={}){
  let source=await readFile(new URL('../apps/web/lib/'+path+'.ts',import.meta.url),'utf8');
  let js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [k,v] of Object.entries(replacements))js=js.replaceAll("'"+k+"'",JSON.stringify(v));
  return 'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
}
const original=await importLocal('requirement-input');
const fallback=await import(await importLocal('requirement-fallback',{'./requirement-input':original}));
test('Arabic sourcer example is understood with Gemini unavailable',()=>{
 const result=fallback.interpretLocally('أحتاج حاويتين دقيق قمح إلى مومباسا');
 assert.equal(result.ready,true);
 assert.equal(result.fields.product,'Wheat Flour');
 assert.equal(result.fields.quantity,'2 FCL');
 assert.equal(result.fields.destination,'مومباسا');
 assert.equal(result.mode,'basic');
});
test('does not fabricate commercial terms, destination or unknown quantity',()=>{
 const result=fallback.interpretLocally('أريد سمسم');
 assert.equal(result.fields.product,'Sesame');
 assert.equal(result.fields.quantity,'');
 assert.equal(result.fields.destination,'');
 assert.equal(result.fields.incoterm,'');
 assert.equal(result.fields.payment,'');
 assert.equal(result.ready,false);
 assert.deepEqual(result.missing,['quantity','destination']);
});
test('explicit terms remain separate and no arbitrary content becomes a product',()=>{
 const result=fallback.interpretLocally('٥ حاويات دقيق ٥٠ كجم إلى السعودية CIF L/C');
 assert.equal(result.fields.quantity,'5 FCL');
 assert.equal(result.fields.packing,'50kg');
 assert.equal(result.fields.payment,'L/C');
 assert.equal(result.fields.incoterm,'CIF');
 assert.equal(result.ready,true);
 assert.equal(fallback.interpretLocally('السلام عليكم').fields.product,'');
});
test('API route uses fast fallback unless Gemini was explicitly verified',async()=>{
 const source=await readFile(new URL('../apps/web/app/api/interpret-requirement/route.ts',import.meta.url),'utf8');
 assert.ok(source.includes("process.env.GEMINI_ENABLED !== 'true'"));
 assert.ok(source.includes('return fallback();'));
 assert.ok(source.includes('interpretLocally(text)'));
});
