#!/usr/bin/env node
/**
 * Buscar: la pantalla de todo el sitio y el filtro del árbol.
 *
 * Son dos buscadores distintos a propósito. El de la pantalla sirve
 * para cambiar el teléfono en veinte páginas de una vez. El del árbol
 * sirve para lo contrario: encontrar un bloque dentro de una página
 * larga sin plegar y desplegar ramas a ciegas.
 *
 * Lo que se comprueba, en un navegador de verdad:
 *
 *   1. Que la pantalla pide lo que se le pide —el texto, si distingue
 *      mayúsculas, si sólo palabras enteras, si mira la cabecera— y no
 *      cambia nada por el hecho de buscar.
 *   2. Que los hallazgos se ven con su contexto, con la palabra
 *      resaltada, y diciendo en qué bloque y en qué campo están.
 *   3. Que se puede desmarcar una página para no tocarla, y que al
 *      reemplazar sólo viajan las marcadas.
 *   4. Que el informe cuenta qué ha pasado y avisa de que hay que
 *      publicar.
 *   5. Que si no hay nada se dice, en vez de dejar la pantalla muda.
 *   6. Y que en el constructor, escribir en el buscador del árbol deja
 *      a la vista los bloques que casan y sus padres, sin perder el
 *      cursor y sin tocar el documento.
 *
 *   node tools/prueba-buscar.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = `${ROOT}/krg-cms/admin/assets/css`;
const PHP = `${ROOT}/.tools/php/php`;
const REST = 'https://krg.test/wp-json/krg/v1';
const dir = mkdtempSync(join(tmpdir(), 'krg-buscar-'));

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

/* =================================================================== */
/* La pantalla de buscar y reemplazar                                  */

const resultado = {
  consulta: '555 12 34 56',
  total: 4,
  paginas: [
    {
      id: 11,
      title: 'Inicio',
      slug: 'inicio',
      hallazgos: [
        { nodeId: 'p1', tipo: 'paragraph', campo: 'text', contexto: 'Llámanos al 555 12 34 56 y te lo guardamos.', veces: 1 },
        { nodeId: 'b1', tipo: 'button', campo: 'text', contexto: 'Llamar al 555 12 34 56', veces: 1 },
        { nodeId: '', tipo: 'seo', campo: 'Descripción SEO', contexto: 'Pide por teléfono al 555 12 34 56.', veces: 1 },
      ],
    },
    {
      id: 12,
      title: 'Contacto',
      slug: 'contacto',
      hallazgos: [
        { nodeId: 'p2', tipo: 'paragraph', campo: 'text', contexto: 'Teléfono: 555 12 34 56. Correo: hola@ejemplo.test', veces: 1 },
      ],
    },
  ],
  chrome: [],
};
const informe = {
  paginas: 1,
  cambios: 3,
  chrome: 0,
  detalle: [{ id: 11, title: 'Inicio', cambios: 3 }],
  avisos: ['Los cambios están en el borrador de cada página: para que se vean en la web hay que publicarlas.'],
};

const busquedas = [];
const reemplazos = [];

const htmlPanel = `<!doctype html><meta charset="utf-8"><title>buscar</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<body class="wp-admin"><div id="krg-admin"></div>
<script>window.KrgAdmin={page:'krg-buscar',view:'',pageId:0,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:true,canEditPages:true,home:'https://destino.test/'};</script>
<script src="file://${JS}/app.js"></script>`;
const archivoPanel = join(dir, 'buscar.html');
writeFileSync(archivoPanel, htmlPanel);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

let vacio = false;
await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url === '/search') {
    const cuerpo = JSON.parse(req.postData() || '{}');
    busquedas.push(cuerpo);
    return json(vacio
      ? { consulta: cuerpo.q, total: 0, paginas: [], chrome: [] }
      : { ...resultado, consulta: cuerpo.q });
  }
  if (url === '/search/replace') {
    reemplazos.push(JSON.parse(req.postData() || '{}'));
    return json(informe);
  }
  return json([]);
});

await page.goto(`file://${archivoPanel}`);
await page.waitForSelector('#bus-ir', { timeout: 15000 });

