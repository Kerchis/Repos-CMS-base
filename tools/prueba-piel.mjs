#!/usr/bin/env node
/**
 * La piel del CMS, en un navegador de verdad.
 *
 * Por que hace falta: que `Skin.php` guarde bien un tema no significa que
 * el panel se vea distinto. Esta mitad comprueba lo que ve una persona:
 * que el apartado existe, que esta plegado, que solo lo ve quien
 * administra, que al elegir un tema el panel cambia de color al instante
 * y que lo que se manda al servidor es el tema elegido.
 *
 * Y de paso vigila los tres fallos visuales que arreglo esta ola, para
 * que no vuelvan:
 *
 *   - el inspector del constructor se desbordaba 6 px y salia una barra
 *     de desplazamiento horizontal con los campos cortados;
 *   - el titulo «Portada del sitio» se montaba sobre el borde de su
 *     tarjeta porque el panel no tenia relleno;
 *   - las acciones de una fila mezclaban un enlace, dos botones y un
 *     punto suelto, y se partian en dos lineas.
 *
 *   node tools/prueba-piel.mjs
 *   KRG_SHOT=1 node tools/prueba-piel.mjs   (deja capturas en la raiz)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = `${ROOT}/krg-cms/admin/assets/css`;
const REST = 'https://krg.test/wp-json/krg/v1';

const piel = JSON.parse(execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/dump-piel.php`], { encoding: 'utf8' }));
const preset = JSON.parse(readFileSync(`${ROOT}/krg-cms/presets/honeycomb.json`, 'utf8'));
const registry = JSON.parse(execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};
/* Bajo file:// y sin red, la hoja de Google Fonts no carga: ese ruido no
   es un error del panel. */
const ruido = (t) => /ERR_CONNECTION_CLOSED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(t);

const paginas = [
  { id: 1, title: 'Inicio', slug: 'inicio', status: 'publish', uiStatus: 'publish', visibility: 'public', isFront: true },
  { id: 2, title: 'Carta', slug: 'carta', status: 'publish', uiStatus: 'publish', visibility: 'public', isFront: false },
];

const dir = mkdtempSync(join(tmpdir(), 'krg-piel-'));
const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});

/** Monta una pantalla del panel con el servidor simulado. */
async function pantalla(page, { key = 'krg-design', canManage = true, extra = {} } = {}) {
  const html = `<!doctype html><meta charset="utf-8"><title>piel</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<body class="wp-admin"><div id="krg-admin"></div>
<script>window.KrgAdmin={page:${JSON.stringify(key)},view:'',pageId:0,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:${canManage},canEditPages:true,canPublish:true,user:'Kerchis',home:'https://casamar.test/'};</script>
<script src="file://${JS}/app.js"></script>`;
  const f = join(dir, `${key}-${canManage}.html`);
  writeFileSync(f, html);
  const puestos = [];
  await page.route('**/krg.test/**', async (route) => {
    const req = route.request();
    const url = req.url().replace(REST, '').split('?')[0];
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() === 'PUT' && url === '/admin-skin') {
      const cuerpo = JSON.parse(req.postData() || '{}');
      puestos.push(cuerpo);
      const slug = cuerpo.theme && piel.themes[cuerpo.theme] ? cuerpo.theme : piel.theme;
      return json({ data: piel.themes[slug].colores, defaults: piel.themes[slug].colores, theme: slug, themes: piel.themes });
    }
    if (url === '/admin-skin') return json(piel);
    if (url === '/tokens') return json({ data: { tokens: preset.tokens, activePreset: 'honeycomb' }, presets: [{ slug: 'honeycomb', name: 'Honeycomb', swatches: ['#3F5E58'] }], fonts: [] });
    if (url === '/identity') return json({ siteName: 'Casa Mar', tagline: '', logoId: 0, logoUrl: '' });
    if (url === '/pages') return json(paginas);
    if (url === '/registry') return json(registry);
    return json(extra[url] ?? []);
  });
  await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('file://' + f);
  return puestos;
}

const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const sucio = [];
page.on('pageerror', (e) => { if (!ruido(String(e))) sucio.push(String(e)); });
page.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) sucio.push(m.text()); });

console.log('\nPRUEBA 1 — el apartado está, plegado y al final');

const puestos = await pantalla(page, { key: 'krg-design' });
await page.waitForSelector('#skin-zona', { timeout: 15000 });
ok(true, 'la pantalla Apariencia monta con el apartado «El panel KRG»');

