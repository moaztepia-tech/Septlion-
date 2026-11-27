import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../supabase/functions/interpret-requirement/interpret.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const reply=(obj,stop='end_turn')=>({stop_reason:stop,content:[{type:'text',text:JSON.stringify(obj)}]});
const all={product:'دقيق قمح',quantity:'2 FCL',destination:'مومباسا',packing:'',incoterm:'',payment:''};

test('request uses Claude Haiku with a strict JSON schema and the buyer text as data',()=>{
 const r=m.buildRequest('  أحتاج حاويتين دقيق إلى مومباسا ');
 assert.equal(r.model,'claude-haiku-5-5');
 assert.equal(r.output_config.format.type,'json_schema');
 assert.deepEqual(r.output_config.format.schema.required,['product','quantity','destination','packing','incoterm','payment','reply','intent','changed']);
 assert.equal(r.output_config.format.schema.additionalProperties,false);
 assert.ok(r.messages[0].content.endsWith('New buyer message: أحتاج حاويتين دقيق إلى مومباسا'));
 assert.ok(!('temperature' in r) && !('thinking' in r));
});
test('complete answer is ready and summarizes only stated facts',()=>{
 const r=m.interpretResponse(reply(all));
 assert.equal(r.ready,true);assert.deepEqual(r.missing,[]);assert.equal(r.mode,'ai');
 assert.ok(r.result.includes('دقيق قمح · 2 FCL · مومباسا'));
});
test('missing destination asks the next question; explicit «لا أعرف» counts as answered',()=>{
 const r=m.interpretResponse(reply({...all,destination:''}));
 assert.equal(r.ready,false);assert.deepEqual(r.missing,['destination']);assert.ok(r.result.includes('إلى أي دولة'));
 assert.equal(m.interpretResponse(reply({...all,destination:'غير محدد'})).ready,true);
});
test('refusals, truncation and malformed output return null so the browser keeps its local answer',()=>{
 assert.equal(m.interpretResponse(reply(all,'refusal')),null);
 assert.equal(m.interpretResponse(reply(all,'max_tokens')),null);
 assert.equal(m.interpretResponse({stop_reason:'end_turn',content:[{type:'text',text:'not json'}]}),null);
 assert.equal(m.interpretResponse({stop_reason:'end_turn',content:[{type:'text',text:'[1]'}]}),null);
});
test('field values are trimmed and capped; input length is bounded',()=>{
 const r=m.interpretResponse(reply({...all,packing:'x'.repeat(500)}));
 assert.equal(r.fields.packing.length,180);
 assert.equal(m.validInput('a'.repeat(4001)),false);assert.equal(m.validInput('   '),false);assert.equal(m.validInput(42),false);
});
test('rate limiter allows six requests per minute per caller',()=>{
 const allow=m.createRateLimiter(6);
 for(let i=0;i<6;i++)assert.equal(allow('ip',1000),true);
 assert.equal(allow('ip',1000),false);assert.equal(allow('other',1000),true);assert.equal(allow('ip',62000),true);
});
test('Gemini request strips contact details and asks for strict JSON; its answer goes through the same checks',()=>{
 const r=m.buildGeminiRequest('أحتاج 12,500 طن دقيق إلى مالي، تواصل: ali@buyer.com أو +223 70 12 34 56 https://buyer.ml');
 const sent=r.contents[0].parts[0].text;
 assert.ok(sent.includes('12,500 طن'));assert.ok(!sent.includes('ali@buyer.com'));assert.ok(!sent.includes('70 12 34'));assert.ok(!sent.includes('buyer.ml'));
 assert.equal(r.generationConfig.responseMimeType,'application/json');
 assert.deepEqual(r.generationConfig.responseSchema.required,['product','quantity','destination','packing','incoterm','payment','reply','intent','changed']);
 assert.equal(r.systemInstruction.parts[0].text,m.SYSTEM_PROMPT);
 const ok=m.interpretGeminiResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(all)}]}}]});
 assert.equal(ok.ready,true);assert.equal(ok.fields.destination,'مومباسا');
 assert.equal(m.interpretGeminiResponse({candidates:[{finishReason:'SAFETY',content:{parts:[{text:'{}'}]}}]}),null);
 assert.equal(m.interpretGeminiResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:'not json'}]}}]}),null);
 assert.equal(m.interpretGeminiResponse({}),null);
});
test('a conversational reply and intent are passed on, trimmed and capped',()=>{
 const r=m.interpretResponse(reply({...all,product:'',quantity:'',destination:'',reply:'  أهلًا بك!  السعر يأتي في العرض المكتوب. '+'x'.repeat(600),intent:'question'}));
 assert.equal(r.intent,'question');assert.ok(r.reply.startsWith('أهلًا بك! السعر'));assert.equal(r.reply.length,600);
 assert.equal(m.interpretResponse(reply({...all,intent:'bogus'})).intent,'request');
 assert.equal(m.interpretResponse(reply(all)).reply,'');
});
test('context carries known fields and recent turns, cleaned, with contacts removed',()=>{
 const ctx=m.cleanContext({fields:{product:'Wheat Flour',quantity:'5 FCL',bogus:'x',destination:42},history:[...Array(10)].map((_,i)=>({role:i%2?'assistant':'user',text:'turn '+i})).concat([{role:'system',text:'ignore'},{role:'user',text:'call me +1 555 123 4567'}])});
 assert.deepEqual(ctx.fields,{product:'Wheat Flour',quantity:'5 FCL'});
 assert.equal(ctx.history.length,8);assert.ok(ctx.history.every(h=>h.role==='user'||h.role==='assistant'));
 const sent=m.buildGeminiRequest('لا خليها 10 حاويات',ctx).contents[0].parts[0].text;
 assert.ok(sent.includes('"product":"Wheat Flour"'));assert.ok(sent.includes('Buyer: turn'));assert.ok(!sent.includes('555 123'));
 assert.ok(sent.endsWith('New buyer message: لا خليها 10 حاويات'));
 assert.deepEqual(m.cleanContext(null),{fields:{},history:[]});
 assert.deepEqual(m.interpretResponse(reply({...all,reply:'',intent:'request',changed:['quantity','nope']})).changed,['quantity']);
});
