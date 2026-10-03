#!/usr/bin/env node
/**
 * La cadena entera, de punta a punta, en un navegador de verdad.
 *
 * Lo que ningun otro banco cubria: el lienzo. Aqui el constructor corre
 * con su iframe, y ese iframe lo sirve el PHP del tema (tools/render-doc.php)
 * a partir del documento que el propio constructor acaba de guardar. Asi se
 * recorre entera la cadena que hay que demostrar:
 *
 *   control → evento → estado → documento → POST → saneador → compilador
 *   de CSS → marcado → DOM del iframe → getComputedStyle
 *
 * Y se repite el ultimo tramo en los tres modos de pintado (lienzo,
 * «Preview» y web publica), que son tres contextos del mismo renderizador.
 *
 *   node tools/prueba-lienzo.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS_DIR = `${ROOT}/krg-cms/admin/assets/js`;
const CSS_DIR = `${ROOT}/krg-cms/admin/assets/css`;
const PHP = `${ROOT}/.tools/php/php`;
const REST = 'https://krg.test/wp-json/krg/v1';
const LIENZO = 'https://krg.test/pagina-de-prueba/';
// El panel se sirve desde el mismo origen que el lienzo a proposito: en el
// admin de WordPress tambien lo son, y de eso depende que el constructor
// pueda tocar el documento del iframe (el repintado en vivo). Con el panel
// en file:// el navegador lo trata como otro origen y ese tramo no se
// podria medir.
const PANEL = 'https://krg.test/wp-admin/krg-builder.html';

const registry = JSON.parse(
  execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' })
);

const dir = mkdtempSync(join(tmpdir(), 'krg-lienzo-'));

/** Pinta un documento con el PHP del tema, en el modo pedido. */
function pintar(doc, modo) {
  const archivo = join(dir, 'doc.json');
  writeFileSync(archivo, JSON.stringify(doc));
  const env = { ...process.env };
  if (modo === 'canvas') env.KRG_CANVAS = '1';
  if (modo === 'preview') env.KRG_PREVIEW = '1';
  return execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, archivo], { encoding: 'utf8', env });
}

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});
const inicial = () => ({
  id: 1, title: 'Prueba', slug: 'prueba', status: 'draft', checksum: 'c0',
  seo: {}, settings: {}, previewUrl: LIENZO,
  sections: [
    nodo('secA', 'section', { width: 'full' }, [
      nodo('secA-r', 'row', {}, [nodo('secA-c', 'column', { span: 12 }, [
        nodo('cta1', 'statement-cta', { title: 'Reserva', theme: 'forest' }),
      ])]),
    ]),
    nodo('secB', 'section', { width: 'boxed' }, [
      nodo('secB-r', 'row', {}, [nodo('secB-c', 'column', { span: 12 }, [
        nodo('p1', 'paragraph', { text: 'Un párrafo cualquiera.' }),
      ])]),
    ]),
  ],
});

let ultimo = null;
let fallos = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};
let comprobaciones = 0;
const comprueba = (cond, msg) => { comprobaciones++; ok(cond, msg); };

const leer = (f) => readFileSync(f, 'utf8');
const html = `<!doctype html><meta charset="utf-8">
<style>${leer(`${CSS_DIR}/admin.css`)}</style>
<style>${leer(`${CSS_DIR}/builder.css`)}</style>
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script>${leer(`${JS_DIR}/app.js`)}</script>
<script>${leer(`${JS_DIR}/builder.js`)}</script>`;

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).split('\n')[0]));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  // El iframe del lienzo: PHP de verdad sobre el documento guardado.
  if (req.url() === PANEL) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  }
  if (req.url().startsWith(LIENZO)) {
    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: pintar(ultimo || inicial(), 'canvas'),
    });
  }
  if (req.method() === 'POST' && /\/pages\/1(\/save)?$/.test(url)) {
    const cuerpo = JSON.parse(req.postData() || '{}');
    ultimo = JSON.parse(JSON.stringify(cuerpo));
    return json({ ...cuerpo, previewUrl: LIENZO, checksum: 'c' + Date.now() });
  }
  // El servidor de verdad siempre devuelve la URL del lienzo; el POST del
  // constructor no la manda, asi que hay que reponerla como hace WordPress.
  if (url === '/pages/1') return json({ ...(ultimo || inicial()), previewUrl: LIENZO });
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {} } });
  return json([]);
});

