#!/usr/bin/env node
/**
 * El historial y el autoguardado, en el panel de verdad.
 *
 * Dos cosas que sólo se notan el día malo:
 *
 * El historial existía, pero la lista era «2026-10-05 20:47:57 ·
 * autosave ·» catorce veces seguidas: imposible elegir, y restaurar a
 * ciegas da más miedo que perder el trabajo. Ahora cada línea dice
 * cuándo fue en palabras, de dónde salió, quién la hizo y cuánto
 * ocupaba la página; y hay un botón para ver qué cambiaría antes de
 * tocar nada.
 *
 * Y el autoguardado se rendía: si el POST fallaba escribía «Error al
 * guardar» y ahí se quedaba, sin reintentar, con el trabajo sólo en la
 * memoria de la pestaña. Ahora reintenta con esperas crecientes y deja
 * una copia en el navegador que se ofrece al volver a entrar.
 *
 * Qué se comprueba:
 *
 *   1. La lista se lee: fechas en palabras, origen en palabras, autor y
 *      tamaño de cada versión; la primera marcada como la más reciente.
 *   2. «Ver qué cambió» dice qué vuelve, qué desaparece y qué cambia.
 *   3. Restaurar trae la versión al borrador.
 *   4. Si el guardado falla, reintenta y avisa de que lo está haciendo.
 *   5. Y guarda una copia local que, al volver a abrir el panel, se
 *      ofrece recuperar —y recuperarla devuelve el trabajo.
 *   6. Si no hay nada que recuperar, no molesta.
 *
 *   node tools/prueba-historial.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const PHP = `${ROOT}/.tools/php/php`;
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = `${ROOT}/krg-cms/admin/assets/css`;
const REST = 'https://krg.test/wp-json/krg/v1';

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const dir = mkdtempSync(join(tmpdir(), 'krg-hist-'));

function sanear(doc) {
  const archivo = join(dir, 'doc.json');
  writeFileSync(archivo, JSON.stringify(doc));
  return JSON.parse(execFileSync(PHP, [`${ROOT}/tools/sanear.php`, archivo], { encoding: 'utf8' }));
}

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});
const seccion = (id, dentro) =>
  nodo(id, 'section', { width: 'padded' }, [
    nodo(id + '-row', 'row', { gap: 24 }, [nodo(id + '-col', 'column', { span: 12 }, dentro)]),
  ]);

/** Lo que hay ahora mismo en el borrador. */
const actual = () => ({
  id: 1, title: 'Inicio', slug: 'inicio', status: 'draft', checksum: 'c0',
  seo: {}, settings: {},
  sections: [
    seccion('secA', [nodo('t1', 'heading', { text: 'Miel cruda', tag: 'h2' })]),
    seccion('secB', [nodo('t2', 'paragraph', { text: 'Texto de ahora' })]),
  ],
});

/**
 * Una versión vieja: el titular decía otra cosa, el párrafo de la
 * segunda sección todavía no existía y había una sección que luego se
 * borró. Así el «qué cambió» tiene las tres cosas que contar.
 */
const vieja = () => ({
  id: 1, title: 'Inicio', slug: 'inicio', status: 'draft', checksum: 'v',
  seo: {}, settings: {},
  sections: [
    seccion('secA', [nodo('t1', 'heading', { text: 'Miel de azahar', tag: 'h2' })]),
    seccion('secVieja', [nodo('t9', 'paragraph', { text: 'Lo que se borró' })]),
  ],
});

const ahora = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const haceMinutos = (m) => new Date(Date.now() - m * 60000).toISOString().replace('T', ' ').slice(0, 19);

const revisiones = [
  { id: 31, origin: 'publish', author: 'Ana', createdAt: haceMinutos(3), title: 'Inicio', sections: 2, blocks: 8 },
  { id: 30, origin: 'autosave', author: 'Ana', createdAt: haceMinutos(42), title: 'Inicio', sections: 2, blocks: 8 },
  { id: 29, origin: 'manual', author: 'Luis', createdAt: haceMinutos(300), title: 'Inicio', sections: 3, blocks: 14 },
];

