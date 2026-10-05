#!/usr/bin/env node
/**
 * Las familias tipográficas del panel de Apariencia.
 *
 * El problema: el panel ofrecía tres familias —Títulos, Cuerpo y
 * Display— pero media web no hacía caso de ninguna. Los menús, los
 * botones, los antetítulos, las etiquetas, los precios de la carta y la
 * letra pequeña iban todos con la familia de Títulos, a pelo en el CSS,
 * y «Display» no se usaba en ningún sitio. Elegir una cuarta no era
 * posible porque no existía la fila.
 *
 * Aquí se comprueba la mitad del panel (la otra mitad, la del CSS, está
 * en tools/prueba-prosa.php):
 *
 *   1. Que hay cuatro familias y que la nueva se llama «Texto general».
 *   2. Que arranca vacía: quien no la toque no ve ningún cambio.
 *   3. Que elegir una familia la guarda en `tokens.font.ui`.
 *   4. Que al recargar el panel sigue elegida.
 *
 *   node tools/prueba-familias.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const REST = 'https://krg.test/wp-json/krg/v1';

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

// Una instalación de las de antes: tres familias y ni rastro de la cuarta.
let tokens = {
  activePreset: 'marca',
  tokens: {
    color: { primary: { value: '#3f5e58', label: 'Primario' } },
    font: {
      heading: { value: 'Archivo, sans-serif', weight: '800', label: 'Títulos' },
      body: { value: 'Inter, sans-serif', weight: '400', label: 'Cuerpo' },
      display: { value: '', label: 'Display' },
    },
    typography: {},
    spacing: { section: '96px' },
  },
};
const fuentes = [
  { name: 'Archivo', css: 'Archivo, sans-serif', group: 'web', google: 'Archivo', variants: [] },
  { name: 'Inter', css: 'Inter, sans-serif', group: 'web', google: 'Inter', variants: [] },
  { name: 'Inter Tight', css: '"Inter Tight", sans-serif', group: 'web', google: 'Inter+Tight', variants: [] },
];
const guardados = [];

const html = `<!doctype html><meta charset="utf-8"><title>apariencia</title>
<body><div id="krg-admin"></div>
<script>window.KrgAdmin={page:'krg-design',view:'',rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:true};</script>
<script src="file://${JS}/app.js"></script>`;
const dir = mkdtempSync(join(tmpdir(), 'krg-fam-'));
const file = join(dir, 'apariencia.html');
writeFileSync(file, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));

await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '').split('?')[0];
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if ((req.method() === 'POST' || req.method() === 'PUT') && url === '/tokens') {
    const cuerpo = JSON.parse(req.postData() || '{}');
    guardados.push(cuerpo);
    tokens = JSON.parse(JSON.stringify(cuerpo));
    return json({ data: tokens, fonts: fuentes });
  }
  if (url === '/tokens') return json({ data: tokens, fonts: fuentes, presets: [] });
  if (url === '/identity') return json({});
  if (url === '/admin-skin') return json({});
  return json([]);
});

const filas = () => page.evaluate(() => [...document.querySelectorAll('[data-font-wrap]')].map((w) => ({
  clave: w.dataset.fontWrap,
  etiqueta: w.querySelector('span')?.textContent.trim() || '',
  valor: w.querySelector('[data-font]')?.value || '',
})));

await page.goto('file://' + file);
await page.waitForSelector('[data-font-wrap]', { timeout: 15000 });

/* ------------------------------------------------------------------ */
console.log('\n--- Las cuatro familias');
let f = await filas();
ok(f.length === 4, `hay cuatro familias y no tres (${f.length})`);
ok(f.map((x) => x.clave).join(',') === 'heading,body,display,ui', `en este orden: ${f.map((x) => x.clave).join(', ')}`);
const ui = f.find((x) => x.clave === 'ui');
ok(/Texto general/i.test(ui.etiqueta), `la nueva se llama «Texto general» («${ui.etiqueta}»)`);
ok(/menús|botones/i.test(ui.etiqueta), 'y la etiqueta dice para qué sirve');
ok(ui.valor === '', 'arranca sin elegir: quien no la toque no ve ningún cambio');
ok(f.find((x) => x.clave === 'heading').etiqueta === 'Títulos', 'las de siempre conservan su nombre');

/* ------------------------------------------------------------------ */
console.log('\n--- Elegir una familia y guardarla');
await page.selectOption('[data-font-wrap="ui"] [data-font]', '"Inter Tight", sans-serif');
await page.waitForTimeout(150);
await page.click('#save-tokens');
await page.waitForTimeout(500);
ok(guardados.length === 1, `el panel guarda (${guardados.length} envío/s)`);
const enviado = guardados[guardados.length - 1]?.tokens?.font?.ui;
ok(!!enviado, 'la familia nueva viaja en el paquete de tokens');
ok(enviado?.value === '"Inter Tight", sans-serif', `con la familia elegida (${enviado?.value})`);
ok(!!guardados[0]?.tokens?.font?.heading, 'y las de siempre siguen ahí');

/* ------------------------------------------------------------------ */
console.log('\n--- Al volver a entrar sigue elegida');
await page.goto('file://' + file);
await page.waitForSelector('[data-font-wrap]', { timeout: 15000 });
f = await filas();
ok(f.find((x) => x.clave === 'ui')?.valor === '"Inter Tight", sans-serif',
  `el panel la recuerda (${f.find((x) => x.clave === 'ui')?.valor})`);
ok(f.length === 4, 'y sigue habiendo cuatro filas, no cinco');

/* ------------------------------------------------------------------ */
console.log('\n--- Ningún error de JavaScript');
ok(errores.length === 0, errores.length ? errores.join(' | ') : 'ninguno');

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS (${hechas} comprobaciones)` : `LAS FAMILIAS TIPOGRÁFICAS VAN (${hechas} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