await page.goto(PANEL);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await page.waitForTimeout(600);

const marco = () => page.frames().find((f) => f.url().startsWith(LIENZO));

/** getComputedStyle de un elemento del lienzo. */
async function calculado(sel, props) {
  const f = marco();
  if (!f) return { '«sin iframe»': true };
  return f.evaluate(([s, ps]) => {
    const el = document.querySelector(s);
    if (!el) return { '«no existe»': s };
    const cs = getComputedStyle(el);
    const out = {};
    ps.forEach((p) => { out[p] = cs.getPropertyValue(p); });
    out.enLinea = el.getAttribute('style') || '';
    return out;
  }, [sel, props]);
}

async function seleccionar(id) {
  await page.evaluate((nid) => document.querySelector(`[data-sel="${nid}"]`).click(), id);
  await page.click('[data-insp-tab="design"]');
  await page.waitForTimeout(150);
}
async function esperarGuardado() {
  await page.waitForFunction(() => !document.querySelector('.b-status') ||
    /Guardado/.test(document.querySelector('.b-status').textContent), null, { timeout: 8000 });
  await page.waitForTimeout(900);
}
async function recargarMarco() {
  await page.evaluate(() => document.getElementById('refresh')?.click());
  await page.waitForTimeout(1200);
}

/* ================================================================== */
console.log('\nPRUEBA 1 — color de fondo #ff0000 en una sección');
await seleccionar('secA');
await page.fill('.b-insp [data-style="background"]', '#ff0000');
await esperarGuardado();

const guardado1 = JSON.stringify(ultimo?.sections?.[0]?.styles?.desktop || {});
comprueba(/#ff0000/.test(guardado1), `1-4. llega al estado y al documento guardado: ${guardado1}`);

await recargarMarco();
let m = await calculado('.m-n-secA', ['background-color', 'padding-top', 'margin-top']);
comprueba(m['background-color'] === 'rgb(255, 0, 0)', `5-7. en el DOM del lienzo: background-color = ${m['background-color']}`);
comprueba(/#ff0000/.test(m.enLinea), `   y en el atributo style del elemento: ${m.enLinea}`);

console.log('\nPRUEBA 1b — repintado inmediato, sin guardar ni recargar el lienzo');
await seleccionar('secB');
await page.fill('.b-insp [data-style="background"]', '#0000ff');
await page.waitForTimeout(250);
let viva = await calculado('.m-n-secB', ['background-color']);
comprueba(viva['background-color'] === 'rgb(0, 0, 255)', `al instante en el lienzo: ${viva['background-color']}`);
await page.fill('.b-insp [data-side="padding-top"]', '64');
await page.waitForTimeout(250);
viva = await calculado('.m-n-secB', ['padding-top']);
comprueba(viva['padding-top'] === '64px', `relleno al instante: ${viva['padding-top']}`);
await esperarGuardado();
await seleccionar('secA');

console.log('\nPRUEBA 2 — padding-top 100px');
await page.fill('.b-insp [data-side="padding-top"]', '100');
await esperarGuardado();
await recargarMarco();
m = await calculado('.m-n-secA', ['padding-top', 'padding-bottom']);
comprueba(m['padding-top'] === '100px', `getComputedStyle(.m-n-secA).paddingTop = ${m['padding-top']}`);

console.log('\nPRUEBA 3 — margin-top 100px');
await page.fill('.b-insp [data-side="margin-top"]', '100');
await esperarGuardado();
await recargarMarco();
m = await calculado('.m-n-secA', ['margin-top']);
comprueba(m['margin-top'] === '100px', `getComputedStyle(.m-n-secA).marginTop = ${m['margin-top']}`);

console.log('\nPRUEBA 4 — persistencia: recargar el constructor entero');
await page.reload();
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await page.waitForTimeout(800);
await seleccionar('secA');
const panel = await page.evaluate(() => ({
  fondo: document.querySelector('.b-insp [data-style="background"]')?.value,
  relleno: document.querySelector('.b-insp [data-side="padding-top"]')?.value,
  margen: document.querySelector('.b-insp [data-side="margin-top"]')?.value,
}));
comprueba(panel.fondo === '#ff0000', `el panel recuerda el fondo: ${panel.fondo}`);
comprueba(panel.relleno === '100', `el panel recuerda el relleno: ${panel.relleno}`);
comprueba(panel.margen === '100', `el panel recuerda el margen: ${panel.margen}`);
m = await calculado('.m-n-secA', ['background-color', 'padding-top', 'margin-top']);
comprueba(m['background-color'] === 'rgb(255, 0, 0)' && m['padding-top'] === '100px' && m['margin-top'] === '100px',
  `y el lienzo recién cargado los pinta: ${m['background-color']} / ${m['padding-top']} / ${m['margin-top']}`);

console.log('\nPRUEBA 5 — el mismo documento en «Preview» y en la web pública');
for (const modo of ['preview', 'publico']) {
  const marcado = pintar(ultimo, modo === 'preview' ? 'preview' : '');
  const f2 = join(dir, `${modo}.html`);
  writeFileSync(f2, marcado);
  const p2 = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await p2.goto('file://' + f2);
  const r = await p2.evaluate(() => {
    const el = document.querySelector('.m-n-secA');
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, pt: cs.paddingTop, mt: cs.marginTop };
  });
  comprueba(r.bg === 'rgb(255, 0, 0)' && r.pt === '100px' && r.mt === '100px',
    `${modo}: ${r.bg} / ${r.pt} / ${r.mt}`);
  await p2.close();
}

console.log('\nPRUEBA 6 — ¿tapa algo el fondo? capas por encima de la sección');
const f6 = marco();
const capas = !f6 ? ['«sin iframe»'] : await f6.evaluate(() => {
  const sec = document.querySelector('.m-n-secA');
  const caja = sec.getBoundingClientRect();
  const dentro = [...sec.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return false;
    const r = el.getBoundingClientRect();
    return r.width >= caja.width - 1 && r.height >= caja.height - 1;
  });
  return dentro.map((el) => `${el.className} (${getComputedStyle(el).backgroundColor})`);
});
comprueba(true, `capas que cubren la sección entera: ${capas.length ? capas.join(', ') : 'ninguna'}`);

