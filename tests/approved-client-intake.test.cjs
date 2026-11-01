const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Intake = require('../release-output/intake.js');
const catalog = JSON.parse(fs.readFileSync(new URL('../release-output/data/products.json', `file://${__filename}`), 'utf8')).products;
const talk = (messages, draft=Intake.create()) => { let result; for(const text of messages) {result=Intake.consume(draft,text,catalog);draft=result.draft;} return result; };

test('Arabic-only message preserves the useful fields instead of rejecting the text',()=>{
 const r=talk(['أحتاج دقيق للمخابز، ٣ حاويات، جوالات ٥٠ كيلو، إلى بورتسودان']);
 assert.equal(r.draft.fields.product,'دقيق للمخابز');assert.equal(r.draft.fields.quantity,'3 حاوية');
 assert.equal(r.draft.fields.packaging,'شوال 50 كجم');assert.equal(r.draft.fields.destination,'بورتسودان');
 assert.equal(r.question.key,'deadline');assert.deepEqual(r.matches,['khabbazo50']);
});
test('Sudanese dual quantity is understood',()=>{
 const r=talk(['داير حاويتين زيت عباد الشمس إلى بورتسودان']);assert.equal(r.draft.fields.quantity,'2 حاوية');
 assert.equal(r.question.key,'packaging');
});
test('complete trade terms are extracted from the approved oil example',()=>{
 const r=talk(['أحتاج ٣ حاويات زيت عباد الشمس، عبوة ١ لتر، إلى ميناء جدة الإسلامي، CIF والدفع LC']);
 assert.equal(r.draft.fields.packaging,'عبوة 1 لتر');assert.equal(r.draft.fields.incoterm,'CIF');
 assert.equal(r.draft.fields.payment,'LC — اعتماد مستندي');assert.equal(r.question.key,'deadline');
 assert.deepEqual(r.matches,['oil1']);
});
test('pack weight is never mistaken for the shipping quantity',()=>{
 const r=talk(['أحتاج دقيق في شوال ٥٠ كجم إلى السودان']);assert.equal(r.draft.fields.quantity,undefined);
 assert.equal(r.draft.fields.packaging,'شوال 50 كجم');assert.equal(r.question.key,'quantity');
});
test('tonnage is kept as tonnage without an invented container conversion',()=>{
 const r=talk(['أحتاج ١٠٠ طن دقيق، شوال ٥٠ كجم، إلى السودان']);assert.equal(r.draft.fields.quantity,'100 طن');
});
test('Arabic quantities expressed in words are supported',()=>{
 const r=talk(['أحتاج ثلاثة وعشرين طن دقيق إلى مصر']);assert.equal(r.draft.fields.quantity,'23 طن');
});
test('greeting asks one relevant question',()=>{
 const r=talk(['السلام عليكم']);assert.equal(r.question.key,'product');assert.equal(r.draft.fields.product,undefined);
});
test('price inquiry does not invent a quantity from the word ton',()=>{
 const r=talk(['كم سعر طن الدقيق للتصدير؟']);assert.equal(r.draft.fields.intent,'price');assert.equal(r.draft.fields.quantity,undefined);
});
test('general oil request asks about the oil type before other details',()=>{
 const r=talk(['عايز زيت','عباد الشمس']);assert.equal(r.draft.fields.product,'زيت عباد الشمس');assert.equal(r.question.key,'quantity');
});
test('private-label goal asks for the product and does not substitute a catalog brand',()=>{
 const r=talk(['أريد تصنيع منتج غذائي بعلامتي الخاصة']);assert.equal(r.draft.fields.intent,'manufacture');
 assert.equal(r.draft.fields.brand,'بعلامتي الخاصة');assert.equal(r.question.key,'product');assert.deepEqual(r.matches,[]);
});
test('unknown category can continue as a custom commercial request',()=>{
 const r=talk(['أحتاج مضخات ري إلى كينيا']);assert.match(r.draft.fields.product,/مضخات/);assert.deepEqual(r.matches,[]);
});
test('missing information can be deferred without asking for it again',()=>{
 const r=talk(['أحتاج دقيق إلى السودان','لا أعرف بعد','شوال 50 كجم','لا أعرف بعد']);
 assert.equal(r.question,null);assert.ok(r.draft.skipped.includes('quantity'));assert.ok(r.draft.skipped.includes('deadline'));
});
test('destination correction replaces the prior destination in the draft and summary',()=>{
 const r=talk(['أحتاج ٣ حاويات دقيق، شوال ٥٠ كجم، إلى جدة','بدل جدة إلى بورتسودان']);
 assert.equal(r.draft.fields.destination,'بورتسودان');assert.doesNotMatch(Intake.summary(r.draft),/جدة/);
});
test('quantity correction can reuse the explicitly stated previous unit',()=>{
 const r=talk(['أحتاج ٣ حاويات دقيق إلى السودان','بدل 3 حاويات خليها 5']);assert.equal(r.draft.fields.quantity,'5 حاوية');
});
test('latest payment instruction is respected in both directions',()=>{
 let r=talk(['أحتاج دقيق والدفع LC','بدل LC خليها TT']);assert.equal(r.draft.fields.payment,'TT — تحويل بنكي');
 r=talk(['بدل TT خليها LC'],r.draft);assert.equal(r.draft.fields.payment,'LC — اعتماد مستندي');
});
test('changing product category clears stale pack size and catalog selection',()=>{
 let r=talk(['أحتاج ٣ حاويات دقيق، شوال ٥٠ كجم، إلى السودان']);
 r=Intake.choose(r.draft,'asasi50',catalog);r=talk(['بدل الدقيق زيت عباد الشمس'],r.draft);
 assert.equal(r.draft.fields.packaging,undefined);assert.equal(r.draft.catalogProductId,null);assert.equal(r.question.key,'packaging');
});
test('catalog selection requires an explicit client choice and fills approved packaging',()=>{
 const r=talk(['أحتاج ٣ حاويات دقيق للمخابز إلى السودان']);assert.equal(r.draft.catalogProductId,null);
 const chosen=Intake.choose(r.draft,'khabbazo50',catalog);assert.equal(chosen.draft.catalogProductId,'khabbazo50');
 assert.equal(chosen.draft.fields.packaging,'شوال منسوج 50 كجم');assert.equal(chosen.question.key,'deadline');
});
test('English units do not become an incorrect Arabic unit',()=>{
 const r=talk(['I need 3 containers sunflower oil to Jeddah']);assert.equal(r.draft.fields.quantity,'3 حاوية');
});
test('logistics origin does not overwrite an already supplied destination',()=>{
 const r=talk(['أريد شحن حاوية إلى السودان','من مصر']);assert.equal(r.draft.fields.destination,'السودان');assert.equal(r.draft.fields.origin,'مصر');
});
test('bare reply to the origin question is treated as origin rather than a replacement destination',()=>{
 const r=talk(['أريد شحن حاوية إلى السودان','مصر']);assert.equal(r.draft.fields.destination,'السودان');assert.equal(r.draft.fields.origin,'مصر');
});
test('a country name embedded within another country does not replace it',()=>{
 const r=talk(['أحتاج 3 حاويات دقيق','جنوب السودان']);assert.equal(r.draft.fields.destination,'جنوب السودان');
});
test('another product type asks for its name rather than recording the phrase as a product',()=>{
 const r=talk(['أحتاج زيت','نوع آخر']);assert.equal(r.draft.fields.product,undefined);assert.equal(r.question.key,'product');
});
test('zero shipping quantity cannot silently become a valid order quantity',()=>{
 const r=talk(['أحتاج 0 حاويات دقيق']);assert.equal(r.draft.fields.quantity,undefined);assert.equal(r.question.key,'quantity');assert.equal(r.draft.pending,'quantity');
});
test('review form is prefilled from the conversation',()=>{
 const r=talk(['أحتاج ٣ حاويات زيت عباد الشمس، عبوة ١ لتر، إلى جدة CIF والدفع LC','خلال شهر']);
 const d=Intake.details(r.draft);assert.equal(d.quantity,'3 حاوية');assert.equal(d.destination,'جدة');
 assert.match(d.terms,/CIF/);assert.match(d.terms,/عبوة 1 لتر/);assert.equal(r.question,null);
});
test('manual review changes appear in the structured draft rather than leaving conflicting values',()=>{
 const r=talk(['أحتاج ٣ حاويات زيت عباد الشمس، عبوة ١ لتر، إلى جدة CIF والدفع LC']);
 const d=Intake.review(r.draft,{quantity:'5 حاويات',destination:'بورتسودان',phone:'+249123456789',terms:'التعبئة: عبوة 1 لتر\nالتسليم: FOB\nالدفع: TT — تحويل بنكي'});
 assert.equal(d.fields.quantity,'5 حاويات');assert.equal(d.fields.incoterm,'FOB');assert.equal(d.fields.payment,'TT — تحويل بنكي');
 assert.doesNotMatch(Intake.summary(d),/CIF|جدة/);
});
test('request serialization contains text only and no execution from markup input',()=>{
 const r=talk(['أحتاج <img src=x onerror=alert(1)> مضخات إلى تشاد']);
 assert.equal(typeof Intake.summary(r.draft),'string');assert.equal(r.draft.fields.destination,'تشاد');
});
