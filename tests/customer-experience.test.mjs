import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
async function moduleUrl(name,imports={}) {
 let source=await readFile(new URL('../apps/web/lib/'+name+'.ts',import.meta.url),'utf8');
 let js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const[path,url]of Object.entries(imports))js=js.replaceAll("'"+path+"'",JSON.stringify(url));
 return 'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
}
const inputUrl=await moduleUrl('requirement-input');
const draft=await import(await moduleUrl('composer-draft',{'./requirement-input':inputUrl}));
const contact=await import(await moduleUrl('buyer-contact'));
const journey=await import(await moduleUrl('customer-journey'));
const feed={source:'product_feed',product:{id:'flour-bakery',name:'دقيق خبازو',nameEn:'Bakery Flour',packing:'50 كجم · 25 كجم'},containerCount:5,septlionScale:'S-1',incoterm:'CIF',destination:{port:'Dar es Salaam',country:'Tanzania',code:'TZDAR'},paymentPreference:'L/C',buyer:{name:'Fixture buyer',company:'Fixture company',whatsapp:'+255712345678',email:null,whatsappStatus:'UNCONFIRMED'}};
const complete=()=>({...draft.draftFromFeed(feed,'draft-fixture'),data:{...draft.draftFromFeed(feed,'draft-fixture').data,packing:'50kg'}});

