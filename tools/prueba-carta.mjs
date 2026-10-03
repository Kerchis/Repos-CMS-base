#!/usr/bin/env node
/**
 * La carta como arbol: categoria → plato → adiciones.
 *
 * Por que existe: el inspector pintaba las categorias y los platos como
 * dos listas planas, todo abierto a la vez. Con cuatro categorias y
 * veinte platos eso es un folio de scroll, y para saber que platos hay
 * en «Postres» habia que leerlos todos. Ahora cada categoria se pliega y
 * sus platos cuelgan dentro, con sus adiciones dentro de cada plato.
 *
 * Lo que se comprueba aqui no es que el HTML tenga la pinta correcta:
 * es que los DATOS siguen intactos. El arbol es solo otra vista de las
 * mismas dos listas planas de siempre, asi que:
 *
 *   1. Cada plato aparece bajo su categoria, y solo bajo la suya.
 *   2. Un plato con una categoria que ya no existe NO desaparece.
 *   3. Plegar y desplegar no toca el documento.
 *   4. «Añadir plato a Postres» crea el plato ya en Postres.
 *   5. Las adiciones se escriben, VIAJAN EN EL GUARDADO y vuelven.
 *   6. Y salen en la pagina publica.
 *
 *   node tools/prueba-carta.mjs
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
const dir = mkdtempSync(join(tmpdir(), 'krg-carta-'));

function sanear(doc) {
  const f = join(dir, 'post.json');
  writeFileSync(f, JSON.stringify(doc));
  return JSON.parse(execFileSync(PHP, [`${ROOT}/tools/sanear.php`, f], { encoding: 'utf8' }));
}
function pintar(doc) {
  const f = join(dir, 'doc.json');
  writeFileSync(f, JSON.stringify(doc));
  return execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, f], { encoding: 'utf8', env: { ...process.env, KRG_CANVAS: '1' } });
}

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: {}, children,
});

const plato = (title, price, category, addons = []) => ({
  title, price, category, addons, text: '', badge: '', imageId: 0, imageUrl: '', alt: '', url: '',
});

const inicial = () => ({
  id: 1, title: 'Carta', slug: 'carta', status: 'draft', checksum: 'c0',
  seo: {}, settings: {}, previewUrl: LIENZO,
  sections: [
    nodo('sec', 'section', { width: 'boxed' }, [
      nodo('r', 'row', {}, [nodo('c', 'column', { span: 12 }, [
        nodo('m', 'menu-list', {
          title: 'Nuestra carta',
          groupMode: 'stacked',
          addonsLabel: 'Adiciones',
                  categories: [
            { label: 'Desayunos', text: '', addons: [{ name: 'Huevo frito o revuelto (x2)', price: '10.9' }, { name: 'Porción de frutas (180g)', price: '9.9' }] },
            { label: 'Postres', text: '', addons: [] },
          ],
          items: [
            plato('Huevos benedictinos', '24.9', 'Desayunos'),
            plato('Tostada de aguacate', '18.0', 'Desayunos'),
            plato('Tiramisú', '12.0', 'Postres'),
            plato('Plato huérfano', '7.0', 'Categoría borrada'),
          ],
        }),
      ])]),
    ]),
  ],
});

let ultimo = null;
let enviado = null;
let ok = 0;
let fallos = 0;
const comprueba = (cond, msg) => {
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  cond ? ++ok : ++fallos;
};

const leer = (f) => readFileSync(f, 'utf8');
const html = `<!doctype html><meta charset="utf-8">
<style>${leer(`${CSS_DIR}/admin.css`)}</style>
<style>${leer(`${CSS_DIR}/builder.css`)}</style>
<body class="wp-admin">
<!-- El armazón del admin de WordPress: el menú lateral empuja el
     contenido 160px. Sin esto el banco no puede ver los fallos de
     ancho, que son justo los que se escapan. -->
<div id="wpwrap"><div id="wpcontent" style="margin-left:160px"><div id="wpbody"><div id="wpbody-content">
<div id="krg-builder"></div>
</div></div></div></div>
<div style="position:fixed;left:0;top:0;width:160px;height:100%;background:#1d2327;z-index:0"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script>${leer(`${JS_DIR}/app.js`)}</script>
<script>${leer(`${JS_DIR}/builder-core.js`)}</script>
<script>${leer(`${JS_DIR}/builder.js`)}</script>`;

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
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
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintar(ultimo || inicial()) });
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
  await page.waitForTimeout(600);
}
async function seleccionarCarta() {
  await page.evaluate(() => document.querySelector('[data-sel="m"]').click());
  await page.click('[data-insp-tab="content"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
  });
  await page.waitForTimeout(100);
}
async function asentar() {
  await page.waitForFunction(
    () => !document.querySelector('.b-status') || /Guardado/.test(document.querySelector('.b-status').textContent),
    null, { timeout: 10000 }
  );
  await page.waitForTimeout(1500);
}
/** Lo que el árbol enseña: categorías y, dentro de cada una, sus platos. */
const arbol = () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.b-insp .b-tree > .tree-n.is-cat').forEach((cat) => {
    out.push({
      titulo: cat.querySelector(':scope > .tree-h > .tree-lbl')?.textContent.trim(),
      cuenta: cat.querySelector(':scope > .tree-h > .tree-c')?.textContent.trim(),
      abierta: cat.classList.contains('is-open'),
      platos: [...cat.querySelectorAll(':scope > .tree-b > .tree-n.is-plato')]
        .map((p) => p.querySelector(':scope > .tree-h > .tree-lbl')?.textContent.trim()),
    });
  });
  return out;
});

