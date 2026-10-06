#!/usr/bin/env node
/**
 * La revisión de antes de publicar, en el panel.
 *
 * Qué faltaba: el servidor ya sabe mirar la página, pero lo que importa
 * es cómo se cuenta. Un revisor que impida publicar sobra; uno que
 * avise y se quite de en medio, no. Aquí se comprueba el trato:
 *
 *   1. Que «Publicar» pasa antes por la revisión y, si hay algo, enseña
 *      la lista en vez de publicar a lo loco.
 *   2. Que desde esa lista se publica igualmente con un botón: avisa,
 *      no bloquea.
 *   3. Que «Ahora no» no publica nada y deja la página como estaba.
 *   4. Que cada hallazgo dice de qué clase es y por qué importa, y que
 *      «Ver el bloque» selecciona el bloque culpable en el árbol.
 *   5. Que el botón «Revisar» de la barra se puede usar cuando se
 *      quiera, sin publicar.
 *   6. Que si la página está limpia, publicar no interrumpe a nadie.
 *   7. Y que si la revisión falla, se publica igual: no es su trabajo
 *      impedirlo.
 *
 *   node tools/prueba-revision.mjs
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
const dir = mkdtempSync(join(tmpdir(), 'krg-revision-'));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const sanear = (doc) => {
  const archivo = join(dir, 'doc.json');
  writeFileSync(archivo, JSON.stringify(doc));
  return JSON.parse(execFileSync(PHP, [`${ROOT}/tools/sanear.php`, archivo], { encoding: 'utf8' }));
};

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});
const pagina = () => ({
  id: 1, title: 'Nuestra miel', slug: 'miel', status: 'draft', checksum: 'c0',
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [
    nodo('secUno', 'section', { width: 'padded' }, [
      nodo('secUno-row', 'row', { gap: 24 }, [
        nodo('secUno-col', 'column', { span: 12 }, [
          nodo('img1', 'image', { imageId: 7, alt: '' }),
          nodo('b1', 'button', { text: 'Comprar', url: '#' }),
        ]),
      ]),
    ]),
  ],
});

/* La revisión que contesta el servidor simulado. Se cambia por prueba. */
let revision = {
  items: [
    {
      level: 'aviso', code: 'alt', nodeId: 'img1',
      title: 'Una foto de «Imagen» no tiene texto alternativo',
      detail: 'Es lo que lee en voz alta un lector de pantalla y lo que se ve si la foto no carga.',
    },
    {
      level: 'aviso', code: 'h1', nodeId: '',
      title: 'La página no tiene titular de primer nivel',
      detail: 'El H1 es el que dice de qué va la página.',
    },
    {
      level: 'pista', code: 'enlace', nodeId: 'b1',
      title: '«Botón» no lleva a ninguna parte',
      detail: 'El botón se pinta, pero al pulsarlo no pasa nada.',
    },
  ],
  counts: { aviso: 2, pista: 1 },
};
let revisionFalla = false;

const estado = { 1: null };
const posts = [];
const publicados = [];
const revisiones = [];

const html = `<!doctype html><meta charset="utf-8"><title>panel</title>
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
const archivo = join(dir, 'panel.html');
writeFileSync(archivo, html);

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
    const cuerpo = JSON.parse(req.postData() || '{}');
    posts.push(cuerpo);
    estado[1] = sanear(cuerpo);
    return json({ ...estado[1], checksum: `c${posts.length}` });
  }
  if (req.method() === 'POST' && url === '/pages/1/publish') {
    publicados.push(Date.now());
    return json({ ...(estado[1] || sanear(pagina())), status: 'publish' });
  }
  if (url === '/pages/1/review') {
    revisiones.push(Date.now());
    if (revisionFalla) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' });
    return json(revision);
  }
  if (url === '/pages/1') return json(estado[1] || sanear(pagina()));
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

const abrir = async () => {
  await page.goto(`file://${archivo}`);
  await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
  await page.waitForTimeout(250);
};
const esperar = async (cond, ms = 8000) => {
  const t0 = Date.now();
  while (!(await cond()) && Date.now() - t0 < ms) await page.waitForTimeout(100);
  return cond();
};

console.log('PRUEBA 1 — publicar pasa antes por la revisión');
await abrir();
ok(await page.isVisible('#review'), 'la barra de arriba tiene el botón «Revisar»');
const nPub = publicados.length;
await page.click('#publish');
ok(await esperar(async () => page.isVisible('.b-revision')), 'sale la lista en vez de publicar a lo loco');
ok(revisiones.length >= 1, 'se ha pedido la revisión al servidor');
ok(publicados.length === nPub, 'y no se ha publicado nada todavía');

