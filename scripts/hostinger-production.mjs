import {cp,mkdir,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function filesIn(dir){const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())files.push(...await filesIn(p));else files.push(p);}return files;}
export async function packageProduction(projectRoot=root){
 const web=path.join(projectRoot,'apps/web'),app=path.join(web,'.next/server/app'),dest=path.join(projectRoot,'deploy');
 const config=await readFile(path.join(web,'next.config.mjs'),'utf8');
 if(config.includes('nextConfig.basePath')||config.includes('/preview/septlion-customer-v2'))throw new Error('Refusing to deploy a preview build to production.');
 const buildId=(await readFile(path.join(web,'.next/BUILD_ID'),'utf8')).trim();
 await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
 await cp(path.join(web,'public'),dest,{recursive:true});
 await cp(path.join(web,'.next/static'),path.join(dest,'_next/static'),{recursive:true});
 const routes=[];
 for(const file of await filesIn(app)){
  const rel=path.relative(app,file);if(rel.startsWith('_'))continue;
  if(rel.endsWith('.html')){const route=rel.slice(0,-5),target=route==='index'?'index.html':path.join(route,'index.html');await mkdir(path.dirname(path.join(dest,target)),{recursive:true});await cp(file,path.join(dest,target));routes.push(route==='index'?'/':'/'+route);}
  if(rel.endsWith('.rsc')){const target=path.join(dest,'_rsc',rel);await mkdir(path.dirname(target),{recursive:true});await cp(file,target);}
  if(['robots.txt.body','sitemap.xml.body','llms.txt.body'].includes(rel))await cp(file,path.join(dest,rel.slice(0,-5)));
 }
 for(const route of ['index','discover','require','requests','request','offer','offer-document','commit','execution','documents','receive','reorder','account','notifications','operations','analytics']){
  const file=path.join(dest,route==='index'?'index.html':route+'/index.html');
  if(!(await stat(file)).size||!(await stat(path.join(dest,'_rsc',route+'.rsc'))).size)throw new Error('Missing production HTML or navigation payload: '+route);
  const html=await readFile(file,'utf8');if(!html.includes('/_next/')||html.includes('/preview/septlion-customer-v2/_next/'))throw new Error('Wrong production assets: '+route);
 }
 await cp(path.join(dest,'index.html'),path.join(dest,'404.html'));
 await writeFile(path.join(dest,'.htaccess'),`Options -Indexes -MultiViews
DirectoryIndex index.html
RewriteEngine On
RewriteBase /
RewriteCond %{HTTP:RSC} =1
RewriteRule ^$ _rsc/index.rsc [L]
RewriteCond %{HTTP:RSC} =1
RewriteCond %{DOCUMENT_ROOT}/_rsc/$1.rsc -f
RewriteRule ^(.+?)/?$ _rsc/$1.rsc [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{DOCUMENT_ROOT}/$1/index.html -f
RewriteRule ^(.+?)/?$ $1/index.html [L]
AddType text/x-component .rsc
<IfModule mod_headers.c>
  <FilesMatch "\\.(html|rsc|json)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
ErrorDocument 404 /404.html
`);
 await writeFile(path.join(dest,'deployment.json'),JSON.stringify({branch:'main',commit:process.env.GITHUB_SHA||'local-validation',basePath:'',buildId,routes,deployedAt:new Date().toISOString()},null,2)+'\n');
 console.log('Verified production package: '+routes.length+' routes with matching navigation payloads.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await packageProduction();
