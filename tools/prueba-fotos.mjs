#!/usr/bin/env node
/**
 * El panel de Fotos de Configuración.
 *
 * Qué resuelve: las fotos nuevas se preparan solas al subirlas, pero un
 * sitio que ya lleva dos años en marcha tiene la biblioteca llena de
 * JPEG sin versión moderna. Convertirlas todas de una tacada agota la
 * memoria o caduca la petición, así que se van haciendo a tandas y la
 * pantalla cuenta por dónde va.
 *
 * Lo que se comprueba, con la pantalla de verdad en un navegador:
 *
 *   1. Que al entrar se dice cuántas fotos hay y cuántas están sin
 *      preparar, y qué formatos sabe hacer este servidor.
 *   2. Que el botón sólo sale si hay algo que preparar.
 *   3. Que al pulsarlo se van pidiendo tandas hasta acabar —no una sola
 *      petición con todo dentro— y que cada vuelta dice cuánto queda.
 *   4. Que al terminar se cuenta lo que se ha ganado en bytes.
 *   5. Que un servidor que no sabe hacer WebP lo dice con todas las
 *      letras en vez de ofrecer un botón que no haría nada.
 *   6. Y que si la conversión se corta a mitad, se dice y se puede
 *      seguir por donde iba.
 *
 *   node tools/prueba-fotos.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = readFileSync(`${ROOT}/krg-cms/admin/assets/css/admin.css`, 'utf8');
const REST = 'https://krg.test/wp-json/krg/v1';
const dir = mkdtempSync(join(tmpdir(), 'krg-fotos-'));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const html = `<!doctype html><meta charset="utf-8"><title>config</title>
<style>${CSS}</style>
<body class="wp-admin"><div id="krg-admin"></div>
<script>window.KrgAdmin={page:'krg-settings',view:'',pageId:0,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:true,canEditPages:true,home:'https://destino.test/'};</script>
<script src="file://${JS}/app.js"></script>`;
const archivo = join(dir, 'config.html');
writeFileSync(archivo, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});

/**
 * Un servidor con 20 fotos, 14 de ellas sin preparar, que las va
 * haciendo de ocho en ocho como el de verdad.
 */
async function montar(page, opciones = {}) {
  const estado = { fotos: 20, pendientes: opciones.pendientes ?? 14, formatos: opciones.formatos ?? ['image/avif', 'image/webp'] };
  const tandas = [];
  await page.route('**/krg.test/**', async (route) => {
    const req = route.request();
    const url = req.url().replace(REST, '');
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url === '/settings') return json({ debug: false, caps: [] });
    if (url === '/media/formats' && req.method() === 'GET') {
      return json({ fotos: estado.fotos, pendientes: estado.pendientes, formatos: estado.formatos });
    }
    if (url === '/media/formats' && req.method() === 'POST') {
      const cuerpo = JSON.parse(req.postData() || '{}');
      tandas.push(cuerpo);
      if (opciones.rompeEn && tandas.length === opciones.rompeEn) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'La conversión se ha quedado sin memoria.' }) });
      }
      const cuantas = Math.min(cuerpo.cuantas || 8, estado.pendientes);
      estado.pendientes -= cuantas;
      return json({
        hechas: cuantas * 3,
        antes: cuantas * 400 * 1024,
        despues: cuantas * 120 * 1024,
        pendientes: estado.pendientes,
      });
    }
    return json({});
  });
  await page.goto(`file://${archivo}`);
  await page.waitForSelector('#fotos-estado', { timeout: 15000 });
  return { estado, tandas };
}

/* =================================================================== */
console.log('PRUEBA 1 — qué hay y qué falta');
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
const { tandas } = await montar(page);
await page.waitForFunction(() => !/Contando/.test(document.querySelector('#fotos-estado').textContent), null, { timeout: 8000 });