console.log('PRUEBA 1 — buscar no cambia nada');
await page.fill('#bus-q', '555 12 34 56');
await page.check('#bus-entera');
await page.check('#bus-chrome');
await page.click('#bus-ir');
await page.waitForSelector('#bus-cambiar', { timeout: 8000 });
ok(busquedas.length === 1, 'se pide una búsqueda al servidor');
const b1 = busquedas[0];
ok(b1.q === '555 12 34 56', 'con el texto tal cual');
ok(b1.entera === true && b1.chrome === true && b1.sensible === false,
  `y con las opciones marcadas: ${JSON.stringify({ entera: b1.entera, chrome: b1.chrome, sensible: b1.sensible })}`);
ok(reemplazos.length === 0, 'y buscar no reemplaza nada, que es lo suyo');

console.log('\nPRUEBA 2 — los hallazgos se ven');
const texto = (await page.textContent('#bus-res')) || '';
ok(/4 sitios en 2 páginas/.test(texto), `se dice cuántos y dónde: «${texto.slice(0, 40).trim()}…»`);
ok(/Llámanos al 555 12 34 56/.test(texto), 'con la frase entera alrededor');
const marcas = await page.$$eval('#bus-res mark', (els) => els.map((e) => e.textContent));
ok(marcas.length >= 4 && marcas.every((m) => m === '555 12 34 56'), `y lo buscado resaltado (${marcas.length} veces)`);
const campos = await page.$$eval('#bus-res .m-busca-lista code', (els) => els.map((e) => e.textContent.trim()));
ok(campos.some((c) => /paragraph · text/.test(c)), `diciendo bloque y campo: «${campos[0]}»`);
ok(campos.some((c) => /seo · Descripción SEO/.test(c)), 'incluido lo que está en el SEO');
const abrir = await page.$$eval('#bus-res .m-busca-ir', (els) => els.map((e) => e.getAttribute('href')));
ok(abrir.length === 3 && abrir[0].includes('page=krg-builder&id=11'),
  'los que son de un bloque traen enlace para abrirlo; el del SEO, no');

console.log('\nPRUEBA 3 — reemplazar sólo en lo marcado');
await page.fill('#bus-por', '600 98 76 54');
await page.uncheck('[data-bus-pag="12"]');
await page.click('#bus-cambiar');
await page.waitForSelector('#bus-informe:not([hidden])', { timeout: 8000 });
ok(reemplazos.length === 1, 'se manda un solo reemplazo');
const r1 = reemplazos[0];
ok(r1.por === '600 98 76 54', 'con el texto nuevo');
ok(JSON.stringify(r1.paginas) === '[11]', `y sólo con la página marcada: ${JSON.stringify(r1.paginas)}`);
ok(r1.entera === true, 'manteniendo las mismas opciones con las que se buscó');

console.log('\nPRUEBA 4 — el informe');
const inf = (await page.textContent('#bus-informe')) || '';
ok(/3 cambios en 1 página/.test(inf), `cuenta lo que ha pasado: «${inf.split('\n').map((l) => l.trim()).filter(Boolean)[1]}»`);
ok(/Inicio — 3 cambios/.test(inf), 'y en qué página, una por una');
ok(/hay que publicarlas/.test(inf), 'avisando de que esto queda en el borrador');

console.log('\nPRUEBA 5 — cuando no hay nada');
vacio = true;
await page.fill('#bus-q', 'patatas');
await page.click('#bus-ir');
await page.waitForFunction(() => /No aparece/.test(document.querySelector('#bus-res').textContent), null, { timeout: 8000 });
ok(/No aparece «patatas»/.test((await page.textContent('#bus-res')) || ''), 'se dice, en vez de quedarse muda');
ok(!(await page.$('#bus-cambiar')), 'y no se ofrece reemplazar lo que no existe');
ok(errores.length === 0, `sin errores de JavaScript${errores.length ? ` — ${errores[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  vacio = false;
  await page.fill('#bus-q', '555 12 34 56');
  await page.click('#bus-ir');
  await page.waitForSelector('#bus-cambiar', { timeout: 8000 });
  await page.screenshot({ path: `${ROOT}/captura-buscar.png`, fullPage: true });
}
await page.close();

/* =================================================================== */
/* El filtro del árbol, en el constructor                              */

console.log('\nPRUEBA 6 — buscar dentro de una página larga');

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});
const doc = {
  id: 1, title: 'Carta', slug: 'carta', status: 'draft', checksum: 'c0',
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [
    nodo('sec1', 'section', { width: 'padded' }, [
      nodo('row1', 'row', { gap: 24 }, [
        nodo('col1', 'column', { span: 12 }, [
          nodo('t1', 'heading', { text: 'Tarros de miel', tag: 'h1' }),
          nodo('p1', 'paragraph', { text: 'Llámanos al 555 12 34 56.' }),
        ]),
      ]),
    ]),
    nodo('sec2', 'section', { width: 'padded' }, [
      nodo('row2', 'row', { gap: 24 }, [
        nodo('col2', 'column', { span: 12 }, [
          nodo('t2', 'heading', { text: 'Dónde estamos', tag: 'h2' }),
          nodo('p2', 'paragraph', { text: 'En el valle, desde 1974.' }),
        ]),
      ]),
    ]),
  ],
};

