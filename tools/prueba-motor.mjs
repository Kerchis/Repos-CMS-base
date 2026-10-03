#!/usr/bin/env node
/**
 * El motor de secciones entero, con la cortina encendida, en el editor.
 *
 * Es el protocolo del encargo, automatizado: configurar ALTURA + FONDO +
 * RELLENO + MARGEN en una seccion, esperar a que el guardado automatico
 * y la recarga del marco terminen, y volver a mirar. Ese «volver a
 * mirar» es lo importante: un cambio que se ve 100 ms y desaparece pasa
 * cualquier prueba instantanea, y aqui no.
 *
 *   configurar → ver → esperar guardado → esperar recarga del marco →
 *   volver a medir → recargar el editor entero → inspector → medir
 *
 * Se hace sobre DOS secciones distintas (una con CTA y otra con texto) y
 * detras de una seccion cortina, que es el sistema que escribia fondos
 * por su cuenta.
 *
 *   node tools/prueba-motor.mjs
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
const PANEL = 'https://krg.test/wp-admin/krg-builder.html';

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const dir = mkdtempSync(join(tmpdir(), 'krg-motor-'));

/**
 * El servidor del banco contesta lo que contestaria WordPress.
 *
 * Antes devolvia tal cual lo que el navegador le mandaba, asi que el
 * banco no podia ver nada de lo que el servidor cambia al guardar. Y lo
 * que cambia incluye la FORMA del JSON: un diccionario vacio sale de PHP
 * como `[]`, que es una lista, y una lista no se puede escribir desde el
 * panel sin que `JSON.stringify` tire el valor al guardar. Ese era el
 * fallo que nadie veia.
 */
function sanear(doc) {
  const archivo = join(dir, 'post.json');
  writeFileSync(archivo, JSON.stringify(doc));
  return JSON.parse(execFileSync(PHP, [`${ROOT}/tools/sanear.php`, archivo], { encoding: 'utf8' }));
}

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

/* Una cortina arriba y dos secciones distintas detras: lo que pase tiene
   que pasar en las dos, o no es del motor. */
const inicial = () => ({
  id: 1, title: 'Motor', slug: 'motor', status: 'draft', checksum: 'c0',
  seo: {}, settings: {}, previewUrl: LIENZO,
  sections: [
    nodo('secCortina', 'section', { width: 'full', curtain: 'on', minHeight: 'half' }, [
      nodo('cor-r', 'row', {}, [nodo('cor-c', 'column', { span: 12 }, [
        nodo('cor-h', 'heading', { text: 'Cortina', level: 'h2' }),
      ])]),
    ]),
    nodo('secCta', 'section', { width: 'boxed' }, [
      nodo('cta-r', 'row', {}, [nodo('cta-c', 'column', { span: 12 }, [
        nodo('cta1', 'statement-cta', { title: 'Reserva', theme: 'forest' }),
      ])]),
    ]),
    nodo('secTexto', 'section', { width: 'full' }, [
      nodo('txt-r', 'row', {}, [nodo('txt-c', 'column', { span: 12 }, [
        nodo('p1', 'paragraph', { text: 'Un párrafo cualquiera.' }),
      ])]),
    ]),
  ],
});

let ultimo = null;
let enviado = null;   // el cuerpo crudo del ultimo POST, antes de sanear
let fallos = 0;
let ok = 0;
const comprueba = (cond, msg) => {
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  cond ? ++ok : ++fallos;
};

const leer = (f) => readFileSync(f, 'utf8');
const html = `<!doctype html><meta charset="utf-8">
<style>${leer(`${CSS_DIR}/admin.css`)}</style>
<style>${leer(`${CSS_DIR}/builder.css`)}</style>
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script>${leer(`${JS_DIR}/app.js`)}</script>
<script>${leer(`${JS_DIR}/builder-core.js`)}</script>
<script>${leer(`${JS_DIR}/builder.js`)}</script>`;

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).split('\n')[0]));

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.url() === PANEL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  if (req.url().startsWith(LIENZO)) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintar(ultimo || inicial(), 'canvas') });
  }
  if (req.method() === 'POST' && /\/pages\/1(\/save)?$/.test(url)) {
    enviado = JSON.parse(req.postData() || '{}');
    ultimo = sanear(enviado);
    return json({ ...ultimo, previewUrl: LIENZO, checksum: 'c' + Date.now() });
  }
  if (url === '/pages/1') return json({ ...sanear(ultimo || inicial()), previewUrl: LIENZO });
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {} } });
  return json([]);
});

