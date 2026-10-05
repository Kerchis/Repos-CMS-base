#!/usr/bin/env node
/**
 * El editor de texto con botones, de punta a punta.
 *
 * La queja era simple: escribir un texto en el panel era escribir en un
 * recuadro pelado. No había manera de poner una palabra en negrita, una
 * cursiva o un enlace, como en WordPress de toda la vida.
 *
 * Un botón que «se ve bonito» no arregla nada, así que aquí se recorre
 * el camino entero y en este orden:
 *
 *   escribir → se ve en el editor → se guarda → recargar el panel →
 *   vuelve a verse igual → y la web lo pinta como formato de verdad.
 *
 * Y de paso las dos trampas del asunto: que la pestaña «HTML» enseñe el
 * mismo contenido (no otro), y que pegar desde fuera no cuele etiquetas
 * raras.
 *
 *   node tools/prueba-editor.mjs
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
const PUBLICO = 'https://krg.test/publico/';
const PANEL = 'https://krg.test/wp-admin/krg-builder.html';

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const dir = mkdtempSync(join(tmpdir(), 'krg-edit-'));

function sanear(doc) {
  const f = join(dir, 'post.json');
  writeFileSync(f, JSON.stringify(doc));
  return JSON.parse(execFileSync(PHP, [`${ROOT}/tools/sanear.php`, f], { encoding: 'utf8' }));
}
function pintar(doc, env = {}) {
  const f = join(dir, 'doc.json');
  writeFileSync(f, JSON.stringify(doc));
  return execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, f], { encoding: 'utf8', env: { ...process.env, ...env } });
}

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: {}, children,
});

const docBase = () => ({
  id: 1, title: 'Textos', slug: 'textos', status: 'draft', checksum: 'c0',
  seo: {}, settings: {}, previewUrl: LIENZO,
  sections: [
    nodo('sec', 'section', { width: 'boxed' }, [
      nodo('r', 'row', {}, [nodo('c', 'column', { span: 12 }, [
        nodo('p1', 'paragraph', { text: 'Texto de partida' }),
        nodo('t1', 'card', { title: 'Tarjeta', text: 'Descripción de partida' }),
      ])]),
    ]),
  ],
});

let ok = 0;
let fallos = 0;
const comprueba = (cond, msg) => {
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  cond ? ++ok : ++fallos;
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let ultimo = null;
let enviado = null;

const leer = (f) => readFileSync(f, 'utf8');
const html = `<!doctype html><meta charset="utf-8">
<style>${leer(`${CSS_DIR}/admin.css`)}</style>
<style>${leer(`${CSS_DIR}/builder.css`)}</style>
<body class="wp-admin">
<div id="wpwrap"><div id="wpcontent" style="margin-left:160px"><div id="wpbody"><div id="wpbody-content">
<div id="krg-builder"></div>
</div></div></div></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script>${leer(`${JS_DIR}/app.js`)}</script>
<script>${leer(`${JS_DIR}/builder-core.js`)}</script>
<script>${leer(`${JS_DIR}/builder-v2.js`)}</script>
<script>${leer(`${JS_DIR}/builder-fields.js`)}</script>
<script>${leer(`${JS_DIR}/builder.js`)}</script>`;

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).split('\n')[0]));
page.on('dialog', (d) => d.accept('https://ejemplo.com/miel'));

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.url() === PANEL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  if (req.url().startsWith(PUBLICO)) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintar(ultimo || docBase()) });
  }
  if (req.url().startsWith(LIENZO)) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintar(ultimo || docBase(), { KRG_CANVAS: '1' }) });
  }
  if (req.method() === 'POST' && /\/pages\/1(\/save)?$/.test(url)) {
    enviado = JSON.parse(req.postData() || '{}');
    ultimo = sanear(enviado);
    return json({ ...ultimo, previewUrl: LIENZO, checksum: 'c' + Date.now() });
  }
  if (url === '/pages/1') return json({ ...sanear(ultimo || docBase()), previewUrl: LIENZO });
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {} } });
  return json([]);
});

/** Selecciona un bloque del árbol y abre todos los grupos del inspector. */
async function elegir(id) {
  await page.evaluate((i) => document.querySelector(`[data-sel="${i}"]`)?.click(), id);
  await esperar(300);
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
  });
  await esperar(250);
}

