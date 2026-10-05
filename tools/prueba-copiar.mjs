#!/usr/bin/env node
/**
 * Copiar y pegar bloques, y copiar y pegar sólo el aspecto.
 *
 * Qué faltaba: «Duplicar» repite algo donde ya está, y punto. Para
 * repetir una sección en otra página había que montarla otra vez a
 * mano, bloque a bloque, y para que dos bloques se vieran igual había
 * que copiar a ojo el fondo, el relleno, el borde y la tipografía. Dos
 * de las cosas que más tiempo comen de todo el constructor.
 *
 * Lo que se comprueba, con el panel de verdad en un navegador y la API
 * simulada con estado (todo lo que se guarda pasa por `sanear.php`,
 * igual que en una instalación):
 *
 *   1. Copiar un bloque y pegarlo: aparece en el árbol, con su propio
 *      identificador, con todo lo que llevaba dentro, y llega así al
 *      servidor.
 *   2. Pegar no se inventa el sitio: una sección cae detrás de la
 *      sección donde estés, un bloque suelto justo debajo del elegido,
 *      y una columna fuera de una fila se rechaza con su aviso.
 *   3. Cortar se lo lleva de verdad.
 *   4. Copiar estilo y pegarlo: el destino se ve como el origen sin
 *      que su texto cambie.
 *   5. Sobrevive al guardado y a recargar el panel.
 *   6. **Y a cambiar de página**, que es lo que de verdad se pedía: lo
 *      copiado en la página 1 se pega en la 2.
 *   7. Los atajos de teclado, y que dentro de una casilla de texto
 *      Ctrl+C siga copiando letras y no bloques.
 *   8. Y en la web pública se ve: el bloque pegado sale dos veces y el
 *      estilo pegado se pinta.
 *
 *   node tools/prueba-copiar.mjs
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

const dir = mkdtempSync(join(tmpdir(), 'krg-copiar-'));

/** Pasa un documento por el saneador de verdad, como hace la API. */
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
  nodo(id, 'section', { width: 'padded', minHeight: 'auto' }, [
    nodo(id + '-row', 'row', { gap: 24 }, [nodo(id + '-col', 'column', { span: 12 }, dentro)]),
  ]);

/** Página 1: una sección con titular y párrafo, y otra con un botón. */
const pagina1 = () => ({
  id: 1, title: 'Primera', slug: 'primera', status: 'draft', checksum: 'c0',
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [
    seccion('secUno', [
      nodo('h1', 'heading', { text: 'Miel de azahar', tag: 'h2' }),
      nodo('p1', 'paragraph', { text: 'Recogida en primavera.' }),
    ]),
    seccion('secDos', [nodo('b1', 'button', { text: 'Comprar', url: '/tienda' })]),
  ],
});

/** Página 2: vacía de contenido, para pegar en ella lo de la 1. */
const pagina2 = () => ({
  id: 2, title: 'Segunda', slug: 'segunda', status: 'draft', checksum: 'd0',
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [seccion('secOtra', [nodo('p9', 'paragraph', { text: 'Página dos.' })])],
});

