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
const variantes = (pesos) => pesos.map((w) => ({ id: `${w}-normal`, label: String(w), weight: String(w), style: 'normal' }));
const fuentes = [
  { name: 'Archivo', css: 'Archivo, sans-serif', group: 'web', google: 'Archivo', weights: ['400', '700', '800'], variants: variantes([400, 700, 800]) },
  { name: 'Inter', css: 'Inter, sans-serif', group: 'web', google: 'Inter', weights: ['400', '500', '600', '700'], variants: variantes([400, 500, 600, 700]) },
  { name: 'Inter Tight', css: '"Inter Tight", sans-serif', group: 'web', google: 'Inter Tight', weights: ['400', '500'], variants: variantes([400, 500]) },
  { name: 'Questrial', css: '"Questrial", sans-serif', group: 'web', google: 'Questrial', weights: ['400'], variants: variantes([400]) },
  { name: 'Georgia', css: 'Georgia, "Times New Roman", serif', group: 'system', google: '', weights: [], variants: variantes([400, 700]) },
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
console.log('\n--- Una fuente de un solo peso avisa de que no tiene negrita');
await page.selectOption('[data-font-wrap="ui"] [data-font]', '"Questrial", sans-serif');
await page.waitForTimeout(150);
const quest = await page.evaluate(() => {
  const w = document.querySelector('[data-font-wrap="ui"]');
  return {
    variantes: [...w.querySelectorAll('[data-font-variant] option')].map((o) => o.textContent.trim()),
    aviso: w.querySelector('.m-font-aviso')?.textContent.trim() || '',
  };
});
ok(quest.variantes.length === 1 && quest.variantes[0] === '400',
  `el selector de variante solo ofrece el peso que existe (${quest.variantes.join(', ')})`);
ok(/solo existe en el peso 400/i.test(quest.aviso), `y lo dice en claro («${quest.aviso.slice(0, 60)}…»)`);

/* ------------------------------------------------------------------ */
console.log('\n--- Una familia escrita a mano se puede cargar de Google');
await page.selectOption('[data-font-wrap="ui"] [data-font]', '__custom__');
await page.waitForTimeout(120);
const aMano = await page.evaluate(() => {
  const w = document.querySelector('[data-font-wrap="ui"]');
  return {
    campo: !w.querySelector('[data-font-custom]').hidden,
    casilla: !w.querySelector('[data-font-google-wrap]').hidden,
    marcada: w.querySelector('[data-font-google]').checked,
  };
});
ok(aMano.campo, 'aparece el campo para escribirla');
ok(aMano.casilla, 'y la casilla «Cargar desde Google Fonts»');
ok(aMano.marcada, 'marcada de serie: si no, la web la declara y nadie la descarga');

await page.fill('[data-font-wrap="ui"] [data-font-custom]', '"Fuente Mía", sans-serif');
await page.waitForTimeout(120);
await page.click('#save-tokens');
await page.waitForTimeout(400);
const conGoogle = guardados[guardados.length - 1]?.tokens?.font?.ui;
ok(conGoogle?.value === '"Fuente Mía", sans-serif', `la familia escrita se guarda (${conGoogle?.value})`);
ok(conGoogle?.google === 'Fuente Mía', `y con ella el encargo de descargarla (${conGoogle?.google})`);

await page.uncheck('[data-font-wrap="ui"] [data-font-google]');
await page.waitForTimeout(120);
await page.click('#save-tokens');
await page.waitForTimeout(400);
ok(guardados[guardados.length - 1]?.tokens?.font?.ui?.google === undefined,
  'y al desmarcarla deja de pedirse: para quien aloje su propia fuente');

/* ------------------------------------------------------------------ */
console.log('\n--- Ningún error de JavaScript');
ok(errores.length === 0, errores.length ? errores.join(' | ') : 'ninguno');

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS (${hechas} comprobaciones)` : `LAS FAMILIAS TIPOGRÁFICAS VAN (${hechas} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
