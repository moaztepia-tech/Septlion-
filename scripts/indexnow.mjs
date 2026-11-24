// IndexNow: tells Bing, Yandex, Seznam and Naver right away which pages are new or changed,
// instead of waiting for their crawlers. The key is public by design (it is served as a file
// on the site to prove ownership). Google does not use IndexNow; it reads the sitemap through
// Search Console.
//   node scripts/indexnow.mjs key <dir>        writes <dir>/<key>.txt
//   node scripts/indexnow.mjs ping <sitemap>   submits every <loc> in the sitemap (never fails the run)
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

export const INDEXNOW_KEY='67d3c0d7c8bbb0dc419a3b74a866e803';
const HOST='www.septlion.com';

const [cmd,arg]=process.argv.slice(2);
if(cmd==='key'){
 await writeFile(path.join(arg||'deploy',INDEXNOW_KEY+'.txt'),INDEXNOW_KEY);
 console.log('IndexNow key file written.');
}else if(cmd==='ping'){
 try{
  const xml=await readFile(arg||'deploy/sitemap.xml','utf8');
  const urls=[...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim()).filter(u=>u.startsWith('https://'+HOST+'/')))].slice(0,10000);
  if(!urls.length){console.log('IndexNow: no URLs in the sitemap.');process.exit(0);}
  const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host:HOST,key:INDEXNOW_KEY,keyLocation:'https://'+HOST+'/'+INDEXNOW_KEY+'.txt',urlList:urls})});
  console.log('IndexNow: submitted '+urls.length+' URLs, HTTP '+r.status+'.');
 }catch(e){console.log('IndexNow ping skipped: '+(e?.message||e));}
}else{
 console.error('usage: indexnow.mjs key <dir> | ping <sitemap>');process.exit(2);
}
