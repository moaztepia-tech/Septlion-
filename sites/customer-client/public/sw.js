/* SEPTLION: retire the old new-app service worker.
   Phones that opened the old site still run a worker registered at /sw.js. On septlion.com
   (without www) it served an old cached copy of the site, because every request there now
   redirects to www and the old worker fell back to its cache. Browsers re-check /sw.js on each
   visit; this version clears the old caches, removes itself and reloads the page from www. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('shell-') || k.startsWith('data-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const w of windows) {
      const url = new URL(w.url);
      url.hostname = 'www.septlion.com';
      try { await w.navigate(url.href); } catch { /* the next visit loads normally */ }
    }
  })());
});
