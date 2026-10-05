#!/usr/bin/env node
/**
 * Plantillas de página enteras.
 *
 * Qué faltaba: el catálogo V.2 resuelve un trozo de página, pero
 * delante de un lienzo en blanco lo que cuesta es decidir el orden —qué
 * va arriba, qué después y con qué se cierra—. Una plantilla de página
 * pone esa decisión ya tomada: varias secciones, en orden, de golpe.
 *
 * Lo que se comprueba:
 *
 *   1. Que el catálogo de plantillas no miente: todas las secciones que
 *      nombra existen en el catálogo V.2. Si un día se renombra una
 *      ficha, esto lo canta antes de que alguien se encuentre media
 *      plantilla.
 *   2. Que cada plantilla se monta entera, con todos sus bloques, con
 *      identificadores distintos, y que el servidor la pinta sin un
 *      solo aviso de PHP.
 *   3. Que desde el constructor se puede poner una plantilla al final o
 *      reemplazar la página con ella —preguntando antes, que es lo
 *      único de aquí que borra algo— y que lo que entra llega al
 *      servidor.
 *   4. Que una página se puede guardar como plantilla y volver a
 *      ponerla en otra, con sus secciones enteras.
 *   5. Que la plantilla elegida en «Nueva página» se monta al abrir el
 *      constructor, y que NO se monta si la página ya tiene algo: una
 *      dirección que se recarga no puede duplicar la plantilla ni pisar
 *      el trabajo de nadie.
 *
 *   node tools/prueba-plantillas.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const PHP = `${ROOT}/.tools/php/php`;
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = `${ROOT}/krg-cms/admin/assets/css`;
const REST = 'https://krg.test/wp-json/krg/v1';

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const porSlug = new Map(registry.map((c) => [c.slug, c]));
const dir = mkdtempSync(join(tmpdir(), 'krg-plantillas-'));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

/* ------------------------------------------------------------------ */
/* Los dos catálogos, cargados como los carga el navegador              */

const dict = (obj, key) => {
  const v = obj[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  obj[key] = {};
  return obj[key];
};
const ventana = {
  KrgBuilderCore: {
    dict,
    styleBucket: (node, bp) => dict(dict(node, 'styles'), bp),
  },
};
new Function('window', readFileSync(`${JS}/builder-v2.js`, 'utf8'))(ventana);
new Function('window', readFileSync(`${JS}/builder-paginas.js`, 'utf8'))(ventana);

let semilla = 0;
const makeNode = (type) => {
  const def = porSlug.get(type);
  semilla += 1;
  return {
    id: `p_${String(semilla).padStart(4, '0')}`,
    type,
    name: def ? def.name : type,
    visible: true,
    source: 'local',
    globalId: 0,
    props: JSON.parse(JSON.stringify((def && def.defaults) || {})),
    styles: { desktop: {}, tablet: {}, mobile: {} },
    children: [],
  };
};

console.log('PRUEBA 1 — el catálogo de plantillas no promete lo que no hay');
const P = ventana.KrgPaginas;
ok(!!P && typeof P.list === 'function' && typeof P.build === 'function',
  'builder-paginas.js expone KrgPaginas.list(), get() y build()');
const fichas = P.list();
ok(fichas.length >= 6, `hay ${fichas.length} plantillas de página`);

const v2 = new Set(ventana.KrgV2.list().map((x) => x.slug));
const sueltas = new Set(ventana.KrgV2.list().filter((x) => x.grupo === 'pieza').map((x) => x.slug));
const slugsRepetidos = fichas.filter((f, i) => fichas.findIndex((x) => x.slug === f.slug) !== i);
ok(slugsRepetidos.length === 0, 'ninguna plantilla repite nombre interno');
fichas.forEach((f) => {
  const faltan = f.secciones.filter((s) => !v2.has(s));
  ok(faltan.length === 0,
    `«${f.name}»: sus ${f.secciones.length} secciones existen en el catálogo V.2${faltan.length ? ` — faltan ${faltan.join(', ')}` : ''}`);
});
const conNota = fichas.filter((f) => (f.nota || '').length > 20).length;
ok(conNota === fichas.length, `las ${fichas.length} explican en una línea para qué sirven`);
// Las piezas sueltas son bloques, no páginas: una plantilla hecha de
// piezas sueltas no monta una página, monta un montón de cajas vacías.
const deJuguete = fichas.filter((f) => f.secciones.length > 1 && f.secciones.every((s) => sueltas.has(s)));
ok(deJuguete.length === 0, 'ninguna plantilla larga se arma sólo con piezas sueltas');

console.log('\nPRUEBA 2 — cada plantilla se monta entera y el servidor la pinta');
const ids = (nodos, out = []) => {
  (nodos || []).forEach((n) => { out.push(n.id); ids(n.children, out); });
  return out;
};
for (const f of fichas) {
  const secs = P.build(f.slug, makeNode);
  ok(secs.length === f.secciones.length,
    `«${f.name}»: monta sus ${f.secciones.length} secciones (${secs.length})`);
  const todos = ids(secs);
  ok(new Set(todos).size === todos.length,
    `    sus ${todos.length} bloques tienen identificadores distintos`);
  ok(secs.every((s) => s.type === 'section'),
    '    y todas las de primer nivel son secciones');

  const doc = {
    id: 1, title: f.name, slug: 'tpl', status: 'publish', seo: {}, settings: {},
    sections: JSON.parse(JSON.stringify(secs)),
  };
  const ruta = join(dir, `${f.slug}.json`);
  writeFileSync(ruta, JSON.stringify(doc));
  let html = '';
  let error = '';
  try {
    html = execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, ruta], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, KRG_ENTRADAS: '3', KRG_CATEGORIAS: '5' },
    });
  } catch (e) {
    error = String(e.stderr || e.message).slice(0, 200);
  }
  const aviso = html.match(/(?:^|\n|<b>)\s*(Warning|Notice|Fatal error|Parse error|Deprecated|Uncaught [A-Za-z]+)\s*:/);
  ok(!error && !aviso, `    el servidor la pinta sin avisos${error ? ` — ${error}` : ''}${aviso ? ` — ${aviso[1]}` : ''}`);
  const pintadas = (html.match(/m-c-section/g) || []).length;
  ok(pintadas >= secs.length, `    y salen sus ${secs.length} secciones en la web (${pintadas})`);
}