test('Feed preserves all selected details and asks only for the pack choice',()=>{
 const result=draft.draftFromFeed(feed,'fixture');
 assert.deepEqual(draft.missingRequirementFields(result.data),['packing']);
 assert.equal(result.data.product,'Bakery Flour');assert.equal(result.data.application,'Bakery');
 assert.equal(result.data.quantity,'5 FCL');assert.equal(result.data.destination,'Dar es Salaam');
 assert.match(draft.requirementQuestion('packing','ar',feed),/50 كجم · 25 كجم/);
});
test('edited Feed fields, tonnage and payment are the authoritative saved payload',()=>{
 const d={...complete(),data:{...complete().data,quantity:'٤٠ طن',destination:'Tema',payment:'T/T',packing:'25kg'},notes:'Specific quality requirement'};
 const payload=draft.requirementPayload(d);
 assert.equal(payload.quantity,'40 MT');assert.equal(payload.unit,'MT');assert.equal(payload.containerCount,null);
 assert.equal(payload.destination,'Tema');assert.equal(payload.packing,'25kg');assert.equal(payload.paymentPreference,'T/T');
 assert.equal(payload.deliveryCountry,undefined);assert.equal(payload.destinationCode,undefined);
 assert.equal(payload.sourceContext.destination.port,'Dar es Salaam');assert.equal(payload.sourceContext.reviewedRequirement.destination,'Tema');
 assert.equal(payload.knownFacts.notes,'Specific quality requirement');
});
test('existing structured details are never re-asked or replaced by an unrelated answer',()=>{
 let d=draft.draftFromFeed(feed,'fixture');
 d=draft.answerRequirement(d,'الوجهة غانا','ar');
 assert.deepEqual(draft.missingRequirementFields(d.data),['packing']);
 assert.equal(d.data.packing,undefined);assert.equal(d.data.destination,'غانا');
 d=draft.answerRequirement(d,'50 كجم','ar');
 assert.deepEqual(draft.missingRequirementFields(d.data),[]);
});
test('unknown packing remains an explicit agreement task rather than an invented pack',()=>{
 const d=draft.answerRequirement(draft.draftFromFeed(feed,'fixture'),'لا أعرف','ar');
 assert.equal(d.data.packing,'تُحدد مع Septlion');assert.doesNotMatch(d.data.packing,/50/);
});
test('reload and authentication handoff preserve edits, notes, input and conversation',()=>{
 const d={...draft.answerRequirement(complete(),'الكمية ٨ حاويات','ar'),input:'An unsent note',notes:'Buyer notes',ownerId:'buyer-1'};
 const restored=draft.restoreComposerDraft(JSON.stringify(d),'buyer-1');
 assert.deepEqual(restored,d);assert.equal(draft.requirementPayload(restored).containerCount,8);
 assert.deepEqual(draft.requirementPayload(restored).knownFacts.conversation,['الكمية ٨ حاويات']);
});
test('a submitted draft keeps its saved reference and cannot appear for another account',()=>{
 const d={...complete(),ownerId:'buyer-1',savedRequirementId:'requirement-1'};
 assert.equal(draft.restoreComposerDraft(JSON.stringify(d),'buyer-1').savedRequirementId,'requirement-1');
 assert.equal(draft.restoreComposerDraft(JSON.stringify(d),'buyer-2'),null);
 assert.equal(draft.restoreComposerDraft(JSON.stringify(d)),null);
 assert.equal(draft.restoreComposerDraft('{'),null);
});
test('invalid quantity is retained for correction and is not silently truncated or defaulted',()=>{
 for(const quantity of ['0 FCL','7.5 FCL','-5 FCL','1000000001 FCL','8','forty containers']){
  const d={...complete(),data:{...complete().data,quantity}};
  assert.ok(draft.missingRequirementFields(d.data).includes('quantity'));assert.throws(()=>draft.requirementPayload(d));
 }
 for(const message of ['7.5 FCL','-5 حاويات']){
  const d=draft.answerRequirement(complete(),message,'ar');
  assert.ok(draft.missingRequirementFields(d.data).includes('quantity'));
 }
 assert.deepEqual(draft.quantityDetails('١٢,٥ MT'),{amount:12.5,unit:'MT'});
});
test('freeform quantity overrides Home defaults and a complete summary preserves explicit terms',()=>{
 const d=draft.answerRequirement({...draft.emptyComposerDraft('home'),data:{quantity:'1 FCL',incoterm:'CIF',payment:'L/C'}},'٥ حاويات دقيق مخابز ٥٠ كجم إلى تنزانيا','ar');
 assert.deepEqual(draft.missingRequirementFields(d.data),[]);assert.equal(draft.requirementPayload(d).containerCount,5);
});
test('international phone accepts Arabic digits and optional email is truly optional',()=>{
 assert.equal(contact.normalizePhone('+٢٥٥ (٧١٢) ٣٤٥-٦٧٨'),'+255712345678');
 assert.equal(contact.buyerContactProblem({name:'Buyer',company:'Company',phone:'+255712345678',email:''}),'');
 for(const phone of ['255712345678','+123','+2557abc12345678','++255712345678'])assert.notEqual(contact.buyerContactProblem({name:'Buyer',company:'Company',phone,email:''}),'');
 assert.match(contact.buyerContactProblem({name:'Buyer',company:'Company',phone:'+255712345678',email:'invalid'}),/اختياري/);
});
test('stage navigation carries the exact request, offer and transaction, never another active trade',()=>{
 const links=journey.tradeNavigation({requestId:'request A',offerId:'offer A',transactionId:'transaction A'});
 assert.equal(links[0].href,'/request?id=request%20A');assert.equal(links[1].href,'/offer?id=offer%20A');
 for(const link of links.slice(2))assert.match(link.href,/\?id=transaction%20A$/);
 assert.ok(journey.tradeNavigation({requestId:'new-request'}).slice(2).every(x=>x.href===null));
 assert.ok(journey.tradeNavigation().every(x=>x.href===null));
});
test('an open claim takes priority over receipt, and only completion proposes reorder',()=>{
 const w={item:{id:'trade-1',status:'DELIVERED'},claims:[{status:'OPEN'}]};
 assert.equal(journey.buyerNextAction(w).owner,'Septlion');assert.match(journey.buyerNextAction(w).title,/مطالبتك/);
 w.claims=[];assert.equal(journey.buyerNextAction(w).owner,'أنت');assert.equal(journey.buyerNextAction(w).href,'/receive?id=trade-1');
 w.item.status='COMPLETED';assert.equal(journey.buyerNextAction(w).href,'/reorder?id=trade-1');assert.match(journey.buyerNextAction(w).detail,/جديد/);
});
test('expired, draft and accepted offers cannot initiate acceptance',()=>{
 const now=Date.parse('2026-10-07T12:00:00Z'),future='2026-10-08T12:00:00Z';
 assert.equal(journey.canAcceptOffer('ISSUED',future,now),true);
 for(const[status,date]of [['ISSUED','2026-10-06T12:00:00Z'],['ISSUED',null],['DRAFT',future],['ACCEPTED',future],['REVISED','invalid']])assert.equal(journey.canAcceptOffer(status,date,now),false);
});

