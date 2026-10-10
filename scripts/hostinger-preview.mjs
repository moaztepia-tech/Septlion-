import {cp, mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// All transformations happen in the preview runner's disposable checkout.
// The production application and its deployment workflow remain unchanged.
export const basePath = '/preview/septlion-customer-v2';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
const destination = path.join(root, 'deploy-preview');
const require = createRequire(path.join(web, 'package.json'));
const ts = require('typescript');
const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});

export function scopedUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return value;
  if (value === basePath || value.startsWith(basePath + '/') || value.startsWith(basePath + '?') || value.startsWith(basePath + '#')) return value;
  return basePath + value;
}

const helperSource = `function __septlionPreviewPath<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return value;
  const prefix = '${basePath}';
  if (value === prefix || value.startsWith(prefix + '/') || value.startsWith(prefix + '?') || value.startsWith(prefix + '#')) return value;
  return (prefix + value) as T;
}`;

export function transformSource(input, fileName) {
  if (input.includes('function __septlionPreviewPath')) throw new Error('Preview source was already prepared: ' + fileName);
  const source = ts.createSourceFile(fileName, input, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let needsHelper = false;
  const transformed = ts.transform(source, [context => {
    const f = context.factory;
    const wrap = value => { needsHelper = true; return f.createCallExpression(f.createIdentifier('__septlionPreviewPath'), undefined, [value]); };
    const visit = node => {
      // Native anchors, images and preload links do not apply Next's basePath.
      if (ts.isJsxAttribute(node) && ['href', 'src', 'srcSet', 'action'].includes(node.name.getText(source))) {
        const tag = node.parent.parent.tagName?.getText(source) || '';
        if (/^[a-z]/.test(tag) && node.initializer) {
          if (ts.isStringLiteral(node.initializer)) return f.updateJsxAttribute(node, node.name, f.createStringLiteral(scopedUrl(node.initializer.text)));
          if (ts.isJsxExpression(node.initializer) && node.initializer.expression) return f.updateJsxAttribute(node, node.name, f.createJsxExpression(undefined, wrap(ts.visitNode(node.initializer.expression, visit))));
        }
      }
      // Full-page redirects, PDF logo loads and generated download anchors.
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && ['href', 'src'].includes(node.left.name.text)) {
        return f.updateBinaryExpression(node, node.left, node.operatorToken, wrap(ts.visitNode(node.right, visit)));
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.arguments.length) {
        const owner = node.expression.expression.getText(source);
        const method = node.expression.name.text;
        if ((['window.location', 'location'].includes(owner) && ['assign', 'replace'].includes(method)) || (owner === 'window' && method === 'open')) {
          return f.updateCallExpression(node, node.expression, node.typeArguments, [wrap(ts.visitNode(node.arguments[0], visit)), ...node.arguments.slice(1).map(value => ts.visitNode(value, visit))]);
        }
        if (owner === 'navigator.serviceWorker' && method === 'register') {
          const options = node.arguments[1];
          const scopedOptions = options && ts.isObjectLiteralExpression(options) ? f.updateObjectLiteralExpression(options, options.properties.map(property => ts.isPropertyAssignment(property) && property.name.getText(source) === 'scope' ? f.updatePropertyAssignment(property, property.name, f.createStringLiteral(basePath + '/')) : property)) : options;
          return f.updateCallExpression(node, node.expression, node.typeArguments, [wrap(ts.visitNode(node.arguments[0], visit)), ...(scopedOptions ? [scopedOptions] : [])]);
        }
      }
      // Metadata and public assets also need the preview prefix.
      if (ts.isStringLiteral(node) && /^\/(brand\/|fonts\/|favicon\.ico|placeholder\.jpg)/.test(node.text)) return f.createStringLiteral(scopedUrl(node.text));
      // Preview logout/drafts must not clear the live site's browser storage.
      if (ts.isStringLiteral(node) && /^septlion[_-]/.test(node.text)) return f.createStringLiteral(node.text.replace(/^septlion/, 'septlion_preview_customer_v2'));
      if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'robots' && ts.isObjectLiteralExpression(node.initializer)) {
        return f.updatePropertyAssignment(node, node.name, f.createObjectLiteralExpression([f.createPropertyAssignment('index', f.createFalse()), f.createPropertyAssignment('follow', f.createFalse())]));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return value => ts.visitNode(value, visit);
  }]);
  let output = transformed.transformed[0];
  if (needsHelper) {
    const helper = ts.createSourceFile('preview-helper.ts', helperSource, ts.ScriptTarget.Latest, true).statements[0];
    const statements = [...output.statements];
    const insertion = statements.findIndex(statement => !ts.isImportDeclaration(statement) && !(ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)));
    // Print the helper separately: nodes from another SourceFile retain offsets.
    const rendered = printer.printFile(output);
    const anchor = insertion < 0 ? rendered.length : rendered.indexOf(printer.printNode(ts.EmitHint.Unspecified, statements[insertion], output));
    transformed.dispose();
    if (anchor < 0) throw new Error('Could not insert preview URL helper: ' + fileName);
    return rendered.slice(0, anchor) + helperSource + '\n' + rendered.slice(anchor);
  }
  const result = printer.printFile(output);
  transformed.dispose();
  return result;
}

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(target));
    else files.push(target);
  }
  return files;
}