let estado = null;
const posts = [];
let fallaElGuardado = 0;   // cuántas veces seguidas tiene que fallar el POST
let restaurada = 0;

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const html = `<!doctype html><meta charset="utf-8"><title>panel</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<link rel="stylesheet" href="file://${CSS}/builder.css">
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;
const file = join(dir, 'panel.html');
writeFileSync(file, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (req.method() === 'POST' && /^\/pages\/1(\/save)?$/.test(url)) {
    if (fallaElGuardado > 0) {
      fallaElGuardado -= 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'caida', message: 'El servidor no responde' }),
      });
    }
    const cuerpo = JSON.parse(req.postData() || '{}');
    posts.push(cuerpo);
    estado = sanear(cuerpo);
    return json({ ...estado, checksum: 'c' + posts.length });
  }
  if (url === '/pages/1/revisions') return json(revisiones);
  if (/^\/pages\/1\/revisions\/\d+$/.test(url)) return json(sanear(vieja()));
  if (/\/restore$/.test(url) && req.method() === 'POST') {
    restaurada += 1;
    estado = sanear(vieja());
    return json(estado);
  }
  if (url === '/pages/1') return json(estado || sanear(actual()));
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

const abrir = async () => {
  await page.goto('file://' + file);
  await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
  await page.waitForTimeout(250);
};

await abrir();

/* ================================================================== */
console.log('\nPRUEBA 1 — el historial se puede leer');
await page.click('#history');
await page.waitForSelector('.b-hist', { timeout: 5000 });
const texto = await page.textContent('.b-hist');
ok(/guardado automático/.test(texto), 'el origen va en palabras, no «autosave»');
ok(/al publicar/.test(texto), 'y «publish» se dice «al publicar»');
ok(/guardado a mano/.test(texto), 'y «manual», «guardado a mano»');
ok(/hace 3 min|hace un momento/.test(texto), 'la fecha se cuenta en palabras («hace 3 min»)');
ok(/Ana/.test(texto) && /Luis/.test(texto), 'con quién hizo cada una');
ok(/14 bloque/.test(texto), 'y cuánto ocupaba la página entonces (14 bloques)');
ok(/la más reciente/.test(texto), 'la primera va marcada como la más reciente');
const lineas = await page.$$eval('.b-hist .b-rev li', (l) => l.length);
ok(lineas === 3, `una línea por versión (${lineas})`);

/* ================================================================== */
console.log('\nPRUEBA 2 — «Ver qué cambió» antes de tocar nada');
await page.click('.b-hist [data-ver="31"]');
await page.waitForSelector('.b-rev-dif:not([hidden])', { timeout: 5000 });
const dif = await page.textContent('.b-rev-dif');
ok(/vuelven\s+\d+\s+bloque/.test(dif), `dice qué vuelve: «${dif.trim().split('\n')[0].trim()}»`);
ok(/desaparecen/.test(dif), 'y qué desaparecería');
ok(/cambian/.test(dif), 'y qué cambia');
ok(/Lo que se borró|Párrafo|Sección/i.test(dif), 'nombrando los bloques, no sólo contándolos');
// Y se pliega otra vez.
await page.click('.b-hist [data-ver="31"]');
await page.waitForTimeout(150);
ok(await page.$eval('.b-rev-dif', (e) => e.hidden), 'y se vuelve a plegar');

/* ================================================================== */
console.log('\nPRUEBA 3 — restaurar');
await page.click('.b-hist [data-rid="31"]');
await page.waitForTimeout(600);
ok(restaurada === 1, 'el panel pide al servidor que la restaure');
ok(!(await page.$('.b-hist')), 'la ventana se cierra sola');
const tituloTras = await page.evaluate(() => {
  const doc = window.KrgBuilderState.doc;
  const busca = (list) => (list || []).reduce((r, n) => r || (n.type === 'heading' ? n.props.text : busca(n.children)), null);
  return busca(doc.sections);
});
ok(tituloTras === 'Miel de azahar', `el borrador pasa a ser el de la versión («${tituloTras}»)`);

/* ================================================================== */
console.log('\nPRUEBA 4 — si el guardado falla, no se rinde');
await page.evaluate(() => localStorage.removeItem('krg-borrador-1'));
fallaElGuardado = 1;
const postsAntes = posts.length;
// Un cambio cualquiera: renombrar la página. El grupo «Configuración de
// página» nace plegado, así que primero se abre, como haría una persona.
await page.click('[data-acc="pagina"] .acc-h');
await page.waitForTimeout(200);
await page.fill('[data-page="title"]', 'Inicio tocado');
await page.waitForTimeout(2200);
const estadoTexto = await page.textContent('.b-status');
ok(/reintentando/i.test(estadoTexto), `avisa de que lo va a reintentar («${estadoTexto.trim()}»)`);
const copia = await page.evaluate(() => localStorage.getItem('krg-borrador-1'));
ok(!!copia, 'y pone a salvo una copia en el navegador');
ok(JSON.parse(copia || '{}').titulo === 'Inicio tocado', 'con lo último que se escribió');

// A los tres segundos lo intenta otra vez y ahora sí entra.
await page.waitForTimeout(4000);
ok(posts.length === postsAntes + 1, `el reintento guarda de verdad (${postsAntes} → ${posts.length})`);
ok(posts[posts.length - 1].title === 'Inicio tocado', 'y guarda lo correcto');
const estado2 = await page.textContent('.b-status');
ok(/Guardado/.test(estado2), `el estado vuelve a la normalidad («${estado2.trim()}»)`);
ok(!(await page.evaluate(() => localStorage.getItem('krg-borrador-1'))),
  'y la copia de emergencia se borra, que ya no hace falta');

/* ================================================================== */
console.log('\nPRUEBA 5 — lo que no llegó a guardarse se ofrece al volver');
// Se simula la pestaña que se cierra con trabajo sin guardar.
await page.evaluate(() => {
  localStorage.setItem('krg-borrador-1', JSON.stringify({
    at: Date.now() - 120000,
    titulo: 'Lo que se perdió',
    sections: window.KrgBuilderState.doc.sections.concat([{
      id: 'secPerdida', type: 'section', name: 'Sección perdida', visible: true,
      source: 'local', globalId: 0, props: {}, styles: { desktop: {}, tablet: {}, mobile: {} },
      children: [],
    }]),
  }));
});
await abrir();
const aviso = await page.textContent('.confirm .box').catch(() => '');
ok(/cambios sin guardar/i.test(aviso), 'al volver a entrar lo dice');
ok(/hace 2 min/.test(aviso), `y de cuándo es («${(aviso.match(/hace [^.]*/) || [''])[0]}»)`);
ok(/3 secciones/.test(aviso) && /ahora mismo, 2/.test(aviso),
  `comparando lo que hay con lo que había («${(aviso.match(/La copia tiene[^.]*/) || [''])[0].replace(/\s+/g, ' ')}»)`);

const secciones = await page.evaluate(() => window.KrgBuilderState.doc.sections.length);
await page.click('.confirm #rec');
await page.waitForTimeout(400);
const despues = await page.evaluate(() => window.KrgBuilderState.doc.sections.length);
ok(despues === secciones + 1, `recuperar devuelve el trabajo (${secciones} → ${despues})`);
ok(await page.evaluate(() => !!document.querySelector('[data-tree="secPerdida"]')),
  'y la sección perdida vuelve al árbol');

/* ================================================================== */
console.log('\nPRUEBA 6 — y si no hay nada que recuperar, no molesta');
await page.waitForTimeout(2500);     // que termine de guardarse
await abrir();
ok(!(await page.$('.confirm')), 'al abrir con todo guardado no sale ninguna ventana');
ok(!(await page.evaluate(() => localStorage.getItem('krg-borrador-1'))), 'y no queda copia suelta');

/* ================================================================== */
console.log('\nPRUEBA 7 — ningún error de JavaScript');
const graves = errores.filter((e) => !/503|caida|no responde/i.test(e));
ok(graves.length === 0, graves.length ? graves.slice(0, 3).join(' | ') : 'ninguno');

await browser.close();

console.log('');
if (fallos) {
  console.log(`HAY ${fallos} FALLOS (${hechas - fallos} comprobaciones correctas)`);
  process.exit(1);
}
console.log(`EL HISTORIAL Y EL AUTOGUARDADO VAN (${hechas} comprobaciones)`);
