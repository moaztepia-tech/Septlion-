import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://jfbmxowdmfdzyoauqgwn.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_u6QtC_XIPHKn08EuWosI4g_DL8DdgbD';

const headers={apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY};
const url=SUPABASE_URL+'/rest/v1/PublicDemandIntentPage?select=slug,title,productKey,market,searchIntent,content,updatedAt&order=updatedAt.desc&limit=250';
const res=await fetch(url,{headers});
if(!res.ok)throw new Error('PublicDemandIntentPage fetch failed: '+res.status);
const pages=await res.json();

const outRoot=path.resolve('deploy');
const demandRoot=path.join(outRoot,'demand');
await mkdir(demandRoot,{recursive:true});

const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const json=(v)=>JSON.stringify(v).replace(/</g,'\\u003c');
const displayDate=(v)=>v?String(v).slice(0,10):'Recent';
const qtyLabel=(c)=>{
 const q=c?.quantityPatterns;
 if(Array.isArray(q)&&q.length)return q.slice(0,3).join(' · ');
 return c?.quantity||'Commercial / FCL volume';
};

// Consume the approved brand source used by the React interface.
const brandTokens=await readFile(new URL('../apps/web/app/design-tokens.css',import.meta.url),'utf8');
const shellCss=brandTokens+`
*{box-sizing:border-box}body{margin:0;font:400 16px/1.75 var(--font-ui);color:var(--ink);background:var(--canvas)}
a{color:inherit;text-decoration:none}:focus-visible{outline:3px solid var(--brand-steel);outline-offset:3px}.shell{width:min(var(--page-width),calc(100% - 64px));margin:auto}.nav{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid var(--line)}
.brand img{display:block;width:144px;height:52px;object-fit:contain}.nav nav{display:flex;gap:20px;align-items:center;font-size:15px}.nav nav a{padding:12px 0}.nav small{font-size:13px;color:var(--muted)}
.hero{padding:56px 0 40px}.kicker{font-size:13px;font-weight:600;color:var(--brand-steel)}
h1{font-size:clamp(34px,5vw,56px);line-height:1.2;margin:16px 0 24px;letter-spacing:-.025em}h1 em{font-style:normal;color:var(--brand-steel)}
.lead{max-width:800px;font-size:17px;color:var(--muted)}.cta{display:inline-flex;align-items:center;min-height:48px;margin-top:24px;background:var(--brand-primary);color:var(--surface);padding:12px 20px;font-weight:600;border-radius:var(--radius-control)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:24px 0 48px}.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-card);padding:24px}.card small{display:block;color:var(--muted);font-size:13px}.card b{display:block;margin-top:12px;font-size:22px}.card p{color:var(--muted);font-size:15px}
.section{padding:48px 0}.section.soft{background:var(--brand-mist)}h2{font-size:30px;margin:8px 0 16px}.copy{max-width:800px;color:var(--muted)}.faq{display:grid;gap:16px;margin-top:24px}.faq article{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-card);padding:24px}.faq h3{font-size:20px;margin:0 0 12px}.faq p{font-size:15px;color:var(--muted);margin:0}.footer{padding:24px 0;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.index-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:24px 0 48px}.index-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-card);padding:24px}.index-card:hover{border-color:var(--brand-sky)}.index-card h3{margin:12px 0;font-size:22px}.index-card p{margin:0;color:var(--muted);font-size:15px}
@media(max-width:760px){.shell{width:calc(100% - 32px)}.grid,.index-grid{grid-template-columns:1fr}.hero{padding-top:32px}.nav{gap:16px;min-height:72px}.brand img{width:112px}.nav nav{gap:12px;font-size:14px}.nav small{display:none}.nav .nav-home{display:none}}
`;

