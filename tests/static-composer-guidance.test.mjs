import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Hostinger static composer calls Supabase Edge guidance with local fallback',async()=>{
  const source=await readFile(new URL('../apps/web/components/requirement-composer.tsx',import.meta.url),'utf8');
  assert.ok(source.includes("publicFunction('interpret-requirement', {text:submitted}, guidance.signal)"));
  assert.ok(!source.includes('railway.app'));
  assert.ok(!source.includes("fetch('/api/interpret-requirement'"));
  assert.ok(source.includes("clearTimeout(guidanceTimeout)"));
  assert.ok(source.includes("const answered=answerRequirement(draft,submitted,lang)"));
  assert.ok(source.includes("applyGuidance(current,body.fields??null,lang,submitted,reply,intent)"));
  assert.ok(source.includes("await createTradeRequirement(input)"));
});
