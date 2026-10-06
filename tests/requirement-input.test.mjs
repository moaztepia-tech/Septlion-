import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';

const source=await readFile(new URL('../apps/web/lib/requirement-input.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {extractRequirement,mergeRequirementInput}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('typed container count overrides the one-container starter default',()=>{
 const result=mergeRequirementInput('أحتاج 5 حاويات دقيق مخابز إلى تنزانيا',{quantity:'1 FCL',destination:'Mombasa',incoterm:'CIF',payment:'L/C'});
 assert.equal(result.quantity,'5 FCL');assert.equal(result.destination,'تنزانيا');assert.equal(result.product,'Wheat Flour');assert.equal(result.application,'Bakery');assert.equal(result.incoterm,'CIF');assert.equal(result.payment,'L/C');
});
test('Arabic digits and packing remain separate commercial fields',()=>{
 const result=extractRequirement('٥ حاويات دقيق مخابز ٥٠ كجم إلى السعودية');
 assert.equal(result.quantity,'5 FCL');assert.equal(result.packing,'50kg');assert.equal(result.destination,'السعودية');
});
test('typed tonnage and terms override defaults without being changed to FCL',()=>{
 const result=mergeRequirementInput('500 MT flour 25kg FOB T/T',{quantity:'1 FCL',incoterm:'CIF',payment:'L/C'});
 assert.equal(result.quantity,'500 MT');assert.equal(result.packing,'25kg');assert.equal(result.incoterm,'FOB');assert.equal(result.payment,'T/T');
});
test('a product-only request preserves the selected port and terms',()=>{
 assert.deepEqual(mergeRequirementInput('Pasta',{quantity:'8 FCL',destination:'Jeddah Islamic Port',incoterm:'CFR',payment:'L/C'}),{quantity:'8 FCL',destination:'Jeddah Islamic Port',incoterm:'CFR',payment:'L/C',product:'Pasta'});
 assert.deepEqual(extractRequirement(''),{});
});