const abierto = await page.$eval('#skin-zona', (e) => e.hasAttribute('open'));
ok(!abierto, 'nace plegado: no estorba a quien venía a tocar su web');
/* Chromium ya no esconde el interior de un `details` cerrado con
   `display:none` (lo deja buscable con `content-visibility`), así que lo
   que hay que preguntar es si se ve, no cuánto mide. */
const visible = await page.$eval('#skin-zona .m-skin-body', (e) => e.checkVisibility());
ok(visible === false, 'y su contenido no se ve mientras está cerrado');
const altoPlegado = await page.$eval('#skin-zona', (e) => Math.round(e.getBoundingClientRect().height));
ok(altoPlegado < 140, `plegado ocupa lo que una fila, no media pantalla (${altoPlegado} px)`);

const tituloVisible = ((await page.textContent('#skin-zona > summary')) || '').replace(/\s+/g, ' ').trim();
ok(/El panel KRG/.test(tituloVisible), `el rótulo se lee: «${tituloVisible.slice(0, 60)}…»`);
ok(/Solo administradores/.test(tituloVisible), 'y dice a quién pertenece');
ok(/No toca tu web/i.test(tituloVisible), 'y deja claro que no toca la web del cliente');

const zonas = await page.$$eval('.m-zona', (els) => els.map((e) => e.textContent.trim()));
ok(zonas.length === 1 && /Tu web/.test(zonas[0]), 'la otra zona está rotulada como «Tu web»');

const ordenOk = await page.evaluate(() => {
  const skin = document.querySelector('#skin-zona');
  const zona = document.querySelector('.m-zona');
  return !!skin && !!zona && zona.compareDocumentPosition(skin) & Node.DOCUMENT_POSITION_FOLLOWING;
});
ok(!!ordenOk, 'y va la última, después de todo lo del sitio');

console.log('\nPRUEBA 2 — quien no administra no lo ve');

const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pantalla(page2, { key: 'krg-design', canManage: false });
await page2.waitForSelector('.m-panel', { timeout: 15000 });
ok(!(await page2.$('#skin-zona')), 'sin permiso de administración, el apartado no se pinta');
ok(!!(await page2.$('.m-presets')), 'pero la paleta del sitio sigue ahí: eso sí es su trabajo');
await page2.close();

console.log('\nPRUEBA 3 — elegir tema pinta el panel al instante');

await page.click('#skin-zona > summary');
await page.waitForTimeout(150);
const cartas = await page.$$eval('.m-tema', (els) => els.map((e) => e.dataset.tema));
ok(cartas.length === 3, `hay tres temas para elegir (${cartas.join(', ')})`);
const activo = await page.$$eval('.m-tema', (els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.dataset.tema));
ok(activo.length === 1 && activo[0] === 'bronce', 'y el de fábrica viene marcado: bronce');

const antes = await page.evaluate(() => getComputedStyle(document.querySelector('.m-aside')).backgroundColor);
await page.click('.m-tema[data-tema="oceano"]');
await page.waitForTimeout(350);
const despues = await page.evaluate(() => getComputedStyle(document.querySelector('.m-aside')).backgroundColor);
ok(antes !== despues, `la barra lateral cambia de color al pulsar (${antes} → ${despues})`);
ok(despues === 'rgb(0, 43, 76)', 'y es el azul del tema Océano, no otro');
const botonFondo = await page.evaluate(() => getComputedStyle(document.querySelector('.m-btn')).backgroundColor);
ok(botonFondo === 'rgb(0, 70, 111)', 'los botones también siguen al tema');

ok(puestos.length === 1 && puestos[0].theme === 'oceano', 'se guarda solo, mandando el tema elegido');
const marcados = await page.$$eval('.m-tema[aria-pressed="true"]', (els) => els.map((e) => e.dataset.tema));
ok(marcados.length === 1 && marcados[0] === 'oceano', 'y la marca se mueve a la tarjeta nueva');

await page.click('.m-tema[data-tema="bronce"]');
await page.waitForTimeout(300);
const vuelta = await page.evaluate(() => getComputedStyle(document.querySelector('.m-aside')).backgroundColor);
ok(vuelta === 'rgb(35, 26, 20)', 'se puede volver a Bronce y el espresso vuelve');
ok(puestos.length === 2 && puestos[1].theme === 'bronce', 'con su guardado');

