// Shared look for the static SEO pages (/en/, /markets/…): the same identity as the
// customer client at / — deep navy, Cairo for Arabic and body text, Montserrat for Latin
// headings, metallic accents and cut-corner panels. Fonts are the ones the client already
// serves from /new-app/fonts, so no third-party request is made.

const FONT = (family, file, weight, range) =>
  `@font-face{font-family:${family};font-style:normal;font-weight:${weight};font-display:swap;src:url(/new-app/fonts/${file}.woff2) format('woff2');unicode-range:${range}}`;
const AR = 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

export const fontFaces = [400, 600, 700, 800].flatMap(w => [FONT('Cairo', `cairo-arabic-${w}-normal`, w, AR), FONT('Cairo', `cairo-latin-${w}-normal`, w, LATIN)])
  .concat([500, 700, 800].map(w => FONT('Montserrat', `montserrat-latin-${w}-normal`, w, LATIN))).join('');

export const themeCss = `${fontFaces}
:root{--bg:#051945;--bg2:#071f52;--surface:#0c1e3d;--surface2:#122a4e;--line:#2c4670;--line-soft:#1f3558;--line-hi:#6f8cb8;--text:#f3f6fd;--muted:#a9b9d4;--dim:#7f95b8;--sky:#b5c7e6;--ok:#9fd3b8;
--metal:linear-gradient(150deg,#b3c5e4 0%,#3a5480 26%,#102344 50%,#3b5784 76%,#b3c5e4 100%);--cut:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);
--font:Cairo,"Noto Sans Arabic",system-ui,sans-serif;--latin:Montserrat,Cairo,Arial,sans-serif;--r:14px;color-scheme:dark}
[hidden]{display:none!important}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:radial-gradient(1200px 600px at 85% -10%,#0d2a66 0%,transparent 60%),var(--bg);color:var(--text);font:400 16px/1.75 var(--font);-webkit-font-smoothing:antialiased;padding-bottom:84px}
a{color:inherit}img{max-width:100%}.wrap{width:min(1160px,calc(100% - 32px));margin-inline:auto}
:focus-visible{outline:2px solid var(--sky);outline-offset:3px;border-radius:6px}
[lang=en] h1,[lang=en] h2,[lang=en] h3,[lang=fr] h1,[lang=fr] h2,[lang=fr] h3,.latin{font-family:var(--latin);letter-spacing:-.01em}
.top{position:sticky;top:0;z-index:20;background:rgba(5,25,69,.86);backdrop-filter:saturate(1.4) blur(12px);-webkit-backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid var(--line-soft)}
.top .wrap{display:flex;align-items:center;gap:20px;min-height:68px}.logo img{display:block;width:150px;height:auto}
.top nav{display:flex;align-items:center;gap:22px;margin-inline-start:auto;font-size:15px;color:var(--muted)}.top nav a{text-decoration:none;white-space:nowrap}.top nav a:hover{color:var(--text)}
.lang{border:1px solid var(--line);border-radius:999px;padding:4px 12px;color:var(--text)!important}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:12px 22px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;border:1px solid var(--line-hi);color:var(--text);background:transparent;transition:transform .2s,background .2s}
.btn:hover{transform:translateY(-1px)}.btn.pri{background:#f3f6fd;color:#051945;border-color:#f3f6fd}.btn.pri:hover{background:#fff}
.btn svg{width:20px;height:20px;flex:none}.top .btn{min-height:40px;padding:8px 16px;font-size:14px}
.hero{padding:64px 0 36px;position:relative}.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.04em;color:var(--sky);text-transform:uppercase}
.eyebrow:before{content:"";width:22px;height:2px;background:var(--metal)}
h1{font-size:clamp(34px,6vw,64px);line-height:1.08;font-weight:800;margin:16px 0 18px;max-width:900px}[lang=ar] h1{line-height:1.3}
h1 em{font-style:normal;background:linear-gradient(90deg,#dfe8f7,#8fa6d6);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:clamp(17px,2.2vw,20px);color:var(--muted);max-width:760px;margin:0}.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:44px;background:var(--line-soft);border:1px solid var(--line-soft);border-radius:var(--r);overflow:hidden}
.facts div{background:var(--surface);padding:18px 20px}.facts span{display:block;font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em}.facts b{display:block;font-size:17px;margin-top:4px;line-height:1.4}
section.block{padding:56px 0 8px}.head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}
h2{font-size:clamp(26px,3.6vw,38px);line-height:1.2;margin:8px 0 0;font-weight:800}.sub{color:var(--muted);margin:8px 0 0;max-width:640px}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.pcard{position:relative;background:linear-gradient(180deg,var(--surface2),var(--surface));border:1px solid var(--line);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column}
.pimg{position:relative;aspect-ratio:4/3;background:radial-gradient(circle at 50% 40%,#1d3a68,#0c1e3d 70%);display:grid;place-items:center;border-bottom:1px solid var(--line-soft)}
.pimg img{width:100%;height:100%;object-fit:contain;padding:14px}.size{position:absolute;inset-block-start:12px;inset-inline-start:12px;background:#f3f6fd;color:#051945;font:800 13px/1 var(--latin);padding:7px 10px;border-radius:8px}
.sack{width:46%;aspect-ratio:3/4;background:linear-gradient(160deg,#eef3fb,#c8d6ec);clip-path:polygon(8% 0,92% 0,100% 8%,96% 100%,4% 100%,0 8%);display:grid;place-items:center;color:#0c1e3d;text-align:center;padding:10px}
.sack b{font:800 13px/1.2 var(--latin);letter-spacing:.08em}.sack small{font:700 11px/1.2 var(--font)}
.pbody{padding:16px 18px 18px;display:flex;flex-direction:column;gap:10px;flex:1}.ptype{font-size:13px;color:var(--sky)}.pname{font-size:21px;font-weight:800;margin:0;line-height:1.25}
.pfacts{display:grid;gap:6px;margin:0;font-size:14px}.pfacts div{display:flex;justify-content:space-between;gap:12px;border-top:1px dashed var(--line-soft);padding-top:6px}.pfacts dt{color:var(--dim);white-space:nowrap}.pfacts dd{margin:0;text-align:end}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;counter-reset:s;list-style:none;padding:0;margin:0}
.steps li{counter-increment:s;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--r);padding:22px;position:relative}
.steps li:before{content:"0" counter(s);font:800 34px/1 var(--latin);background:var(--metal);-webkit-background-clip:text;background-clip:text;color:transparent;display:block;margin-bottom:12px}
.steps b{display:block;font-size:18px;margin-bottom:6px}.steps p{margin:0;color:var(--muted)}
.split{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start}
.panel{background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--r);padding:24px}
.checks{list-style:none;padding:0;margin:0;display:grid;gap:12px}.checks li{display:flex;gap:12px;align-items:flex-start}
.checks li:before{content:"";flex:none;width:22px;height:22px;margin-top:3px;border-radius:50%;background:#9fd3b8 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='%23051945' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/14px no-repeat}
.msg{background:#0a1733;border:1px dashed var(--line-hi);border-radius:12px;padding:16px;color:var(--sky);font-size:15px;margin:0 0 16px;white-space:pre-line}
.brief{display:grid;grid-template-columns:.8fr 1.2fr;gap:28px;align-items:start;background:linear-gradient(135deg,#0e2550,#0a1b40);border:1px solid var(--line);border-radius:20px;padding:32px}
.points{list-style:none;counter-reset:p;padding:0;margin:0;display:grid;gap:14px}.points li{counter-increment:p;display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:start;font-size:16.5px}
.points li:before{content:counter(p);width:30px;height:30px;border-radius:50%;border:1px solid var(--line-hi);display:grid;place-items:center;font:700 14px/1 var(--latin);color:var(--sky)}
.tgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.tgrid h3{margin:0 0 8px;font-size:17px;color:var(--sky)}.tgrid p{margin:0;color:var(--muted);font-size:15px}
.faq{display:grid;gap:10px}.faq details{background:var(--surface);border:1px solid var(--line-soft);border-radius:12px;padding:0 20px}.faq details[open]{border-color:var(--line)}
.faq summary{cursor:pointer;list-style:none;padding:18px 0;font-weight:700;font-size:17px;display:flex;justify-content:space-between;gap:16px}.faq summary::-webkit-details-marker{display:none}
.faq summary:after{content:"+";font:400 24px/1 var(--latin);color:var(--sky)}.faq details[open] summary:after{content:"–"}.faq p{margin:0 0 18px;color:var(--muted)}
.band{margin:64px 0 0;padding:36px;border-radius:20px;background:linear-gradient(135deg,#102a5c,#0a1d45);border:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:24px;position:relative;overflow:hidden}
.band:before{content:"";position:absolute;inset:0;padding:1px;border-radius:20px;background:var(--metal);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.7;pointer-events:none}
.band h2{margin:0}.band p{margin:6px 0 0;color:var(--muted)}.band .cta{margin:0;flex:none}
.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0}.chips a{display:inline-block;padding:8px 14px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:14px;color:var(--muted);background:var(--surface)}.chips a:hover{color:var(--text);border-color:var(--line-hi)}
.regions{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.regions h3{margin:0 0 14px;font-size:18px}
.routes{columns:2;column-gap:32px;padding:0;margin:0;list-style:none}.routes li{break-inside:avoid;padding:10px 0;border-bottom:1px solid var(--line-soft)}.routes a{text-decoration:none}.routes a:hover{color:var(--sky)}
footer.foot{margin-top:72px;border-top:1px solid var(--line-soft);padding:32px 0 28px;color:var(--dim);font-size:14px}.foot .wrap{display:flex;flex-wrap:wrap;gap:16px 28px;align-items:center;justify-content:space-between}.foot img{width:134px;opacity:.9}.foot nav{display:flex;flex-wrap:wrap;gap:18px}.foot a{text-decoration:none}
.dock{position:fixed;inset-inline:0;bottom:0;z-index:30;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(5,25,69,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid var(--line-soft);display:none}
.dock .btn{width:100%}
@media(max-width:900px){.brief{grid-template-columns:1fr;padding:24px}.tgrid{grid-template-columns:repeat(2,1fr)}.facts{grid-template-columns:repeat(2,1fr)}.split,.regions{grid-template-columns:1fr}.band{flex-direction:column;align-items:flex-start}}
@media(max-width:700px){.products{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;margin-inline:-16px;padding:0 16px 8px;scrollbar-width:none}.products::-webkit-scrollbar{display:none}.pcard{flex:0 0 84%;scroll-snap-align:center}.pimg{aspect-ratio:16/10}.sack{width:30%}.top nav .hide-s,.top .btn{display:none}.top nav{gap:14px}.hero{padding:40px 0 20px}.steps{grid-template-columns:1fr}.routes{columns:1}.dock{display:block}.band{padding:26px}.head{display:block}.hero .cta .btn{flex:1 1 100%}.tgrid{grid-template-columns:1fr}}
@media(min-width:701px){body{padding-bottom:0}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}`;

export const ICON_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';

/** The product picture, with a branded sack drawing if the photo is missing or fails to load. */
export function productVisual({image, alt, name, size}) {
  const sack = `<div class="sack" ${image ? 'hidden' : ''}><div><b>ZOLLANA</b><br><small>${name}</small></div></div>`;
  return `<div class="pimg">${image ? `<img src="${image}" alt="${alt}" loading="lazy" width="400" height="300" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ''}${sack}<span class="size">${size}</span></div>`;
}