await abrirPanel();
await seleccionarCarta();

// Con KRG_SHOT=1 este banco deja ademas una captura del arbol en
// .captures/. Va aqui y no en un script aparte porque este es el unico
// sitio donde el constructor esta montado con datos de verdad.
if (process.env.KRG_SHOT) {
  await page.evaluate(() => {
    const t = document.querySelector('.b-insp .tree-n.is-plato > .tree-h > .tree-t');
    if (t) t.click();
    const c = document.querySelector('.b-insp .b-tree');
    if (c) document.querySelector('.b-insp').scrollTop = c.offsetTop - 8;
  });
  await page.waitForTimeout(250);
  await (await page.$('.b-insp')).screenshot({ path: `${ROOT}/.captures/arbol-carta.png` });
  await page.screenshot({ path: `${ROOT}/.captures/constructor-admin.png` });
  await page.evaluate(() => {
    const t = document.querySelector('.b-insp .tree-n.is-plato > .tree-h > .tree-t');
    if (t) t.click();
  });
  await page.waitForTimeout(150);
}

/* ================================================================== */
console.log('\n--- La carta se ve como un árbol');
let t = await arbol();
comprueba(t.length === 3, `hay ${t.length} grupos: ${t.map((c) => c.titulo).join(' · ')}`);
comprueba(t[0]?.titulo === 'Desayunos' && t[0].platos.length === 2, `Desayunos tiene sus 2 platos: ${t[0]?.platos.join(', ')}`);
comprueba(t[1]?.titulo === 'Postres' && t[1].platos.length === 1, `Postres tiene 1: ${t[1]?.platos.join(', ')}`);
comprueba(t[0]?.cuenta === '2' && t[1]?.cuenta === '1', `la cuenta de cada categoría cuadra: ${t[0]?.cuenta}/${t[1]?.cuenta}`);
comprueba(
  t[2]?.titulo === 'Sin categoría' && t[2].platos[0] === 'Plato huérfano',
  'un plato con una categoría que ya no existe NO se pierde: cae en «Sin categoría»'
);
comprueba(
  t.every((c) => !c.platos.some((p) => t.some((o) => o !== c && o.platos.includes(p)))),
  'ningún plato aparece en dos categorías a la vez'
);

