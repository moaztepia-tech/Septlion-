import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../apps/api/src/auth/access-token-ttl.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {accessTokenTtl}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('JWT durations become bounded seconds with the existing 15 minute default',()=>{assert.equal(accessTokenTtl(),900);assert.equal(accessTokenTtl('30m'),1800);assert.equal(accessTokenTtl('1h'),3600);assert.equal(accessTokenTtl('900'),900);assert.equal(accessTokenTtl('1d'),86400)});
test('invalid, unbounded and ambiguous JWT lifetimes fail closed',()=>{for(const value of ['','0','-1m','2d','15 minutes','NaN','Infinity','1.5h'])assert.throws(()=>accessTokenTtl(value))});