async function abrirPanel() {
  await page.goto(PANEL);
  await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
  await page.waitForTimeout(700);
}
await abrirPanel();

const marco = () => page.frames().find((f) => f.url().startsWith(LIENZO));

async function calculado(sel, props) {
  const f = marco();
  if (!f) return { '«sin iframe»': true };
  return f.evaluate(([s, ps]) => {
    const el = document.querySelector(s);
    if (!el) return { '«no existe»': s };
    const cs = getComputedStyle(el);
    const out = { enLinea: el.getAttribute('style') || '', clases: el.className, alto: Math.round(el.getBoundingClientRect().height) };
    ps.forEach((p) => { out[p] = cs.getPropertyValue(p).trim(); });
    return out;
  }, [sel, props]);
}

/** Lo que se ve de verdad en un punto de la seccion. */
async function queSeVe(sel, fraccion) {
  const f = marco();
  if (!f) return 'sin iframe';
  return f.evaluate(([s, fr]) => {
    const el = document.querySelector(s);
    if (!el) return 'no existe';
    const r = el.getBoundingClientRect();
    const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height * fr));
    const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
    let n = document.elementFromPoint(x, y);
    while (n) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'transparent' && bg.replace(/\s/g, '') !== 'rgba(0,0,0,0)') return bg;
      n = n.parentElement;
    }
    return 'nada';
  }, [sel, fraccion]);
}

async function abrirTodos() {
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
  });
  await page.waitForTimeout(60);
}
async function seleccionar(id, pestana = 'design') {
  await page.evaluate((nid) => document.querySelector(`[data-sel="${nid}"]`).click(), id);
  await page.click(`[data-insp-tab="${pestana}"]`);
  await page.waitForTimeout(150);
  await abrirTodos();
}
async function bp(cual) {
  await page.evaluate((b) => document.querySelector(`[data-bp="${b}"]`).click(), cual);
  await page.waitForTimeout(200);
  await abrirTodos();
}
/** Espera al guardado automatico Y a la recarga del marco que viene detras. */
async function asentar() {
  await page.waitForFunction(
    () => !document.querySelector('.b-status') || /Guardado/.test(document.querySelector('.b-status').textContent),
    null, { timeout: 10000 }
  );
  // 250 ms para que se dispare reloadFrame, mas la carga y el `load` de
  // modules.js, que es cuando la cortina mide y escribe.
  await page.waitForTimeout(1600);
}

const VERDE = 'rgb(63, 94, 88)';
const CASOS = [['secCta', 'sección con CTA'], ['secTexto', 'sección con texto']];

/* ================================================================== */
console.log('\nLa cortina está encendida en el lienzo');
let cor = await calculado('.m-n-secCortina', ['position']);
comprueba(/is-curtain/.test(cor.clases || ''), `la sección cortina existe: ${cor.clases}`);
comprueba(/is-curtain-on/.test(cor.clases || ''), 'y modules.js la ha encendido');
let sig = await calculado('.m-n-secCta', ['z-index']);
comprueba(/m-curtain-above/.test(sig.clases || ''), 'la siguiente pasa por delante');

