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
test('priority African and Middle East markets are recognised in Arabic and English, on whole words only',()=>{
 assert.equal(extractRequirement('أحتاج 5 حاويات دقيق مخابز بتعبئة 50 كجم إلى بنين').destination,'بنين');
 assert.equal(extractRequirement('12500 طن دقيق إلى مالي').destination,'مالي');
 assert.equal(extractRequirement('flour to Cotonou, Benin').destination,'cotonou');
 assert.equal(extractRequirement('دقيق إلى جنوب السودان').destination,'جنوب السودان');
 assert.equal(extractRequirement('wheat flour for Nigeria').destination,'nigeria');
 assert.equal(extractRequirement('السعر الإجمالي للدقيق').destination,undefined);
 assert.equal(extractRequirement('flour for Somalia').destination,'somalia');
});
test('free wording: dialect words, number words, thousands, typos and other products',()=>{
 let r=extractRequirement('نحتاج خمس حاويات طحين للافران إلى نيجيرا');
 assert.equal(r.product,'Wheat Flour');assert.equal(r.quantity,'5 FCL');assert.equal(r.application,'Bakery');assert.equal(r.destination,'نيجيريا');
 r=extractRequirement('12,500 طن دقيق إلى مالي، الدفع مستندات مقابل الدفع');
 assert.equal(r.quantity,'12500 MT');assert.equal(r.payment,'OTHER');
 r=extractRequirement('عايزين 12 الف طن سكر ايكومسا 45 لبورتسودان سيف، والدفع اعتماد');
 assert.equal(r.payment,'L/C');
 assert.equal(r.product,'Sugar');assert.equal(r.quantity,'12000 MT');assert.equal(r.destination,'بورتسودان');assert.equal(r.incoterm,'CIF');
 r=extractRequirement('أحتاج 3 حاويات زيت عباد الشمس، عبوة 1 لتر، إلى جدة، CIF والدفع LC');
 assert.equal(r.product,'Sunflower Oil');assert.equal(r.packing,'1 L');assert.equal(r.quantity,'3 FCL');assert.equal(r.payment,'L/C');assert.equal(r.destination,'جدة');
 r=extractRequirement('need 20 containers of rice to Lagos, C&F, T/T');
 assert.equal(r.product,'Rice');assert.equal(r.quantity,'20 FCL');assert.equal(r.incoterm,'CFR');assert.equal(r.payment,'T/T');assert.equal(r.destination,'lagos');
 assert.equal(extractRequirement('أكياس 50 كجم مطبوعة بعلامتنا').product,'Custom Packaging');
 assert.equal(extractRequirement('حليب بودرة 25 كيلو إلى اليمن').product,'Milk Powder');
 assert.equal(extractRequirement('أريد حاوية واحدة أرز').quantity,'1 FCL');
});
