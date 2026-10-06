import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as nodeModule from 'node:module';
import { test } from 'node:test';

// No live accounts or network calls: exercise the production client against Auth
// and Edge response fixtures, including token rotation and interrupted requests.
let transpile;
try {
  const { default: ts } = await import('typescript');
  transpile = source => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
} catch {
  if (!nodeModule.stripTypeScriptTypes) throw new Error('Install workspace TypeScript or use Node 22.13+.');
  transpile = source => nodeModule.stripTypeScriptTypes(source, { mode: 'strip' });
}
const source = await readFile(new URL('../apps/web/lib/api.ts', import.meta.url), 'utf8');
let moduleNo = 0;
const loadClient = () => import('data:text/javascript;base64,' + Buffer.from(transpile(source) + '\n// fixture ' + ++moduleNo).toString('base64'));
const now = () => Math.floor(Date.now() / 1000);
const jwt = (exp, sid = 'fixture-buyer') => ['fixture', Buffer.from(JSON.stringify({ exp, session_id: sid })).toString('base64url'), 'unsigned-test-only'].join('.');
const session = (exp = now() + 3600, sid = 'fixture-buyer') => ({ access_token: jwt(exp, sid), refresh_token: 'fixture-refresh-' + sid, expires_at: exp });
const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const refreshURL = url => String(url).includes('grant_type=refresh_token');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function setup(t) {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const oldFetch = globalThis.fetch;
  const oldWindow = globalThis.window;
  const oldStorage = globalThis.localStorage;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.window = { localStorage: storage };
  globalThis.localStorage = storage;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fixture-public-key';
  t.after(() => {
    globalThis.fetch = oldFetch; globalThis.window = oldWindow; globalThis.localStorage = oldStorage;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  });
  return { api: await loadClient(), storage, values };
}

test('valid session calls Edge without refreshing and preserves the requested action', async t => {
  const { api } = await setup(t); const s = session(); api.saveSession(s); let calls = 0;
  globalThis.fetch = async (url, options) => { calls++; assert.equal(refreshURL(url), false); assert.equal(options.headers.Authorization, 'Bearer ' + s.access_token); assert.equal(JSON.parse(options.body).action, 'requirements.list'); return reply(200, { items: [] }); };
  assert.deepEqual(await api.edge('requirements.list', { action: 'offers.accept' }), { items: [] });
  assert.equal(calls, 1);
});

test('expired access token rotates before posting a requirement', async t => {
  const { api, storage } = await setup(t); api.saveSession(session(now() - 1)); const fresh = session(); fresh.refresh_token = 'fixture-rotated'; const calls = [];
  globalThis.fetch = async (url, options) => { calls.push(String(url)); if (refreshURL(url)) return reply(200, fresh); assert.equal(options.headers.Authorization, 'Bearer ' + fresh.access_token); return reply(201, { item: { id: 'fixture-requirement' } }); };
  assert.equal((await api.edge('requirements.create', { input: { product: 'TEST', destination: 'TEST' } })).item.id, 'fixture-requirement');
  assert.equal(calls.filter(refreshURL).length, 1); assert.equal(calls.length, 2); assert.equal(storage.getItem('septlion_refresh'), 'fixture-rotated');
});

test('nearly expired token refreshes with a clock-skew margin', async t => {
  const { api } = await setup(t); api.saveSession(session(now() + 20)); let refreshes = 0;
  globalThis.fetch = async url => { if (refreshURL(url)) { refreshes++; return reply(200, session()); } return reply(200, {}); };
  await api.edge('me'); assert.equal(refreshes, 1);
});

test('concurrent requests share one refresh operation', async t => {
  const { api } = await setup(t); api.saveSession(session(now() - 1)); const gate = deferred(); const started = deferred(); let refreshes = 0, posts = 0;
  globalThis.fetch = async url => { if (refreshURL(url)) { refreshes++; started.resolve(); await gate.promise; return reply(200, session()); } posts++; return reply(200, {}); };
  const a = api.edge('requirements.list'), b = api.edge('notifications.list'); await started.promise; gate.resolve(); await Promise.all([a, b]);
  assert.equal(refreshes, 1); assert.equal(posts, 2);
});

test('two tabs coordinate refresh-token rotation with a browser lock', async t => {
  const { api } = await setup(t); const other = await loadClient(); api.saveSession(session(now() - 1)); let queue = Promise.resolve(); let refreshes = 0;
  globalThis.navigator.locks = { request: (_name, task) => { const next = queue.then(task); queue = next.catch(() => {}); return next; } };
  globalThis.fetch = async url => { if (refreshURL(url)) { refreshes++; return reply(200, session()); } return reply(200, {}); };
  await Promise.all([api.edge('me'), other.edge('requirements.list')]); assert.equal(refreshes, 1);
});

test('server 401 triggers one refresh and one authenticated retry', async t => {
  const { api } = await setup(t); api.saveSession(session()); let posts = 0, refreshes = 0;
  globalThis.fetch = async url => { if (refreshURL(url)) { refreshes++; return reply(200, session(now() + 7200)); } return ++posts === 1 ? reply(401, { error: 'Invalid session' }) : reply(200, { ok: true }); };
  assert.deepEqual(await api.edge('me'), { ok: true }); assert.equal(posts, 2); assert.equal(refreshes, 1);
});

test('a second 401 stops retrying and clears the rejected session', async t => {
  const { api } = await setup(t); api.saveSession(session()); let posts = 0, refreshes = 0;
  globalThis.fetch = async url => { if (refreshURL(url)) { refreshes++; return reply(200, session(now() + 7200)); } posts++; return reply(401, { error: 'Invalid session' }); };
  await assert.rejects(api.edge('me')); assert.equal(posts, 2); assert.equal(refreshes, 1); assert.equal(api.hasSession(), false);
});