test('reorder reaches a review draft without copying the old price or shipping date',()=>{
 const workspace={item:{id:'previous-trade',status:'COMPLETED',testOnly:true},commercialLock:{snapshot:{product:'Fixture flour',items:[{description:'Fixture flour',quantity:5,unit:'FCL',unitPrice:999}],terms:{incoterm:'CIF',destination:'Dar es Salaam',packing:'50kg',payment:'L/C',shipDate:'2026-01-01'}}}};
 let d=draft.draftFromReorder(workspace,'stable-reorder-key');
 assert.deepEqual(draft.missingComposerFields(d),[]);assert.doesNotMatch(JSON.stringify(d),/unitPrice|shipDate|999|2026-01-01/);
 d=draft.answerRequirement(d,'٨ حاويات إلى غانا','ar');
 assert.equal(d.data.destination,'Dar es Salaam');assert.equal(d.data.quantity,'8 FCL');
 assert.deepEqual(draft.reorderPayload(d),{transactionId:'previous-trade',quantity:8,idempotencyKey:'stable-reorder-key'});
 assert.equal(draft.restoreComposerDraft(JSON.stringify(d)).reorder.testOnly,true);
 assert.throws(()=>draft.draftFromReorder({...workspace,item:{...workspace.item,status:'DELIVERED'}},'key'));
});
test('reorder rejects changing the original unit and preserves its retry key across reload',()=>{
 const d={...complete(),reorder:{transactionId:'previous-trade',unit:'FCL',testOnly:false},data:{...complete().data,quantity:'40 MT'}};
 assert.deepEqual(draft.missingComposerFields(d),['quantity']);assert.throws(()=>draft.reorderPayload(d));
 d.data.quantity='8 FCL';assert.equal(draft.reorderPayload(draft.restoreComposerDraft(JSON.stringify(d))).idempotencyKey,d.id);
});
const apiFixtureUrl='data:text/javascript;base64,'+Buffer.from("export function hasSession(){return true} export async function edge(){throw new Error('Fixture server unavailable')}").toString('base64');
const tradeData=await import(await moduleUrl('trade-data',{'./api':apiFixtureUrl}));
test('failed server reads stay explicit instead of falling back to another local draft',async()=>{
 await assert.rejects(tradeData.tradeRequests(),/Fixture server unavailable/);
 await assert.rejects(tradeData.tradeRequestDetails('foreign-request'),/Fixture server unavailable/);
});
test('tonnage and missing quantity are never displayed as a default container',()=>{
 const base={id:'request-1',product:'Fixture',status:'OPEN',createdAt:'2026-10-07'};
 assert.equal(tradeData.mapRequirement({...base,quantity:40,unit:'MT',containerCount:null}).quantityLabel,'40 MT');
 assert.equal(tradeData.mapRequirement(base).containers,0);
 assert.doesNotMatch(tradeData.mapRequirement(base).quantityLabel,/1 حاويات/);
});
test('a generic flour packing answer preserves the selected product variant',()=>{
 const d=draft.answerRequirement(draft.draftFromFeed(feed,'fixture'),'50 كجم من الدقيق','ar');
 assert.equal(d.data.product,'Bakery Flour');assert.equal(d.data.packing,'50kg');
 const changed=draft.answerRequirement(d,'أحتاج دقيق كامل','ar');assert.equal(changed.data.product,'Whole Wheat Flour');
});
test('reorder preserves original unit semantics and supports non-container quantities',()=>{
 for(const[unit,quantity]of [['TEU',8],['MT',12.5],['BAG',100]]){
  const w={item:{id:'trade',status:'COMPLETED',testOnly:false},commercialLock:{snapshot:{items:[{description:'Fixture',quantity,unit}],terms:{}}}};
  const d=draft.draftFromReorder(w,'retry-key');
  assert.equal(d.reorder.unit,unit);assert.equal(d.data.quantity,quantity+' '+unit);assert.equal(draft.reorderPayload(d).quantity,quantity);
 }
});