async function prepare() {
  const configPath = path.join(web, 'next.config.mjs');
  const config = await readFile(configPath, 'utf8');
  if (!config.includes('export default nextConfig;') || config.includes('nextConfig.basePath')) throw new Error('Unexpected Next config; refusing to prepare twice.');
  await writeFile(configPath, config.replace('export default nextConfig;', `nextConfig.basePath = '${basePath}'; export default nextConfig;`));
  for (const directory of ['app', 'components', 'lib']) {
    for (const file of await filesIn(path.join(web, directory))) {
      if (/\.tsx?$/.test(file)) await writeFile(file, transformSource(await readFile(file, 'utf8'), file));
      if (file.endsWith('.css')) {
        const input = await readFile(file, 'utf8');
        await writeFile(file, input.replace(/url\((['"]?)(\/(?!\/)[^)'"\s]+)\1\)/g, (_, quote, url) => `url(${quote}${scopedUrl(url)}${quote})`));
      }
    }
  }
  const swPath = path.join(web, 'public/demand-sw.js');
  const sw = await readFile(swPath, 'utf8');
  await writeFile(swPath, sw.replace(/(['"])(\/(?!\/)[^'"]+)\1/g, (_, quote, url) => quote + scopedUrl(url) + quote));
  console.log('Prepared isolated Hostinger preview URLs and browser storage.');
}

async function packagePreview() {
  const app = path.join(web, '.next/server/app');
  const buildId = (await readFile(path.join(web, '.next/BUILD_ID'), 'utf8')).trim();
  const config = await readFile(path.join(web, 'next.config.mjs'), 'utf8');
  if (!config.includes(`nextConfig.basePath = '${basePath}'`)) throw new Error('Refusing to publish an unscoped build.');
  await rm(destination, {recursive: true, force: true});
  await mkdir(destination, {recursive: true});
  await cp(path.join(web, 'public'), destination, {recursive: true});
  await cp(path.join(web, '.next/static'), path.join(destination, '_next/static'), {recursive: true});
  const routes = [];
  for (const file of await filesIn(app)) {
    const relative = path.relative(app, file);
    if (relative.endsWith('.html') && !relative.startsWith('_')) {
      const route = relative.slice(0, -5);
      const target = route === 'index' ? 'index.html' : path.join(route, 'index.html');
      await mkdir(path.dirname(path.join(destination, target)), {recursive: true});
      await cp(file, path.join(destination, target));
      routes.push(route === 'index' ? '/' : '/' + route);
    }
    if (relative.endsWith('.rsc') && !relative.startsWith('_')) {
      const target = path.join(destination, '_rsc', relative);
      await mkdir(path.dirname(target), {recursive: true});
      await cp(file, target);
    }
  }
  await cp(path.join(destination, 'index.html'), path.join(destination, '404.html'));
  await writeFile(path.join(destination, '.htaccess'), `Options -Indexes -MultiViews
DirectoryIndex index.html
RewriteEngine On
RewriteBase ${basePath}/
# App Router client navigation requests receive the matching prerendered RSC.
RewriteCond %{HTTP:RSC} =1
RewriteRule ^$ _rsc/index.rsc [L]
RewriteCond %{HTTP:RSC} =1
RewriteCond %{DOCUMENT_ROOT}${basePath}/_rsc/$1.rsc -f
RewriteRule ^(.+?)/?$ _rsc/$1.rsc [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{DOCUMENT_ROOT}${basePath}/$1/index.html -f
RewriteRule ^(.+?)/?$ $1/index.html [L]
AddType text/x-component .rsc
<IfModule mod_headers.c>
  Header always set X-Robots-Tag "noindex, nofollow"
  <FilesMatch "\\.(html|rsc|json)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
ErrorDocument 404 ${basePath}/404.html
`);
  await writeFile(path.join(destination, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await writeFile(path.join(destination, 'deployment.json'), JSON.stringify({branch: 'septlion-customer-v2', commit: process.env.GITHUB_SHA || 'local-validation', basePath, buildId, routes, backend: 'existing Septlion Supabase backend', deployedAt: new Date().toISOString()}, null, 2) + '\n');
  for (const route of ['/', '/discover', '/require', '/requests', '/request', '/offer', '/offer-document', '/commit', '/execution', '/documents', '/receive', '/reorder', '/account', '/notifications']) {
    const file = path.join(destination, route === '/' ? 'index.html' : route.slice(1) + '/index.html');
    if (!(await stat(file)).size) throw new Error('Missing preview route: ' + route);
    const html = await readFile(file, 'utf8');
    if (!html.includes(basePath + '/_next/')) throw new Error('Unscoped Next assets: ' + route);
    for (const match of html.matchAll(/(?:href|src|srcset)="(\/(?!\/)[^"]*)"/g)) {
      if (!match[1].startsWith(basePath)) throw new Error('Preview URL escapes to production: ' + match[1]);
    }
  }
  if (!(await stat(path.join(destination, '_rsc/require.rsc'))).size) throw new Error('Missing App Router navigation payload.');
  // Verify the built CSS cascade, not just the presence of the latest source.
  const stylesheetLists = [];
  for (const route of ['index.html', 'discover/index.html', 'require/index.html', 'requests/index.html']) {
    const html = await readFile(path.join(destination, route), 'utf8');
    const stylesheets = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(match => match[0]).filter(tag => tag.includes('rel="stylesheet"'))
      .map(tag => tag.match(/href="([^"]+)"/)[1]);
    stylesheetLists.push(stylesheets);
  }
  if (!stylesheetLists[0].length || stylesheetLists.some(list => JSON.stringify(list) !== JSON.stringify(stylesheetLists[0]))) {
    throw new Error('A route stylesheet can override the approved customer theme.');
  }
  const stylesheets = await Promise.all(stylesheetLists[0].map(url => {
    if (!url.startsWith(basePath + '/_next/static/css/')) throw new Error('Unscoped customer stylesheet.');
    return readFile(path.join(destination, url.slice(basePath.length + 1)), 'utf8');
  }));
  const css = require('postcss').parse(stylesheets.join('\n'));
  for (const [selector, expected] of [['.discover-page', 'radial-gradient'], ['.discover-page .discover-product', 'linear-gradient']]) {
    let winner;
    css.walkRules(rule => {
      if (rule.parent.type === 'atrule' || !rule.selector.split(',').includes(selector)) return;
      rule.walkDecls('background', declaration => {
        if (!winner || declaration.important || !winner.important) winner = declaration;
      });
    });
    if (!winner?.value.includes(expected)) throw new Error('Legacy CSS hides the approved theme: ' + selector);
  }
  console.log('Verified preview package: ' + routes.length + ' routes, scoped assets, RSC navigation and noindex.');
  console.log('Verified stable customer stylesheet order and visible v2 theme.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === '--prepare') await prepare();
  else if (mode === '--package') await packagePreview();
  else throw new Error('Use --prepare before build, then --package.');
}
