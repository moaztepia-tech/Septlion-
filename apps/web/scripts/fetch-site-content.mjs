// Bakes the team's saved site texts into the build so search engines see them.
// Never fails the build: on any problem the previous file (or {}) is kept.
import {writeFile} from 'node:fs/promises';
const out = new URL('../lib/site-content.generated.json', import.meta.url);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
try {
  if (!url || !key) throw new Error('Supabase is not configured');
  const r = await fetch(`${url}/rest/v1/SiteContent?select=key,value`, {headers: {apikey: key}, signal: AbortSignal.timeout(10000)});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const rows = await r.json();
  const map = Object.fromEntries(rows.map(x => [x.key, x.value]));
  await writeFile(out, JSON.stringify(map, null, 1) + '\n');
  console.log(`Site content: ${rows.length} saved texts baked in.`);
} catch (error) {
  console.log(`Site content: using built-in texts (${error.message}).`);
}
