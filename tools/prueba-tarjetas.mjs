#!/usr/bin/env node
/**
 * El carril de productos: tarjetas parejas y lista cómoda de editar.
 *
 * Dos quejas, dos mitades:
 *
 *   FRONTEND. Con descripciones de largos distintos, cada tarjeta
 *   empezaba su texto a una altura y la fila se veía desordenada. Aquí se
 *   mide la «y» de la categoría, del título, de la descripción y del
 *   enlace en las cuatro tarjetas: tienen que coincidir.
 *
 *   PANEL. Añadir productos era una tira de treinta controles sin
 *   principio ni final. Ahora cada producto es una ficha plegable con su
 *   nombre, se arrastra para ordenar y al añadir uno el cursor cae
 *   dentro. Las fichas son el repetidor GENÉRICO: lo que se comprueba
 *   aquí vale para cualquier lista del editor.
 *
 *   node tools/prueba-tarjetas.mjs
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
const PUBLICO = 'https://krg.test/carril-publico/';
const PANEL = 'https://krg.test/wp-admin/krg-builder.html';

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const dir = mkdtempSync(join(tmpdir(), 'krg-tarj-'));

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

// Cuatro productos como los de verdad: títulos de uno y de dos renglones,
// descripciones de tres líneas y de media.
const PRODUCTOS = [
  { title: 'Barbaros | FQ Doble IPA', category: 'Cerveza', text: 'Tipo: IPA - Indian Pale Ale (7.5%) perfil de sabor: robusta e intensa, con fuertes notas herbales y frutales, carácter y personalidad', imageId: 21, imageUrl: 'https://ejemplo.test/uploads/foto-21.jpg', linkText: 'Ver más', url: '#', alt: '', badge: '' },
  { title: 'AMERICANO', category: 'Desayuno', text: 'Huevo frito o revuelto, salsa de queso, salchicha americana, tocineta, papa sauté, tostada o mini pancakes', imageId: 22, imageUrl: 'https://ejemplo.test/uploads/foto-22.jpg', linkText: 'Ver más', url: '#', alt: '', badge: '' },
  { title: 'MARGARITA', category: 'Pizza', text: '(pomodoro, fior di latte, albahaca)', imageId: 23, imageUrl: 'https://ejemplo.test/uploads/foto-23.jpg', linkText: 'Ver más', url: '#', alt: '', badge: '' },
  { title: 'Barbaros | FQ Doble IPA Edición especial', category: 'Cerveza', text: 'Tipo: IPA - Indian Pale Ale (7.5%)', imageId: 24, imageUrl: 'https://ejemplo.test/uploads/foto-24.jpg', linkText: 'Ver más', url: '#', alt: '', badge: '' },
];

const doc = (props = {}) => ({
  id: 1, title: 'Carril', slug: 'carril', status: 'draft', checksum: 'c0',
  seo: {}, settings: {}, previewUrl: LIENZO,
  sections: [
    nodo('sec', 'section', { width: 'boxed' }, [
      nodo('r', 'row', {}, [nodo('c', 'column', { span: 12 }, [
        nodo('m', 'product-rail', {
          title: 'Destacados',
          layout: 'grid',
          desktop: 4,
          items: JSON.parse(JSON.stringify(PRODUCTOS)),
          ...props,
        }),
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
const iguales = (lista, tol = 1) => lista.length > 1 && Math.max(...lista) - Math.min(...lista) <= tol;

let ultimo = null;
let enviado = null;
let props = {};

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
<script>${leer(`${JS_DIR}/builder-fields.js`)}</script>
<script>${leer(`${JS_DIR}/builder.js`)}</script>`;

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).split('\n')[0]));

await page.route('**/ejemplo.test/uploads/**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100"><rect width="900" height="1100" fill="#b98a4a"/></svg>',
  })
);

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.url() === PANEL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  if (req.url().startsWith(PUBLICO)) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintar(ultimo || doc(props)) });
  }
  if (req.url().startsWith(LIENZO)) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintar(ultimo || doc(props), { KRG_CANVAS: '1' }) });
  }
  if (req.method() === 'POST' && /\/pages\/1(\/save)?$/.test(url)) {
    enviado = JSON.parse(req.postData() || '{}');
    ultimo = sanear(enviado);
    return json({ ...ultimo, previewUrl: LIENZO, checksum: 'c' + Date.now() });
  }
  if (url === '/pages/1') return json({ ...sanear(ultimo || doc(props)), previewUrl: LIENZO });
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {} } });
  return json([]);
});

const alturas = () => page.evaluate(() => {
  const y = (s) => [...document.querySelectorAll(s)].map((e) => Math.round(e.getBoundingClientRect().top));
  const h = (s) => [...document.querySelectorAll(s)].map((e) => Math.round(e.getBoundingClientRect().height));
  const txt = document.querySelector('.m-card-text');
  return {
    cat: y('.m-card-cat'),
    tit: y('.m-card-title'),
    desc: y('.m-card-text'),
    cta: y('.m-card-cta'),
    foto: h('.m-card-media'),
    fin: [...document.querySelectorAll('.m-card-text')].map((e) => Math.round(e.getBoundingClientRect().bottom)),
    recorte: txt ? getComputedStyle(txt).webkitLineClamp : '',
    recortado: txt ? txt.scrollHeight > txt.clientHeight + 1 : false,
    titulos: [...document.querySelectorAll('.m-card-title')].map((e) => e.textContent.trim()),
  };
});

/* ================================================================== */
console.log('\n--- La fila se ve ordenada aunque los textos no midan igual');
props = {};
await page.goto(PUBLICO);
await page.waitForSelector('.m-card-title', { timeout: 15000 });
await page.waitForTimeout(300);
let a = await alturas();
comprueba(a.tit.length === 4, `las cuatro tarjetas están ahí: ${a.tit.length}`);
comprueba(iguales(a.foto), `las fotos miden lo mismo: ${a.foto.join(' / ')}`);
comprueba(iguales(a.cat), `la categoría arranca a la misma altura en todas: ${a.cat.join(' / ')}`);
comprueba(iguales(a.tit), `y el título también: ${a.tit.join(' / ')}`);
comprueba(iguales(a.cta), `el enlace final queda alineado abajo: ${a.cta.join(' / ')}`);
comprueba(!a.recortado, 'sin pedirlo, no se recorta ni una palabra de la descripción');