const texto = (await page.textContent('#fotos-estado')) || '';
ok(/20 fotos/.test(texto), `dice cuántas fotos hay: «${texto.slice(0, 70)}…»`);
ok(/14 sin preparar/.test(texto), 'y cuántas están sin preparar');
ok(/AVIF y WebP/.test(texto), 'y qué formatos sabe hacer este servidor, que no es lo mismo en todos');

console.log('\nPRUEBA 2 — el botón');
ok(await page.isVisible('#fotos-ir'), 'hay algo que preparar, así que el botón está');
ok(!(await page.isVisible('#fotos-parte')), 'y todavía no se cuenta nada: no se ha tocado');

console.log('\nPRUEBA 3 — a tandas, no de una tacada');
await page.click('#fotos-ir');
await page.waitForFunction(() => /Listo/.test(document.querySelector('#fotos-parte').textContent), null, { timeout: 10000 });
ok(tandas.length === 2, `se piden varias tandas y no una petición con las 14 dentro (${tandas.length})`);
ok(tandas.every((t) => t.cuantas === 8), 'de ocho en ocho, que es lo que aguanta un servidor normal');

console.log('\nPRUEBA 4 — lo que se ha ganado');
const parte = (await page.textContent('#fotos-parte')) || '';
ok(/42 archivos nuevos/.test(parte), `cuenta los archivos escritos: «${parte.slice(0, 80)}…»`);
ok(/5,5 MB/.test(parte) && /1,6 MB/.test(parte), `y lo que pesaba antes y lo que pesa ahora, que es lo que se nota`);
await page.waitForFunction(() => /están preparadas/.test(document.querySelector('#fotos-estado').textContent), null, { timeout: 8000 });
ok(!(await page.isVisible('#fotos-ir')), 'y el botón se retira cuando ya no queda nada que hacer');
ok(errores.length === 0, `sin errores de JavaScript${errores.length ? ` — ${errores[0]}` : ''}`);
await page.close();

console.log('\nPRUEBA 5 — un servidor que no sabe');
const pobre = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await montar(pobre, { formatos: [], pendientes: 14 });
await pobre.waitForFunction(() => !/Contando/.test(document.querySelector('#fotos-estado').textContent), null, { timeout: 8000 });
const aviso = (await pobre.textContent('#fotos-estado')) || '';
ok(/no sabe escribir/.test(aviso), `se dice con todas las letras: «${aviso.slice(0, 80)}…»`);
ok(/hospedaje/.test(aviso), 'y de quién es la cosa, para no buscarla en el tema');
ok(!(await pobre.isVisible('#fotos-ir')), 'y no se ofrece un botón que no haría nada');
await pobre.close();

console.log('\nPRUEBA 6 — si se corta a mitad');
const roto = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const sucio = [];
roto.on('console', (m) => { if (m.type() === 'error') sucio.push(m.text()); });
const { tandas: t2 } = await montar(roto, { rompeEn: 2 });
await roto.waitForFunction(() => !/Contando/.test(document.querySelector('#fotos-estado').textContent), null, { timeout: 8000 });
await roto.click('#fotos-ir');
await roto.waitForFunction(() => /memoria|cortado/.test(document.querySelector('#fotos-parte').textContent), null, { timeout: 10000 });
const corte = (await roto.textContent('#fotos-parte')) || '';
ok(/memoria/.test(corte), `se dice qué ha pasado: «${corte.slice(0, 70)}…»`);
ok(t2.length === 2, 'y se para ahí, sin seguir dando vueltas contra un servidor que falla');
ok(await roto.isEnabled('#fotos-ir'), 'el botón vuelve a estar vivo: se sigue por donde iba');
const reales = sucio.filter((e) => !/500 \(Internal Server Error\)/.test(e));
ok(reales.length === 0, `sin errores de JavaScript${reales.length ? ` — ${reales[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await roto.screenshot({ path: `${ROOT}/captura-fotos.png`, fullPage: true });
  console.log(`\n  captura en ${ROOT}/captura-fotos.png`);
}

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas`);
console.log(fallos ? 'HAY QUE ARREGLARLO' : 'EL PANEL DE FOTOS VA');
process.exit(fallos ? 1 : 0);