/* ================================================================== */
console.log('\n--- Plegar y desplegar no toca el documento');
const antes = await page.evaluate(() => JSON.stringify(window.__krgDoc ? window.__krgDoc() : null));
comprueba(t[0].abierta, 'las categorías empiezan abiertas');
await page.click('.b-insp .b-tree > .tree-n.is-cat:first-child > .tree-h > .tree-t');
await page.waitForTimeout(120);
let estado = await page.evaluate(() => {
  const c = document.querySelector('.b-insp .b-tree > .tree-n.is-cat');
  const b = c.querySelector(':scope > .tree-b');
  // `hidden` es un ATRIBUTO: que esté puesto no significa que no se vea.
  // Cualquier `display` del tema le gana, porque el estilo del autor
  // manda sobre el del navegador. Hay que medir el alto de verdad.
  return {
    abierta: c.classList.contains('is-open'),
    atributo: b.hidden,
    alto: b.getBoundingClientRect().height,
    signo: c.querySelector('.tree-t').textContent.trim(),
  };
});
comprueba(!estado.abierta && estado.atributo, 'al pulsar se marca como cerrada');
comprueba(estado.alto === 0, `y DEJA DE VERSE de verdad: el cuerpo mide ${Math.round(estado.alto)}px`);
comprueba(estado.signo === '+', `y el botón pasa a «${estado.signo}»`);
comprueba(
  await page.evaluate(() => document.querySelector('.b-status')?.textContent || '') !== 'Sin guardar',
  'plegar no marca el documento como modificado'
);
await page.click('.b-insp .b-tree > .tree-n.is-cat:first-child > .tree-h > .tree-t');
await page.waitForTimeout(120);
comprueba(
  await page.evaluate(() => document.querySelector('.b-insp .b-tree > .tree-n.is-cat > .tree-b').getBoundingClientRect().height > 20),
  'y al volver a pulsar se vuelve a ver'
);

/* ================================================================== */
console.log('\n--- Añadir un plato desde dentro de su categoría');
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.b-insp [data-rep-add="items"][data-preset-k]')];
  btns.find((b) => /Postres/.test(b.textContent)).click();
});
await page.waitForTimeout(300);
t = await arbol();
comprueba(t[1]?.platos.length === 2, `Postres pasa a tener ${t[1]?.platos.length} platos`);
comprueba(
  t[0]?.platos.length === 2 && t[2]?.platos.length === 1,
  'y no se ha colado en otra categoría ni en «Sin categoría»'
);

/* ================================================================== */
console.log('\n--- Adiciones: escribir, guardar, recargar');
// Abrir el primer plato de Desayunos y su rama de adiciones.
await page.evaluate(() => {
  document.querySelector('.b-insp .b-tree > .tree-n.is-cat > .tree-b > .tree-n.is-plato > .tree-h > .tree-t').click();
});
await page.waitForTimeout(150);
comprueba(
  await page.evaluate(() => !!document.querySelector('.b-insp .tree-n.is-plato .tree-n.is-sub')),
  'dentro del plato hay una rama de adiciones'
);
await page.evaluate(() => document.querySelector('.b-insp .tree-n.is-plato [data-sub-add]').click());
await page.waitForTimeout(250);
await page.evaluate(() => {
  const p = document.querySelector('.b-insp .tree-n.is-plato .tree-n.is-sub');
  p.querySelector('[data-sk="name"]').focus();
});
await page.fill('.b-insp .tree-n.is-plato .tree-n.is-sub [data-sk="name"]', 'Huevo frito o revuelto (x2)');
await page.fill('.b-insp .tree-n.is-plato .tree-n.is-sub [data-sk="price"]', '10.9');
await page.waitForTimeout(150);

const enPantalla = await page.evaluate(() => {
  const n = document.querySelector('.b-insp .tree-n.is-plato .tree-n.is-sub [data-sk="name"]');
  return { i: n.dataset.i, j: n.dataset.j, k: n.dataset.k, campo: n.dataset.sub };
});
comprueba(enPantalla.campo === 'items' && enPantalla.k === 'addons', `el control apunta al sitio correcto: items[${enPantalla.i}].addons[${enPantalla.j}]`);

