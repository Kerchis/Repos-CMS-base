#!/usr/bin/env node
/**
 * El constructor de cabecera y pie, con el mismo motor que las páginas.
 *
 * Por que hace falta: el encargo pide un unico motor para paginas y
 * navegacion (puntos 28-30). Decirlo es facil; esto lo comprueba. La
 * pantalla de cabecera y pie carga `builder-core.js` y pinta sus
 * ajustes como grupos plegables del nucleo, con las mismas tres
 * pestañas y la misma cabecera de seleccion. Y lo que se toca tiene que
 * llegar al PUT de /header o /footer, no quedarse en la pantalla.
 *
 *   node tools/prueba-chrome.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const REST = 'https://krg.test/wp-json/krg/v1';

const registry = JSON.parse(
  execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' })
);

const header = {
  logoId: 0, logoWidth: 140, height: 72, paddingY: 12, sticky: true,
  menuSlug: 'principal', ctaText: 'Reservar', ctaUrl: '#', align: 'left',
  background: '', color: '', transparent: false, animation: 'none',
};
const footer = {
  text: 'Pie', columns: 3, paddingY: 64, copyright: '© KRG', reveal: 'stagger',
  menuSlug: 'principal', showClassic: true,
  sections: [{
    id: 'fsec1', type: 'section', name: 'Sección del pie', visible: true, props: { layout: '6-6' },
    styles: { desktop: {}, tablet: {}, mobile: {} },
    children: [{
      id: 'frow1', type: 'row', name: 'Fila', visible: true, props: { layout: '6-6', gap: 24 },
      styles: { desktop: {}, tablet: {}, mobile: {} },
      children: [{
        id: 'fcol1', type: 'column', name: 'Columna', visible: true, props: { span: 6 },
        styles: { desktop: {}, tablet: {}, mobile: {} },
        children: [{
          id: 'ftxt1', type: 'paragraph', name: 'Párrafo', visible: true, props: { text: 'Hola' },
          styles: { desktop: {}, tablet: {}, mobile: {} }, children: [],
        }],
      }],
    }],
  }],
};

const enviados = { header: [], footer: [] };
let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

function paginaHtml(region) {
  return `<!doctype html><meta charset="utf-8"><title>chrome</title>
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={chrome:${JSON.stringify(region)},rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/chrome.js"></script>`;
}

const dir = mkdtempSync(join(tmpdir(), 'krg-chrome-'));
writeFileSync(join(dir, 'header.html'), paginaHtml('header'));
writeFileSync(join(dir, 'footer.html'), paginaHtml('footer'));

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (req.method() === 'POST' || req.method() === 'PUT') {
    const cuerpo = JSON.parse(req.postData() || '{}');
    if (url.startsWith('/header')) { enviados.header.push(cuerpo); Object.assign(header, cuerpo); }
    if (url.startsWith('/footer')) { enviados.footer.push(cuerpo); Object.assign(footer, cuerpo); }
    return json(cuerpo);
  }
  if (url === '/header') return json(header);
  if (url === '/footer') return json(footer);
  if (url === '/menus') return json([{ slug: 'principal', name: 'Principal' }]);
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

const esperar = (ms = 150) => page.waitForTimeout(ms);
const grupos = () => page.evaluate(() =>
  [...document.querySelectorAll('.b-insp .b-group')].map((g) => ({
    id: g.dataset.acc,
    titulo: g.querySelector('.acc-t')?.textContent.trim(),
    abierto: g.classList.contains('is-open'),
  })));
const abrirTodos = async () => {
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
  });
  await esperar(60);
};
async function esperarEnvio(lista, n, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (lista.length >= n) return true;
    await esperar(120);
  }
  return false;
}

/* ================================================================== */
console.log('\nPRUEBA 1 — la cabecera usa el núcleo del constructor');
await page.goto('file://' + join(dir, 'header.html'));
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
ok(await page.evaluate(() => !!window.KrgBuilderCore), 'la pantalla carga KrgBuilderCore');
ok(await page.evaluate(() => document.querySelectorAll('.b-insp [data-insp-tab]').length === 3),
  'tiene las tres pestañas Contenido / Diseño / Avanzado');
const cab = await page.evaluate(() => ({
  kind: document.querySelector('.b-insp .b-sel-kind')?.textContent.trim(),
  name: document.querySelector('.b-insp .b-sel-name')?.textContent.trim(),
}));
ok(cab.kind === 'Cabecera' && !!cab.name, `la cabecera del panel dice «${cab.kind} / ${cab.name}»`);
const gH = await grupos();
ok(gH.length >= 1 && gH.filter((x) => x.abierto).length === 1,
  `los ajustes vienen en grupos plegables (${gH.length} en Contenido, 1 abierto)`);

console.log('\nPRUEBA 2 — los grupos de Diseño de la cabecera');
await page.click('.b-insp [data-insp-tab="design"]');
await esperar();
const idsH = (await grupos()).map((x) => x.id);
for (const g of ['h.align', 'h.navMode', 'h.colors', 'h.logo', 'h.size', 'h.glass', 'h.anim']) {
  ok(idsH.includes(g), `está el grupo ${g}`);
}

