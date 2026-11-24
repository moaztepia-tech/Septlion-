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

test('Arab markets get an Arabic demand page linked to the English one',async()=>{
 const {arabicMarket,arabicProduct,arabicDemandPage}=await import('../scripts/demand-page-ar.mjs');
 assert.equal(arabicMarket('Doha, Qatar, Qatar'),'الدوحة، قطر');
 assert.equal(arabicMarket('Muscat, Muscat, Oman'),'مسقط، عُمان');
 assert.equal(arabicMarket('United Arab Emirates — Jebel Ali'),'جبل علي، الإمارات');
 assert.equal(arabicMarket('Sudan'),'السودان');
 assert.equal(arabicMarket('South Sudan'),null);
 assert.equal(arabicMarket('Canada'),null);
 assert.equal(arabicMarket('Omania Ltd, Germany'),null);
 assert.equal(arabicProduct('All Purpose Flour'),'دقيق القمح متعدد الاستخدامات');
 const html=arabicDemandPage({p:{market:'Oman'},product:'Wheat Flour',englishUrl:'https://www.septlion.com/demand/wheat-flour-oman/',intentUrl:'https://www.septlion.com/intent/demand/?slug=wheat-flour-oman#live-rfq',signals:1,latest:'2026-10-26',quantities:'1 Twenty-Foot Container',shellCss:'',esc:seo.esc,json:JSON.stringify});
 assert.ok(html.includes('<html lang="ar" dir="rtl">'));
 assert.ok(html.includes('<link rel="canonical" href="https://www.septlion.com/demand/wheat-flour-oman/ar/">'));
 assert.ok(html.includes('hreflang="en" href="https://www.septlion.com/demand/wheat-flour-oman/"'));
 assert.ok(html.includes('طلب شراء عام واحد')&&html.includes('حاوية 20 قدم واحدة'));
 const xml=seo.sitemapXml(seo.siteEntries({demand:[{slug:'wheat-flour-oman',arUrl:'https://www.septlion.com/demand/wheat-flour-oman/ar/',updatedAt:'2026-11-24'}]}));
 assert.ok(xml.includes('<loc>https://www.septlion.com/demand/wheat-flour-oman/ar/</loc>'));
});

test('every target market gets a page in its buyers’ language, with honest wording',async()=>{
 const {allMarketPages,MARKETS}=await import('../scripts/market-pages.mjs');
 const pages=allMarketPages(products);
 assert.equal(pages.length,1+MARKETS.reduce((n,m)=>n+m.langs.length,0));
 const by=u=>pages.find(p=>p.url==='https://www.septlion.com/markets/'+u);
 assert.ok(by('sudan/').html.includes('<html lang="ar" dir="rtl">')&&by('sudan/').html.includes('بورتسودان'));
 assert.ok(by('senegal/').html.includes('<html lang="fr"')&&by('senegal/').html.includes('au Sénégal'));
 assert.ok(by('nigeria/').html.includes('<html lang="en"'));
 assert.ok(by('morocco/fr/').html.includes('hreflang="ar" href="https://www.septlion.com/markets/morocco/"'));
 for(const p of pages){
  assert.ok(p.html.includes(`<link rel="canonical" href="${p.url}">`),p.url);
  assert.ok(!/price|\$\s?\d|USD\s?\d/i.test(p.html.replace(/Prices are given|prix est|price is|price depends|the price/gi,'')),'no prices: '+p.url);
  assert.ok(!/we have (shipped|delivered)|already supply|clients in/i.test(p.html),'no invented track record: '+p.url);
 }
 const xml=seo.sitemapXml(seo.siteEntries({markets:pages}));
 assert.ok(xml.includes('<loc>https://www.septlion.com/markets/sudan/</loc>'));
});

test('each market page states how cargo gets there: sea, road, or sea then road',async()=>{
 const {allMarketPages,MARKETS,SHIPPING}=await import('../scripts/market-pages.mjs');
 for(const slug of Object.keys(SHIPPING)) assert.ok(MARKETS.some(m=>m.slug===slug),slug);
 const pages=allMarketPages(products);
 const by=u=>pages.find(p=>p.url==='https://www.septlion.com/markets/'+u).html;
 assert.ok(by('sudan/').includes('بحراً إلى بورتسودان') && by('sudan/').includes('حدربة'));
 assert.ok(by('saudi-arabia/').includes('سفاجا–ضبا'));
 assert.ok(by('qatar/').includes('سلوى'));
 assert.ok(by('mali/').includes('puis par camion jusqu'));
 assert.ok(by('ethiopia/').includes('Djibouti–Addis Ababa'));
 assert.ok(!by('morocco/').includes('براً'));
});
