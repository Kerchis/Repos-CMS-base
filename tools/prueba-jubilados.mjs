#!/usr/bin/env node
/**
 * La paleta, separada: piezas que se quedan y secciones que se jubilan.
 *
 * Por qué: la paleta V.1 mezclaba dos cosas muy distintas. Por un lado
 * las piezas de toda la vida —un título, una foto, un mapa, un
 * formulario—, que son justo lo que usan por dentro las fichas V.2 y
 * que no se van a ir nunca. Por otro, las secciones enteras metidas en
 * un solo bloque, que es lo que V.2 vino a sustituir. Mientras las dos
 * familias estuvieran en el mismo cajón no había forma de apagar la
 * V.1 sin llevarse por delante las piezas.
 *
 * Esto es el paso previo: clasificar y decirlo. No se borra nada.
 *
 * Lo que se comprueba:
 *
 *   1. Que cada sección jubilada existe de verdad en el registro —nada
 *      de jubilar un bloque que no está— y que su recambio V.2 existe
 *      también.
 *   2. Que ninguna sección jubilada se usa por dentro de una ficha
 *      V.2: si se usara, apagarla rompería el catálogo nuevo. Se
 *      comprueba montando las 53 fichas y mirando qué bloques salen.
 *   3. Que las piezas que sí usan las fichas V.2 siguen todas en el
 *      cajón que se queda.
 *   4. Que en la paleta hay dos cajones distintos, que el de las viejas
 *      nace cerrado y que cada botón dice con qué ficha se hace lo
 *      mismo.
 *   5. Que una sección jubilada **se sigue pudiendo insertar**: esto
 *      no quita funcionalidad, sólo la ordena.
 *   6. Y que al seleccionar un bloque viejo de una página que ya
 *      existe, el inspector lo dice sin estorbar y sin cambiar nada.
 *
 *   node tools/prueba-jubilados.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = `${ROOT}/krg-cms/admin/assets/css`;
const PHP = `${ROOT}/.tools/php/php`;
const REST = 'https://krg.test/wp-json/krg/v1';
const dir = mkdtempSync(join(tmpdir(), 'krg-jubilados-'));

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const slugsRegistro = new Set(registry.map((b) => b.slug));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

/* =================================================================== */
/* 1 a 3 — el catálogo, sin navegador                                  */

const ventana = {
  KrgBuilderCore: {
    dict: (x) => x,
    styleBucket: () => ({}),
  },
};
const fuenteV2 = readFileSync(`${JS}/builder-v2.js`, 'utf8');
new Function('window', fuenteV2)(ventana);
const V2 = ventana.KrgV2;
const jubilados = V2.jubilados();
const fichas = V2.list();

console.log('PRUEBA 1 — el mapa de jubilaciones es real');
const sinRegistro = Object.keys(jubilados).filter((s) => !slugsRegistro.has(s));
ok(sinRegistro.length === 0, `las ${Object.keys(jubilados).length} secciones jubiladas existen en el registro${sinRegistro.length ? ` — sobra ${sinRegistro.join(', ')}` : ''}`);
const sinRecambio = Object.entries(jubilados).filter(([, destino]) => !fichas.some((f) => f.slug === destino));
ok(sinRecambio.length === 0, `y cada una apunta a una ficha V.2 que existe${sinRecambio.length ? ` — falta ${sinRecambio.map(([a, b]) => `${a}→${b}`).join(', ')}` : ''}`);
ok(Object.values(jubilados).every((d) => d.endsWith('-v2')), 'los recambios son todos fichas V.2');

console.log('\nPRUEBA 2 — ninguna jubilada se usa dentro de V.2');
let contador = 0;
const makeNode = (type, props = {}, name = '') => {
  const def = registry.find((d) => d.slug === type);
  return {
    id: `n${++contador}`,
    type,
    name: name || (def ? def.name : type),
    visible: true,
    source: 'local',
    globalId: 0,
    props: { ...(def ? def.defaults : {}), ...props },
    styles: { desktop: {}, tablet: {}, mobile: {} },
    children: [],
  };
};
const tiposDe = (nodo, fuera = []) => {
  fuera.push(nodo.type);
  (nodo.children || []).forEach((h) => tiposDe(h, fuera));
  return fuera;
};
const usados = new Set();
let montadas = 0;
fichas.forEach((f) => {
  const arbol = V2.build(f.slug, makeNode);
  if (!arbol) return;
  montadas++;
  tiposDe(arbol).forEach((t) => usados.add(t));
});
ok(montadas === fichas.length, `se montan las ${fichas.length} fichas del catálogo`);
const chocan = [...usados].filter((t) => Object.prototype.hasOwnProperty.call(jubilados, t));
ok(chocan.length === 0, `y ninguna usa por dentro una sección jubilada${chocan.length ? ` — usa ${chocan.join(', ')}` : ''}`);

console.log('\nPRUEBA 3 — lo que usa V.2 se queda');
const quedan = [...usados].filter((t) => !Object.prototype.hasOwnProperty.call(jubilados, t));
ok(quedan.length >= 15, `las ${quedan.length} piezas que usan las fichas siguen en el cajón que se queda`);
['heading', 'paragraph', 'image', 'button', 'map', 'contact-form', 'marquee', 'accordion', 'tabs'].forEach((pieza) => {
  if (usados.has(pieza)) {
    ok(!Object.prototype.hasOwnProperty.call(jubilados, pieza), `«${pieza}» no se jubila: lo usa V.2 por dentro`);
  }
});

