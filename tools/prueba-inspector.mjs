#!/usr/bin/env node
/**
 * El inspector nuevo, en un navegador de verdad.
 *
 * Por que hace falta: el encargo no pide un panel mas bonito, pide que
 * cada control este conectado. Un acordeon que se abre pero no guarda,
 * o un grupo que aparece en la seccion y no en la columna, serian un
 * cambio visual y nada mas. Aqui se comprueban las dos cosas a la vez:
 *
 *   1. ESTRUCTURA — cabecera del elemento seleccionado, tres pestañas,
 *      grupos que se abren y se cierran y recuerdan como quedaron, y
 *      ajustes contextuales (lo que no aplica, no sale).
 *   2. CADENA COMPLETA — tipografia, borde, sombra, posicion y
 *      transformacion: escribir → estado → POST → recargar → sigue ahi.
 *   3. NO PERDER NADA — el arbol, las filas, las columnas y los modulos
 *      siguen funcionando despues del cambio de inspector.
 *
 * Carga `app.js`, `builder-core.js` y `builder.js` tal cual se sirven en
 * el admin, con la API interceptada.
 *
 *   node tools/prueba-inspector.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const REST = 'https://krg.test/wp-json/krg/v1';

const registry = JSON.parse(
  execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' })
);

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});

/** Una pagina con los cinco tipos de elemento que tienen inspector. */
function doc() {
  const seccion = (id, dentro, props = {}) =>
    nodo(id, 'section', Object.assign({ width: 'full', minHeight: 'auto' }, props), [
      nodo(id + '-row', 'row', {}, [nodo(id + '-col', 'column', { span: 12 }, dentro)]),
    ]);
  return {
    id: 1, title: 'Prueba', slug: 'prueba', status: 'draft', checksum: 'c0',
    seo: {}, settings: { showHeader: true, showFooter: true },
    sections: [
      seccion('secA', [nodo('cta1', 'statement-cta', { title: 'Reserva', theme: 'forest' })]),
      seccion('secB', [
        nodo('tit1', 'heading', { text: 'Un título', tag: 'h2' }),
        nodo('img1', 'image', { imageId: 7, alt: 'foto' }),
        nodo('gal1', 'gallery', { items: [], layout: 'carousel' }),
        nodo('vid1', 'video', { source: 'link', url: 'https://example.com/v.mp4' }),
        nodo('map1', 'map', { url: 'https://www.google.com/maps/embed?pb=1' }),
      ]),
    ],
  };
}

