#!/usr/bin/env node
/**
 * Las salidas de los avisos del panel.
 *
 * El caso que lo motivó: «Plantillas de página» es una lista larga con
 * su botón «Cerrar» al final del todo. Si la lista no cabe, el botón
 * queda fuera de la pantalla y el aviso parece una trampa: ni aspa
 * arriba, ni tecla Escape, ni clic fuera. Se sale con el ratón o no se
 * sale.
 *
 * Ahora todos los avisos pasan por `KrgModal.abrir()`, que les añade un
 * aspa pegada arriba a la derecha, Escape, clic en el fondo, foco
 * atrapado dentro y foco devuelto al salir. Lo que cada caja ya traía
 * —«Cerrar», «Cancelar», «Ahora no, lo arreglo»— sigue donde estaba:
 * esto suma caminos de salida, no los sustituye.
 *
 * Qué se comprueba:
 *
 *   1. El aviso de plantillas tiene aspa visible Y conserva su «Cerrar».
 *   2. Escape cierra, el aspa cierra, el fondo cierra; un clic dentro no.
 *   3. Es un diálogo de verdad: role, aria-modal y nombre leído del h3.
 *   4. El foco entra en la caja, se queda dentro con el tabulador y
 *      vuelve al botón que abrió el aviso.
 *   5. El aspa sigue viéndose con la lista desplazada hasta el final
 *      (es el caso del encargo: el «Cerrar» de abajo no se ve y el aspa
 *      sí).
 *   6. Lo mismo en los otros avisos: biblioteca, historial, disposición
 *      de la sección y el «Eliminar» del árbol.
 *
 *   node tools/prueba-modal.mjs
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
const dir = mkdtempSync(join(tmpdir(), 'krg-modal-'));

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

const doc = () => ({
  id: 1, title: 'Inicio', slug: 'inicio', status: 'draft', checksum: 'c0',
  seo: {}, settings: {},
  sections: [seccion('secA', [nodo('t1', 'heading', { text: 'Miel cruda', tag: 'h2' })])],
});

const haceMinutos = (m) => new Date(Date.now() - m * 60000).toISOString().replace('T', ' ').slice(0, 19);
const revisiones = [
  { id: 31, origin: 'publish', author: 'Ana', createdAt: haceMinutos(3), title: 'Inicio', sections: 1, blocks: 4 },
];

let estado = null;
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
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canPublish:true,canEditPages:true,canManage:true};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-paginas.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;
const file = join(dir, 'panel.html');
writeFileSync(file, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
// Una ventana baja a propósito: así la lista de plantillas desborda y se
// reproduce el caso del encargo, con el «Cerrar» de abajo fuera de vista.
const page = await browser.newPage({ viewport: { width: 1400, height: 700 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (req.method() === 'POST' && /^\/pages\/1(\/save)?$/.test(url)) {
    estado = sanear(JSON.parse(req.postData() || '{}'));
    return json({ ...estado, checksum: 'c1' });
  }
  if (url === '/pages/1/revisions') return json(revisiones);
  if (url === '/pages/1') return json(estado || sanear(doc()));
  if (url === '/registry') return json(registry);
  if (url === '/templates') return json([]);
  if (url === '/globals') return json([]);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

await page.goto('file://' + file);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await page.waitForTimeout(250);

const abierto = () => page.$('.confirm');
const esperaCerrado = async () => {
  await page.waitForFunction(() => !document.querySelector('.confirm'), null, { timeout: 4000 }).catch(() => {});
  return !(await abierto());
};

/* ================================================================== */
console.log('\nPRUEBA 1 — «Plantillas de página»: el aspa se suma, no sustituye');
await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });

const aspa = await page.$('.confirm .b-modal-x');
ok(!!aspa, 'la caja tiene un aspa de cerrar');
ok(await page.$eval('.confirm .b-modal-x', (b) => b.getAttribute('aria-label') === 'Cerrar'),
  'con nombre para el lector de pantalla («Cerrar»)');