/* =================================================================== */
/* 4 a 6 — la paleta y el inspector, en el navegador                   */

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});
/** Una página que ya existe y usa un módulo de los viejos. */
const doc = {
  id: 1, title: 'Portada antigua', slug: 'portada', status: 'draft', checksum: 'c0',
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [
    nodo('sec1', 'section', { width: 'padded' }, [
      nodo('row1', 'row', { gap: 24 }, [
        nodo('col1', 'column', { span: 12 }, [
          nodo('viejo', 'cta', { title: 'Reserva tu tarro', text: 'Reservar' }),
          nodo('nuevo', 'heading', { text: 'Un título normal', tag: 'h2' }),
        ]),
      ]),
    ]),
  ],
};

const html = `<!doctype html><meta charset="utf-8"><title>constructor</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<link rel="stylesheet" href="file://${CSS}/builder.css">
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-paginas.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;
const archivo = join(dir, 'constructor.html');
writeFileSync(archivo, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
const guardados = [];
await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.method() === 'POST' && /^\/pages\/1(\/save)?$/.test(url)) {
    guardados.push(JSON.parse(req.postData() || '{}'));
    return json({ ...doc, checksum: `c${guardados.length}` });
  }
  if (url === '/pages/1') return json(doc);
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});
await page.goto(`file://${archivo}`);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await page.waitForTimeout(250);

console.log('\nPRUEBA 4 — dos cajones en la paleta');
ok(await page.isVisible('[data-acc="pal.v1"]'), 'está el cajón de los bloques sueltos');
ok(await page.isVisible('[data-acc="pal.viejas"]'), 'y el de las secciones de la versión anterior');
const tituloViejas = (await page.textContent('[data-acc="pal.viejas"] .acc-t')) || '';
ok(/versión anterior/i.test(tituloViejas), `con su nombre en claro: «${tituloViejas.trim()}»`);
const abiertoViejas = await page.getAttribute('[data-acc="pal.viejas"] .acc-h', 'aria-expanded');
ok(abiertoViejas === 'false', 'nace cerrado: lo primero que se ofrece es lo nuevo');
const abiertoNuevas = await page.getAttribute('[data-acc="pal.v2"] .acc-h', 'aria-expanded');
ok(abiertoNuevas === 'true', 'y el de las secciones V.2, abierto');

await page.click('[data-acc="pal.viejas"] .acc-h');
await page.waitForTimeout(150);
const viejos = await page.$$eval('[data-acc="pal.viejas"] [data-vieja]', (els) => els.map((e) => ({
  slug: e.getAttribute('data-vieja'),
  titulo: e.getAttribute('title') || '',
})));
ok(viejos.length === Object.keys(jubilados).length,
  `están las ${viejos.length} secciones jubiladas, y sólo ellas`);
ok(viejos.every((v) => /Lo mismo por piezas/.test(v.titulo)),
  'cada botón dice con qué ficha V.2 se hace lo mismo');
const cta = viejos.find((v) => v.slug === 'cta');
ok(cta && /CTA V\.2/.test(cta.titulo), `por ejemplo «cta» → ${cta ? cta.titulo.split('«')[1] : '—'}`);
const sueltos = await page.$$eval('[data-acc="pal.v1"] [data-add]', (els) => els.map((e) => e.getAttribute('data-add')));
ok(!sueltos.some((s) => Object.prototype.hasOwnProperty.call(jubilados, s)),
  'y en el cajón de los sueltos no se ha colado ninguna jubilada');
ok(sueltos.includes('heading') && sueltos.includes('image') && sueltos.includes('map'),
  'las piezas de siempre siguen ahí');

console.log('\nPRUEBA 5 — se siguen pudiendo poner');
const antes = await page.$$eval('.b-tree .sec[data-tree]', (els) => els.length);
await page.click('[data-acc="pal.viejas"] [data-vieja="testimonials"]');
await page.waitForTimeout(400);
const despues = await page.$$eval('.b-tree .sec[data-tree]', (els) => els.length);
ok(despues > antes, `una sección jubilada se inserta igual que antes (${antes} → ${despues} bloques)`);
ok(await page.evaluate(() => {
  const ver = (ns) => (ns || []).some((n) => n.type === 'testimonials' || ver(n.children));
  return ver(window.KrgBuilderState.doc.sections);
}), 'y entra en el documento de verdad, no sólo en la lista');

console.log('\nPRUEBA 6 — el inspector lo dice sin estorbar');
await page.click('.b-tree .sec[data-tree="viejo"] .b-tname');
await page.waitForTimeout(300);
ok(await page.isVisible('[data-vieja-aviso]'), 'al seleccionar un bloque viejo sale la nota');
const nota = (await page.textContent('[data-vieja-aviso]')) || '';
ok(/CTA V\.2/.test(nota), `que dice cuál es su equivalente: «${nota.trim().split('\n').pop().trim().slice(-40)}»`);
ok(/puede quedarse/.test(nota), 'y que puede quedarse como está: esto no obliga a nada');
const camposCta = await page.$$eval('.b-groups [data-prop]', (els) => els.length);
ok(camposCta > 0, `el inspector del bloque viejo sigue entero (${camposCta} controles)`);

await page.click('.b-tree .sec[data-tree="nuevo"] .b-tname');
await page.waitForTimeout(300);
ok(!(await page.$('[data-vieja-aviso]')), 'y en un bloque normal no sale ninguna nota');
ok(errores.length === 0, `sin errores de JavaScript${errores.length ? ` — ${errores[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await page.click('.b-tree .sec[data-tree="viejo"] .b-tname');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${ROOT}/captura-jubilados.png` });
  console.log(`\n  captura en ${ROOT}/captura-jubilados.png`);
}

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas`);
console.log(fallos ? 'HAY QUE ARREGLARLO' : 'LA PALETA ESTÁ SEPARADA Y NO SE HA PERDIDO NADA');
process.exit(fallos ? 1 : 0);