console.log('\nPRUEBA 7 — bloque de dentro: relleno propio');
await seleccionar('cta1');
await page.fill('.b-insp [data-side="padding-top"]', '37');
await esperarGuardado();
await recargarMarco();
m = await calculado('.m-n-cta1', ['padding-top']);
comprueba(m['padding-top'] === '37px', `getComputedStyle(.m-n-cta1).paddingTop = ${m['padding-top']}`);

console.log('\nPRUEBA 8 — el diagnóstico de estilos dice la verdad cuando todo va bien');
await seleccionar('secA');
await page.click('.b-insp [data-insp-tab="advanced"]');
await page.click('.b-insp [data-diag]');
let informe = await page.inputValue('.b-insp .b-diag');
comprueba(/Elementos con \.m-n-secA en el lienzo: 1/.test(informe), 'cuenta el elemento en el lienzo');
comprueba(/background:\s*#ff0000/.test(informe), 'enseña el atributo style real');
comprueba(/background \(background-color\): pedido #ff0000 · calculado rgb\(255, 0, 0\) ✔/.test(informe), 'marca la propiedad como aplicada');
comprueba(!/✖/.test(informe), 'ningún paso roto');

console.log('\nPRUEBA 9 — y señala al culpable cuando otra hoja pisa el valor');
await page.evaluate(() => {
  const d = document.querySelector('iframe').contentDocument;
  const st = d.createElement('style');
  st.textContent = '@media (min-width: 300px) { .m-c-section { background: #ff00ff !important; } }';
  d.head.appendChild(st);
});
await page.click('.b-insp [data-diag]');
informe = await page.inputValue('.b-insp .b-diag');
comprueba(/background \(background-color\): pedido #ff0000 · calculado rgb\(255, 0, 255\) ✖/.test(informe), 'detecta que lo calculado no es lo pedido');
comprueba(/\.m-c-section \{ background-color: rgb\(255, 0, 255\) !important \}/.test(informe), 'nombra la regla que gana');
comprueba(/@media \(min-width: 300px\)/.test(informe), 'y la media query en la que vive');
await page.evaluate(() => document.querySelector('.b-insp .b-diag').scrollIntoView({ block: 'center' }));
await page.locator('.b-insp').screenshot({ path: '.captures/panel/diagnostico.png' });

const unicos = [...new Set(errores)];
comprueba(unicos.length === 0, `sin errores de consola${unicos.length ? ': ' + unicos.join(' | ') : ''}`);

await browser.close();
console.log(`\n${comprobaciones - fallos}/${comprobaciones} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
