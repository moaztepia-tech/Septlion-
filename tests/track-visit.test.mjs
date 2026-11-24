import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../supabase/functions/track-visit/visit.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const index=await readFile(new URL('../supabase/functions/track-visit/index.ts',import.meta.url),'utf8');
const sql=await readFile(new URL('../supabase/migrations/20261124010000_site_visit_counter.sql',import.meta.url),'utf8');

test('paths keep only the page, never query strings or odd input',()=>{
 assert.equal(m.cleanPath('/'),'/');
 assert.equal(m.cleanPath('/discover/?email=a@b.c#x'),'/discover');
 assert.equal(m.cleanPath('/demand/wheat-flour-japan/'),'/demand/wheat-flour-japan');
 assert.equal(m.cleanPath('https://evil.example/'),null);
 assert.equal(m.cleanPath('/<script>'),null);
 assert.equal(m.cleanPath('/'+'a'.repeat(300)),null);
});
test('referrer keeps only the outside site name',()=>{
 assert.equal(m.cleanReferrer('https://www.google.com/search?q=flour'),'google.com');
 assert.equal(m.cleanReferrer('https://www.septlion.com/discover'),null);
 assert.equal(m.cleanReferrer('javascript:alert(1)'),null);
 assert.equal(m.cleanReferrer(''),null);
});
test('bots are not counted; devices and countries are read safely',()=>{
 assert.ok(m.isBot('Googlebot/2.1'));assert.ok(m.isBot(''));
 assert.ok(!m.isBot('Mozilla/5.0 (Linux; Android 10; K) Chrome/155.0 Mobile Safari/537.36'));
 assert.equal(m.deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile'),'mobile');
 assert.equal(m.deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),'desktop');
 assert.equal(m.countryOf(new Headers({'cf-ipcountry':'eg'})),'EG');
 assert.equal(m.countryOf(new Headers({'cf-ipcountry':'XX'})),null);
 assert.equal(m.countryOf(new Headers()),null);
});
test('no IP address or cookie is stored, and only septlion.com is accepted',()=>{
 assert.ok(!/insert\([^)]*\bip\b/.test(index));
 assert.match(index,/SHA-256/);
 assert.ok(!/cookie/i.test(index.replace(/No cookies/i,'')));
 assert.match(index,/if \(!allowed\.has\(origin\)\)/);
 assert.ok(!/\bip\b/.test(sql.replace(/IP address/g,'')),'table has no ip column');
 assert.match(sql,/revoke all on core\."SiteVisit" from anon, authenticated/);
 assert.match(sql,/revoke all on function core\.site_visit_stats\(\) from public, anon, authenticated/);
});
test('visits from AI assistants are their own group, even when only utm_source is left',()=>{
 assert.deepEqual(m.classifySource('chatgpt.com',null),{source:'ai',name:'ChatGPT'});
 assert.deepEqual(m.classifySource(null,'chatgpt.com'),{source:'ai',name:'ChatGPT'});
 assert.deepEqual(m.classifySource('gemini.google.com',null),{source:'ai',name:'Gemini'});
 assert.deepEqual(m.classifySource('perplexity.ai',null),{source:'ai',name:'Perplexity'});
 assert.deepEqual(m.classifySource('copilot.microsoft.com',null),{source:'ai',name:'Copilot'});
 assert.deepEqual(m.classifySource('claude.ai',null),{source:'ai',name:'Claude'});
 assert.deepEqual(m.classifySource('chat.deepseek.com',null),{source:'ai',name:'DeepSeek'});
});
test('search, WhatsApp, social, direct and other sources',()=>{
 assert.deepEqual(m.classifySource('google.com',null),{source:'search',name:'Google'});
 assert.deepEqual(m.classifySource('google.com.sa',null),{source:'search',name:'Google'});
 assert.deepEqual(m.classifySource(m.cleanReferrer('android-app://com.whatsapp/'),null),{source:'whatsapp',name:'WhatsApp'});
 assert.deepEqual(m.classifySource('web.whatsapp.com',null),{source:'whatsapp',name:'WhatsApp'});
 assert.deepEqual(m.classifySource('m.facebook.com',null),{source:'social',name:'Facebook'});
 assert.deepEqual(m.classifySource('com.google.android.gm',null),{source:'other',name:'Gmail'});
 assert.deepEqual(m.classifySource(null,null),{source:'direct',name:null});
 assert.deepEqual(m.classifySource('example.org',null),{source:'other',name:'example.org'});
 assert.equal(m.cleanTag('ChatGPT.com'),'chatgpt.com');assert.equal(m.cleanTag('<x>'),null);
});