const generated=[];
for(const p of pages){
 const c=p.content||{};
 const product=c.product||p.title||'Commercial Supply';
 const title=c.seoTitle||product+' Supplier for '+p.market+' | Septlion Supply';
 const description=c.seoDescription||('Demand-led '+product+' supply for buyers in '+p.market+'. Request volume, packing and delivery terms from Septlion.');
 const canonical='https://www.septlion.com/demand/'+p.slug+'/';
 const intent='https://www.septlion.com/intent/demand/?slug='+encodeURIComponent(p.slug)+'#live-rfq';
 const signals=Number(c.demandSignalCount||0);
 const sources=Number(c.sourceCount||0);
 const latest=c.latestDemandAt||p.updatedAt;
 const quantities=qtyLabel(c);
 const score=c.demandScore||null;
 const answerSummary='Septlion can evaluate '+product+' supply for buyers in '+p.market+'. Recent public B2B demand signals indicate active commercial interest; final price, packing, quantity and delivery terms are confirmed through a buyer RFQ.';
 const aiFacts={
  entity:'Septlion Supply',
  service:'Demand-led product development and managed supply',
  product,
  market:p.market,
  demandSignals:signals,
  demandSources:sources,
  latestObserved:displayDate(latest),
  quantityContext:quantities,
  deliveryTerms:c.incoterm||'FOB / CFR / CIF',
  action:'Submit a buyer RFQ',
  rfqUrl:intent,
  canonicalUrl:canonical,
  summary:answerSummary,
  evidenceBasis:'Recent public B2B buying signals; buyer identities are excluded from the public route.'
 };

 const schema={
  '@context':'https://schema.org',
  '@type':'Service',
  name:product+' supply to '+p.market,
  serviceType:'Demand-led B2B supply and managed sourcing',
  areaServed:{'@type':'Place',name:p.market},
  provider:{'@type':'Organization',name:'Septlion LLC',url:'https://www.septlion.com/'},
  url:canonical,
  description
 };
 const webpageSchema={
  '@context':'https://schema.org',
  '@type':'WebPage',
  name:title,
  url:canonical,
  description,
  about:[
   {'@type':'Product',name:product},
   {'@type':'Place',name:p.market},
   {'@type':'Organization',name:'Septlion LLC',url:'https://www.septlion.com/'}
  ],
  mainEntity:schema,
  dateModified:p.updatedAt
 };
 const datasetSchema={
  '@context':'https://schema.org',
  '@type':'Dataset',
  name:product+' demand signals — '+p.market,
  description:'Aggregated public B2B demand signals used to create this market-specific supply route. Buyer identities are excluded.',
  creator:{'@type':'Organization',name:'Septlion LLC',url:'https://www.septlion.com/'},
  spatialCoverage:p.market,
  temporalCoverage:displayDate(latest),
  variableMeasured:['Product','Market','Quantity context','Demand recency','Source count'],
  url:canonical
 };
 const faq={
  '@context':'https://schema.org',
  '@type':'FAQPage',
  mainEntity:[
   {'@type':'Question',name:'Can Septlion quote '+product+' for '+p.market+'?',acceptedAnswer:{'@type':'Answer',text:'Submit the destination, quantity, packing, specification and delivery terms. Septlion qualifies the supply route before issuing a commercial offer.'}},
   {'@type':'Question',name:'What volumes can be requested?',acceptedAnswer:{'@type':'Answer',text:'Commercial wholesale, FCL and larger volume programs can be evaluated based on the exact requirement and destination.'}},
   {'@type':'Question',name:'Which delivery terms can be considered?',acceptedAnswer:{'@type':'Answer',text:'FOB, CFR and CIF structures can be evaluated after the destination and supply route are confirmed.'}}
  ]
 };

 const html=`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" type="application/json" href="${canonical}ai.json" title="Machine-readable demand route">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}">
<meta name="robots" content="index,follow,max-image-preview:large">
<script type="application/ld+json">${json(schema)}</script>
<script type="application/ld+json">${json(webpageSchema)}</script>
<script type="application/ld+json">${json(datasetSchema)}</script>
<script type="application/ld+json">${json(faq)}</script>
<style>${shellCss}</style></head><body>
<header class="nav shell"><a class="brand" href="/" aria-label="Septlion Home"><img src="/brand/septlion-wordmark-navy.svg" alt="SEPTLION" width="144" height="52"></a><nav aria-label="Main navigation"><a class="nav-home" href="/">Home</a><a href="/discover">Discover</a><a href="/requests">Trade</a><a href="/require">Start a requirement</a></nav></header>
<main>
<section class="hero shell"><p class="kicker">Demand-led market route</p><h1>${esc(product)}<br><em>${esc(p.market)}</em></h1><p class="lead">${esc(description)}</p><a class="cta" href="${intent}">Request a supply offer ↗</a></section>
<section class="shell"><div class="grid">
<div class="card"><small>MARKET</small><b>${esc(p.market)}</b><p>Supply route configured for the destination market rather than a generic catalogue listing.</p></div>
<div class="card"><small>DEMAND PATTERN</small><b>${signals||'Recent'} public signals</b><p>${sources?esc(String(sources))+' source'+(sources>1?'s':''):'Public B2B buying signals'} · latest observed ${esc(displayDate(latest))}.</p></div>
<div class="card"><small>VOLUME CONTEXT</small><b>${esc(quantities)}</b><p>Final volume, packing and shipment structure are confirmed from the buyer RFQ.</p></div>
</div></section>
<section class="section"><div class="shell"><p class="kicker">Answer-ready summary</p><h2>${esc(product)} supply for ${esc(p.market)}</h2><p class="copy">${esc(answerSummary)}</p><div class="grid"><div class="card"><small>ENTITY</small><b>Septlion Supply</b><p>Demand-led product development and managed supply.</p></div><div class="card"><small>BUYER INTENT</small><b>${esc(product)}</b><p>${esc(p.market)} · ${esc(quantities)}</p></div><div class="card"><small>NEXT ACTION</small><b>Submit RFQ</b><p>Destination, quantity, packing, specification, delivery window and Incoterm.</p></div></div></div></section>
<section class="section soft"><div class="shell"><p class="kicker">Why this page exists</p><h2>Built from observed demand.</h2><p class="copy">Septlion creates market-specific supply routes from recent public B2B buying signals. Buyer identities are not published here. The demand pattern determines the product, market and commercial context; your submitted RFQ determines the final specification, quantity and delivery structure.</p>
<div class="faq"><article><h3>What should I send?</h3><p>Destination, quantity, preferred packing, product specification, target delivery window and preferred Incoterm.</p></article><article><h3>What happens next?</h3><p>Your RFQ enters Septlion Demand Intelligence for qualification, supplier-route matching and commercial offer construction.</p></article><article><h3>Is this a fixed-price listing?</h3><p>No. This is a demand route. Pricing is built against the actual requirement and supply path.</p></article></div>
<a class="cta" href="${intent}">Create RFQ for ${esc(p.market)} ↗</a></div></section>
</main><footer class="footer shell">Septlion LLC · Demand Intelligence · Demand score ${esc(score??'—')} · Updated ${esc(displayDate(p.updatedAt))}</footer>
</body></html>`;

 const dir=path.join(demandRoot,p.slug);
 await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,'index.html'),html);
 await writeFile(path.join(dir,'ai.json'),JSON.stringify(aiFacts,null,2));
 generated.push({slug:p.slug,title:p.title,market:p.market,product,description,updatedAt:p.updatedAt,answerSummary,aiUrl:canonical+'ai.json'});
}