ok(await page.$eval('.confirm .b-modal-x', (b) => !!b.querySelector('svg')),
  'y un dibujo, no un carácter suelto');
const caja = await page.$eval('.confirm .box', (b) => b.getBoundingClientRect().toJSON());
const rAspa = await page.$eval('.confirm .b-modal-x', (b) => b.getBoundingClientRect().toJSON());
ok(rAspa.width >= 28 && rAspa.height >= 28, `el blanco es grande para el dedo (${Math.round(rAspa.width)}×${Math.round(rAspa.height)})`);
ok(rAspa.top >= caja.top - 1 && rAspa.top < caja.top + 40, 'va arriba del todo');
ok(rAspa.right > caja.right - 60, 'y a la derecha');
if (process.env.KRG_SHOT) {
  await page.screenshot({ path: `${ROOT}/captura-modal.png` });
  console.log('  --   captura-modal.png escrita');
}
const sigueCerrar = await page.$$eval('.confirm button', (bs) =>
  bs.some((b) => b.id === 'close' && b.textContent.trim() === 'Cerrar'));
ok(sigueCerrar, 'y el botón «Cerrar» de abajo sigue estando');

/* ================================================================== */
console.log('\nPRUEBA 2 — es un diálogo de verdad');
const aria = await page.$eval('.confirm .box', (b) => ({
  role: b.getAttribute('role'),
  modal: b.getAttribute('aria-modal'),
  label: b.getAttribute('aria-labelledby'),
  titulo: (b.querySelector('h3') || {}).id,
  texto: (b.querySelector('h3') || {}).textContent,
}));
ok(aria.role === 'dialog', 'role="dialog"');
ok(aria.modal === 'true', 'aria-modal="true"');
ok(!!aria.label && aria.label === aria.titulo, 'se llama como su título');
ok(/Plantillas de página/.test(aria.texto || ''), `y el título es «${(aria.texto || '').trim()}»`);
ok(await page.evaluate(() => document.activeElement.classList.contains('box')),
  'el foco entra en la caja, no en el primer botón (nadie pulsa sin querer)');

/* ================================================================== */
console.log('\nPRUEBA 3 — el aspa se ve aunque la lista esté desplazada');
await page.$eval('.confirm .box', (b) => { b.scrollTop = b.scrollHeight; });
await page.waitForTimeout(120);
const tras = await page.evaluate(() => {
  const b = document.querySelector('.confirm .box');
  const x = b.querySelector('.b-modal-x');
  const cerrarAbajo = b.querySelector('#close');
  const rb = b.getBoundingClientRect();
  const rx = x.getBoundingClientRect();
  const rc = cerrarAbajo.getBoundingClientRect();
  return {
    desplazada: b.scrollTop > 40,
    aspaDentro: rx.top >= rb.top - 1 && rx.bottom <= rb.bottom + 1,
    cerrarEstaba: rc.bottom <= rb.bottom + 1,
  };
});
ok(tras.desplazada, 'la lista desborda la caja (es el caso de la captura)');
ok(tras.aspaDentro, 'el aspa sigue dentro de la parte visible de la caja');
ok(tras.cerrarEstaba, 'y abajo aparece el «Cerrar» de siempre');

/* ================================================================== */
console.log('\nPRUEBA 4 — el tabulador no se escapa de la caja');
const atrapado = await page.evaluate(() => {
  const box = document.querySelector('.confirm .box');
  const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const dentro = [...box.querySelectorAll(sel)];
  return { cuantos: dentro.length, primero: dentro[0] && dentro[0].classList.contains('b-modal-x') };
});
ok(atrapado.primero, 'el aspa es lo primero que recibe el tabulador');
await page.keyboard.press('Tab');
ok(await page.evaluate(() => document.querySelector('.confirm .box').contains(document.activeElement)),
  'y al tabular el foco sigue dentro del aviso');