/* ------------------------------------------------------------------ */
/* El panel de verdad, con la API simulada con estado                   */

const sanear = (doc) => {
  const archivo = join(dir, 'doc.json');
  writeFileSync(archivo, JSON.stringify(doc));
  return JSON.parse(execFileSync(PHP, [`${ROOT}/tools/sanear.php`, archivo], { encoding: 'utf8' }));
};

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});
const seccion = (id, dentro) =>
  nodo(id, 'section', { width: 'padded', minHeight: 'auto' }, [
    nodo(`${id}-row`, 'row', { gap: 24 }, [nodo(`${id}-col`, 'column', { span: 12 }, dentro)]),
  ]);

const paginaConAlgo = () => ({
  id: 1, title: 'Con trabajo dentro', slug: 'uno', status: 'draft', checksum: 'c0',
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [seccion('secMia', [nodo('p1', 'paragraph', { text: 'Esto lo escribí yo.' })])],
});
const paginaVacia = (id, titulo, slug) => ({
  id, title: titulo, slug, status: 'draft', checksum: `d${id}`,
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [],
});

const estado = { 1: null, 2: null, 3: null };
const posts = { 1: [], 2: [], 3: [] };
let plantillas = [];
const postTpl = [];

const paginaHtml = (pid, tpl = '') => `<!doctype html><meta charset="utf-8"><title>panel ${pid}</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<link rel="stylesheet" href="file://${CSS}/builder.css">
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:${pid},rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',tpl:${JSON.stringify(tpl)}};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-paginas.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;

const f1 = join(dir, 'panel1.html');
const f2 = join(dir, 'panel2.html');
// La tercera página nace vacía y se abre ya con una plantilla elegida,
// como la deja «Nueva página»; la primera se abre igual pero con
// trabajo dentro, que es el caso en el que no debe tocar nada.
const f3tpl = join(dir, 'panel3-tpl.html');
const f1tpl = join(dir, 'panel1-tpl.html');
writeFileSync(f1, paginaHtml(1));
writeFileSync(f2, paginaHtml(2));
writeFileSync(f3tpl, paginaHtml(3, 'contacto'));
writeFileSync(f1tpl, paginaHtml(1, 'contacto'));

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
// El nombre de la plantilla se pide con `prompt`, como el del resto de
// la casa; aquí se contesta siempre lo mismo.
page.on('dialog', (d) => d.accept('Mi página tipo'));

await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  const guardar = url.match(/^\/pages\/(\d)(\/save)?$/);
  if (req.method() === 'POST' && guardar) {
    const pid = Number(guardar[1]);
    const cuerpo = JSON.parse(req.postData() || '{}');
    posts[pid].push(cuerpo);
    estado[pid] = sanear(cuerpo);
    return json({ ...estado[pid], checksum: `c${posts[pid].length}` });
  }
  if (req.method() === 'POST' && url === '/templates') {
    // El servidor de verdad sanea y devuelve la plantilla con su clase;
    // aquí se hace lo mismo con el saneador de verdad.
    const cuerpo = JSON.parse(req.postData() || '{}');
    postTpl.push(cuerpo);
    const limpio = sanear({ id: 9, title: 't', slug: 't', seo: {}, settings: {}, sections: cuerpo.sections || [] });
    const ficha = {
      id: 500 + plantillas.length,
      name: cuerpo.name,
      kind: (cuerpo.sections || []).length ? 'page' : 'node',
      node: cuerpo.node || null,
      sections: limpio.sections || [],
    };
    plantillas = plantillas.concat([ficha]);
    return json(ficha);
  }
  if (url === '/pages/1') return json(estado[1] || sanear(paginaConAlgo()));
  if (url === '/pages/2') return json(estado[2] || sanear(paginaVacia(2, 'Recién creada', 'dos')));
  if (url === '/pages/3') return json(estado[3] || sanear(paginaVacia(3, 'Recién creada también', 'tres')));
  if (url === '/registry') return json(registry);
  if (url === '/templates') return json(plantillas);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

const abrir = async (archivo) => {
  await page.goto(`file://${archivo}`);
  await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
  await page.waitForTimeout(250);
};
const esperarPost = async (pid, n) => {
  const t0 = Date.now();
  while (posts[pid].length < n && Date.now() - t0 < 8000) await page.waitForTimeout(100);
  return posts[pid].length >= n;
};
const ultimo = (pid) => posts[pid][posts[pid].length - 1];
const secciones = () => page.$$eval('.b-left [data-tree]', (els) => els.length);