/* ================================================================== */
console.log('\n--- Igualar también las descripciones, cuando se pide');
props = { titleLines: 2, textLines: 3 };
ultimo = null;
await page.goto(PUBLICO);
await page.waitForTimeout(300);
a = await alturas();
comprueba(iguales(a.desc), `la descripción empieza igual en las cuatro: ${a.desc.join(' / ')}`);
comprueba(iguales(a.fin), `y acaba igual: ${a.fin.join(' / ')}`);
comprueba(iguales(a.cta), `con el enlace en línea: ${a.cta.join(' / ')}`);
comprueba(a.recorte === '3', `la descripción se recorta a tres líneas: line-clamp = ${a.recorte}`);
comprueba(a.recortado, 'la descripción larga se recorta de verdad');
comprueba(
  a.titulos[0] === 'Barbaros | FQ Doble IPA',
  'y el texto no se toca: el recorte es visual, el contenido sigue entero'
);

/* ================================================================== */
console.log('\n--- Cada producto, una ficha plegable');
props = {};
ultimo = null;
await page.goto(PANEL);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('[data-sel="m"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => {
  document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
});
await page.waitForTimeout(250);

const fichas = () => page.evaluate(() => {
  const fs = [...document.querySelectorAll('.b-insp [data-rep-row="items"]')];
  return fs.map((f) => ({
    i: f.dataset.i,
    nombre: f.querySelector('.tree-lbl')?.textContent.trim() || '',
    abierta: f.classList.contains('is-open'),
    alto: Math.round(f.querySelector('.tree-b').getBoundingClientRect().height),
    arrastrable: f.querySelector('[data-rep-drag]')?.getAttribute('draggable') === 'true',
    mini: !!f.querySelector('.tree-mini img'),
  }));
});
let f = await fichas();
comprueba(f.length === 4, `hay cuatro fichas, una por producto: ${f.length}`);
comprueba(
  f.map((x) => x.nombre).join(' | ') === 'Barbaros | FQ Doble IPA | AMERICANO | MARGARITA | Barbaros | FQ Doble IPA Edición especial',
  `cada una se llama como su producto: ${f.map((x) => x.nombre).join(' · ')}`
);
comprueba(f.every((x) => x.alto === 0), 'y nacen plegadas: ningún campo ocupa sitio hasta que se abre');
comprueba(f.every((x) => x.arrastrable), 'todas tienen asa para arrastrar');
comprueba(f.every((x) => x.mini), 'y su miniatura, para reconocerlas de un vistazo');

const altoLista = await page.evaluate(() => Math.round(document.querySelector('.b-insp .b-rep').getBoundingClientRect().height));
comprueba(altoLista < 420, `la lista entera cabe en la pantalla: ${altoLista}px (antes era una tira de treinta controles)`);

await page.click('.b-insp [data-rep-row="items"][data-i="1"] .tree-t');
await page.waitForTimeout(200);
f = await fichas();
comprueba(f[1].abierta && f[1].alto > 100, `al abrir una se ven sus campos: ${f[1].alto}px`);
comprueba(f[0].alto === 0 && f[2].alto === 0, 'y solo esa: las demás siguen plegadas');

// El pliegue sobrevive a un repintado del panel.
await page.evaluate(() => document.querySelector('[data-sel="sec"]').click());
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('[data-sel="m"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => {
  document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
});
await page.waitForTimeout(200);
f = await fichas();
comprueba(f[1].abierta, 'y se recuerda qué ficha estaba abierta al volver al bloque');

