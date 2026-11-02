import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Hostinger static composer calls server-side guidance with fallback',async()=>{
  const source=await readFile(new URL('../apps/web/components/requirement-composer.tsx',import.meta.url),'utf8');
  assert.ok(source.includes('https://septlion-web-production.up.railway.app/api/interpret-requirement'));
  assert.ok(!source.includes("fetch('/api/interpret-requirement'"));
  assert.ok(source.includes("signal:guidance.signal"));
  assert.ok(source.includes("clearTimeout(guidanceTimeout)"));
  assert.ok(source.includes("setDraft(d=>answerRequirement(d,submitted,lang))"));
  assert.ok(source.includes("await createTradeRequirement(input)"));
});