console.log('\nPRUEBA 3 — tocar un control llega al guardado de la cabecera');
await abrirTodos();
let n = enviados.header.length;
await page.fill('.b-insp [data-h-num="height"]', '96');
ok(await esperarEnvio(enviados.header, n + 1), 'el cambio se envía');
ok(Number(enviados.header[enviados.header.length - 1].height) === 96,
  `alto guardado = ${enviados.header[enviados.header.length - 1].height}`);
n = enviados.header.length;
await page.evaluate(() => document.querySelector('.b-insp [data-h-set="navModeDesktop"][data-v="drawer"]').click());
ok(await esperarEnvio(enviados.header, n + 1), 'el tipo de menú se envía');
ok(enviados.header[enviados.header.length - 1].navModeDesktop === 'drawer',
  `tipo de menú en escritorio = ${enviados.header[enviados.header.length - 1].navModeDesktop}`);

console.log('\nPRUEBA 4 — Avanzado de la cabecera');
await page.click('.b-insp [data-insp-tab="advanced"]');
await esperar();
await abrirTodos();
const idsA = (await grupos()).map((x) => x.id);
ok(idsA.includes('h.adaptive') && idsA.includes('h.advanced'), 'color adaptativo y avanzado');
n = enviados.header.length;
await page.fill('.b-insp [data-h="htmlId"]', 'cabecera-sitio');
ok(await esperarEnvio(enviados.header, n + 1), 'el identificador CSS se envía');
ok(enviados.header[enviados.header.length - 1].htmlId === 'cabecera-sitio',
  `id guardado = ${enviados.header[enviados.header.length - 1].htmlId}`);

console.log('\nPRUEBA 5 — recargar y seguir viendo lo guardado');
await page.reload();
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
await page.click('.b-insp [data-insp-tab="design"]');
await esperar();
await abrirTodos();
ok(await page.inputValue('.b-insp [data-h-num="height"]') === '96', 'el alto sigue en 96');
await page.click('.b-insp [data-insp-tab="advanced"]');
await esperar();
await abrirTodos();
ok(await page.inputValue('.b-insp [data-h="htmlId"]') === 'cabecera-sitio', 'el identificador CSS sigue puesto');

/* ================================================================== */
console.log('\nPRUEBA 6 — el pie, mismo motor');
await page.goto('file://' + join(dir, 'footer.html'));
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
const cabF = await page.evaluate(() => document.querySelector('.b-insp .b-sel-kind')?.textContent.trim());
ok(cabF === 'Pie', `la cabecera del panel dice «${cabF}»`);
const idsF = (await grupos()).map((x) => x.id);
ok(idsF.includes('f.content') && idsF.includes('f.copyright'), 'contenido del pie y copyright');
await abrirTodos();
n = enviados.footer.length;
await page.fill('.b-insp [data-f="copyright"]', '© 2026 KRG');
ok(await esperarEnvio(enviados.footer, n + 1), 'el copyright se envía');
ok(enviados.footer[enviados.footer.length - 1].copyright === '© 2026 KRG',
  `copyright guardado = ${enviados.footer[enviados.footer.length - 1].copyright}`);

console.log('\nPRUEBA 7 — un bloque dentro del pie se configura igual que en una página');
await page.evaluate(() => {
  const el = document.querySelector('[data-fsel="ftxt1"]') || [...document.querySelectorAll('[data-fsel]')].pop();
  if (el) el.click();
});
await esperar(200);
const cabN = await page.evaluate(() => ({
  kind: document.querySelector('.b-insp .b-sel-kind')?.textContent.trim(),
  name: document.querySelector('.b-insp .b-sel-name')?.textContent.trim(),
  volver: !!document.querySelector('.b-insp [data-froot]'),
}));
ok(!!cabN.kind && !!cabN.name, `la cabecera dice «${cabN.kind} / ${cabN.name}»`);
ok(cabN.volver, 'y deja volver a los ajustes del pie');
await page.click('.b-insp [data-insp-tab="design"]');
await esperar();
await abrirTodos();
const idsN = (await grupos()).map((x) => x.id);
ok(idsN.includes('fn.design') && idsN.includes('fn.align') && idsN.includes('fn.anim'),
  `diseño, alineación y animación del bloque (${idsN.join(', ')})`);
n = enviados.footer.length;
await page.fill('.b-insp [data-fstyle="padding"]', '32px');
ok(await esperarEnvio(enviados.footer, n + 1), 'el relleno del bloque se envía');
const guardadoN = JSON.stringify(enviados.footer[enviados.footer.length - 1]?.sections || []);
ok(guardadoN.includes('32px'), 'y viaja dentro de las secciones del pie');

console.log('\nPRUEBA 8 — los grupos recuerdan cómo quedaron, también aquí');
await page.evaluate(() => {
  const g = document.querySelector('.b-insp [data-acc="fn.anim"]');
  if (g && g.classList.contains('is-open')) g.querySelector('.acc-h').click();
});
await esperar();
await page.reload();
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
const recordado = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('krg.insp.groups') || '{}')['fn.anim'];
  } catch (e) { return null; }
});
ok(recordado === false, 'el grupo que se cerró sigue cerrado después de recargar');

console.log('\nPRUEBA 9 — ningún error de JavaScript');
ok(errores.length === 0, errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
