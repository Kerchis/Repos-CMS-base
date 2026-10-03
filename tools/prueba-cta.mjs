#!/usr/bin/env node
/**
 * El fondo del «CTA display»: foto que cubre, parallax y fusión.
 *
 * Lo que se pidió: poder poner una imagen de fondo que cubra la sección
 * entera, con el mismo parallax (y los mismos ajustes) que ya tenía la
 * galería, y con modos de fusión para mezclarla con el color de fondo
 * del bloque.
 *
 * Lo que se comprueba aquí no es que existan los campos —eso es lo
 * barato—, es que:
 *
 *   1. La foto cubre el bloque entero, no un trozo.
 *   2. El encaje y la parte que manda salen del panel.
 *   3. La fusión LLEGA AL NAVEGADOR: `mix-blend-mode` calculado.
 *   4. El parallax mueve la foto al desplazarse, y SOLO la foto.
 *   5. Invertir la dirección la mueve al revés.
 *   6. Lo que se toca en el panel se ve en el lienzo y viaja en el
 *      guardado.
 *
 *   node tools/prueba-cta.mjs
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
const PUBLICO = 'https://krg.test/cta-publico/';
const PANEL = 'https://krg.test/wp-admin/krg-builder.html';

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const dir = mkdtempSync(join(tmpdir(), 'krg-cta-'));

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

/** Una página alta: un hueco largo y debajo el CTA, para poder rodar. */
const doc = (props = {}, seccion = null) => ({
  id: 1, title: 'CTA', slug: 'cta', status: 'draft', checksum: 'c0',
  seo: {}, settings: {}, previewUrl: LIENZO,
  sections: [
    nodo('hueco', 'section', { width: 'full' }, [
      nodo('rh', 'row', {}, [nodo('ch', 'column', { span: 12 }, [
        nodo('sp', 'spacer', { height: 1200 }),
      ])]),
    ]),
    nodo('sec', 'section', { width: 'full', ...(seccion || {}) }, [
      nodo('r', 'row', {}, [nodo('c', 'column', { span: 12 }, [
        nodo('m', 'statement-cta', {
          title: 'Reserva tu mesa',
          text: 'Abrimos de miércoles a domingo.',
          buttonText: 'RESERVAR',
          buttonUrl: '#',
          iconId: 31,
          iconCount: 2,
          imageId: 21,
          overlay: 30,
          theme: 'forest',
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

let ultimo = null;
let enviado = null;
let props = {};
let seccion = null;

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
<script>${leer(`${JS_DIR}/builder.js`)}</script>`;

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).split('\n')[0]));

// Las fotos de la mediateca falsa, servidas de verdad: una imagen rota
// no se puede medir ni mezclar.
await page.route('**/ejemplo.test/uploads/**', async (route) => {
  const n = Number((route.request().url().match(/foto-(\d+)/) || [])[1] || 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <rect width="1600" height="900" fill="#c8b48a"/>
    <circle cx="400" cy="300" r="180" fill="#8c6b3f"/></svg>`;
  return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
});

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.url() === PANEL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  if (req.url().startsWith(PUBLICO)) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintar(doc(props, seccion)) });
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

const medir = () => page.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const c = e.getBoundingClientRect();
    return { x: Math.round(c.left), y: Math.round(c.top), w: Math.round(c.width), h: Math.round(c.height) };
  };
  const sc = document.querySelector('.m-sc');
  const img = document.querySelector('.m-sc-bg');
  const capa = document.querySelector('.m-sc-media');
  return {
    sc: r('.m-sc'),
    sec: r('.m-sc')?.w === undefined ? null : r('.m-c-section:last-of-type'),
    capa: r('.m-sc-media'),
    img: r('.m-sc-bg'),
    fit: img ? getComputedStyle(img).objectFit : '',
    pos: img ? getComputedStyle(img).objectPosition : '',
    blend: capa ? getComputedStyle(capa).mixBlendMode : '',
    aislado: sc ? getComputedStyle(sc).isolation : '',
    clases: sc ? sc.className : '',
    datos: sc ? [sc.dataset.parallaxZoom, sc.dataset.parallaxAmount, sc.dataset.parallaxDir] : null,
    tImg: img ? getComputedStyle(img).transform : '',
    tIcono: document.querySelector('.m-sc-icon-img') ? getComputedStyle(document.querySelector('.m-sc-icon-img')).transform : '',
  };
});
/** La «y» del transform en línea que escribe el motor de parallax. */
const desplazamiento = () => page.evaluate(() => {
  const img = document.querySelector('.m-sc-bg');
  const m = /translate3d\(0px,\s*(-?[\d.]+)px/.exec(img?.style.transform || '');
  return m ? Math.round(Number(m[1]) * 100) / 100 : null;
});
const rodarHasta = async (y) => {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(260);
};

/* ================================================================== */
console.log('\n--- La foto de fondo cubre el bloque entero');
props = { imageId: 21 };
await page.goto(PUBLICO);
await page.waitForSelector('.m-sc', { timeout: 15000 });
await page.waitForTimeout(300);
let m = await medir();
comprueba(!!m.img, 'el bloque pinta su foto de fondo');
comprueba(
  m.capa.w === m.sc.w && m.capa.h === m.sc.h && m.capa.x === m.sc.x && m.capa.y === m.sc.y,
  `la capa del fondo mide lo mismo que el bloque: ${m.capa.w}×${m.capa.h} de ${m.sc.w}×${m.sc.h}`
);
comprueba(m.img.w === m.sc.w && m.img.h === m.sc.h, `y la foto también: ${m.img.w}×${m.img.h}`);
comprueba(m.sc.w >= 1280, `que en una sección a todo lo ancho es la pantalla entera: ${m.sc.w}px`);
comprueba(m.fit === 'cover', `por defecto la estira hasta cubrir: object-fit = ${m.fit}`);
comprueba(m.blend === 'normal', `y sin fusión mientras no se pida: ${m.blend}`);
comprueba(m.aislado === 'isolate', 'el bloque está aislado, que es lo que permite fusionar contra su color');

/* ================================================================== */
console.log('\n--- «La imagen cubre: toda la sección»');
// Una sección más alta que el bloque: es el caso de la queja, con el
// bloque en medio y la franja de color arriba y abajo.
seccion = { minHeight: 'custom', minHeightValue: 900 };
props = { imageId: 21, bgScope: 'block' };
await page.goto(PUBLICO);
await page.waitForTimeout(300);
const cajas = () => page.evaluate(() => {
  const caja = (e) => { if (!e) return null; const c = e.getBoundingClientRect(); return { y: Math.round(c.top), h: Math.round(c.height) }; };
  const sc = document.querySelector('.m-sc');
  const sec = sc.closest('.m-c-section');
  const capa = document.querySelector('.m-sc-media');
  return {
    sec: caja(sec), sc: caja(sc), capa: caja(capa),
    secPos: getComputedStyle(sec).position,
    secCorte: getComputedStyle(sec).overflow,
    secAisla: getComputedStyle(sec).isolation,
    fondoBloque: getComputedStyle(sc).backgroundColor,
    blend: capa ? getComputedStyle(capa).mixBlendMode : '',
  };
});
let caja = await cajas();
comprueba(caja.sec.h > caja.sc.h + 100, `la sección es más alta que el bloque: ${caja.sec.h}px contra ${caja.sc.h}px`);
comprueba(caja.capa.h === caja.sc.h, `y «solo este bloque» deja la foto en el bloque: ${caja.capa.h}px`);

props = { imageId: 21, bgScope: 'section', blend: 'multiply' };
await page.goto(PUBLICO);
await page.waitForTimeout(300);
caja = await cajas();
comprueba(
  caja.capa.h === caja.sec.h && caja.capa.y === caja.sec.y,
  `con «toda la sección» la foto cubre la sección entera: ${caja.capa.h}px de ${caja.sec.h}px`
);
comprueba(caja.secPos === 'relative' && caja.secCorte === 'hidden', 'la sección recoge el marco y el recorte');
comprueba(caja.secAisla === 'isolate', 'y el aislamiento, que es lo que da telón a la fusión');
comprueba(
  caja.fondoBloque === 'rgba(0, 0, 0, 0)',
  `el color del tema del bloque se aparta para no tapar la foto: ${caja.fondoBloque}`
);
comprueba(caja.blend === 'multiply', `y la fusión sigue en pie: ${caja.blend}`);

// Un color elegido a mano en el panel manda sobre todo, como siempre.
props = { imageId: 21, bgScope: 'section', bgColor: { mode: 'custom', token: '', value: '#3f5e58' } };
await page.goto(PUBLICO);
await page.waitForTimeout(300);
comprueba(
  await page.evaluate(() => getComputedStyle(document.querySelector('.m-sc')).backgroundColor === 'rgb(63, 94, 88)'),
  'pero un color puesto por ti en el panel sigue ganando: nada se pisa a tus espaldas'
);
seccion = null;

/* ================================================================== */
console.log('\n--- El encaje y la parte que manda salen del panel');
props = { imageId: 21, bgFit: 'contain', bgPosition: 'top' };
await page.goto(PUBLICO);
await page.waitForTimeout(300);
m = await medir();
comprueba(m.fit === 'contain', `«contain» enseña la foto entera: ${m.fit}`);
comprueba(/\b0%|top/.test(m.pos.split(' ')[1] || m.pos), `y «arriba» ancla la parte de arriba: object-position = ${m.pos}`);

/* ================================================================== */
console.log('\n--- Modo de fusión con el color del bloque');
for (const modo of ['multiply', 'screen', 'luminosity']) {
  props = { imageId: 21, blend: modo };
  await page.goto(PUBLICO);
  await page.waitForTimeout(250);
  m = await medir();
  comprueba(m.blend === modo, `«${modo}» llega al navegador: mix-blend-mode = ${m.blend}`);
}
props = { imageId: 21, blend: 'inventado' };
await page.goto(PUBLICO);
await page.waitForTimeout(250);
comprueba((await medir()).blend === 'normal', 'un valor que no existe no se cuela: vuelve a «normal»');

props = { imageId: 0, blend: 'multiply' };
await page.goto(PUBLICO);
await page.waitForTimeout(250);
comprueba(
  await page.evaluate(() => !document.querySelector('.m-sc-media')),
  'sin foto no hay capa de fondo que fusionar: no se pinta nada de más'
);

/* ================================================================== */
console.log('\n--- Parallax: los mismos ajustes que la galería');
props = { imageId: 21, parallax: true, parallaxZoom: 14, parallaxAmount: 18 };
await page.goto(PUBLICO);
await page.waitForTimeout(300);
m = await medir();
comprueba(/is-parallax/.test(m.clases), 'el bloque se marca como parallax');
comprueba(
  m.datos[0] === '14' && m.datos[1] === '18' && m.datos[2] === '1',
  `con la ampliación, la intensidad y la dirección del panel: ${m.datos.join(' / ')}`
);
comprueba(/matrix\(1.14/.test(m.tImg), `la ampliación se nota aunque no se mueva nada: ${m.tImg.slice(0, 22)}`);

await rodarHasta(0);
const arriba = await desplazamiento();
await rodarHasta(1400);
const abajo = await desplazamiento();
comprueba(arriba !== null && abajo !== null, `el motor mueve la foto al rodar: ${arriba} → ${abajo}`);
comprueba(abajo !== arriba, 'y el desplazamiento cambia con el scroll, que es el efecto');
const iconoQuieto = await page.evaluate(() => document.querySelector('.m-sc-icon-img').style.transform === '');
comprueba(iconoQuieto, 'los iconos del titular NO se mueven: solo la foto de fondo');

// Invertir: a la misma altura, el desplazamiento cambia de signo.
props = { imageId: 21, parallax: true, parallaxZoom: 14, parallaxAmount: 18, parallaxInvert: true };
await page.goto(PUBLICO);
await page.waitForTimeout(300);
comprueba((await medir()).datos[2] === '-1', 'invertir la dirección viaja como data-parallax-dir = -1');
await rodarHasta(1400);
const invertido = await desplazamiento();
comprueba(
  invertido !== null && abajo !== null && Math.sign(invertido) === -Math.sign(abajo),
  `y al mismo scroll la foto va al revés: ${abajo} → ${invertido}`
);

props = { imageId: 21, parallax: false };
await page.goto(PUBLICO);
await page.waitForTimeout(250);
m = await medir();
comprueba(!/is-parallax/.test(m.clases), 'sin parallax no se marca');
comprueba(m.tImg === 'none', `y la foto no lleva ninguna transformación: ${m.tImg}`);

// Con KRG_SHOT=1, una foto de como queda: fusion «multiply» sobre el
// color del bloque, con la veladura y el parallax puestos.
if (process.env.KRG_SHOT) {
  props = { imageId: 21, blend: 'multiply', overlay: 20, parallax: true, parallaxZoom: 14 };
  await page.goto(PUBLICO);
  await page.waitForTimeout(400);
  await rodarHasta(1100);
  const caja = await page.$('.m-sc');
  await caja.screenshot({ path: `${ROOT}/.captures/cta-fondo.png` });
}

/* ================================================================== */
console.log('\n--- En el panel: se toca, se ve y se guarda');
props = { imageId: 21 };
ultimo = null;
await page.goto(PANEL);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('[data-sel="m"]').click());
await page.waitForTimeout(250);
await page.click('[data-insp-tab="design"]');
await page.waitForTimeout(200);
await page.evaluate(() => {
  document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
});
await page.waitForTimeout(200);

const campos = await page.evaluate(() => ({
  fit: !!document.querySelector('.b-insp [data-prop="bgFit"]'),
  pos: !!document.querySelector('.b-insp [data-prop="bgPosition"]'),
  px: !!document.querySelector('.b-insp [data-prop="parallax"]'),
  zoom: !!document.querySelector('.b-insp [data-prop="parallaxZoom"]'),
  amount: !!document.querySelector('.b-insp [data-prop="parallaxAmount"]'),
  inv: !!document.querySelector('.b-insp [data-prop="parallaxInvert"]'),
}));
comprueba(campos.fit && campos.pos, 'el panel ofrece el ajuste de la imagen y su anclaje');
comprueba(
  await page.evaluate(() => {
    const sel = document.querySelector('.b-insp [data-prop="bgScope"]');
    return !!sel && [...sel.options].map((o) => o.value).join(',') === 'block,section';
  }),
  'y el selector de hasta dónde llega la foto: solo el bloque o toda la sección'
);
comprueba(campos.px && campos.zoom && campos.amount && campos.inv, 'y el parallax con sus tres ajustes, como la galería');
comprueba(
  await page.evaluate(() => {
    const campo = document.querySelector('.b-insp [data-prop="blend"]');
    return !!campo && !!campo.closest('[data-acc="catColors"]');
  }),
  'y el modo de fusión está en el grupo «Colores», que es donde se busca'
);

const opciones = await page.evaluate(() =>
  [...document.querySelectorAll('.b-insp [data-prop="blend"] option')].map((o) => o.value)
);
comprueba(opciones.includes('multiply') && opciones.includes('luminosity') && opciones[0] === 'normal',
  `con ${opciones.length} modos y «normal» el primero`);

// Tocar la fusión: tiene que verse en el lienzo sin esperar al guardado.
await page.selectOption('.b-insp [data-prop="blend"]', 'multiply');
await page.waitForTimeout(400);
const enVivo = await page.evaluate(() => {
  const f = document.querySelector('.b-frame, iframe');
  const d = f?.contentDocument;
  const capa = d?.querySelector('.m-sc-media');
  return capa ? d.defaultView.getComputedStyle(capa).mixBlendMode : '(sin lienzo)';
});
comprueba(enVivo === 'multiply', `el lienzo lo enseña al momento, sin guardar: ${enVivo}`);

await page.evaluate(() => {
  const t = document.querySelector('.b-insp [data-prop="parallax"]');
  t.checked = true;
  t.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(500);
const pxVivo = await page.evaluate(() => {
  const f = document.querySelector('.b-frame, iframe');
  const el = f?.contentDocument?.querySelector('.m-sc');
  return el ? { cls: /is-parallax/.test(el.className), zoom: el.style.getPropertyValue('--m-px-zoom') } : null;
});
comprueba(!!pxVivo && pxVivo.cls, 'y el parallax también se marca en el lienzo al momento');

await page.waitForFunction(
  () => !document.querySelector('.b-status') || /Guardado/.test(document.querySelector('.b-status').textContent),
  null, { timeout: 10000 }
);
await page.waitForTimeout(1200);
const buscar = (lista, id) => (lista || []).reduce((h, n) => h || (n.id === id ? n : buscar(n.children, id)), null);
const guardado = buscar(enviado?.sections, 'm')?.props || {};
comprueba(guardado.blend === 'multiply', `la fusión viaja en el guardado: ${guardado.blend}`);
comprueba(guardado.parallax === true, `y el parallax también: ${guardado.parallax}`);

await page.goto(PANEL);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('[data-sel="m"]').click());
await page.click('[data-insp-tab="design"]');
await page.waitForTimeout(250);
await page.evaluate(() => {
  document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
});
await page.waitForTimeout(150);
const trasRecargar = await page.evaluate(() => document.querySelector('.b-insp [data-prop="blend"]')?.value || '(no está)');
comprueba(trasRecargar === 'multiply', `tras recargar el editor el panel lo sigue diciendo: ${trasRecargar}`);

comprueba(errores.length === 0, `sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`);

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