const htmlBuilder = `<!doctype html><meta charset="utf-8"><title>constructor</title>
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
const archivoBuilder = join(dir, 'constructor.html');
writeFileSync(archivoBuilder, htmlBuilder);

const cons = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const sucio = [];
cons.on('pageerror', (e) => sucio.push(String(e)));
cons.on('console', (m) => { if (m.type() === 'error') sucio.push(m.text()); });
const guardados = [];
await cons.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await cons.route('**/krg.test/**', async (route) => {
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
await cons.goto(`file://${archivoBuilder}`);
await cons.waitForSelector('#b-tree-q', { timeout: 15000 });

const visibles = () => cons.$$eval('.b-tree .sec[data-tree]', (els) => els
  .filter((e) => e.offsetParent !== null)
  .map((e) => e.getAttribute('data-tree')));

const antes = await visibles();
ok(antes.length >= 6, `sin filtro se ve el árbol entero (${antes.length} bloques)`);

await cons.fill('#b-tree-q', 'valle');
await cons.waitForTimeout(250);
const despues = await visibles();
ok(despues.includes('p2'), 'escribiendo «valle» queda el párrafo que lo dice');
ok(despues.includes('sec2') && despues.includes('col2'),
  'y sus padres, para saber dónde está');
ok(!despues.includes('p1') && !despues.includes('sec1'),
  `lo que no casa se quita de en medio (quedan ${despues.length})`);
ok(await cons.isVisible('.b-tree .sec[data-tree="p2"].is-hit'), 'el que casa va señalado');
const cuenta = (await cons.textContent('#b-tree-cuenta')) || '';
ok(/1 de \d+/.test(cuenta), `y se dice cuántos de cuántos: «${cuenta}»`);

ok(await cons.evaluate(() => document.activeElement && document.activeElement.id === 'b-tree-q'),
  'el cursor sigue en la caja: se puede seguir escribiendo');
ok(guardados.length === 0, 'y buscar no guarda nada: esto no toca el documento');

await cons.fill('#b-tree-q', 'heading');
await cons.waitForTimeout(250);
const porTipo = await visibles();
ok(porTipo.includes('t1') && porTipo.includes('t2'), 'también se busca por el tipo de bloque');

await cons.fill('#b-tree-q', 'zzzz');
await cons.waitForTimeout(250);
ok(((await cons.textContent('#b-tree-cuenta')) || '').trim() === 'nada', 'y si no hay nada, lo dice');

await cons.press('#b-tree-q', 'Escape');
await cons.waitForTimeout(250);
const vuelta = await visibles();
ok(vuelta.length === antes.length, 'con Escape vuelve el árbol entero');
ok(sucio.length === 0, `sin errores de JavaScript${sucio.length ? ` — ${sucio[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await cons.fill('#b-tree-q', 'valle');
  await cons.waitForTimeout(250);
  await cons.evaluate(() => document.querySelector('#b-tree-q').scrollIntoView({ block: 'center' }));
  await cons.waitForTimeout(150);
  await cons.screenshot({ path: `${ROOT}/captura-arbol.png` });
  console.log(`\n  capturas en ${ROOT}/captura-buscar.png y ${ROOT}/captura-arbol.png`);
}

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas`);
console.log(fallos ? 'HAY QUE ARREGLARLO' : 'BUSCAR VA EN LAS DOS PANTALLAS');
process.exit(fallos ? 1 : 0);