/* ================================================================== */
console.log('\n--- Añadir un producto deja el cursor dentro');
await page.click('.b-insp [data-rep-add="items"]');
await page.waitForTimeout(400);
f = await fichas();
comprueba(f.length === 5, `la lista crece: ${f.length} fichas`);
comprueba(f[4].abierta, 'la ficha nueva se abre sola');
const dondeEstaElCursor = await page.evaluate(() => {
  const el = document.activeElement;
  const fila = el?.closest('[data-rep-row]');
  return { dentro: fila?.dataset.i ?? null, campo: el?.dataset?.k || el?.tagName };
});
comprueba(
  dondeEstaElCursor.dentro === '4',
  `y el cursor cae en su primer campo: ficha ${dondeEstaElCursor.dentro}, campo «${dondeEstaElCursor.campo}»`
);
await page.keyboard.type('Pizza del día');
await page.waitForTimeout(300);
comprueba(
  (await fichas())[4].nombre === 'Pizza del día',
  'se escribe directamente y la ficha se renombra sola'
);
await page.click('.b-insp [data-rep-row="items"][data-i="4"] [data-rep-del="items"]');
await page.waitForTimeout(300);
comprueba((await fichas()).length === 4, 'y se puede borrar: vuelven a ser cuatro');

/* ================================================================== */
console.log('\n--- Arrastrar para ordenar');
const arrastra = (desde, hasta, despues) => page.evaluate(([d, h, ab]) => {
  const dt = new DataTransfer();
  const asa = document.querySelector(`.b-insp [data-rep-drag="items"][data-i="${d}"]`);
  const destino = document.querySelector(`.b-insp [data-rep-row="items"][data-i="${h}"]`);
  const r = destino.getBoundingClientRect();
  const y = ab ? r.bottom - 3 : r.top + 3;
  const ev = (t, el) => el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: y }));
  ev('dragstart', asa);
  ev('dragover', destino);
  ev('drop', destino);
  ev('dragend', asa);
}, [desde, hasta, despues]);

await arrastra(0, 2, true);
await page.waitForTimeout(400);
let nombres = (await fichas()).map((x) => x.nombre);
comprueba(
  nombres[2] === 'Barbaros | FQ Doble IPA' && nombres[0] === 'AMERICANO',
  `la primera se suelta debajo de la tercera y la lista se reordena: ${nombres.join(' · ')}`
);

await arrastra(2, 0, false);
await page.waitForTimeout(400);
nombres = (await fichas()).map((x) => x.nombre);
comprueba(nombres[0] === 'Barbaros | FQ Doble IPA', `y vuelve arriba soltándola encima de la primera: ${nombres[0]}`);

await page.click('.b-insp [data-rep-row="items"][data-i="0"] [data-rep-move="items"][data-dir="1"]');
await page.waitForTimeout(300);
nombres = (await fichas()).map((x) => x.nombre);
comprueba(nombres[0] === 'AMERICANO', 'las flechas ↑ ↓ siguen funcionando: el ratón es un atajo, no la única puerta');

/* ================================================================== */
console.log('\n--- El orden viaja y la página lo respeta');
await page.waitForFunction(
  () => !document.querySelector('.b-status') || /Guardado/.test(document.querySelector('.b-status').textContent),
  null, { timeout: 10000 }
);
await page.waitForTimeout(1200);
const buscar = (lista, id) => (lista || []).reduce((h, n) => h || (n.id === id ? n : buscar(n.children, id)), null);
const guardados = (buscar(enviado?.sections, 'm')?.props?.items || []).map((x) => x.title);
comprueba(
  guardados[0] === 'AMERICANO' && guardados[1] === 'Barbaros | FQ Doble IPA',
  `el nuevo orden viaja en el guardado: ${guardados.join(' · ')}`
);

await page.goto(PUBLICO);
await page.waitForSelector('.m-card-title', { timeout: 15000 });
await page.waitForTimeout(300);
const enLaPagina = await page.evaluate(() => [...document.querySelectorAll('.m-card-title')].map((e) => e.textContent.trim()));
comprueba(enLaPagina[0] === 'AMERICANO', `y la página sale en ese orden: ${enLaPagina.join(' · ')}`);

if (process.env.KRG_SHOT) {
  props = { titleLines: 2, textLines: 3 };
  ultimo = null;
  await page.goto(PUBLICO);
  await page.waitForTimeout(400);
  await page.locator('.m-rail').screenshot({ path: `${ROOT}/.captures/carril-parejo.png` });
  await page.goto(PANEL);
  await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('[data-sel="m"]').click());
  await page.waitForSelector('.b-insp [data-rep-row="items"]', { timeout: 15000 });
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
    const lista = document.querySelector('.b-insp .b-rep');
    if (lista) lista.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);
  await page.locator('.b-insp .b-rep').screenshot({ path: `${ROOT}/.captures/carril-fichas.png` });
}

comprueba(errores.length === 0, `sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`);

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