console.log('\nPRUEBA 4 — el aviso de contraste');

const sano = (await page.textContent('#skin-contraste')) || '';
ok(/todo se lee/i.test(sano), `con un tema de fábrica dice que todo se lee: «${sano}»`);
ok(!(await page.$('#skin-contraste.is-mal')), 'y no está en rojo');

await page.click('#skin-zona .m-skin-avanzado > summary');
await page.waitForTimeout(100);
await page.fill('[data-skin="ink"]', '#f1e6cf');
await page.dispatchEvent('[data-skin="ink"]', 'change');
await page.waitForTimeout(150);
const roto = (await page.textContent('#skin-contraste')) || '';
ok(/no se lee bien/i.test(roto), `un texto casi del color del fondo se avisa: «${roto.slice(0, 80)}…»`);
ok(!!(await page.$('#skin-contraste.is-mal')), 'y el aviso se pinta de peligro');
ok(/\d\.\d:1/.test(roto), 'con el número exacto, no con un «mejóralo»');

await page.fill('[data-skin="ink"]', '#1d1d1b');
await page.dispatchEvent('[data-skin="ink"]', 'change');
await page.waitForTimeout(150);
ok(/todo se lee/i.test((await page.textContent('#skin-contraste')) || ''), 'y se quita al arreglarlo');

console.log('\nPRUEBA 5 — la tarjeta ya no se come su propio título');

const pageP = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
pageP.on('pageerror', (e) => { if (!ruido(String(e))) sucio.push(String(e)); });
pageP.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) sucio.push(m.text()); });
await pantalla(pageP, { key: 'krg-pages' });
await pageP.waitForSelector('.m-front-bar', { timeout: 15000 });
const caja = await pageP.$eval('.m-front-bar', (el) => {
  const p = el.getBoundingClientRect();
  const h = el.querySelector('h2').getBoundingClientRect();
  return { hueco: Math.round(h.top - p.top), relleno: getComputedStyle(el).paddingTop };
});
ok(caja.hueco >= 12, `«Portada del sitio» respira dentro de su tarjeta (${caja.hueco} px desde el borde)`);
ok(caja.relleno !== '0px', `el panel tiene relleno propio (${caja.relleno})`);

console.log('\nPRUEBA 6 — las acciones de una fila son tres botones en una línea');

const acts = await pageP.$eval('td.m-acts', (td) => {
  const hijos = [...td.children];
  return {
    cuantos: hijos.length,
    todosBoton: hijos.every((e) => e.classList.contains('m-btn')),
    texto: td.textContent.replace(/\s+/g, ' ').trim(),
    lineas: new Set(hijos.map((e) => Math.round(e.getBoundingClientRect().top))).size,
  };
});
ok(acts.cuantos === 3 && acts.todosBoton, 'Editar, Duplicar y Eliminar son los tres botones');
ok(!acts.texto.includes('·'), `sin el punto suelto de separación («${acts.texto}»)`);
ok(acts.lineas === 1, 'y caben en una sola línea');

console.log('\nPRUEBA 7 — el inspector ya no se desborda');