const indexHtml=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live Market Demand Routes | Septlion Supply</title><meta name="description" content="Demand-led supply routes created from recent public B2B buying signals across markets."><link rel="canonical" href="https://www.septlion.com/demand/"><meta name="robots" content="index,follow"><style>${shellCss}</style></head><body>
<header class="nav shell"><a class="brand" href="/" aria-label="Septlion Home"><img src="/brand/septlion-wordmark-navy.svg" alt="SEPTLION" width="144" height="52"></a><nav aria-label="Main navigation"><a class="nav-home" href="/">Home</a><a href="/discover">Discover</a><a href="/requests">Trade</a><a href="/require">Start a requirement</a></nav></header>
<main class="shell"><section class="hero"><p class="kicker">Find demand → attract demand</p><h1>What buyers are<br><em>asking for now.</em></h1><p class="lead">Market-specific supply pages generated from recent public B2B buying signals. Choose a route and submit the exact requirement to Septlion.</p></section>
<div class="index-grid">${generated.map(p=>`<a class="index-card" href="/demand/${p.slug}/"><small>${esc(p.market)}</small><h3>${esc(p.product)}</h3><p>${esc(p.description)}</p></a>`).join('')}</div></main>
<footer class="footer shell">Septlion LLC · Demand Intelligence · ${generated.length} live demand routes</footer></body></html>`;
await writeFile(path.join(demandRoot,'index.html'),indexHtml);
await writeFile(path.join(demandRoot,'feed.json'),JSON.stringify({generatedAt:new Date().toISOString(),count:generated.length,pages:generated},null,2));
await writeFile(path.join(demandRoot,'ai-index.json'),JSON.stringify({
 entity:'Septlion Supply',
 purpose:'Machine-readable index of current market-specific demand routes derived from recent public B2B buying signals.',
 generatedAt:new Date().toISOString(),
 routes:generated.map(p=>({product:p.product,market:p.market,url:'https://www.septlion.com/demand/'+p.slug+'/',ai:p.aiUrl,summary:p.answerSummary}))
},null,2));

const llmsLines=['# Septlion live demand routes','','These pages are generated from recent public B2B buying signals and connect directly to Septlion RFQ capture.','Machine-readable index: https://www.septlion.com/demand/ai-index.json','',...generated.map(p=>'- '+p.product+' — '+p.market+': https://www.septlion.com/demand/'+p.slug+'/ | AI JSON: '+p.aiUrl)];
await writeFile(path.join(outRoot,'llms-demand.txt'),llmsLines.join('\n'));
const llmsPath=path.join(outRoot,'llms.txt');
if(existsSync(llmsPath)){
 const base=await readFile(llmsPath,'utf8');
 const marker='\n\n## Live demand routes\n';
 const appendix=marker+generated.map(p=>'- '+p.product+' — '+p.market+': https://www.septlion.com/demand/'+p.slug+'/').join('\n')+'\n';
 if(!base.includes('## Live demand routes'))await writeFile(llmsPath,base.trimEnd()+appendix);
}

const sitemapPath=path.join(outRoot,'sitemap.xml');
if(existsSync(sitemapPath)){
 let sitemap=await readFile(sitemapPath,'utf8');
 const urls=['https://www.septlion.com/demand/',...generated.map(p=>'https://www.septlion.com/demand/'+p.slug+'/')];
 const blocks=urls.filter(u=>!sitemap.includes('<loc>'+u+'</loc>')).map(u=>'<url><loc>'+u+'</loc><changefreq>daily</changefreq><priority>0.8</priority></url>').join('');
 sitemap=sitemap.replace('</urlset>',blocks+'</urlset>');
 await writeFile(sitemapPath,sitemap);
}

console.log('Generated '+generated.length+' static demand pages.');