console.log('\nPRUEBA 3 — poner una plantilla desde el constructor');
await abrir(f1);
ok(await page.isVisible('#open-pagtpl'), 'el botón «Plantillas de página» está en la columna de la izquierda');
await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });
// Con KRG_SHOT=1 deja una foto del diálogo, para el informe.
if (process.env.KRG_SHOT) await page.screenshot({ path: `${ROOT}/captura-plantillas.png` });
const enDialogo = await page.$$eval('.b-pagtpl [data-ptpl-add]', (b) => b.length);
ok(enDialogo === fichas.length, `el diálogo ofrece las ${fichas.length} del catálogo (${enDialogo})`);
ok(/Ninguna todavía/.test(await page.textContent('.b-pagtpl')), 'y dice que no hay ninguna guardada todavía');

const antes = await secciones();
await page.click('.b-pagtpl [data-ptpl-add="c:contacto"]');
await page.waitForTimeout(300);
ok(!(await page.isVisible('.b-pagtpl')), 'al elegir una, el diálogo se cierra');
ok(await esperarPost(1, 1), 'poner la plantilla dispara el guardado');
const doc1 = ultimo(1);
const fichaContacto = P.get('contacto');
ok((doc1.sections || []).length === 1 + fichaContacto.secciones.length,
  `«Contacto» añade sus ${fichaContacto.secciones.length} secciones detrás de la que ya había (${(doc1.sections || []).length})`);
ok((doc1.sections || [])[0]?.id === 'secMia', 'lo que ya estaba escrito sigue el primero, intacto');
const textosMios = JSON.stringify(doc1).includes('Esto lo escribí yo.');
ok(textosMios, 'y con su texto');
ok((await secciones()) > antes, 'el árbol del panel enseña las secciones nuevas');