await asentar();
const buscar = (lista, t2) => (lista || []).reduce((h, n) => h || (n.id === t2 ? n : buscar(n.children, t2)), null);
const mandado = buscar(enviado?.sections, 'm');
const ad = mandado?.props?.items?.[Number(enPantalla.i)]?.addons || [];
comprueba(ad.length === 1 && ad[0].name === 'Huevo frito o revuelto (x2)', `la adición viaja en el guardado: ${JSON.stringify(ad)}`);
comprueba(ad[0]?.price === '10.9', `con su precio: ${ad[0]?.price}`);

await abrirPanel();
await seleccionarCarta();
await page.evaluate(() => {
  document.querySelector('.b-insp .b-tree > .tree-n.is-cat > .tree-b > .tree-n.is-plato > .tree-h > .tree-t').click();
});
await page.waitForTimeout(200);
const trasRecargar = await page.evaluate(() => {
  const n = document.querySelector('.b-insp .tree-n.is-plato .tree-n.is-sub [data-sk="name"]');
  return n ? n.value : '(no está)';
});
comprueba(trasRecargar === 'Huevo frito o revuelto (x2)', `tras recargar el editor, la adición sigue en el inspector: ${trasRecargar}`);

const contador = await page.evaluate(() => {
  const p = document.querySelector('.b-insp .tree-n.is-plato');
  return p.querySelector(':scope > .tree-h > .tree-c')?.textContent.trim() || '';
});
comprueba(contador === '+1', `y el plato enseña que tiene adiciones sin abrirlo: «${contador}»`);