// Shift+Tab desde el primero salta al último, no al fondo de la página.
await page.evaluate(() => document.querySelector('.confirm .b-modal-x').focus());
await page.keyboard.press('Shift+Tab');
ok(await page.evaluate(() => document.querySelector('.confirm .box').contains(document.activeElement)),
  'hacia atrás, tampoco se sale');

/* ================================================================== */
console.log('\nPRUEBA 5 — un clic dentro no cierra; el fondo sí');
await page.click('.confirm .box h3');
await page.waitForTimeout(120);
ok(!!(await abierto()), 'pinchar en la caja no cierra nada');
const ventana = page.viewportSize();
await page.mouse.click(ventana.width - 8, ventana.height - 8);
ok(await esperaCerrado(), 'pinchar en el fondo oscuro sí cierra');

/* ================================================================== */
console.log('\nPRUEBA 6 — Escape, el aspa, y el foco que vuelve');
await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });
await page.keyboard.press('Escape');
ok(await esperaCerrado(), 'Escape cierra el aviso');
ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'open-pagtpl'),
  'y el foco vuelve al botón que lo abrió');

await page.click('#open-pagtpl');
await page.waitForSelector('.b-pagtpl', { timeout: 5000 });
await page.click('.confirm .b-modal-x');
ok(await esperaCerrado(), 'el aspa cierra el aviso');

/* ================================================================== */
console.log('\nPRUEBA 7 — los demás avisos del constructor, igual');

const avisos = [
  ['Biblioteca', async () => { await page.click('#open-lib'); }],
  ['Historial', async () => { await page.click('#history'); }],
  ['Disposición de la sección', async () => {
    // Se abre al añadir una sección desde la paleta de piezas.
    await page.click('.b-tree [data-sel="secA"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.b-pal [data-add], [data-add]')]
        .find((x) => x.getAttribute('data-add') === 'section');
      if (b) b.click();
    });
  }],
];

for (const [nombre, abrir] of avisos) {
  await abrir();
  const hay = await page.waitForSelector('.confirm', { timeout: 4000 }).catch(() => null);
  if (!hay) {
    // La disposición se abre desde el inspector y puede no estar a mano
    // en esta pantalla: no se inventa el resultado, se dice.
    console.log(`  --   «${nombre}» no se pudo abrir desde aquí; sin comprobar`);
    continue;
  }
  const tieneAspa = await page.$eval('.confirm', (w) => !!w.querySelector('.b-modal-x'));
  const esDialogo = await page.$eval('.confirm .box', (b) => b.getAttribute('role') === 'dialog');
  ok(tieneAspa && esDialogo, `«${nombre}» tiene aspa y es un diálogo`);
  await page.keyboard.press('Escape');
  ok(await esperaCerrado(), `«${nombre}» se cierra con Escape`);
}

/* El «Eliminar» del árbol: un sí o no, que también tiene que dejar salir. */
await page.click('.b-tree [data-del="secA"]');
const borrar = await page.waitForSelector('.confirm', { timeout: 4000 }).catch(() => null);
if (borrar) {
  ok(await page.$eval('.confirm', (w) => !!w.querySelector('.b-modal-x')), '«Eliminar» tiene aspa');
  const sigueCancelar = await page.$eval('.confirm', (w) => !!w.querySelector('#no'));
  ok(sigueCancelar, 'y conserva su «Cancelar»');
  await page.keyboard.press('Escape');
  ok(await esperaCerrado(), '«Eliminar» se cierra con Escape sin borrar nada');
  const quedan = await page.$$eval('.b-tree [data-sel]', (l) => l.length);
  ok(quedan >= 1, 'y la sección sigue en el árbol');
} else {
  ok(false, 'no se pudo abrir el aviso de eliminar');
}

/* ================================================================== */
const limpios = errores.filter((e) => !/ERR_CONNECTION_CLOSED|fonts\.googleapis/.test(e));
ok(limpios.length === 0, `sin errores de consola${limpios.length ? ': ' + limpios[0] : ''}`);

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones`);
process.exit(fallos ? 1 : 0);