const docJson = {
  id: 1, title: 'Inicio', slug: 'inicio', status: 'publish', checksum: 'c0', seo: {},
  settings: { showHeader: true, showFooter: true },
  sections: [{
    id: 'sRes', type: 'section', name: 'Reserva', visible: true, source: 'local', globalId: 0,
    props: {}, styles: { desktop: {}, tablet: {}, mobile: {} },
    children: [{
      id: 'rRes', type: 'row', name: 'row', visible: true, source: 'local', globalId: 0,
      props: {}, styles: { desktop: {}, tablet: {}, mobile: {} },
      children: [{
        id: 'cRes', type: 'column', name: 'column', visible: true, source: 'local', globalId: 0,
        props: { span: 12 }, styles: { desktop: {}, tablet: {}, mobile: {} },
        children: [{
          id: 'bk1', type: 'booking-form', name: 'booking-form', visible: true, source: 'local', globalId: 0,
          props: {}, styles: { desktop: {}, tablet: {}, mobile: {} }, children: [],
        }],
      }],
    }],
  }],
};
const htmlB = `<!doctype html><meta charset="utf-8"><title>constructor</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<link rel="stylesheet" href="file://${CSS}/builder.css">
<body class="wp-admin"><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:true,canEditPages:true,home:'https://casamar.test/'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-paginas.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;
const fB = join(dir, 'constructor.html');
writeFileSync(fB, htmlB);
const cons = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
cons.on('pageerror', (e) => { if (!ruido(String(e))) sucio.push(String(e)); });
cons.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) sucio.push(m.text()); });
await cons.route('**/krg.test/**', async (route) => {
  const url = route.request().url().replace(REST, '').split('?')[0];
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url === '/pages/1') return json(docJson);
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});
await cons.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await cons.goto('file://' + fB);
await cons.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await cons.evaluate(() => document.querySelector('[data-sel="bk1"]')?.click());
await cons.waitForTimeout(400);

const medida = await cons.evaluate(() => {
  const insp = document.querySelector('.b-insp');
  const r = insp.getBoundingClientRect();
  const campos = [...insp.querySelectorAll('input, select, textarea')];
  return {
    scroll: insp.scrollWidth,
    visible: insp.clientWidth,
    derechaPanel: Math.round(r.right),
    derechaCampo: Math.round(Math.max(...campos.map((e) => e.getBoundingClientRect().right))),
    cuantos: campos.length,
  };
});
ok(medida.cuantos > 3, `el inspector tiene campos que medir (${medida.cuantos})`);
ok(medida.scroll <= medida.visible, `no hay desplazamiento horizontal (${medida.scroll} ≤ ${medida.visible})`);
ok(medida.derechaCampo <= medida.derechaPanel,
  `ningún campo se sale por la derecha (campo ${medida.derechaCampo} ≤ panel ${medida.derechaPanel})`);

const caja2 = await cons.$eval('.b-insp input', (e) => getComputedStyle(e).boxSizing);
ok(caja2 === 'border-box', 'porque el panel se mide en caja de borde');

console.log('\nPRUEBA 8 — el tema llega también al constructor');

const barra = await cons.evaluate(() => getComputedStyle(document.querySelector('.b-top') || document.body).backgroundColor);
ok(barra === 'rgb(35, 26, 20)', `la barra del constructor va con el tema de fábrica (${barra})`);
const sinGrisFijo = readFileSync(`${ROOT}/krg-cms/admin/assets/css/builder.css`, 'utf8');
ok(!/#eee\b|#fcfcfc|#fafafa/.test(sinGrisFijo), 'y en builder.css no quedan grises escritos a mano que ignoren el tema');

console.log('\nPRUEBA 9 — la barra de arriba, en una sola fila y por grupos');

const fila = await cons.evaluate(() => {
  const top = document.querySelector('.b-top');
  const hijos = [...top.children].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0);
  const filas = new Set(hijos.map((e) => {
    const r = e.getBoundingClientRect();
    return Math.round((r.top + r.bottom) / 2 / 20);
  }));
  const solidos = [...top.querySelectorAll('.m-btn:not(.ghost)')].map((b) => b.id || b.textContent.trim());
  const iconos = [...top.querySelectorAll('.b-ico')];
  return {
    alto: Math.round(top.getBoundingClientRect().height),
    filas: filas.size,
    solidos,
    iconos: iconos.length,
    sinRotulo: iconos.filter((b) => !b.getAttribute('aria-label')).length,
    grupos: top.querySelectorAll('.b-grupo').length,
    acciones: [...top.querySelectorAll('.b-acciones .m-btn')].map((b) => b.id),
    pulsado: [...top.querySelectorAll('.b-bp [data-bp]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.bp),
  };
});
if (process.env.KRG_DEBUG) {
  console.log(await cons.evaluate(() => [...document.querySelector('.b-top').children]
    .map((e) => `${e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}`).join(' | ')));
}
ok(fila.filas === 1, `todo cabe en una fila a 1600 px (${fila.filas} fila${fila.filas === 1 ? '' : 's'})`);
ok(fila.alto <= 60, `y la barra mide lo de una fila: ${fila.alto} px`);
ok(fila.solidos.length === 1 && fila.solidos[0] === 'publish',
  `sólo «Publicar» va relleno, el resto es secundario (${fila.solidos.join(', ') || 'ninguno'})`);
ok(fila.acciones.join(',') === 'save,publish', `guardar y publicar van juntos y apartados (${fila.acciones.join(', ')})`);
ok(fila.grupos === 2 && fila.iconos === 5, `las herramientas van en ${fila.grupos} grupos de iconos (${fila.iconos} iconos)`);
ok(fila.sinRotulo === 0, 'y cada icono dice su nombre para quien no ve el dibujo');
ok(fila.pulsado.join(',') === 'desktop', `el tamaño elegido se anuncia pulsado (${fila.pulsado.join(', ') || 'ninguno'})`);

const mismos = await cons.evaluate(() => {
  const ids = [...document.querySelectorAll('.b-top [id]')].map((e) => e.id);
  return ['undo', 'redo', 'review', 'history', 'refresh', 'save', 'preview', 'publish'].filter((x) => !ids.includes(x));
});
ok(mismos.length === 0, `no se ha perdido ningún mando por el camino (faltan: ${mismos.join(', ') || 'ninguno'})`);

console.log('\nPRUEBA 10 — el buscador de la paleta');

const hayCaja = await cons.$('#b-pal-q');
ok(!!hayCaja, 'la paleta tiene su propio buscador');
const todos = await cons.$$eval('.b-pal-group [data-add], .b-pal-group [data-add-v2]', (b) => b.length);
ok(todos > 50, `con más de cincuenta bloques que buscar (${todos})`);

await cons.fill('#b-pal-q', 'resen');
await cons.waitForTimeout(150);
const busca = await cons.evaluate(() => {
  const sin = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const vistos = [...document.querySelectorAll('.b-pal-group [data-add], .b-pal-group [data-add-v2]')]
    .filter((b) => !b.hidden && b.offsetParent !== null);
  return {
    cuantos: vistos.length,
    todosCasan: vistos.every((b) => sin(`${b.textContent} ${b.title || ''}`).includes('resen')),
    gruposVistos: [...document.querySelectorAll('.b-pal-group')].filter((g) => !g.hidden).length,
    cuenta: (document.querySelector('#b-pal-cuenta') || {}).textContent || '',
  };
});
ok(busca.cuantos > 0 && busca.todosCasan,
  `al escribir «resen» sólo quedan los que casan (${busca.cuantos})`);
ok(busca.gruposVistos >= 1 && busca.gruposVistos < 4, `y los grupos sin aciertos se van (quedan ${busca.gruposVistos})`);
ok(/\d+ bloque/.test(busca.cuenta), `con la cuenta a la vista: «${busca.cuenta}»`);

await cons.fill('#b-pal-q', 'zzzzz');
await cons.waitForTimeout(150);
const vacio = await cons.evaluate(() => ({
  vistos: [...document.querySelectorAll('.b-pal-group [data-add], .b-pal-group [data-add-v2]')].filter((b) => !b.hidden && b.offsetParent !== null).length,
  cuenta: (document.querySelector('#b-pal-cuenta') || {}).textContent || '',
}));
ok(vacio.vistos === 0 && /ninguno/i.test(vacio.cuenta), `si no hay nada, lo dice: «${vacio.cuenta}»`);

await cons.fill('#b-pal-q', '');
await cons.waitForTimeout(150);
const vuelto = await cons.evaluate(() => ({
  vistos: [...document.querySelectorAll('.b-pal-group [data-add], .b-pal-group [data-add-v2]')].filter((b) => !b.hidden).length,
  abiertos: [...document.querySelectorAll('.b-pal-group')].filter((g) => g.classList.contains('is-open')).map((g) => g.dataset.acc),
}));
ok(vuelto.vistos === todos, `al borrar vuelven todos (${vuelto.vistos})`);
ok(!vuelto.abiertos.includes('pal.viejas'), `y los grupos que nacen cerrados siguen cerrados (${vuelto.abiertos.join(', ')})`);

ok(sucio.length === 0, `sin errores de JavaScript${sucio.length ? ` — ${sucio[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await page.screenshot({ path: `${ROOT}/captura-piel.png`, fullPage: true });
  await page.$eval('#skin-zona', (e) => e.scrollIntoView());
  await (await page.$('#skin-zona')).screenshot({ path: `${ROOT}/captura-piel-apartado.png` });
  await pageP.screenshot({ path: `${ROOT}/captura-piel-paginas.png`, fullPage: true });
  await cons.screenshot({ path: `${ROOT}/captura-piel-constructor.png` });
  console.log(`\n  capturas en ${ROOT}/captura-piel*.png`);
}

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas`);
console.log(fallos ? 'HAY FALLOS' : 'EL PANEL REDISEÑADO VA');
process.exit(fallos ? 1 : 0);