if (process.env.KRG_SHOT) await page.screenshot({ path: `${ROOT}/captura-revision.png` });
const texto = await page.textContent('.b-revision');
ok(/2 avisos y 1 pista/.test(texto || ''), 'la cabecera cuenta cuántos avisos y cuántas pistas hay');
ok(/no impide publicar/.test(texto || ''), 'y deja claro que no impide publicar');
ok(/texto alternativo/.test(texto || '') && /lector de pantalla/.test(texto || ''),
  'cada hallazgo dice qué pasa y por qué importa');
const niveles = await page.$$eval('.b-revision .b-rev-nivel', (els) => els.map((e) => e.textContent.trim()));
ok(niveles.filter((x) => x === 'Aviso').length === 2 && niveles.filter((x) => x === 'Pista').length === 1,
  `los niveles salen escritos: ${niveles.join(', ')}`);
const conBoton = await page.$$eval('.b-revision [data-rev-ir]', (els) => els.map((e) => e.getAttribute('data-rev-ir')));
ok(conBoton.length === 2 && conBoton.includes('img1') && conBoton.includes('b1'),
  'los hallazgos que señalan a un bloque traen su botón; los de la página entera, no');

console.log('\nPRUEBA 2 — «Ahora no» no publica');
await page.click('.b-revision #close');
await page.waitForTimeout(200);
ok(!(await page.isVisible('.b-revision')), 'el diálogo se cierra');
ok(publicados.length === nPub, 'y sigue sin publicarse nada');

console.log('\nPRUEBA 3 — «Ver el bloque» lleva hasta él');
await page.click('#publish');
await page.waitForSelector('.b-revision', { timeout: 8000 });
await page.click('.b-revision [data-rev-ir="img1"]');
await page.waitForTimeout(300);
ok(!(await page.isVisible('.b-revision')), 'el diálogo se quita de en medio');
const seleccionado = await page.$$eval('.b-left .hd.is-sel, .b-left [data-nid].is-sel', (els) => els.map((e) => e.getAttribute('data-nid')));
const enInspector = (await page.textContent('.b-insp')) || '';
ok(seleccionado.includes('img1') || /Imagen/.test(enInspector),
  'y el bloque de la foto queda seleccionado, listo para arreglarlo');

console.log('\nPRUEBA 4 — avisa, pero no bloquea');
await page.click('#publish');
await page.waitForSelector('.b-revision', { timeout: 8000 });
ok(await page.isVisible('.b-revision #rev-pub'), 'la lista trae el botón de publicar dentro');
await page.click('.b-revision #rev-pub');
ok(await esperar(async () => publicados.length > nPub), 'se publica igualmente: quien publica decide');
ok(!(await page.isVisible('.b-revision')), 'y el diálogo se cierra al publicar');

console.log('\nPRUEBA 5 — revisar cuando se quiera, sin publicar');
const nPub2 = publicados.length;
const nRev = revisiones.length;
await page.click('#review');
ok(await esperar(async () => page.isVisible('.b-revision')), 'el botón «Revisar» abre la misma lista');
ok(revisiones.length > nRev, 'pidiendo la revisión otra vez, por si se acaba de cambiar algo');
ok(!(await page.isVisible('.b-revision #rev-pub')),
  'pero sin el botón de publicar: aquí sólo se viene a mirar');
await page.click('.b-revision #close');
ok(publicados.length === nPub2, 'y no se publica nada');

console.log('\nPRUEBA 6 — una página limpia no interrumpe');
revision = { items: [], counts: { aviso: 0, pista: 0 } };
const nPub3 = publicados.length;
await page.click('#publish');
ok(await esperar(async () => publicados.length > nPub3), 'publicar publica, sin diálogo por medio');
ok(!(await page.isVisible('.b-revision')), 'y no se enseña ninguna lista vacía');

console.log('\nPRUEBA 7 — si la revisión falla, se publica igual');
revisionFalla = true;
const nPub4 = publicados.length;
await page.click('#publish');
ok(await esperar(async () => publicados.length > nPub4),
  'un error del revisor no puede dejar a nadie sin publicar');

// El 500 de la prueba 7 lo provoca este banco a propósito: el navegador
// lo apunta en la consola y no es un fallo del panel.
const reales = errores.filter((e) => !/500 \(Internal Server Error\)/.test(e));
ok(reales.length === 0, `sin errores de JavaScript en el panel${reales.length ? ` — ${reales[0]}` : ''}`);

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
if (!fallos) console.log('LA REVISIÓN DE ANTES DE PUBLICAR VA EN EL PANEL');
process.exit(fallos ? 1 : 0);