/* ================================================================== */
for (const [id, titulo] of CASOS) {
  console.log(`\n========== ${titulo.toUpperCase()} ==========`);

  console.log('\nConfigurar altura 90vh + fondo + relleno 50 + margen 50');
  await seleccionar(id, 'design');
  await page.selectOption('.b-insp [data-prop="minHeight"]', 'custom');
  await page.waitForTimeout(250);
  await abrirTodos();
  await page.fill('.b-insp [data-prop="minHeightValue"]', '90');
  await page.selectOption('.b-insp [data-prop="minHeightUnit"]', 'vh');
  await page.waitForTimeout(200);
  await seleccionar(id, 'design');
  await page.fill('.b-insp [data-style="background-color"]', '#3f5e58');
  await page.waitForTimeout(120);
  for (const lado of ['top', 'right', 'bottom', 'left']) {
    await page.fill(`.b-insp [data-side="padding-${lado}"]`, '50');
    await page.waitForTimeout(60);
  }
  for (const lado of ['top', 'right', 'bottom', 'left']) {
    await page.fill(`.b-insp [data-side="margin-${lado}"]`, '50');
    await page.waitForTimeout(60);
  }

  // 1. Lo que se ve ANTES de guardar: el repintado en vivo.
  let m = await calculado(`.m-n-${id}`, ['background-color', 'padding-top', 'margin-top']);
  comprueba(m['background-color'] === VERDE, `al instante en el lienzo: fondo ${m['background-color']}`);
  comprueba(m['padding-top'] === '50px' && m['margin-top'] === '50px', `al instante: relleno ${m['padding-top']}, margen ${m['margin-top']}`);

  // 2. Lo que queda DESPUES del guardado y de la recarga del marco.
  await asentar();

  // 2b. Lo que de verdad VIAJO por la red. Un bucket de estilos que llega
  // de PHP como lista vacia acepta la propiedad en memoria —el lienzo la
  // pinta— y `JSON.stringify` la descarta al guardar: se veia bien y no
  // llegaba nunca. Esto lee el cuerpo del POST, que es el unico sitio
  // donde esa diferencia se nota.
  const buscar = (lista, nid) => (lista || []).reduce((h, n) => h || (n.id === nid ? n : buscar(n.children, nid)), null);
  const enviadoNodo = buscar(enviado?.sections, id) || {};
  const stEnv = (enviadoNodo.styles || {}).desktop || {};
  comprueba(stEnv['background-color'] === '#3f5e58', `el fondo viaja en el guardado: ${JSON.stringify(stEnv['background-color'] ?? null)}`);
  comprueba(stEnv['padding-top'] === '50px' && stEnv['margin-top'] === '50px', `el relleno y el margen viajan en el guardado: ${JSON.stringify([stEnv['padding-top'], stEnv['margin-top']])}`);
  comprueba(!Array.isArray(enviadoNodo.styles) && !Array.isArray(stEnv), 'los estilos viajan como diccionario, no como lista');
  m = await calculado(`.m-n-${id}`, ['background-color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left']);
  comprueba(m['background-color'] === VERDE, `y SIGUE ahí tras guardar y recargar el marco: ${m['background-color']}`);
  comprueba(
    ['top', 'right', 'bottom', 'left'].every((l) => m[`padding-${l}`] === '50px'),
    `relleno completo: ${['top', 'right', 'bottom', 'left'].map((l) => m[`padding-${l}`]).join('/')}`
  );
  comprueba(
    ['top', 'right', 'bottom', 'left'].every((l) => m[`margin-${l}`] === '50px'),
    `margen completo: ${['top', 'right', 'bottom', 'left'].map((l) => m[`margin-${l}`]).join('/')}`
  );
  // 90 svh del alto del iframe, que es la ventana que ve la pagina.
  const vh = await marco().evaluate(() => window.innerHeight);
  comprueba(
    Math.abs(m.alto - vh * 0.9) <= 12,
    `la altura de 90vh se respeta: ${m.alto}px de los ${Math.round(vh * 0.9)}px que son el 90 % del lienzo (${vh}px)`
  );
  comprueba(!/background|padding|margin|curtain-bg/.test(m.enLinea || ''), `sin estilos sueltos en el atributo: "${m.enLinea}"`);

  // 3. Lo que de verdad se ve, arriba y abajo de la sección alta.
  for (const [donde, f] of [['arriba', 0.04], ['abajo', 0.96]]) {
    const visto = await queSeVe(`.m-n-${id}`, f);
    comprueba(visto === VERDE, `lo que se ve ${donde} del todo: ${visto}`);
  }

  // 4. Responsive: tablet y móvil con valores propios, sin tocar escritorio.
  await bp('tablet');
  await page.fill('.b-insp [data-side="padding-top"]', '60');
  await page.waitForTimeout(120);
  await bp('mobile');
  await page.fill('.b-insp [data-side="padding-top"]', '40');
  await asentar();
  const st = ultimo.sections.find((s) => s.id === id).styles;
  comprueba(st.desktop['padding-top'] === '50px', `escritorio sigue en ${st.desktop['padding-top']}`);
  comprueba(st.tablet['padding-top'] === '60px', `tableta en ${st.tablet['padding-top']}`);
  comprueba(st.mobile['padding-top'] === '40px', `móvil en ${st.mobile['padding-top']}`);
  comprueba(st.desktop['background-color'] === '#3f5e58', `el fondo de escritorio intacto: ${st.desktop['background-color']}`);
  await bp('desktop');

  // 5. Recargar el editor entero y volver a mirar el inspector.
  await abrirPanel();
  await seleccionar(id, 'design');
  const enPanel = await page.evaluate(() => ({
    fondo: document.querySelector('.b-insp [data-style="background-color"]')?.value || '',
    pad: document.querySelector('.b-insp [data-side="padding-top"]')?.value || '',
    mar: document.querySelector('.b-insp [data-side="margin-top"]')?.value || '',
  }));
  comprueba(enPanel.fondo.toLowerCase() === '#3f5e58', `tras recargar, el inspector dice fondo ${enPanel.fondo}`);
  comprueba(enPanel.pad === '50', `relleno ${enPanel.pad}`);
  comprueba(enPanel.mar === '50', `margen ${enPanel.mar}`);
  m = await calculado(`.m-n-${id}`, ['background-color', 'padding-top', 'margin-top']);
  comprueba(m['background-color'] === VERDE, `y el lienzo recargado: ${m['background-color']}`);
}

