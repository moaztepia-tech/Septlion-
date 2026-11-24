import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
const src=await readFile(new URL('../infra/supabase/functions/collect-demand-signals/normalize.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {normalizeNotice}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=Date.parse('2026-11-25T12:00:00Z');
const base={id:'OP123456',notice_type:'Invitation for Bids',noticedate:'24-Nov-2026',submission_deadline_date:'30-Nov-2026',project_ctry_name:'Sudan',bid_description:'Supply of wheat flour'};
test('commodity, date, deadline, and official provenance survive normalization',()=>{
 const row=normalizeNotice(base,now);
 assert.equal(row.productKey,'wheat_flour'); assert.equal(row.market,'Sudan');
 assert.equal(row.publishedAt,'2026-11-24T00:00:00.000Z');
 assert.equal(row.deadlineAt,'2026-11-30T00:00:00.000Z');
 assert.match(row.sourceUrl,/OP123456$/);
 assert.equal(normalizeNotice({...base,bid_description:'Supply of sesame'},now).productKey,'sesame');
});
test('awards, old/undated/future requests, unrelated items and other flours never become wheat-flour leads',()=>{
 for(const override of [{notice_type:'Contract Award'},{noticedate:'01-Nov-2026'},{noticedate:null},{noticedate:'27-Nov-2026'},
  {submission_deadline_date:'24-Nov-2026'},{bid_description:'Milling equipment'},{bid_description:'Rice flour'},
  {bid_description:'Procurement of accounting software',notice_text:'Address: Flour Road'},
  {bid_description:'Premix for wheat flour fortification'}])assert.equal(normalizeNotice({...base,...override},now),null);
});
