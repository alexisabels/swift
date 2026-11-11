#!/usr/bin/env node
/*
 * Empaqueta la app en un único fichero HTML (CSS y JS en línea), útil para
 * compartirla por correo o subirla a cualquier sitio sin estructura de carpetas.
 *
 *   node scripts/build-single.js                 → dist/swiftui-sobre-kmp.html
 *   node scripts/build-single.js --fragment out  → fragmento sin <html>/<head>/<body>
 *                                                   (para visores que ya ponen el esqueleto)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const outArg = args.find((a) => !a.startsWith('--'));
const out = path.resolve(outArg || path.join(root, 'dist', 'swiftui-sobre-kmp.html'));

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function inline(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  if (/<\/script/i.test(src) || /<\/style/i.test(src)) {
    throw new Error(`${file} contiene "</script" o "</style" y no se puede incrustar tal cual`);
  }
  return src;
}

html = html.replace(/<link rel="stylesheet" href="(assets\/[^"]+)">/g, (_, file) => `<style>\n${inline(file)}\n</style>`);
html = html.replace(/<script src="(assets\/[^"]+)"><\/script>/g, (_, file) => {
  const pre = fragment && file.endsWith('app.js') ? 'window.CURSO_EMBEDDED = true;\n' : '';
  return `<script>\n${pre}${inline(file)}\n</script>`;
});

if (/(?:href|src)="assets\//.test(html)) throw new Error('Queda alguna referencia a assets/ sin incrustar');

if (fragment) {
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '')
    .replace(/<\/html>\s*/i, '')
    .replace(/<head>\s*/i, '')
    .replace(/<\/head>\s*/i, '')
    .replace(/<body>\s*/i, '')
    .replace(/<\/body>\s*/i, '')
    .replace(/\s*<meta charset="utf-8">/i, '')
    .replace(/\s*<meta name="viewport"[^>]*>/i, '');
  html = html.replace('<title>', '<script>document.documentElement.lang = "es";</script>\n<title>');
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${path.relative(process.cwd(), out)} · ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
