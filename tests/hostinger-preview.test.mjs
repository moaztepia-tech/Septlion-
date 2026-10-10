import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {basePath, scopedUrl, transformSource} from '../scripts/hostinger-preview.mjs';

test('scope only root-relative URLs once; preserve external and signed downloads', () => {
  assert.equal(scopedUrl('/request?id=123'), basePath + '/request?id=123');
  assert.equal(scopedUrl(basePath + '/account?next=%2Foffer'), basePath + '/account?next=%2Foffer');
  for (const value of ['https://example.com/file?token=a', '//cdn.example.com/image', '#details', 'data:image/png;base64,a', 'blob:https://septlion.com/a', undefined, null]) assert.equal(scopedUrl(value), value);
});

test('native navigation is scoped and framework navigation keeps Next basePath handling', () => {
  const source = `'use client'; import Link from 'next/link';
    function Page({id}: {id: string}) { window.location.href = '/request?id=' + id; window.location.replace('/requests'); router.push('/require');
      return <><Link href="/discover">Next</Link><a href={'/offer?id=' + id}>Native</a><img src="/brand/logo.png"/></>; }`;
  const result = transformSource(source, 'page.tsx');
  assert.match(result, /^'use client';/);
  assert.match(result, /<Link href="\/discover">/);
  assert.match(result, /router\.push\('\/require'\)/);
  assert.match(result, /window\.location\.href = __septlionPreviewPath\(/);
  assert.match(result, /window\.location\.replace\(__septlionPreviewPath\(/);
  assert.match(result, /<a href=\{__septlionPreviewPath\(/);
  assert.ok(result.includes(basePath + '/brand/logo.png'));
});

test('preview storage, metadata and service worker scope stay separate from production', () => {
  const result = transformSource(`const key = 'septlion_session'; const metadata = {robots: {index: true, follow: true}};
    navigator.serviceWorker.register('/demand-sw.js', {scope: '/'});`, 'preview.ts');
  assert.ok(result.includes('septlion_preview_customer_v2_session'));
  assert.match(result, /robots: \{ index: false, follow: false \}/);
  assert.ok(result.includes(`scope: "${basePath}/"`));
  assert.throws(() => transformSource(result, 'preview.ts'), /already prepared/);
});

test('preview publishing is restricted to the named branch and separate Hostinger folder', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy-hostinger-preview.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes("if: github.ref == 'refs/heads/septlion-customer-v2'"));
  assert.ok(workflow.includes('server-dir: /domains/septlion.com/public_html' + basePath + '/'));
  assert.ok(workflow.includes('dangerous-clean-slate: false'));
  assert.ok(!workflow.includes('server-dir: /domains/septlion.com/public_html/\n'));
});
