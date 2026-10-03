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
const PUBLICO = 'https://krg.test/carta-publica/';

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
/** La misma carta tal y como la ve el visitante: sin lienzo y con su JS. */
function pintarPublico(doc) {
  const f = join(dir, 'pub-page.json');
  writeFileSync(f, JSON.stringify(doc));
  return execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, f], { encoding: 'utf8' });
}
/** La carta de la prueba, pero en modo pestañas y con la pestaña «Todo». */
function docPestanas() {
  const d = JSON.parse(JSON.stringify(inicial()));
  const carta = d.sections[0].children[0].children[0].children[0];
  carta.props.groupMode = 'tabs';
  carta.props.showAll = true;
  carta.props.items[0].addons = [{ name: 'Extra beicon', price: '6' }];
  carta.props.categories[1].addons = [{ name: 'Bola de helado', price: '4' }];
  return d;
}

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: {}, children,
});

const plato = (title, price, category, addons = [], extra = {}) => ({
  title, price, category, addons, text: '', badge: '', imageId: 0, imageUrl: '', alt: '', url: '',
  photos: [], ...extra,
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
          showImages: true,
          currency: '$',
          zoom: true,
                  categories: [
            { label: 'Desayunos', text: '', addons: [{ name: 'Huevo frito o revuelto (x2)', price: '10.9' }, { name: 'Porción de frutas (180g)', price: '9.9' }] },
            { label: 'Postres', text: '', addons: [] },
          ],
          items: [
            plato('Huevos benedictinos', '24.9', 'Desayunos', [], {
              imageId: 11, alt: 'Huevos benedictinos', text: 'Con salsa holandesa.',
              photos: [
                { imageId: 11, imageUrl: 'https://ejemplo.test/uploads/foto-11-large.jpg', alt: 'El plato entero' },
                { imageId: 12, imageUrl: 'https://ejemplo.test/uploads/foto-12-large.jpg', alt: 'De cerca' },
                { imageId: 13, imageUrl: 'https://ejemplo.test/uploads/foto-13-large.jpg', alt: 'En la mesa' },
              ],
            }),
            plato('Tostada de aguacate', '18.0', 'Desayunos', [], { imageId: 14, alt: 'Tostada' }),
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

// Las fotos de la mediateca falsa: se sirven de verdad para que el
// navegador las descargue, las mida y la captura ensene algo. Sin esto
// el visor se mediria con imagenes rotas, que no es lo que ve nadie.
await page.route('**/ejemplo.test/uploads/**', async (route) => {
  const n = Number((route.request().url().match(/foto-(\d+)/) || [])[1] || 0);
  const tonos = ['#3f5e58', '#8c6b3f', '#b3452f', '#2f4858', '#6b7f3f'];
  const c = tonos[n % tonos.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="1200" height="800" fill="${c}"/>
    <text x="600" y="430" font-family="sans-serif" font-size="90" fill="#fef6e7" text-anchor="middle">Foto ${n}</text></svg>`;
  return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
});

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.url() === PANEL) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  if (req.url().startsWith(PUBLICO)) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pintarPublico(docPestanas()) });
  }
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
  await page.evaluate(() => !!document.querySelector('.b-insp .tree-n.is-plato [data-sub-add]')),
  'dentro del plato hay una rama de adiciones'
);
await page.evaluate(() => document.querySelector('.b-insp .tree-n.is-plato [data-sub-add]').click());
await page.waitForTimeout(250);
await page.evaluate(() => {
  document.querySelector('.b-insp .tree-n.is-plato [data-sk="name"]').focus();
});
await page.fill('.b-insp .tree-n.is-plato [data-sk="name"]', 'Huevo frito o revuelto (x2)');
await page.fill('.b-insp .tree-n.is-plato [data-sk="price"]', '10.9');
await page.waitForTimeout(150);

const enPantalla = await page.evaluate(() => {
  const n = document.querySelector('.b-insp .tree-n.is-plato [data-sk="name"]');
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
  const n = document.querySelector('.b-insp .tree-n.is-plato [data-sk="name"]');
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
comprueba(/m-carta-addon-price">\$10\.9</.test(publico), 'y con su precio, con el símbolo puesto por la carta');
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


/* ================================================================== */
/* La carta que ve el visitante: pestañas, precios y fotos             */
/* ================================================================== */
await page.goto(PUBLICO);
await page.waitForSelector('.m-carta[data-carta]', { timeout: 15000 });
await page.waitForTimeout(300);

console.log('\n--- «Todo» enseña platos, no adiciones');
const verCarta = () => page.evaluate(() => {
  const alto = (s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().height > 0).length;
  return {
    todo: document.querySelector('.m-carta').classList.contains('is-todo'),
    platos: alto('.m-carta-item:not(.is-addons)'),
    adicionesPlato: alto('.m-carta-item > .m-carta-addons:not(.is-cat)'),
    adicionesCat: alto('.m-carta-item.is-addons'),
  };
});
let v = await verCarta();
comprueba(v.todo, 'la pestaña «Todo» marca la carta como tal');
comprueba(v.platos === 4, `en «Todo» se ven los ${v.platos} platos`);
comprueba(v.adicionesPlato === 0, `y NINGUNA adición de plato: ${v.adicionesPlato} visibles`);
comprueba(v.adicionesCat === 0, `ni el bloque de adiciones de la categoría: ${v.adicionesCat} visibles`);

await page.click('.m-carta-tab[data-carta-filter="desayunos"]');
await page.waitForTimeout(200);
v = await verCarta();
comprueba(!v.todo, 'al elegir una categoría se quita la marca de «Todo»');
comprueba(v.platos === 2, `en «Desayunos» quedan sus ${v.platos} platos`);
comprueba(v.adicionesPlato === 1, `y vuelven las adiciones del plato: ${v.adicionesPlato}`);
comprueba(v.adicionesCat === 1, `y las de la categoría: ${v.adicionesCat}`);

await page.click('.m-carta-tab[data-carta-filter="*"]');
await page.waitForTimeout(200);
v = await verCarta();
comprueba(v.platos === 4 && v.adicionesPlato === 0 && v.adicionesCat === 0, 'y volver a «Todo» las esconde otra vez');

console.log('\n--- Cada categoría enseña SUS adiciones y solo en su pestaña');
const adicionesVisibles = () => page.evaluate(() =>
  [...document.querySelectorAll('.m-carta-item.is-addons')]
    .filter((e) => e.getBoundingClientRect().height > 0)
    .map((e) => e.getAttribute('data-cat'))
);
await page.click('.m-carta-tab[data-carta-filter="desayunos"]');
await page.waitForTimeout(200);
let av = await adicionesVisibles();
comprueba(av.length === 1 && av[0] === 'desayunos', `en «Desayunos» solo salen las suyas: ${av.join(', ') || 'ninguna'}`);
await page.click('.m-carta-tab[data-carta-filter="postres"]');
await page.waitForTimeout(200);
av = await adicionesVisibles();
comprueba(
  av.length === 1 && av[0] === 'postres',
  `en «Postres» NO se cuelan las de Desayunos: ${av.join(', ') || 'ninguna'}`
);
const platoAjeno = await page.evaluate(() =>
  [...document.querySelectorAll('.m-carta-item > .m-carta-addons:not(.is-cat)')]
    .filter((e) => e.getBoundingClientRect().height > 0).length
);
comprueba(platoAjeno === 0, `ni las adiciones del plato de otra categoría: ${platoAjeno} visibles`);
await page.click('.m-carta-tab[data-carta-filter="*"]');
await page.waitForTimeout(200);
comprueba((await adicionesVisibles()).length === 0, 'y en «Todo» no hay ninguna');

console.log('\n--- El símbolo de la moneda lo pone la carta, no el usuario');
const precios = await page.evaluate(() => ({
  platos: [...document.querySelectorAll('.m-carta-price')].map((e) => e.textContent.trim()),
  adiciones: [...document.querySelectorAll('.m-carta-addon-price')].map((e) => e.textContent.trim()),
}));
comprueba(
  precios.platos.length === 4 && precios.platos.every((p) => p.startsWith('$')),
  `todos los precios salen con $: ${precios.platos.join(' · ')}`
);
comprueba(precios.platos.includes('$24.9'), 'el 24.9 que escribió el usuario se ve como $24.9');
comprueba(
  precios.adiciones.length > 0 && precios.adiciones.every((p) => p.startsWith('$')),
  `y las adiciones también: ${precios.adiciones.join(' · ')}`
);
comprueba(
  !precios.platos.some((p) => p.startsWith('$$')) && !precios.adiciones.some((p) => p.startsWith('$$')),
  'y nunca sale el símbolo dos veces'
);

console.log('\n--- Las fotos del plato se abren en grande');
const hayBoton = await page.evaluate(() => ({
  botones: document.querySelectorAll('.m-carta-media.is-zoom').length,
  dentroDeEnlace: !!document.querySelector('a .m-carta-media.is-zoom'),
  plantillas: document.querySelectorAll('template.m-carta-fotos').length,
  pesan: document.querySelectorAll('.m-carta-lb-img').length,
  etiqueta: document.querySelector('.m-carta-media.is-zoom')?.getAttribute('aria-label') || '',
}));
comprueba(hayBoton.botones === 2, `las fotos de los platos se pueden pulsar: ${hayBoton.botones} botones`);
comprueba(!hayBoton.dentroDeEnlace, 'y ningún botón queda metido dentro de un enlace (HTML inválido)');
comprueba(hayBoton.plantillas === 2, 'cada uno lleva sus fotos en un <template>');
comprueba(hayBoton.pesan === 0, 'que el navegador NO descarga hasta que se abre');
comprueba(/Ver fotos de Huevos benedictinos/.test(hayBoton.etiqueta), `con nombre para el lector de pantalla: «${hayBoton.etiqueta}»`);

await page.click('.m-carta-item:first-child .m-carta-media.is-zoom');
await page.waitForTimeout(350);
const visor = () => page.evaluate(() => {
  const d = document.querySelector('.m-carta-lb');
  if (!d) return null;
  const fig = [...d.querySelectorAll('.m-carta-lb-fig')];
  const on = fig.findIndex((f) => f.classList.contains('is-on'));
  return {
    abierto: d.open,
    modal: d.matches(':modal'),
    fotos: fig.length,
    actual: on,
    cuenta: d.querySelector('[data-lb-n]').textContent.trim(),
    titulo: d.querySelector('[data-lb-t]').textContent.trim(),
    precio: d.querySelector('[data-lb-p]').textContent.trim(),
    miniaturas: d.querySelectorAll('.m-carta-lb-th').length,
    alto: Math.round(d.getBoundingClientRect().height),
  };
});
let w = await visor();
comprueba(!!w && w.abierto, 'al pulsar la foto se abre el visor');
comprueba(w.modal, 'y lo hace como ventana modal de verdad (<dialog>, foco atrapado, Esc incluido)');
comprueba(w.fotos === 3, `con las ${w.fotos} fotos del plato`);
comprueba(w.titulo === 'Huevos benedictinos' && w.precio === '$24.9', `y el nombre y el precio del plato: ${w.titulo} ${w.precio}`);
comprueba(w.cuenta === '1 / 3', `enseña en cuál va: «${w.cuenta}»`);
comprueba(w.miniaturas === 3, 'y una miniatura por foto para saltar a la que sea');

await page.click('.m-carta-lb [data-lb-go="1"]');
await page.waitForTimeout(200);
w = await visor();
comprueba(w.actual === 1 && w.cuenta === '2 / 3', `la flecha pasa a la siguiente: «${w.cuenta}»`);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
w = await visor();
comprueba(w.actual === 2, 'el teclado también pasa de foto');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
w = await visor();
comprueba(w.actual === 0, 'y de la última vuelve a la primera');
await page.click('.m-carta-lb .m-carta-lb-th[data-lb-i="2"]');
await page.waitForTimeout(200);
w = await visor();
comprueba(w.actual === 2, 'la miniatura salta a su foto');

if (process.env.KRG_SHOT) {
  await page.click('.m-carta-lb .m-carta-lb-th[data-lb-i="0"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ROOT}/.captures/visor-carta.png` });
}

const adVisor = await page.evaluate(() => {
  const c = document.querySelector('.m-carta-lb [data-lb-ad]');
  return {
    sale: c.getBoundingClientRect().height > 0,
    titulo: c.querySelector('.m-carta-addons-t')?.textContent.trim() || '',
    lineas: [...c.querySelectorAll('.m-carta-addon')].map((e) => e.textContent.trim()),
  };
});
comprueba(adVisor.sale, 'el visor también enseña las adiciones del plato');
comprueba(adVisor.lineas.length === 1 && /Extra beicon/.test(adVisor.lineas[0]), `con su nombre: ${adVisor.lineas.join(' · ')}`);
comprueba(/\$6/.test(adVisor.lineas[0] || ''), 'y su precio con el símbolo puesto');
comprueba(/ADICIONES|Adiciones/i.test(adVisor.titulo), `bajo su título: «${adVisor.titulo}»`);

// Deslizar de lado: el gesto que se usa en el móvil (aquí con puntero).
const centro = await page.evaluate(() => {
  const r = document.querySelector('.m-carta-lb-slides').getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
const desliza = async (dx, dy = 0) => {
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.down();
  await page.mouse.move(centro.x + dx, centro.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
};
const antesDeDeslizar = (await visor()).actual;
await desliza(-200);
w = await visor();
comprueba(w.actual === (antesDeDeslizar + 1) % 3, `deslizando hacia la izquierda pasa a la siguiente: ${antesDeDeslizar} → ${w.actual}`);
await desliza(200);
w = await visor();
comprueba(w.actual === antesDeDeslizar, `y hacia la derecha vuelve: ${w.actual}`);
await desliza(-10);
comprueba((await visor()).actual === antesDeDeslizar, 'un roce de 10px no cambia de foto');
await desliza(-60, 160);
comprueba((await visor()).actual === antesDeDeslizar, 'y un gesto vertical tampoco: ese es para bajar la página');

await page.keyboard.press('Escape');
await page.waitForTimeout(250);
comprueba(!(await visor()).abierto, 'Escape cierra el visor');

await page.click('.m-carta-item:first-child .m-carta-media.is-zoom');
await page.waitForTimeout(250);
await page.click('.m-carta-lb [data-lb-x]');
await page.waitForTimeout(250);
comprueba(!(await visor()).abierto, 'y la ✕ también');

// Un plato con foto pero sin fotos extra: se amplía la suya, y una sola
// foto no pinta flechas que no llevan a ningún sitio.
await page.click('.m-carta-item:nth-child(2) .m-carta-media.is-zoom');
await page.waitForTimeout(250);
const sola = await page.evaluate(() => {
  const d = document.querySelector('.m-carta-lb');
  const nav = d.querySelector('.m-carta-lb-nav');
  return {
    abierto: d.open,
    fotos: d.querySelectorAll('.m-carta-lb-fig').length,
    flechas: nav.getBoundingClientRect().height,
    minis: d.querySelector('.m-carta-lb-thumbs').getBoundingClientRect().height,
    titulo: d.querySelector('[data-lb-t]').textContent.trim(),
  };
});
comprueba(sola.abierto && sola.fotos === 1, `un plato sin fotos extra amplía la suya: ${sola.fotos} foto`);
comprueba(sola.flechas === 0 && sola.minis === 0, 'y no enseña flechas ni miniaturas de adorno');
comprueba(sola.titulo === 'Tostada de aguacate', `con su nombre: ${sola.titulo}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

console.log('\n--- El plato con foto se ve ordenado, también en el móvil');
const maqueta = () => page.evaluate(() => {
  const it = document.querySelector('.m-carta-item:not(.is-addons)');
  const foto = it.querySelector('.m-carta-media').getBoundingClientRect();
  const nombre = it.querySelector('.m-carta-name').getBoundingClientRect();
  const precio = it.querySelector('.m-carta-price').getBoundingClientRect();
  const adEl = it.querySelector('.m-carta-addons');
  const ad = adEl && adEl.getBoundingClientRect();
  return {
    alLado: nombre.left >= foto.right - 1,
    mismaFila: nombre.top < foto.bottom && nombre.bottom > foto.top,
    precioALaDerecha: precio.right > nombre.right,
    precioEnLaFila: Math.abs(precio.top - nombre.top) < 14,
    adDebajo: ad ? ad.top >= foto.bottom - 1 : null,
    adSangrada: ad ? ad.left >= foto.right - 1 : null,
    anchoNombre: Math.round(nombre.width),
  };
});
await page.click('.m-carta-tab[data-carta-filter="desayunos"]');
await page.waitForTimeout(200);
let m = await maqueta();
comprueba(m.alLado && m.mismaFila, 'en escritorio el nombre va AL LADO de la foto, no debajo');
comprueba(m.precioALaDerecha && m.precioEnLaFila, 'y el precio al final de esa misma línea');
comprueba(m.adDebajo && m.adSangrada, 'las adiciones caen debajo, sangradas al ancho de la foto');

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
m = await maqueta();
comprueba(m.alLado && m.mismaFila, `en móvil (390px) sigue al lado y no se parte: el nombre mide ${m.anchoNombre}px`);
comprueba(m.precioEnLaFila, 'con el precio todavía en su línea');
if (process.env.KRG_SHOT) {
  const it = await page.$('.m-carta-item:not(.is-addons)');
  await it.screenshot({ path: `${ROOT}/.captures/plato-movil.png` });
}
comprueba(m.adDebajo && m.adSangrada, 'y las adiciones siguen debajo y sangradas');
await page.setViewportSize({ width: 834, height: 1000 });
await page.waitForTimeout(300);
m = await maqueta();
comprueba(m.alLado && m.mismaFila && m.adDebajo, 'y en tableta (834px) igual');
await page.setViewportSize({ width: 1600, height: 1000 });

console.log('\n--- En el editor la foto no abre nada: se selecciona');
const enLienzo = pintar(docPestanas());
// Ojo: el guion publico va incrustado en la pagina y menciona el
// atributo, asi que hay que buscar el BOTON, no el texto suelto.
comprueba(!/<button[^>]*data-carta-zoom/.test(enLienzo), 'el lienzo del constructor no pinta el botón de ampliar');
comprueba(/m-carta-media/.test(enLienzo), 'pero la foto del plato sigue ahí');

console.log('\n--- Fotos del plato en el inspector');
await abrirPanel();
await seleccionarCarta();
await page.evaluate(() => {
  document.querySelector('.b-insp .b-tree > .tree-n.is-cat > .tree-b > .tree-n.is-plato > .tree-h > .tree-t').click();
});
await page.waitForTimeout(250);
const rama = await page.evaluate(() => {
  const p = document.querySelector('.b-insp .tree-n.is-plato');
  const subs = [...p.querySelectorAll(':scope > .tree-b > .tree-n.is-sub')];
  const fotos = subs.find((s) => /Fotos/.test(s.querySelector('.tree-lbl').textContent));
  if (!fotos) return null;
  const b = fotos.querySelector('.tree-b');
  if (b.hidden) fotos.querySelector('.tree-t').click();
  return {
    cuenta: fotos.querySelector('.tree-c').textContent.trim(),
    miniaturas: fotos.querySelectorAll('.tree-foto img').length,
    boton: !!fotos.querySelector('[data-sub-fotos]'),
    alt: fotos.querySelector('.tree-foto-alt')?.value || '',
  };
});
comprueba(!!rama, 'cada plato tiene su rama «Fotos del plato»');
comprueba(rama?.cuenta === '3', `que dice cuántas hay sin abrirla: ${rama?.cuenta}`);
comprueba(rama?.miniaturas === 3, `y las enseña como miniaturas, no como IDs: ${rama?.miniaturas}`);
comprueba(rama?.alt === 'El plato entero', `con su texto alternativo editable: «${rama?.alt}»`);
comprueba(rama?.boton, 'y un botón para añadir varias de una vez');

console.log('\n--- Las fotos sobreviven al guardado');
const saneado = sanear(docPestanas());
const mod = (function buscarN(lista) {
  return (lista || []).reduce((h, n) => h || (n.id === 'm' ? n : buscarN(n.children)), null);
})(saneado.sections);
const fotosGuardadas = mod?.props?.items?.[0]?.photos || [];
comprueba(fotosGuardadas.length === 3, `el saneador conserva las ${fotosGuardadas.length} fotos del plato`);
comprueba(fotosGuardadas[1]?.imageId === 12, `con su id de imagen: ${fotosGuardadas[1]?.imageId}`);
comprueba(fotosGuardadas[0]?.alt === 'El plato entero', `y su texto alternativo: ${fotosGuardadas[0]?.alt}`);
comprueba(mod?.props?.currency === '$', `y el símbolo de la moneda: «${mod?.props?.currency}»`);

comprueba(errores.length === 0, `sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`);

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
