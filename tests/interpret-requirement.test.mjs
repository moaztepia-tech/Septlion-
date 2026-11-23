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
 assert.deepEqual(r.output_config.format.schema.required,['product','quantity','destination','packing','incoterm','payment']);
 assert.equal(r.output_config.format.schema.additionalProperties,false);
 assert.equal(r.messages[0].content,'أحتاج حاويتين دقيق إلى مومباسا');
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