/** Lo que el editor de un campo enseña y lo que lleva dentro. */
const mirar = (prop) => page.evaluate((p) => {
  const area = document.querySelector(`.b-insp [data-prop="${p}"]`);
  const caja = area?.closest('[data-rt-caja]');
  const vis = caja?.querySelector('[data-rt-visual]');
  return {
    hay: !!caja,
    modo: caja?.dataset.rtModo || '',
    visual: vis?.innerHTML || '',
    texto: vis?.textContent || '',
    area: area?.value || '',
    areaOculta: !!area?.hidden,
    visualOculto: !!vis?.hidden,
    botones: [...(caja?.querySelectorAll('[data-rt-cmd]') || [])].map((b) => b.dataset.rtCmd),
  };
}, prop);

/** Escribe en el editor visual seleccionando todo lo que hubiera. */
async function escribir(prop, texto) {
  await page.evaluate(([p, t]) => {
    const caja = document.querySelector(`.b-insp [data-prop="${p}"]`).closest('[data-rt-caja]');
    const vis = caja.querySelector('[data-rt-visual]');
    vis.focus();
    vis.textContent = t;
    vis.dispatchEvent(new Event('input', { bubbles: true }));
  }, [prop, texto]);
  await esperar(120);
}

/** Pone en negrita un trozo del texto, como haría el ratón. */
async function negrita(prop, palabra) {
  await page.evaluate(([p, w]) => {
    const caja = document.querySelector(`.b-insp [data-prop="${p}"]`).closest('[data-rt-caja]');
    const vis = caja.querySelector('[data-rt-visual]');
    const nodo = vis.firstChild;
    const i = nodo.textContent.indexOf(w);
    const r = document.createRange();
    r.setStart(nodo, i);
    r.setEnd(nodo, i + w.length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    vis.focus();
    caja.querySelector('[data-rt-cmd="bold"]').click();
  }, [prop, palabra]);
  await esperar(150);
}

const esperarGuardado = async (n) => {
  for (let i = 0; i < 60; i++) {
    if (ultimo && JSON.stringify(ultimo).length && enviado && (enviado.__n = n)) break;
    await esperar(100);
  }
};

/* ================================================================== */
console.log('\n--- El campo de texto es un editor, no un recuadro pelado');
await page.goto(PANEL);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await esperar(700);
await elegir('p1');

let m = await mirar('text');
comprueba(m.hay, 'el párrafo se escribe en un editor con barra de formato');
comprueba(m.modo === 'linea', `en modo línea, que es lo que cabe en un párrafo (${m.modo})`);
comprueba(['bold', 'italic', 'underline', 'strikeThrough', 'createLink', 'unlink', 'removeFormat'].every((c) => m.botones.includes(c)),
  `con negrita, cursiva, subrayado, tachado, enlace, quitar enlace y limpiar (${m.botones.join(', ')})`);
comprueba(m.texto === 'Texto de partida', 'y arranca con el texto que ya había');
comprueba(m.areaOculta && !m.visualOculto, 'se ve el texto, no el código');

/* ================================================================== */
console.log('\n--- Poner una palabra en negrita');
await escribir('text', 'Miel cruda de la sierra');
await negrita('text', 'cruda');
m = await mirar('text');
comprueba(/<(b|strong)>cruda<\/(b|strong)>/i.test(m.visual), `la palabra queda en negrita (${m.visual})`);
comprueba(/<(b|strong)>cruda<\/(b|strong)>/i.test(m.area), 'y el recuadro de debajo lleva ese mismo HTML');

/* ================================================================== */
console.log('\n--- Se guarda solo, como cualquier otro cambio');
await esperar(1200);
comprueba(!!enviado, 'el panel manda el documento al servidor');
const guardadoTexto = JSON.stringify(ultimo);
comprueba(/<(b|strong)>cruda<\/(b|strong)>/i.test(guardadoTexto),
  'y la negrita sobrevive al saneador de verdad del guardado');

/* ================================================================== */
console.log('\n--- Al volver a abrir el panel sigue ahí');
await page.goto(PANEL);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await esperar(700);
await elegir('p1');
m = await mirar('text');
comprueba(/<(b|strong)>cruda<\/(b|strong)>/i.test(m.visual), 'el editor vuelve a enseñar la negrita');
comprueba(m.texto === 'Miel cruda de la sierra', 'con el texto entero, sin etiquetas a la vista');

/* ================================================================== */
console.log('\n--- La pestaña HTML enseña lo mismo, en código');
await page.evaluate(() => {
  const caja = document.querySelector('.b-insp [data-prop="text"]').closest('[data-rt-caja]');
  caja.querySelector('[data-rt-tab="html"]').click();
});
await esperar(200);
m = await mirar('text');
comprueba(!m.areaOculta && m.visualOculto, 'al pulsar «HTML» se ve el código');
comprueba(/<(b|strong)>cruda<\/(b|strong)>/i.test(m.area), 'y es el mismo contenido, no otro');
await page.fill('.b-insp [data-prop="text"]', 'Miel <em>cruda</em> de la sierra');
await esperar(300);
await page.evaluate(() => {
  const caja = document.querySelector('.b-insp [data-prop="text"]').closest('[data-rt-caja]');
  caja.querySelector('[data-rt-tab="visual"]').click();
});
await esperar(200);
m = await mirar('text');
comprueba(m.visual.includes('<em>cruda</em>'), 'lo escrito a mano en HTML vuelve al editor visual');

/* ================================================================== */
console.log('\n--- Pegar desde fuera entra como texto, no como maquetado ajeno');
await page.evaluate(() => {
  const caja = document.querySelector('.b-insp [data-prop="text"]').closest('[data-rt-caja]');
  const vis = caja.querySelector('[data-rt-visual]');
  vis.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', 'PEGADO');
  dt.setData('text/html', '<div style="color:red"><h1>PEGADO</h1></div>');
  vis.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await esperar(200);
m = await mirar('text');
comprueba(!/<h1|style=/i.test(m.visual), `no entra ni el encabezado ni el estilo ajeno (${m.visual})`);
comprueba(m.texto.includes('PEGADO'), 'pero el texto sí entra');

/* ================================================================== */
console.log('\n--- La descripción de una tarjeta, igual');
await elegir('t1');
m = await mirar('text');
comprueba(m.hay, 'el campo del catálogo también es un editor');
await escribir('text', 'Tarro de medio kilo');
await negrita('text', 'medio kilo');
await esperar(1200);
comprueba(/medio kilo<\/(b|strong)>/i.test(JSON.stringify(ultimo)), 'y lo que se escribe ahí se guarda con su formato');

/* ================================================================== */
console.log('\n--- Y la web lo pinta como formato, no como etiquetas escritas');
await page.goto(PUBLICO);
await page.waitForSelector('.m-card', { timeout: 15000 });
const web = await page.evaluate(() => ({
  parrafo: document.querySelector('.m-card-body p')?.innerHTML || '',
  negritas: [...document.querySelectorAll('strong, b')].map((e) => e.textContent.trim()),
  escapadas: document.body.innerText.includes('<strong>') || document.body.innerText.includes('<em>'),
}));
comprueba(web.negritas.includes('medio kilo'), `la negrita llega a la web (${web.negritas.join(' / ')})`);
comprueba(!web.escapadas, 'y en ningún sitio se lee una etiqueta escrita');

/* ================================================================== */
console.log('\n--- Ningún error de JavaScript');
comprueba(errores.length === 0, errores.length ? errores.join(' | ') : 'ninguno');

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS (${ok} correctas)` : `EL EDITOR DE TEXTO VA (${ok} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
