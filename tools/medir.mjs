#!/usr/bin/env node
/**
 * Mide una pagina montada con el marcado REAL del tema.
 *
 * Por que: una franja vacia entre dos bloques puede salir del relleno de
 * la seccion, del espacio que sobra cuando el contenido es mas bajo que
 * el alto configurado, o de una seccion intermedia. A ojo no se
 * distinguen. Esto imprime, para cada seccion, de donde sale cada pixel.
 *
 *   node tools/medir.mjs <caso> [ancho] [alto]
 *   node tools/medir.mjs hueco-b-panel-corto 1440 1197
 *
 * El caso es uno de los de tools/render.php.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(ROOT, 'tools/'));
const { chromium } = require(path.join(ROOT, '.tools/npm/node_modules/playwright-core'));

const caso = process.argv[2];
const W = Number(process.argv[3] || 1440);
const H = Number(process.argv[4] || 1197);
if (!caso) {
  console.error('Uso: node tools/medir.mjs <caso> [ancho] [alto]');
  process.exit(1);
}

const markup = execFileSync(path.join(ROOT, '.tools/php/php'), [path.join(ROOT, 'tools/render.php'), caso], {
  encoding: 'utf8',
});

/* Tokens del preset, igual que tools/preview.py. */
const preset = JSON.parse(readFileSync(path.join(ROOT, 'krg-cms/presets/honeycomb.json'), 'utf8')).tokens;
const vars = [];
for (const [group, prefix] of [['color', 'color'], ['font', 'font'], ['spacing', 'spacing']]) {
  for (const [k, v] of Object.entries(preset[group] || {})) {
    vars.push(`--${prefix}-${k}:${typeof v === 'object' ? v.value : v}`);
  }
}
vars.push('--page-max-width:1360px');

const css = ['base.css', 'components.css', 'modules.css']
  .map((f) => readFileSync(path.join(ROOT, 'krg-cms/assets/css', f), 'utf8'))
  .join('\n');

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>:root,.krg-root{${vars.join(';')};--m-header-h:76px}</style>
<style>${css}</style>
<style>
  body{margin:0;background:var(--color-background)}
  /* Lo que en WordPress emite DocumentCssCompiler para cada columna. */
  .m-c-row > .m-c-column{grid-column:span 12;min-width:0}
  .m-c-row:has(> .m-c-column:nth-child(2)) > .m-c-column{grid-column:span 6}
  .qa-ph{display:block;width:100%;height:100%;min-height:120px;background:#d9c7a3}
  .m-sp-media .qa-ph{position:absolute;inset:0}
  header.stub{height:76px;background:var(--color-primary);position:sticky;top:0;z-index:5}
</style>
</head><body class="krg-root"><header class="stub"></header><main class="m-page">
${markup}
</main></body></html>`;

mkdirSync(path.join(ROOT, '.captures'), { recursive: true });
const file = path.join(ROOT, '.captures', `medir-${caso}.html`);
writeFileSync(file, html);

const browser = await chromium.launch({
  executablePath: path.join(ROOT, '.tools/chromium/chromium'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto('file://' + file);
await page.waitForTimeout(250);

const filas = await page.evaluate(() => {
  const r = (n) => Math.round(n * 10) / 10;
  const out = [];
  document.querySelectorAll('main > .m-c-section').forEach((s, i) => {
    const cs = getComputedStyle(s);
    const box = s.getBoundingClientRect();
    // El punto mas bajo que pinta algo dentro de la seccion. Los
    // envoltorios de maquetacion no cuentan: se estiran solos y taparian
    // justo el hueco que buscamos.
    const envoltorio = (el) => el.matches('.m-container, .m-c-row, .m-c-column');
    let fondo = box.top;
    s.querySelectorAll('*').forEach((el) => {
      if (envoltorio(el)) return;
      const b = el.getBoundingClientRect();
      if (b.height > 0 && b.width > 0) fondo = Math.max(fondo, b.bottom);
    });
    out.push({
      i,
      clases: s.className,
      alto: r(box.height),
      padTop: cs.paddingTop,
      padBottom: cs.paddingBottom,
      // Espacio muerto: alto de la seccion que nada ocupa, por abajo.
      colaVacia: r(box.bottom - fondo),
      huecoSiguiente: 0,
    });
  });
  const secs = [...document.querySelectorAll('main > .m-c-section')];
  secs.forEach((s, i) => {
    if (i + 1 < secs.length) {
      out[i].huecoSiguiente = r(secs[i + 1].getBoundingClientRect().top - s.getBoundingClientRect().bottom);
    }
  });
  return out;
});

const desborde = await page.evaluate(() =>
  Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
);

console.log(`\ncaso: ${caso}   ventana: ${W}x${H}   desborde horizontal: ${desborde}px`);
console.table(filas);
const muerto = filas.reduce((a, f) => a + Math.max(0, f.colaVacia) + Math.max(0, f.huecoSiguiente), 0);
console.log(`espacio muerto total: ${Math.round(muerto)} px\n`);

await browser.close();