const estado = { 1: null, 2: null };
const posts = { 1: [], 2: [] };

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const paginaHtml = (pid) => `<!doctype html><meta charset="utf-8"><title>panel ${pid}</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<link rel="stylesheet" href="file://${CSS}/builder.css">
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:${pid},rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;

const f1 = join(dir, 'panel1.html');
const f2 = join(dir, 'panel2.html');
writeFileSync(f1, paginaHtml(1));
writeFileSync(f2, paginaHtml(2));

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
page.on('dialog', (d) => d.accept());

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
    return json({ ...estado[pid], checksum: 'c' + posts[pid].length });
  }
  if (url === '/pages/1') return json(estado[1] || sanear(pagina1()));
  if (url === '/pages/2') return json(estado[2] || sanear(pagina2()));
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

async function abrir(archivo) {
  await page.goto('file://' + archivo);
  await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
}

/** Selecciona un nodo pulsando su nombre en el árbol, como una persona. */
async function seleccionar(nid) {
  await page.click(`[data-sel="${nid}"]`);
  await page.waitForTimeout(120);
}

/** Pulsa uno de los botones del portapapeles del inspector. */
async function porta(accion) {
  const sel = `.b-insp [data-porta="${accion}"]`;
  await page.waitForSelector(sel, { timeout: 5000 });
  await page.click(sel);
  await page.waitForTimeout(150);
}

const esperarPost = async (pid, n) => {
  const t0 = Date.now();
  while (posts[pid].length < n && Date.now() - t0 < 8000) await page.waitForTimeout(100);
  return posts[pid].length >= n;
};

const buscar = (doc, pred) => {
  const salida = [];
  const walk = (list) => (list || []).forEach((n) => { if (pred(n)) salida.push(n); walk(n.children); });
  walk(doc.sections);
  return salida;
};
const ultimo = (pid) => posts[pid][posts[pid].length - 1];
/** Cuántas veces aparece ese texto en el último documento guardado. */
const cuantos = (pid, texto) => buscar(ultimo(pid), (n) => n.props?.text === texto).length;
/** Borra los avisos en pantalla: si no, se lee el de la acción anterior. */
const limpiarAvisos = () => page.evaluate(() => document.querySelectorAll('.m-toast').forEach((t) => t.remove()));
const ultimoAviso = () => page.evaluate(() => {
  const t = [...document.querySelectorAll('.m-toast')].pop();
  return t ? t.textContent : '';
});
const arbol = () => page.$$eval('[data-tree]', (els) => els.map((e) => e.getAttribute('data-tree')));

/* ================================================================== */
console.log('\nPRUEBA 1 — copiar una sección entera y pegarla');
await abrir(f1);
const antes = await arbol();
await seleccionar('secUno');
await porta('copiar');

const chip = await page.textContent('.b-porta-bar');
ok(/bloque «/.test(chip || ''), `el árbol avisa de lo que llevas: «${(chip || '').trim().replace(/\s+/g, ' ')}»`);

await porta('pegar');
const despues = await arbol();
// La sección copiada son cinco nodos: ella, su fila, su columna, el
// titular y el párrafo.
ok(despues.length === antes.length + 5, `el árbol crece con la sección y sus cuatro piezas (${antes.length} → ${despues.length})`);

ok(await esperarPost(1, 1), 'pegar dispara el guardado automático');
let doc1 = ultimo(1);
const titulares = buscar(doc1, (n) => n.type === 'heading' && n.props?.text === 'Miel de azahar');
ok(titulares.length === 2, `el titular viaja dos veces al servidor (${titulares.length})`);
ok(titulares.length === 2 && titulares[0].id !== titulares[1].id,
  `y cada copia con su propio identificador (${titulares.map((t) => t.id).join(' / ')})`);
const secciones = (doc1.sections || []).map((s) => s.id);
ok(secciones.length === 3 && secciones[1] !== 'secDos',
  `la sección pegada cae detrás de la copiada, no al final (${secciones.join(', ')})`);

/* ================================================================== */
console.log('\nPRUEBA 2 — un bloque suelto se pega justo debajo del elegido');
await seleccionar('b1');
await porta('copiar');
await porta('pegar');
ok(await esperarPost(1, posts[1].length + 1), 'se guarda');
doc1 = ultimo(1);
const colBoton = buscar(doc1, (n) => n.id === 'secDos-col')[0];
const hijos = (colBoton?.children || []).map((c) => c.type);
ok(hijos.length === 2 && hijos.every((t) => t === 'button'),
  `la columna del botón acaba con dos botones (${hijos.join(', ')})`);

/* ================================================================== */
console.log('\nPRUEBA 3 — una columna no se pega donde no cabe');
await seleccionar('secUno-col');
await porta('copiar');
await seleccionar('secUno');   // una sección no es una fila
const nPosts = posts[1].length;
await limpiarAvisos();
await porta('pegar');
await page.waitForTimeout(400);
const aviso = await ultimoAviso();
ok(/fila/i.test(aviso || ''), `avisa en vez de colarla: «${(aviso || '').trim()}»`);
ok(posts[1].length === nPosts, 'y no toca el documento');

// Pero dentro de una fila sí entra.
await seleccionar('secUno-row');
await porta('pegar');
ok(await esperarPost(1, nPosts + 1), 'dentro de una fila sí se pega');
doc1 = ultimo(1);
const filaUno = buscar(doc1, (n) => n.id === 'secUno-row')[0];
ok((filaUno?.children || []).length === 2, `la fila pasa a tener dos columnas (${(filaUno?.children || []).length})`);

/* ================================================================== */
console.log('\nPRUEBA 4 — cortar se lo lleva');
const idsAntes = (await arbol()).length;
const parrafosAntes = cuantos(1, 'Recogida en primavera.');
await seleccionar('p1');
await porta('cortar');
await page.waitForTimeout(200);
const idsDespues = (await arbol()).length;
ok(idsDespues === idsAntes - 1, `el párrafo desaparece del árbol (${idsAntes} → ${idsDespues})`);
ok(await esperarPost(1, posts[1].length + 1), 'y se guarda sin él');
doc1 = ultimo(1);
ok(buscar(doc1, (n) => n.id === 'p1').length === 0, 'el servidor ya no lo recibe');
ok(cuantos(1, 'Recogida en primavera.') === parrafosAntes - 1,
  `queda uno menos de ese párrafo (${parrafosAntes} → ${cuantos(1, 'Recogida en primavera.')})`);

// Y lo cortado se puede pegar en otro sitio: no se pierde.
await seleccionar('secDos-col');
await porta('pegar');
ok(await esperarPost(1, posts[1].length + 1), 'lo cortado se pega en otra columna');
ok(cuantos(1, 'Recogida en primavera.') === parrafosAntes,
  `y vuelve a haber los mismos de antes de cortarlo (${parrafosAntes})`);

/* ================================================================== */
console.log('\nPRUEBA 5 — copiar el aspecto, no el contenido');
await seleccionar('secDos');
await page.click('[data-insp-tab="design"]');
await page.waitForTimeout(120);
await page.evaluate(() => {
  document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
});
await page.waitForTimeout(100);
await page.fill('.b-insp [data-style="background-color"]', '#D94E27');
await page.waitForTimeout(100);
await page.fill('.b-insp [data-side="padding-top"]', '64');
await page.waitForTimeout(100);
ok(await esperarPost(1, posts[1].length + 1), 'se guardan el fondo y el relleno del origen');

await porta('copiar-estilo');
const chip2 = await page.textContent('.b-porta-bar');
ok(/estilo de/.test(chip2 || ''), `el árbol dice que llevas un estilo en la mano: «${(chip2 || '').trim().replace(/\s+/g, ' ')}»`);

await seleccionar('secUno');
await porta('pegar-estilo');
ok(await esperarPost(1, posts[1].length + 1), 'pegar el estilo dispara el guardado');
doc1 = ultimo(1);
const destino = buscar(doc1, (n) => n.id === 'secUno')[0];
ok(String(destino?.styles?.desktop?.['background-color']).toLowerCase() === '#d94e27',
  `el destino recibe el fondo (${destino?.styles?.desktop?.['background-color']})`);
ok(destino?.styles?.desktop?.['padding-top'] === '64px',
  `y el relleno (${destino?.styles?.desktop?.['padding-top']})`);
const titularSigue = buscar(doc1, (n) => n.id === 'h1')[0];
ok(titularSigue?.props?.text === 'Miel de azahar', 'y el contenido del destino no se toca');

/* ================================================================== */
console.log('\nPRUEBA 6 — sobrevive a recargar el panel');
await abrir(f1);
const chip3 = await page.textContent('.b-porta-bar').catch(() => '');
ok(/estilo de/.test(chip3 || '') && /bloque «/.test(chip3 || ''),
  'al volver a entrar, el portapapeles sigue lleno');
const enServidor = buscar(estado[1], (n) => n.type === 'heading' && n.props?.text === 'Miel de azahar').length;
ok(enServidor >= 2, `y lo pegado sigue en el documento que devuelve el servidor (${enServidor} titulares)`);

/* ================================================================== */
console.log('\nPRUEBA 7 — los atajos de teclado');
await seleccionar('secUno');
// Dentro de una casilla de texto, Ctrl+C es del texto.
await page.click('[data-insp-tab="content"]');
await page.waitForTimeout(120);
const etiquetaAntes = await page.textContent('.b-porta-bar');
await page.focus('.b-insp input');
await page.keyboard.press('Control+c');
await page.waitForTimeout(150);
ok((await page.textContent('.b-porta-bar')) === etiquetaAntes,
  'escribiendo en una casilla, Ctrl+C no copia el bloque');

// Fuera de las casillas, sí.
await seleccionar('secDos');
await page.evaluate(() => { document.activeElement?.blur(); window.getSelection()?.removeAllRanges(); });
await page.keyboard.press('Control+c');
await page.waitForTimeout(200);
const etiquetaDespues = await page.textContent('.b-porta-bar');
ok(etiquetaDespues !== etiquetaAntes, `Ctrl+C copia el bloque seleccionado («${(etiquetaDespues || '').trim().replace(/\s+/g, ' ')}»)`);

const nSec = (await page.evaluate(() => document.querySelectorAll('.b-tree > .sec').length));
await page.keyboard.press('Control+v');
await page.waitForTimeout(300);
ok(await page.evaluate((n) => document.querySelectorAll('.b-tree > .sec').length === n + 1, nSec),
  'y Ctrl+V la pega');

/* ================================================================== */
console.log('\nPRUEBA 8 — y se pega en OTRA página');
await seleccionar('secUno');
await porta('copiar');
await page.waitForTimeout(100);

await abrir(f2);
const chipDos = await page.textContent('.b-porta-bar').catch(() => '');
ok(/bloque «/.test(chipDos || ''), 'en la página 2 el portapapeles sigue cargado');
await seleccionar('secOtra');
await porta('pegar');
ok(await esperarPost(2, 1), 'pegar en la página 2 la guarda');
const doc2 = ultimo(2);
ok((doc2.sections || []).length === 2, `la página 2 pasa a tener dos secciones (${(doc2.sections || []).length})`);
const tituloEnDos = buscar(doc2, (n) => n.type === 'heading' && n.props?.text === 'Miel de azahar');
ok(tituloEnDos.length >= 1, `con el titular de la página 1 dentro (${tituloEnDos.length})`);
ok(buscar(doc2, (n) => n.props?.text === 'Página dos.').length === 1, 'y sin perder lo que ya había');

/* ================================================================== */
console.log('\nPRUEBA 9 — y en la web pública se ve');
const archivoDoc = join(dir, 'final.json');
writeFileSync(archivoDoc, JSON.stringify(estado[1]));
const htmlPublico = execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, archivoDoc], { encoding: 'utf8' });
const avisoPhp = (htmlPublico.match(/^(Warning|Notice|Fatal|Parse error)/im) || [])[0];
ok(!avisoPhp, `el servidor lo pinta sin avisos de PHP${avisoPhp ? ' — ' + avisoPhp : ''}`);
const vista = join(dir, 'final.html');
writeFileSync(vista, htmlPublico);

const pub = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await pub.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await pub.goto('file://' + vista);
await pub.waitForTimeout(200);
const medidas = await pub.evaluate(() => {
  const textos = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.textContent.trim());
  const sec = document.querySelector('.m-n-secUno');
  const cs = sec ? getComputedStyle(sec) : null;
  return {
    cuantos: textos.filter((t) => t === 'Miel de azahar').length,
    fondo: cs ? cs.backgroundColor : '',
    arriba: cs ? cs.paddingTop : '',
  };
});
await pub.close();
const enDoc = buscar(estado[1], (n) => n.type === 'heading' && n.props?.text === 'Miel de azahar').length;
ok(medidas.cuantos === enDoc && enDoc >= 2,
  `el titular pegado sale tantas veces como dice el documento (${medidas.cuantos} de ${enDoc})`);
ok(medidas.fondo === 'rgb(217, 78, 39)', `y el estilo pegado se pinta de verdad (${medidas.fondo})`);
ok(medidas.arriba === '64px', `con su relleno (${medidas.arriba})`);

/* ================================================================== */
console.log('\nPRUEBA 10 — ningún error de JavaScript');
ok(errores.length === 0, errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

await browser.close();

console.log('');
if (fallos) {
  console.log(`HAY ${fallos} FALLOS (${hechas - fallos} comprobaciones correctas)`);
  process.exit(1);
}
console.log(`COPIAR Y PEGAR VA (${hechas} comprobaciones)`);
