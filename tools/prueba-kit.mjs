#!/usr/bin/env node
/**
 * La pantalla de exportar e importar.
 *
 * Qué faltaba: antes había dos botones —«Exportar JSON» e «Importar
 * JSON»— que se lo llevaban todo y lo metían todo, sin decir qué traía
 * el archivo ni qué había pasado al meterlo. Para mudar un sitio eso no
 * basta: hay que poder elegir qué parte viaja, ver qué trae el paquete
 * **antes** de tocar nada y decidir qué se hace con las páginas que ya
 * existen aquí.
 *
 * Lo que se comprueba, con la pantalla de verdad en un navegador:
 *
 *   1. Que se eligen las cuatro partes por separado y que lo que se
 *      marca es exactamente lo que se pide al servidor.
 *   2. Que se puede exportar una sola página.
 *   3. Que al elegir un archivo se enseña lo que trae —de dónde salió,
 *      cuántas páginas, si lleva la paleta— sin importar nada todavía.
 *   4. Que un archivo que no es un paquete se dice con todas las letras
 *      en vez de reventar.
 *   5. Que al importar se manda el paquete, las partes marcadas y qué
 *      hacer con las páginas repetidas.
 *   6. Y que el informe del final cuenta lo que ha pasado: creadas,
 *      reemplazadas, enlaces reconectados y los que se han quedado sin
 *      destino.
 *
 *   node tools/prueba-kit.mjs
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
const dir = mkdtempSync(join(tmpdir(), 'krg-kit-'));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const paginas = [
  { id: 11, title: 'Inicio', slug: 'inicio', uiStatus: 'publish', visibility: 'public', parentId: 0, isFront: true, modified: '2026-10-01 10:00:00', link: '#' },
  { id: 12, title: 'Contacto', slug: 'contacto', uiStatus: 'draft', visibility: 'public', parentId: 0, isFront: false, modified: '2026-10-01 10:00:00', link: '#' },
];

const paquete = {
  krg: 2,
  exportedAt: '2026-09-30T08:00:00+00:00',
  origen: { home: 'https://origen.test/', nombre: 'Origen' },
  tokens: { tokens: { color: { primary: '#3F5E58' } } },
  header: { ctaText: 'Reservar' },
  pages: [{ title: 'Inicio', slug: 'inicio', sections: [] }, { title: 'Carta', slug: 'carta', sections: [] }],
  templates: [{ id: 5, name: 'Cabecera', node: { type: 'heading' }, sections: [] }],
  globals: [],
};
const fichero = join(dir, 'paquete.json');
writeFileSync(fichero, JSON.stringify(paquete));
const basura = join(dir, 'basura.json');
writeFileSync(basura, '{"esto":"no es un paquete"}');
const roto = join(dir, 'roto.json');
writeFileSync(roto, 'esto no es ni json');

const resumen = {
  origen: 'https://origen.test/',
  fecha: '2026-09-30T08:00:00+00:00',
  tokens: true,
  chrome: true,
  menus: 1,
  plantillas: 1,
  globales: 0,
  paginas: 2,
  titulos: ['Inicio', 'Carta'],
  imagenes: 3,
};
const informe = {
  tokens: 'puestos',
  chrome: 'puesto',
  plantillas: { creadas: 1, actualizadas: 0 },
  globales: { creados: 0, actualizados: 0 },
  paginas: { creadas: 1, reemplazadas: 1, saltadas: 0, fallidas: 0 },
  enlaces: { reconectados: 7, 'sin destino': ['https://origen.test/tienda/'] },
  avisos: ['El paquete no lleva las fotos dentro: hay 3 imágenes que apuntan a la Biblioteca del sitio de origen.'],
};

const pedidos = { export: [], inspect: [], import: [] };

const html = `<!doctype html><meta charset="utf-8"><title>kit</title>
<style>${CSS}</style>
<body class="wp-admin"><div id="krg-admin"></div>
<script>window.KrgAdmin={page:'krg-kit',view:'',pageId:0,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:true,canEditPages:true,home:'https://destino.test/'};</script>
<script src="file://${JS}/app.js"></script>`;
const archivo = join(dir, 'kit.html');
writeFileSync(archivo, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  const cuerpo = () => JSON.parse(req.postData() || '{}');
  if (url === '/pages') return json(paginas);
  if (url === '/kit/export') { pedidos.export.push(cuerpo()); return json(paquete); }
  if (url === '/kit/inspect') {
    pedidos.inspect.push(cuerpo());
    const p = cuerpo().pack || {};
    if (!p.krg) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'El archivo no es un paquete KRG CMS válido.' }) });
    }
    return json(resumen);
  }
  if (url === '/kit/import') { pedidos.import.push(cuerpo()); return json(informe); }
  return json([]);
});
// La descarga del archivo no se puede seguir en un file://: se desactiva
// el clic del enlace y se mira el POST, que es lo que importa.
await page.addInitScript(() => {
  const real = document.createElement.bind(document);
  document.createElement = (tag) => {
    const n = real(tag);
    if (tag === 'a') n.click = () => { window.__descargas = (window.__descargas || 0) + 1; };
    return n;
  };
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
});

await page.goto(`file://${archivo}`);
await page.waitForSelector('#kit-exp', { timeout: 15000 });

console.log('PRUEBA 1 — elegir qué se lleva uno');
const partes = await page.$$eval('[data-exp]', (els) => els.map((e) => e.getAttribute('data-exp')));
ok(partes.join(',') === 'tokens,chrome,biblioteca,paginas',
  `las cuatro partes se eligen por separado: ${partes.join(', ')}`);
const todasMarcadas = await page.$$eval('[data-exp]', (els) => els.every((e) => e.checked));
ok(todasMarcadas, 'y vienen marcadas de serie: lo normal es llevárselo todo');

await page.uncheck('[data-exp="paginas"]');
await page.uncheck('[data-exp="biblioteca"]');
await page.click('#kit-exp');
await page.waitForTimeout(300);
ok(pedidos.export.length === 1, 'se pide el paquete al servidor');
const ex1 = pedidos.export[0];
ok(ex1.tokens === true && ex1.chrome === true && ex1.paginas === false && ex1.biblioteca === false,
  `y se pide exactamente lo marcado: ${JSON.stringify(ex1)}`);
ok(await page.evaluate(() => window.__descargas > 0), 'y el archivo se descarga');

console.log('\nPRUEBA 2 — llevarse una sola página');
await page.check('[data-exp="paginas"]');
await page.selectOption('#kit-pag', '12');
await page.click('#kit-exp');
await page.waitForTimeout(300);
const ex2 = pedidos.export[1];
ok(Array.isArray(ex2.pageIds) && ex2.pageIds[0] === 12, `se pide sólo esa página (${JSON.stringify(ex2.pageIds)})`);

console.log('\nPRUEBA 3 — mirar el paquete antes de importarlo');
await page.setInputFiles('#kit-file', fichero);
await page.waitForSelector('#kit-imp', { timeout: 8000 });
const texto = (await page.textContent('#kit-mirar')) || '';
ok(/origen\.test/.test(texto), 'dice de qué sitio salió');
const titular = ((await page.textContent('#kit-mirar h4')) || '').trim();
ok(/2 páginas/.test(texto) && /1 plantilla/.test(texto), `y qué trae: «${titular}»`);
ok(/Inicio, Carta/.test(texto), 'con los títulos, para reconocerlo');
ok(/3 fotos/.test(texto), 'y avisa de que las fotos no viajan dentro');
ok(pedidos.import.length === 0, 'mirar no importa nada');
const modos = await page.$$eval('#kit-modo option', (els) => els.map((e) => e.value));
ok(modos.join(',') === 'crear,reemplazar,saltar',
  'y se puede decidir qué pasa con una página que ya existe aquí');

console.log('\nPRUEBA 4 — un archivo que no es un paquete');
await page.setInputFiles('#kit-file', basura);
await page.waitForTimeout(400);
ok(/no es un paquete/i.test((await page.textContent('#kit-mirar')) || ''),
  'se dice con todas las letras');
await page.setInputFiles('#kit-file', roto);
await page.waitForTimeout(300);
ok(/no es un JSON/i.test((await page.textContent('#kit-mirar')) || ''),
  'y un archivo ilegible, también');
const rotos = () => errores.filter((e) => !/400 \(Bad Request\)/.test(e));
ok(rotos().length === 0, `sin que el panel se caiga${rotos().length ? ` — ${rotos()[0]}` : ''}`);

console.log('\nPRUEBA 5 — importar');
await page.setInputFiles('#kit-file', fichero);
await page.waitForSelector('#kit-imp', { timeout: 8000 });
await page.uncheck('[data-imp="tokens"]');
await page.selectOption('#kit-modo', 'reemplazar');
await page.click('#kit-imp');
await page.waitForSelector('#kit-informe:not([hidden])', { timeout: 8000 });
ok(pedidos.import.length === 1, 'se manda el paquete al servidor');
const imp = pedidos.import[0];
ok(imp.pack && imp.pack.krg === 2, 'con el paquete entero dentro');
ok(imp.opts.tokens === false && imp.opts.chrome === true,
  `y con las partes marcadas: ${JSON.stringify(imp.opts)}`);
ok(imp.opts.modo === 'reemplazar', 'y con lo que hay que hacer con las repetidas');

console.log('\nPRUEBA 6 — el informe de lo que ha pasado');
const inf = (await page.textContent('#kit-informe')) || '';
ok(/1 creadas, 1 reemplazadas/.test(inf), 'dice cuántas páginas se han creado y cuántas reemplazado');
ok(/Enlaces reconectados/.test(inf) && /7/.test(inf), 'cuántos enlaces se han reconectado');
ok(/origen\.test\/tienda/.test(inf), 'y cuáles se han quedado como estaban, uno por uno');
ok(/no lleva las fotos/.test(inf), 'con el aviso de las fotos que no viajan');
if (process.env.KRG_SHOT) await page.screenshot({ path: `${ROOT}/captura-kit.png`, fullPage: true });

// El 400 de la prueba 4 lo provoca este banco a propósito.
ok(rotos().length === 0, `sin errores de JavaScript${rotos().length ? ` — ${rotos()[0]}` : ''}`);

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
if (!fallos) console.log('LA PANTALLA DE EXPORTAR E IMPORTAR VA');
process.exit(fallos ? 1 : 0);