test('temporary refresh failure preserves the session for a later retry', async t => {
  const { api } = await setup(t); const old = session(now() - 1); api.saveSession(old); let failed = false;
  globalThis.fetch = async url => { if (refreshURL(url) && !failed) { failed = true; return reply(503, { message: 'Temporary Auth outage' }); } if (refreshURL(url)) return reply(200, session()); return reply(200, { ok: true }); };
  await assert.rejects(api.edge('me'), /Temporary Auth outage/); assert.equal(api.accessToken(), old.access_token);
  assert.deepEqual(await api.edge('me'), { ok: true });
});

test('revoked refresh token clears the session without posting a mutation', async t => {
  const { api } = await setup(t); api.saveSession(session(now() - 1)); let posts = 0;
  globalThis.fetch = async url => { if (refreshURL(url)) return reply(400, { msg: 'Refresh token revoked' }); posts++; return reply(200, {}); };
  await assert.rejects(api.edge('requirements.create')); assert.equal(posts, 0); assert.equal(api.hasSession(), false);
});

test('expired token without refresh token requires sign-in', async t => {
  const { api, storage } = await setup(t); storage.setItem('septlion_access', jwt(now() - 1)); let calls = 0;
  globalThis.fetch = async () => { calls++; return reply(200, {}); };
  await assert.rejects(api.edge('me')); assert.equal(calls, 0); assert.equal(api.hasSession(), false);
});

test('logout while refresh is pending cannot restore the old session', async t => {
  const { api } = await setup(t); api.saveSession(session(now() - 1)); const gate = deferred(), started = deferred(); let posts = 0;
  globalThis.fetch = async url => { if (refreshURL(url)) { started.resolve(); await gate.promise; return reply(200, session()); } posts++; return reply(200, {}); };
  const call = api.edge('requirements.create'); const checked = assert.rejects(call); await started.promise; api.clearSession(); gate.resolve(); await checked;
  assert.equal(api.hasSession(), false); assert.equal(posts, 0);
});

test('switching account during refresh neither overwrites nor submits under the new account', async t => {
  const { api } = await setup(t); api.saveSession(session(now() - 1)); const gate = deferred(), started = deferred(); const other = session(now() + 3600, 'fixture-other-buyer'); let posts = 0;
  globalThis.fetch = async url => { if (refreshURL(url)) { started.resolve(); await gate.promise; return reply(200, session()); } posts++; return reply(200, {}); };
  const checked = assert.rejects(api.edge('requirements.create')); await started.promise; api.saveSession(other); gate.resolve(); await checked;
  assert.equal(api.accessToken(), other.access_token); assert.equal(posts, 0);
});

test('business failures and rate limits do not replay a mutation', async t => {
  const { api } = await setup(t); api.saveSession(session());
  for (const status of [400, 403, 429, 500]) { let calls = 0; globalThis.fetch = async () => { calls++; return reply(status, { error: 'Fixture failure' }); }; await assert.rejects(api.edge('requirements.create'), /Fixture failure/); assert.equal(calls, 1); assert.equal(api.hasSession(), true); }
});

test('legacy access/refresh storage upgrades during refresh', async t => {
  const { api, storage } = await setup(t); storage.setItem('septlion_access', jwt(now() - 1)); storage.setItem('septlion_refresh', 'fixture-legacy'); const fresh = session();
  globalThis.fetch = async (url, options) => { if (refreshURL(url)) { assert.equal(JSON.parse(options.body).refresh_token, 'fixture-legacy'); return reply(200, fresh); } return reply(200, {}); };
  await api.edge('me'); assert.equal(api.accessToken(), fresh.access_token); assert.equal(storage.getItem('septlion_refresh'), fresh.refresh_token);
});

test('sign-in persists the expiry returned by Auth', async t => {
  const { api } = await setup(t); const fresh = session(); let calls = 0;
  globalThis.fetch = async url => { calls++; if (String(url).includes('grant_type=password')) return reply(200, fresh); assert.equal(refreshURL(url), false); return reply(200, {}); };
  await api.signIn('fixture@example.invalid', 'fixture-password'); await api.edge('me'); assert.equal(calls, 2);
});

test('invalid refresh response leaves the original session intact', async t => {
  const { api } = await setup(t); const original = session(now() - 1); api.saveSession(original);
  globalThis.fetch = async url => { assert.equal(refreshURL(url), true); return reply(200, { access_token: 'missing-refresh-token' }); };
  await assert.rejects(api.edge('me')); assert.equal(api.accessToken(), original.access_token);
});

test('missing deployment configuration fails before network transmission', async t => {
  const { storage } = await setup(t); process.env.NEXT_PUBLIC_SUPABASE_URL = ''; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ''; const api = await loadClient(); let calls = 0; storage.setItem('septlion_access', jwt(now() + 3600));
  globalThis.fetch = async () => { calls++; return reply(200, {}); };
  await assert.rejects(api.edge('me')); assert.equal(calls, 0);
});

test('post-login return path accepts local routes and rejects external redirects', async () => {
  const redirectSource = await readFile(new URL('../apps/web/lib/auth-return-path.ts', import.meta.url), 'utf8');
  const { authReturnPath } = await import('data:text/javascript;base64,' + Buffer.from(transpile(redirectSource)).toString('base64'));
  const origin = 'https://septlion.com';
  assert.equal(authReturnPath('/require?id=fixture#review', origin), '/require?id=fixture#review');
  assert.equal(authReturnPath('/requests', origin), '/requests');
  for (const next of [null, '', 'https://outside.invalid', '//outside.invalid', '/\\outside.invalid', '/\noutside.invalid', 'require']) assert.equal(authReturnPath(next, origin), null);
});