console.log('\nPRUEBA 4 — reemplazar la página pregunta antes');
await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });
await page.click('.b-pagtpl [data-ptpl-set="c:blog"]');
await page.waitForTimeout(250);
const preguntando = await page.textContent('.confirm .box');
ok(/Reemplazar la página/.test(preguntando || ''), 'sale el aviso antes de quitar nada');
const nPosts = posts[1].length;
await page.click('.confirm .box #no');
await page.waitForTimeout(400);
ok(posts[1].length === nPosts, 'si se cancela, no se guarda nada');
ok(JSON.stringify(ultimo(1)).includes('Esto lo escribí yo.'), 'y la página sigue como estaba');

await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });
await page.click('.b-pagtpl [data-ptpl-set="c:blog"]');
await page.waitForTimeout(250);
await page.click('.confirm .box #si');
ok(await esperarPost(1, nPosts + 1), 'al confirmar, se guarda');
const doc2 = ultimo(1);
ok((doc2.sections || []).length === P.get('blog').secciones.length,
  `la página pasa a tener sólo las ${P.get('blog').secciones.length} de «Índice del blog» (${(doc2.sections || []).length})`);
ok(!JSON.stringify(doc2).includes('Esto lo escribí yo.'), 'lo anterior ya no está');
const deshacer = await page.isVisible('#undo');
ok(deshacer, 'y Ctrl+Z sigue disponible para volver atrás');

console.log('\nPRUEBA 5 — guardar esta página como plantilla y ponerla en otra');
await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });
await page.click('#ptpl-save');
await page.waitForTimeout(600);
ok(postTpl.length === 1, 'se manda al servidor una plantilla');
ok((postTpl[0]?.sections || []).length === (doc2.sections || []).length,
  `con las ${(doc2.sections || []).length} secciones de la página (${(postTpl[0]?.sections || []).length})`);
ok(postTpl[0]?.name === 'Mi página tipo', `y con el nombre que se escribió («${postTpl[0]?.name}»)`);
ok(!postTpl[0]?.node, 'sin bloque suelto: es una página, no una sección');
ok(/Mi página tipo/.test((await page.textContent('.b-pagtpl')) || ''),
  'y el diálogo se vuelve a abrir con ella en «Guardadas»');

const guardadaId = `g:${plantillas[0].id}`;
await abrir(f2);
ok((await secciones()) === 0, 'la segunda página está vacía');
await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });
ok(await page.isVisible(`[data-ptpl-add="${guardadaId}"]`), 'la plantilla guardada se ofrece también en la otra página');
await page.click(`[data-ptpl-add="${guardadaId}"]`);
ok(await esperarPost(2, 1), 'ponerla guarda la segunda página');
const doc3 = ultimo(2);
ok((doc3.sections || []).length === plantillas[0].sections.length,
  `llegan sus ${plantillas[0].sections.length} secciones (${(doc3.sections || []).length})`);
const idsNuevos = ids(doc3.sections || []);
const idsViejos = ids(plantillas[0].sections);
ok(!idsNuevos.some((x) => idsViejos.includes(x)),
  'con identificadores nuevos: el CSS de una página no pinta en la otra');

console.log('\nPRUEBA 6 — la plantilla elegida al crear la página');
await abrir(f3tpl);
ok(await esperarPost(3, 1), 'al abrir una página vacía con ?tpl= se monta y se guarda');
const doc4 = ultimo(3);
ok((doc4.sections || []).length === fichaContacto.secciones.length,
  `con las ${fichaContacto.secciones.length} secciones de «Contacto» (${(doc4.sections || []).length})`);
// Que coincida el número no basta: cuatro secciones las tiene cualquiera.
ok(JSON.stringify(doc4).includes('"type":"map"') && JSON.stringify(doc4).includes('"type":"contact-form"'),
  'y son las de «Contacto» de verdad: el mapa y el formulario están dentro');
const url = page.url();
ok(!/tpl=/.test(url), 'y la dirección se queda sin el ?tpl=, para que recargar no la vuelva a poner');

const nAntes = posts[1].length;
await abrir(f1tpl);
await page.waitForTimeout(900);
ok(posts[1].length === nAntes, 'en una página que ya tiene secciones, el ?tpl= no toca nada');

ok(errores.length === 0, `sin errores de JavaScript en el panel${errores.length ? ` — ${errores[0]}` : ''}`);

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
if (!fallos) console.log('LAS PLANTILLAS DE PÁGINA VAN');
process.exit(fallos ? 1 : 0);
