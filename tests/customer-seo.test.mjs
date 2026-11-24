import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as seo from '../scripts/customer-seo.mjs';
import {fixSearchTags} from '../scripts/hostinger-production.mjs';

const products=JSON.parse(await readFile(new URL('../sites/customer-client/seo/products.snapshot.json',import.meta.url),'utf8')).products;
const home=await readFile(new URL('../sites/customer-client/public/index.html',import.meta.url),'utf8');
const demand=[{slug:'wheat-flour-oman',title:'Wheat Flour Supply to Oman',market:'Oman',product:'wheat_flour',updatedAt:'2026-11-24T00:27:00Z'}];

test('the home page carries readable product cards, hreflang and structured data',()=>{
 const out=seo.homepageSeo(home,products);
 assert.equal(out.match(/<article class="gcard" data-id="\w/g).length,products.length);
 for(const l of ['ar','en','x-default'])assert.ok(out.includes(`hreflang="${l}"`),l);
 const ld=JSON.parse(out.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
 const types=ld['@graph'].map(n=>n['@type']);
 assert.ok(types.includes('Organization')&&types.includes('ItemList'));
 assert.ok(!JSON.stringify(ld).includes('"price"'),'no prices are published');
 assert.ok(out.includes('id="feed"'),'the app still renders into the same feed');
});

test('the home page update refuses to guess when an anchor is missing',()=>{
 assert.throws(()=>seo.homepageSeo(home.replace('id="feed"','id="x"'),products));
});

test('English home links back to Arabic and lists demand routes by title',()=>{
 const en=seo.englishHome(products,demand);
 assert.ok(en.includes('<html lang="en"'));
 assert.ok(en.includes('<link rel="canonical" href="https://www.septlion.com/en/"'));
 assert.ok(en.includes('Wheat Flour Supply to Oman'));
 assert.ok(!en.includes('wheat_flour —'));
});

test('sitemap and llms.txt list every public demand page and no team screens',()=>{
 const xml=seo.sitemapXml(seo.siteEntries({demand,hasRadarEn:true,now:'2026-11-24T00:00:00Z'}));
 assert.ok(xml.includes('https://www.septlion.com/demand/wheat-flour-oman/'));
 assert.ok(xml.includes('https://www.septlion.com/en/'));
 assert.ok(!/\/(ops|rfq|maritime-rfq|workbench)\//.test(xml));
 const txt=seo.llmsTxt(products,demand);
 assert.ok(txt.includes('https://www.septlion.com/demand/wheat-flour-oman/'));
});

test('only public pages are indexed, each with its own canonical link',()=>{
 const page='<head><meta name="robots" content="index, follow"/><link rel="canonical" href="https://www.septlion.com"/></head>';
 assert.ok(fixSearchTags(page,'/intent/wheat-flour').includes('href="https://www.septlion.com/intent/wheat-flour/"'));
 assert.ok(fixSearchTags(page,'/demand-intelligence').includes('href="https://www.septlion.com/demand-intelligence/"'));
 const ops=fixSearchTags(page,'/ops');
 assert.ok(ops.includes('content="noindex, follow"')&&!ops.includes('canonical'));
});