/* ================================================================== */
console.log('\n--- Y se ven en la página pública');
const publico = execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, (() => {
  const f = join(dir, 'pub.json');
  writeFileSync(f, JSON.stringify(ultimo));
  return f;
})()], { encoding: 'utf8' });
comprueba(/m-carta-addons/.test(publico), 'el HTML público lleva el bloque de adiciones');
comprueba(/Huevo frito o revuelto \(x2\)/.test(publico), 'con el nombre de la adición');
comprueba(/m-carta-addon-price">10\.9</.test(publico), 'y con su precio');
comprueba(
  (publico.match(/class="m-carta-addons"/g) || []).length === 1,
  `solo el plato que tiene adiciones las pinta: ${(publico.match(/class="m-carta-addons"/g) || []).length} bloque(s)`
);

/* ================================================================== */
/* Los dos paneles del constructor: esconder y ensanchar               */
console.log('\n--- Esconder y ensanchar los paneles');
const geo = () => page.evaluate(() => {
  const g = (s) => { const e = document.querySelector(s); const r = e ? e.getBoundingClientRect() : null; return r ? Math.round(r.width) : 0; };
  return {
    izq: g('.b-left'), der: g('.b-right'), lienzo: g('.b-canvas'),
    railIzq: !document.querySelector('[data-show="left"]')?.hidden,
    railDer: !document.querySelector('[data-show="right"]')?.hidden,
  };
});
let g0 = await geo();
comprueba(g0.izq > 100 && g0.der > 100, `los dos paneles se ven: ${g0.izq}px y ${g0.der}px`);
comprueba(!g0.railIzq && !g0.railDer, 'y no hay railes de «mostrar» por medio');

await page.click('[data-panel="right"]');
await page.waitForTimeout(200);
let g1 = await geo();
comprueba(g1.der === 0, `al pulsar «Ajustes» el panel derecho desaparece: ${g1.der}px`);
comprueba(g1.lienzo > g0.lienzo + 200, `y el lienzo se queda el hueco: ${g0.lienzo} → ${g1.lienzo}px`);
comprueba(g1.railDer, 'aparece el raíl para traerlo de vuelta');

await page.click('[data-panel="left"]');
await page.waitForTimeout(200);
let g2 = await geo();
comprueba(g2.izq === 0 && g2.der === 0, 'se pueden esconder los dos a la vez');
comprueba(g2.lienzo > g1.lienzo + 200, `y el lienzo se lleva todo: ${g2.lienzo}px`);

await page.click('[data-show="right"]');
await page.waitForTimeout(200);
let g3 = await geo();
comprueba(g3.der > 100 && g3.izq === 0, `el raíl devuelve el panel derecho: ${g3.der}px, y sólo ese`);
await page.click('[data-panel="left"]');
await page.waitForTimeout(200);

// Arrastrar el tirador de la derecha hacia la izquierda ensancha el panel.
const antesAncho = (await geo()).der;
const caja = await page.evaluate(() => {
  const r = document.querySelector('[data-split="right"]').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + 200 };
});
await page.mouse.move(caja.x, caja.y);
await page.mouse.down();
await page.mouse.move(caja.x - 160, caja.y, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(200);
const despuesAncho = (await geo()).der;
comprueba(despuesAncho > antesAncho + 100, `arrastrando el tirador el panel derecho se ensancha: ${antesAncho} → ${despuesAncho}px`);

const guardado2 = await page.evaluate(() => localStorage.getItem('krg-right-w'));
comprueba(Number(guardado2) === despuesAncho, `y el ancho queda recordado: ${guardado2}px`);

await page.reload();
await page.waitForSelector('.b-insp', { timeout: 15000 });
await page.waitForTimeout(600);
const trasRecarga = (await geo()).der;
comprueba(Math.abs(trasRecarga - despuesAncho) <= 1, `tras recargar el editor sigue igual de ancho: ${trasRecarga}px`);

/* ================================================================== */
console.log('\n--- Dentro del admin de WordPress todo cabe y se alcanza');
const encaja = await page.evaluate(() => {
  const r = document.querySelector('.b-root').getBoundingClientRect();
  const der = document.querySelector('.b-right').getBoundingClientRect();
  const barra = document.querySelector('.b-top');
  const botones = [...document.querySelectorAll('.b-top [data-panel], .b-split-t')].map((b) => {
    const c = b.getBoundingClientRect();
    return { k: (b.dataset.panel || '') + (b.className.includes('split') ? '/borde' : '/barra'), dentro: c.right <= window.innerWidth + 1 && c.width > 0 };
  });
  return {
    anchoRoot: Math.round(r.width),
    hueco: Math.round(document.querySelector('#wpbody-content').getBoundingClientRect().width),
    derFuera: Math.round(der.right - window.innerWidth),
    barraCortada: barra.scrollWidth > barra.clientWidth + 1,
    botones,
  };
});
comprueba(encaja.anchoRoot <= encaja.hueco + 1, `el constructor no se sale de su hueco: ${encaja.anchoRoot} de ${encaja.hueco}px`);
comprueba(encaja.derFuera <= 0, `el panel derecho entra entero en la pantalla (se pasa ${encaja.derFuera}px)`);
comprueba(!encaja.barraCortada, 'la barra de arriba no esconde botones por el lado');
comprueba(
  encaja.botones.length === 4 && encaja.botones.every((b) => b.dentro),
  `los 4 botones de plegar se ven y se alcanzan: ${encaja.botones.map((b) => b.k + (b.dentro ? '✔' : '✖')).join(' ')}`
);

console.log('\n--- Plegar desde el botón del borde del panel');
await page.click('.b-split-t[data-panel="right"]');
await page.waitForTimeout(200);
let gb = await geo();
comprueba(gb.der === 0, `el botón del borde esconde el panel derecho: ${gb.der}px`);
await page.click('[data-show="right"]');
await page.waitForTimeout(200);
gb = await geo();
comprueba(gb.der > 100, `y el raíl lo devuelve: ${gb.der}px`);

// Pulsar el botón del borde no puede mover el panel de sitio.
const anchoAntes = gb.der;
await page.click('.b-split-t[data-panel="left"]');
await page.waitForTimeout(150);
await page.click('[data-show="left"]');
await page.waitForTimeout(200);
const gc = await geo();
comprueba(gc.der === anchoAntes && gc.izq > 100, `plegar no descoloca los anchos: ${gc.izq} / ${gc.der}px`);

comprueba(errores.length === 0, `sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`);

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