/* ================================================================== */
/* «Estirar» de punta a punta: inspector → lienzo → guardar → recargar  */
console.log('\nEstirar un bloque que pinta, con el control de posición');
await seleccionar('secCta', 'design');
comprueba(
  await page.evaluate(() => !document.querySelector('.b-insp [data-prop="stretchAlign"]')),
  'sin estirar, el control de posición no se enseña'
);
await page.selectOption('.b-insp [data-prop="vAlign"]', 'stretch');
await page.waitForTimeout(300);
await abrirTodos();
comprueba(
  await page.evaluate(() => !!document.querySelector('.b-insp [data-prop="stretchAlign"]')),
  'al elegir «Estirar» aparece «Contenido dentro del bloque estirado»'
);

let est = await calculado('.m-n-secCta', ['align-items']);
comprueba(/is-va-stretch/.test(est.clases || ''), `el lienzo marca la sección al instante: ${(est.clases || '').split(' ').filter((c) => c.startsWith('is-va')).join('')}`);
comprueba(/is-sa-center/.test(est.clases || ''), 'y con el centro por defecto');

await page.selectOption('.b-insp [data-prop="stretchAlign"]', 'end');
await page.waitForTimeout(250);
est = await calculado('.m-n-secCta', ['align-items']);
comprueba(/is-sa-end/.test(est.clases || ''), 'cambiar a «Abajo» se ve al instante en el lienzo');

await asentar();
const estirado = await calculado('.m-n-cta1', ['align-content', 'display']);
const seccion = await calculado('.m-n-secCta', ['height']);
comprueba(estirado.alto >= seccion.alto * 0.7, `tras guardar y recargar, el CTA llena la sección: ${estirado.alto} de ${seccion.alto}px`);
comprueba(estirado['align-content'] === 'end', `y su contenido se coloca abajo: align-content ${estirado['align-content']}`);
comprueba(estirado.display === 'block', `sin convertir el bloque en flex: display ${estirado.display}`);
for (const [donde, f] of [['arriba', 0.06], ['abajo', 0.94]]) {
  const visto = await queSeVe('.m-n-secCta', f);
  comprueba(visto === VERDE, `el verde del bloque llega ${donde}: ${visto}`);
}

await abrirPanel();
await seleccionar('secCta', 'design');
const guardado = await page.evaluate(() => document.querySelector('.b-insp [data-prop="stretchAlign"]')?.value || '');
comprueba(guardado === 'end', `tras recargar el editor, el inspector sigue diciendo «abajo»: ${guardado || '(no está)'}`);

/* ================================================================== */
console.log('\nLa cortina sigue funcionando después de todo');
cor = await calculado('.m-n-secCortina', ['position']);
comprueba(cor.position === 'sticky', `la sección cortina sigue quieta: position ${cor.position}`);
comprueba(/is-curtain-on/.test(cor.clases || ''), 'y encendida');
sig = await calculado('.m-n-secCta', ['z-index']);
comprueba(sig['z-index'] === '1', `las de encima siguen por delante: z-index ${sig['z-index']}`);

comprueba(errores.length === 0, `sin errores de JavaScript${errores.length ? ': ' + errores.join(' · ') : ''}`);

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