const guardados = [];
let ultimo = null;
let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const html = `<!doctype html><meta charset="utf-8"><title>inspector</title>
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;

const dir = mkdtempSync(join(tmpdir(), 'krg-insp-'));
const file = join(dir, 'panel.html');
writeFileSync(file, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (req.method() === 'POST' && /\/pages\/1(\/save)?$/.test(url)) {
    const cuerpo = JSON.parse(req.postData() || '{}');
    guardados.push(cuerpo);
    ultimo = JSON.parse(JSON.stringify(cuerpo));
    return json({ ...JSON.parse(JSON.stringify(cuerpo)), checksum: 'c' + guardados.length });
  }
  if (url === '/pages/1') return json(ultimo || doc());
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

await page.goto('file://' + file);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });

/* ---------------------------------------------------------------- */
/* Ayudas                                                            */
/* ---------------------------------------------------------------- */

const esperar = (ms = 120) => page.waitForTimeout(ms);

async function seleccionar(id, pestana = 'design') {
  await page.evaluate((nid) => document.querySelector(`[data-sel="${nid}"]`).click(), id);
  await esperar();
  if (pestana) {
    await page.click(`.b-insp [data-insp-tab="${pestana}"]`);
    await esperar();
  }
}

/** Los titulos de los grupos de la pestaña que se este viendo. */
const grupos = () => page.evaluate(() =>
  [...document.querySelectorAll('.b-insp .b-group')].map((g) => ({
    id: g.dataset.acc,
    titulo: g.querySelector('.acc-t')?.textContent.trim(),
    abierto: g.classList.contains('is-open'),
  })));

async function abrir(id) {
  await page.evaluate((gid) => {
    const g = document.querySelector(`.b-insp [data-acc="${gid}"]`);
    if (g && !g.classList.contains('is-open')) g.querySelector('.acc-h').click();
  }, id);
  await esperar(60);
}

async function abrirTodos() {
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
  });
  await esperar(60);
}

async function esperarGuardado(n, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (guardados.length >= n) return true;
    await esperar(100);
  }
  return false;
}

/** Busca un nodo por id en el ultimo documento guardado. */
function nodoDe(d, id) {
  const buscar = (list) => {
    for (const n of list || []) {
      if (n.id === id) return n;
      const h = buscar(n.children);
      if (h) return h;
    }
    return null;
  };
  return buscar(d?.sections);
}

/* ================================================================== */
console.log('\nPRUEBA 1 — «Configuración de página» es un acordeón de verdad');
const pagInicial = await page.evaluate(() => {
  const g = document.querySelector('.b-insp [data-acc="pagina"]');
  return g ? { existe: true, abierto: g.classList.contains('is-open'), cuerpoOculto: g.querySelector('.acc-b').hidden } : { existe: false };
});
ok(pagInicial.existe, 'existe el grupo «Configuración de página»');
ok(pagInicial.abierto === false && pagInicial.cuerpoOculto === true, 'nace plegado');
await page.click('.b-insp [data-acc="pagina"] .acc-h');
await esperar();
const pagAbierta = await page.evaluate(() => {
  const g = document.querySelector('.b-insp [data-acc="pagina"]');
  return {
    abierto: g.classList.contains('is-open'),
    campos: g.querySelectorAll('[data-page], [data-set], [data-seo]').length,
  };
});
ok(pagAbierta.abierto, 'al pulsar se despliega');
ok(pagAbierta.campos >= 8, `y enseña las configuraciones de la página (${pagAbierta.campos} campos)`);
await page.click('.b-insp [data-acc="pagina"] .acc-h');
await esperar();
ok(await page.evaluate(() => !document.querySelector('.b-insp [data-acc="pagina"]').classList.contains('is-open')),
  'al volver a pulsar se pliega');

/* ================================================================== */
console.log('\nPRUEBA 2 — la cabecera dice qué elemento está seleccionado');
for (const [id, clase, nombre] of [
  ['secA', 'Sección', 'section'],
  ['secA-row', 'Fila', 'row'],
  ['secA-col', 'Columna', 'column'],
  ['cta1', 'Módulo', 'statement-cta'],
]) {
  await seleccionar(id, null);
  const cab = await page.evaluate(() => ({
    kind: document.querySelector('.b-insp .b-sel-kind')?.textContent.trim(),
    name: document.querySelector('.b-insp .b-sel-name')?.textContent.trim(),
  }));
  ok(cab.kind === clase, `${id}: la cabecera dice «${cab.kind}» (esperaba «${clase}»)`);
  ok(!!cab.name && cab.name.length > 0, `   y lo nombra: «${cab.name}» (${nombre})`);
}

/* ================================================================== */
console.log('\nPRUEBA 3 — las tres pestañas, en todos los elementos');
for (const id of ['secA', 'secA-row', 'secA-col', 'cta1', 'img1', 'gal1', 'vid1', 'tit1', 'map1']) {
  await seleccionar(id, null);
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('.b-insp [data-insp-tab]')].map((b) => b.textContent.trim()));
  ok(tabs.join('·') === 'Contenido·Diseño·Avanzado', `${id}: ${tabs.join(' · ')}`);
}

/* ================================================================== */
console.log('\nPRUEBA 4 — la configuración es contextual: no sale lo que no aplica');
await seleccionar('secA');
let g = await grupos();
let ids = g.map((x) => x.id);
ok(ids.includes('sectionHeight'), 'la sección tiene «Alto de la sección»');
ok(ids.includes('sectionWidth') && ids.includes('sectionCurtain'), 'y su ancho y su cortina');
await seleccionar('secA-col');
ids = (await grupos()).map((x) => x.id);
ok(!ids.includes('sectionHeight'), 'la columna NO tiene el alto de sección');
ok(!ids.includes('imgParallax'), 'ni el parallax de la imagen');
await seleccionar('img1');
ids = (await grupos()).map((x) => x.id);
ok(ids.includes('imgParallax') && ids.includes('imgRadius'), 'la imagen sí tiene parallax y radio');
ok(ids.includes('filters'), 'y filtros');
await seleccionar('vid1');
ids = (await grupos()).map((x) => x.id);
ok(ids.includes('vidPlayback'), 'el vídeo tiene «Reproducción»');
ok(!ids.includes('imgParallax'), 'y no el parallax de la imagen');

/* ================================================================== */
console.log('\nPRUEBA 5 — se acabó la fragmentación: todos tienen el bloque común');
const COMUNES = ['background', 'spacing', 'size', 'border', 'shadow', 'animation'];
for (const id of ['secA', 'secA-row', 'secA-col', 'cta1', 'img1', 'gal1', 'vid1', 'tit1', 'map1']) {
  await seleccionar(id);
  const tiene = (await grupos()).map((x) => x.id);
  const faltan = COMUNES.filter((c) => !tiene.includes(c));
  ok(faltan.length === 0, `${id}: Fondo, Separación, Tamaño, Borde, Sombra y Animación${faltan.length ? ' — faltan ' + faltan.join(', ') : ''}`);
}

/* ================================================================== */
console.log('\nPRUEBA 6 — los grupos se abren, se cierran y lo recuerdan');
await seleccionar('secA');
const inicial = await grupos();
ok(inicial.filter((x) => x.abierto).length === 1, `al entrar solo hay un grupo abierto (${inicial.filter((x) => x.abierto).map((x) => x.id).join(', ')})`);
await abrir('shadow');
ok((await grupos()).find((x) => x.id === 'shadow').abierto, '«Sombra» se abre al pulsar su título');
ok(await page.evaluate(() => !document.querySelector('.b-insp [data-acc="shadow"] .acc-b').hidden),
  'y su cuerpo deja de estar oculto');
// Cambiar de elemento y volver: la preferencia sigue puesta.
await seleccionar('secB');
await seleccionar('secA');
ok((await grupos()).find((x) => x.id === 'shadow').abierto, 'al volver, «Sombra» sigue abierto');
await page.click('.b-insp [data-acc="shadow"] .acc-h');
await esperar();
ok(!(await grupos()).find((x) => x.id === 'shadow').abierto, 'y se cierra al volver a pulsar');

/* ================================================================== */
console.log('\nPRUEBA 7 — tipografía, borde y sombra: del panel al documento guardado');
await seleccionar('tit1');
await abrirTodos();
let n = guardados.length;
await page.fill('.b-insp [data-style-num="font-size"]', '42');
await page.evaluate(() => document.querySelector('.b-insp [data-style-set="font-weight"][data-v="700"]').click());
await page.fill('.b-insp [data-side="border-top-left-radius"]', '18');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.b-insp [data-style-set="box-shadow"]')].find((x) => x.dataset.v);
  b.click();
});
ok(await esperarGuardado(n + 1), 'los cambios disparan guardado');
let st = nodoDe(ultimo, 'tit1')?.styles?.desktop || {};
ok(st['font-size'] === '42px', `tipografía guardada: font-size = ${st['font-size']}`);
ok(st['font-weight'] === '700', `peso guardado: ${st['font-weight']}`);
ok(st['border-top-left-radius'] === '18px', `borde guardado: ${st['border-top-left-radius']}`);
ok(!!st['box-shadow'], `sombra guardada: ${st['box-shadow']}`);

console.log('\nPRUEBA 8 — posición y transformación (grupo nuevo de Avanzado)');
await page.click('.b-insp [data-insp-tab="advanced"]');
await esperar();
await abrirTodos();
n = guardados.length;
await page.fill('.b-insp [data-style="transform"]', 'rotate(-3deg)');
await page.evaluate(() => document.querySelector('.b-insp [data-style-set="position"][data-v="relative"]').click());
await page.fill('.b-insp [data-style="top"]', '12px');
ok(await esperarGuardado(n + 1), 'los cambios de Avanzado disparan guardado');
st = nodoDe(ultimo, 'tit1')?.styles?.desktop || {};
ok(st.transform === 'rotate(-3deg)', `transformación guardada: ${st.transform}`);
ok(st.position === 'relative' && st.top === '12px', `posición guardada: ${st.position} / top ${st.top}`);

console.log('\nPRUEBA 9 — ID, clase y CSS personalizado llegan al documento');
n = guardados.length;
await page.fill('.b-insp [data-node="htmlId"]', 'mi-titulo');
await page.fill('.b-insp [data-node="htmlClass"]', 'hero-principal');
await page.fill('.b-insp [data-css="main"]', 'letter-spacing: 3px;');
ok(await esperarGuardado(n + 1), 'se guardan');
let nd = nodoDe(ultimo, 'tit1') || {};
ok(nd.htmlId === 'mi-titulo', `ID CSS = ${nd.htmlId}`);
ok(nd.htmlClass === 'hero-principal', `clase CSS = ${nd.htmlClass}`);
ok((nd.customCss?.main || '').includes('letter-spacing'), `CSS personalizado = ${JSON.stringify(nd.customCss?.main || '')}`);
n = guardados.length;
await page.fill('.b-insp [data-attrs]', 'data-gtm: cta-principal\naria-label: Reserva tu mesa');
ok(await esperarGuardado(n + 1), 'los atributos se guardan');
nd = nodoDe(ultimo, 'tit1') || {};
ok(nd.attrs?.['data-gtm'] === 'cta-principal' && nd.attrs?.['aria-label'] === 'Reserva tu mesa',
  `atributos = ${JSON.stringify(nd.attrs || {})}`);

console.log('\nPRUEBA 10 — visibilidad responsive');
n = guardados.length;
await page.evaluate(() => document.querySelector('.b-insp [data-hide-bp="mobile"]').click());
ok(await esperarGuardado(n + 1), 'se guarda');
ok(nodoDe(ultimo, 'tit1')?.hiddenOn?.mobile === true, 'oculto en móvil queda apuntado en el documento');

/* ================================================================== */
console.log('\nPRUEBA 11 — los tres tamaños son independientes');
await seleccionar('tit1');
await abrirTodos();
for (const [bp, valor] of [['desktop', '42'], ['tablet', '30'], ['mobile', '22']]) {
  await page.evaluate((b) => document.querySelector(`[data-bp="${b}"]`).click(), bp);
  await esperar();
  await abrirTodos();
  n = guardados.length;
  await page.fill('.b-insp [data-style-num="font-size"]', valor);
  await esperarGuardado(n + 1);
}
const porBp = nodoDe(ultimo, 'tit1')?.styles || {};
ok(porBp.desktop?.['font-size'] === '42px', `escritorio = ${porBp.desktop?.['font-size']}`);
ok(porBp.tablet?.['font-size'] === '30px', `tablet = ${porBp.tablet?.['font-size']}`);
ok(porBp.mobile?.['font-size'] === '22px', `móvil = ${porBp.mobile?.['font-size']}`);
await page.evaluate(() => document.querySelector('[data-bp="desktop"]').click());
await esperar();

/* ================================================================== */
console.log('\nPRUEBA 12 — nada de esto se pierde al recargar el constructor');
await page.reload();
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await esperar(300);
const trasRecarga = await page.evaluate(() => {
  const buscar = (list) => {
    for (const n of list || []) {
      if (n.id === 'tit1') return n;
      const h = buscar(n.children);
      if (h) return h;
    }
    return null;
  };
  // El estado del constructor, tal cual lo tiene cargado.
  return JSON.stringify(buscar(window.KrgBuilderState?.doc?.sections || []));
});
const nodoRec = JSON.parse(trasRecarga || 'null');
ok(!!nodoRec, 'el bloque sigue en el documento después de recargar');
ok(nodoRec?.styles?.desktop?.['font-size'] === '42px', `tipografía: ${nodoRec?.styles?.desktop?.['font-size']}`);
ok(nodoRec?.styles?.mobile?.['font-size'] === '22px', `tipografía de móvil: ${nodoRec?.styles?.mobile?.['font-size']}`);
ok(nodoRec?.styles?.desktop?.['border-top-left-radius'] === '18px', `borde: ${nodoRec?.styles?.desktop?.['border-top-left-radius']}`);
ok(!!nodoRec?.styles?.desktop?.['box-shadow'], `sombra: ${nodoRec?.styles?.desktop?.['box-shadow']}`);
ok(nodoRec?.styles?.desktop?.transform === 'rotate(-3deg)', `transformación: ${nodoRec?.styles?.desktop?.transform}`);
ok(nodoRec?.htmlId === 'mi-titulo', `ID CSS: ${nodoRec?.htmlId}`);
ok((nodoRec?.customCss?.main || '').includes('letter-spacing'), 'CSS personalizado');
ok(nodoRec?.attrs?.['data-gtm'] === 'cta-principal', `atributos: ${JSON.stringify(nodoRec?.attrs || {})}`);

/* ================================================================== */
console.log('\nPRUEBA 13 — filas y columnas siguen funcionando');
await seleccionar('secA', 'content');
await abrirTodos();
const antesFilas = await page.evaluate(() => {
  const s = (window.KrgBuilderState?.doc?.sections || []).find((x) => x.id === 'secA');
  return (s?.children || []).filter((c) => c.type === 'row').length;
});
n = guardados.length;
await page.click('.b-insp [data-add-row]');
// Sale el selector de disposición; se elige media y media.
await page.waitForSelector('.b-lay-modal [data-layout="6-6"]', { timeout: 5000 });
await page.click('.b-lay-modal [data-layout="6-6"]');
ok(await esperarGuardado(n + 1), 'elegir la disposición de la fila nueva dispara guardado');
await esperar(200);
const trasFila = await page.evaluate(() => {
  const s = (window.KrgBuilderState?.doc?.sections || []).find((x) => x.id === 'secA');
  return (s?.children || []).filter((c) => c.type === 'row').length;
});
ok(trasFila === antesFilas + 1, `«Añadir otra fila» añade una fila: ${antesFilas} → ${trasFila}`);

await seleccionar('secA-row', 'content');
await abrirTodos();
const disposiciones = await page.evaluate(() => document.querySelectorAll('.b-insp [data-layout]').length);
ok(disposiciones >= 6, `siguen estando las disposiciones de columnas (${disposiciones} opciones)`);
n = guardados.length;
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.b-insp [data-layout]')].find((x) => x.dataset.layout === '4-4-4');
  if (b) b.click();
});
await esperarGuardado(n + 1);
await esperar(200);
const cols = await page.evaluate(() => {
  const buscar = (list) => {
    for (const n of list || []) {
      if (n.id === 'secA-row') return n;
      const h = buscar(n.children);
      if (h) return h;
    }
    return null;
  };
  const row = buscar(window.KrgBuilderState?.doc?.sections || []);
  return (row?.children || []).map((c) => c.props?.span);
});
ok(cols.length === 3 && cols.every((c) => Number(c) === 4), `tres columnas de 1/3: ${JSON.stringify(cols)}`);

/* ================================================================== */
console.log('\nPRUEBA 14 — ningún error de JavaScript en toda la sesión');
ok(errores.length === 0, errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
