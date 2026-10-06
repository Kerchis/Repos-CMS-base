#!/usr/bin/env node
/**
 * Inspirarse en otra web o en una foto.
 *
 * Qué faltaba: montar un sitio nuevo empieza casi siempre con un «quiero
 * que se parezca a esto». Hasta ahora eso era mirar la web de referencia
 * con cuentagotas y teclear hexadecimales a mano. El medidor hace esa
 * parte aburrida: cuenta qué colores ocupan más sitio, qué tipografías
 * se usan y de qué tamaño son los títulos, y propone una paleta. No baja
 * HTML ni CSS de nadie: lo que viaja son números.
 *
 * Lo que se comprueba, con el medidor de verdad en un navegador:
 *
 *   1. Que midiendo una web reconoce su fondo, su texto y su color de
 *      acento, y las dos familias tipográficas.
 *   2. Que deja la medida a mano, en una caja que se puede copiar.
 *   3. Que avisa cuando el texto de la referencia no se lee sobre su
 *      propio fondo, en vez de copiar el problema.
 *   4. Que de una foto salen los colores que de verdad mandan en ella, y
 *      que el texto se ajusta hasta que se lee.
 *   5. Que la propuesta se convierte en un paquete con la paleta entera
 *      —los veinte papeles, no cinco— y en el formato que ya sabe leer
 *      «Exportar e importar».
 *   6. Y que en la pantalla se ve la propuesta, se aplica y sólo toca
 *      los tokens: ni páginas, ni cabecera, ni biblioteca.
 *
 *   node tools/prueba-estilo.mjs
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
const ESTILO = readFileSync(`${JS}/estilo.js`, 'utf8');
const REST = 'https://krg.test/wp-json/krg/v1';
const dir = mkdtempSync(join(tmpdir(), 'krg-estilo-'));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

/* Una web de mentira con una pinta muy marcada: fondo crema, texto
   negro, títulos en una familia y cuerpo en otra, y botones verdes. */
const referencia = `<!doctype html><meta charset="utf-8"><title>Referencia</title>
<style>
  body { margin:0; background:#fef6e7; color:#000000; font:16px/1.6 Georgia, serif; }
  header { background:#fef6e7; padding:24px 40px; }
  h1, h2, h3 { font-family: Verdana, sans-serif; margin:0 0 16px; }
  h1 { font-size:64px; } h2 { font-size:40px; } h3 { font-size:24px; }
  section { padding:96px 40px; }
  .tarjeta { background:#f7ead1; border:1px solid #e1d3b6; border-radius:20px; padding:28px; margin:16px 0; }
  .boton { display:inline-block; background:#3f5e58; color:#fef6e7; padding:14px 28px; border-radius:20px; }
</style>
<body>
  <header><h1>Miel de verdad</h1><p>Desde 1974 en el mismo valle, con las mismas abejas.</p></header>
  <section>
    <h2>Nuestros tarros</h2>
    <div class="tarjeta"><h3>Tarro de flores</h3><p>Un texto largo de relleno para que el medidor tenga letras que contar y sepa cuál es la tipografía del cuerpo.</p><a class="boton" href="#">Comprar</a></div>
    <div class="tarjeta"><h3>Tarro de bosque</h3><p>Otro texto largo de relleno, también en la tipografía del cuerpo, para que no haya empate con la de los títulos.</p><a class="boton" href="#">Comprar</a></div>
  </section>
  <section>
    <h2>Dónde estamos</h2>
    <p>Un párrafo más, con bastantes letras, porque el color del texto se pesa por cuántas letras hay de cada color y no por cuántas etiquetas.</p>
  </section>`;
const refFile = join(dir, 'referencia.html');
writeFileSync(refFile, referencia);

/* Y otra con el texto ilegible a propósito: gris clarito sobre crema. */
const floja = referencia.replace('color:#000000', 'color:#c8c0ae');
const flojaFile = join(dir, 'floja.html');
writeFileSync(flojaFile, floja);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});

/* ===================================================================
 * 1 a 3 — el marcador sobre una web
 * =================================================================== */
const medir = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await medir.goto(`file://${refFile}`);
await medir.addScriptTag({ content: ESTILO });
const medida = await medir.evaluate(() => window.KrgMedidor());

console.log('PRUEBA 1 — medir una web');
ok(medida.colores.background.toLowerCase() === '#fef6e7',
  `reconoce el fondo (${medida.colores.background})`);
ok(medida.colores.text.toLowerCase() === '#000000',
  `y el color del texto (${medida.colores.text})`);
ok(medida.colores.primary.toLowerCase() === '#3f5e58',
  `y el color de acento, que está en los botones y no en el fondo (${medida.colores.primary})`);
ok(medida.colores.surface.toLowerCase() === '#f7ead1',
  `y la superficie de las tarjetas (${medida.colores.surface})`);
ok(medida.colores.border.toLowerCase() === '#e1d3b6',
  `y el color de los bordes (${medida.colores.border})`);
ok(medida.tipografias.heading === 'Verdana' && medida.tipografias.body === 'Georgia',
  `distingue la tipografía de los títulos de la del cuerpo (${medida.tipografias.heading} / ${medida.tipografias.body})`);
ok(medida.escala.h1 === 64 && medida.escala.h2 === 40 && medida.escala.p === 16,
  `y mide la escala: H1 ${medida.escala.h1}, H2 ${medida.escala.h2}, texto ${medida.escala.p}`);
ok(medida.radio === 20, `y el redondeo de las esquinas (${medida.radio} px)`);
ok(medida.seccion === 96, `y el aire de las secciones (${medida.seccion} px)`);
ok(/referencia\.html$/.test(medida.de), 'deja dicho de dónde se sacó');

console.log('\nPRUEBA 2 — y la deja a mano');
ok(await medir.isVisible('#krg-medidor'), 'sale una caja encima de la web medida');
const pegado = await medir.inputValue('#krg-medidor textarea');
let releida = null;
try {
  releida = JSON.parse(pegado);
} catch (err) { /* lo dirá la aserción */ }
ok(releida && releida.colores.background.toLowerCase() === '#fef6e7',
  'con la medida entera dentro, lista para copiar y pegar en el panel');
ok((await medir.$$('#krg-medidor span')).length >= 5, 'y las muestras de color a la vista');
await medir.click('#krg-med-cerrar');
ok(!(await medir.isVisible('#krg-medidor')), 'y se cierra sin dejar rastro en la web medida');

console.log('\nPRUEBA 3 — una web con el texto ilegible');
const floj = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await floj.goto(`file://${flojaFile}`);
await floj.addScriptTag({ content: ESTILO });
const mal = await floj.evaluate(() => window.KrgMedidor());
ok(mal.contraste < 4.5, `se da cuenta de que no llega al mínimo (${mal.contraste}:1)`);
ok(mal.avisos.length > 0 && /4\.5/.test(mal.avisos[0]), `y lo dice: «${(mal.avisos[0] || '').slice(0, 60)}…»`);
const arreglado = await floj.evaluate((m) => window.KrgEstilo.aPaquete(m).tokens.tokens.color.text.value, mal);
const ratio = await floj.evaluate(([a, b]) => Math.round(window.KrgEstilo.contraste(a, b) * 10) / 10,
  [arreglado, mal.colores.background]);
ok(ratio >= 4.5, `y al llevarlo al paquete el texto se oscurece hasta leerse (${arreglado}, ${ratio}:1)`);
await floj.close();

/* ===================================================================
 * 4 y 5 — la foto y el paquete
 * =================================================================== */
console.log('\nPRUEBA 4 — una paleta desde una foto');
const foto = await medir.evaluate(() => {
  // Una foto de mentira: mucho azul noche, un buen trozo de amarillo
  // de miel y una esquina casi blanca.
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 200;
  const x = c.getContext('2d');
  x.fillStyle = '#16233a';
  x.fillRect(0, 0, 200, 200);
  x.fillStyle = '#e8c547';
  x.fillRect(0, 140, 200, 60);
  x.fillStyle = '#f2efe6';
  x.fillRect(160, 0, 40, 40);
  return c.toDataURL('image/png');
});
const desdeFoto = await medir.evaluate(async (url) => {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  return window.KrgEstilo.desdeFoto(img, { nombre: 'tarro.png' });
}, foto);
const cerca = (a, b, margen = 24) => {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const [x, y] = [n(a), n(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i]))) <= margen;
};
ok(cerca(desdeFoto.colores.background, '#16233a'),
  `el color que más manda es el fondo (${desdeFoto.colores.background})`);
ok(cerca(desdeFoto.colores.primary, '#e8c547', 32),
  `el más vivo es el acento (${desdeFoto.colores.primary})`);
ok(desdeFoto.contraste >= 4.5,
  `y el texto se elige para que se lea sobre ese fondo (${desdeFoto.colores.text}, ${desdeFoto.contraste}:1)`);
ok(desdeFoto.de === 'tarro.png', 'queda dicho de qué foto salió');
ok(desdeFoto.tipografias === null, 'de una foto no salen tipografías, y no se las inventa');

console.log('\nPRUEBA 5 — de la propuesta al paquete');
const pack = await medir.evaluate((m) => window.KrgEstilo.aPaquete(m), medida);
ok(pack.krg === 2 && pack.tokens && pack.tokens.tokens,
  'sale un paquete con la misma forma que el de exportar');
const color = pack.tokens.tokens.color;
ok(Object.keys(color).length >= 19,
  `con la paleta entera y no sólo los cinco medidos (${Object.keys(color).length} papeles)`);
ok(color.background.value.toLowerCase() === '#fef6e7' && color.primary.value.toLowerCase() === '#3f5e58',
  'los medidos tal cual');
const legibles = await medir.evaluate((c) => ({
  sobrePrimario: window.KrgEstilo.contraste(c['on-primary'].value, c.primary.value),
  sobreSuperficie: window.KrgEstilo.contraste(c['on-surface'].value, c.surface.value),
  atenuado: window.KrgEstilo.contraste(c.muted.value, c.background.value),
}), color);
ok(legibles.sobrePrimario >= 4.5 && legibles.sobreSuperficie >= 4.5 && legibles.atenuado >= 4.5,
  `y los derivados se leen todos: ${Object.values(legibles).map((n) => `${Math.round(n * 10) / 10}:1`).join(', ')}`);
ok(pack.tokens.tokens.font.heading.value.includes('Verdana')
  && pack.tokens.tokens.font.body.value.includes('Georgia'),
  'las tipografías viajan con su familia de respaldo detrás');
ok(pack.tokens.tokens.spacing.section.value === '96px' && pack.tokens.tokens.radius.cards.value === '20px',
  'y el aire y el redondeo medidos');
ok(!pack.pages && !pack.templates && !pack.header,
  'y nada más: una medida de estilo no trae páginas');
const sinFoto = await medir.evaluate((m) => window.KrgEstilo.aPaquete(m), desdeFoto);
ok(!sinFoto.tokens.tokens.font, 'y si no había tipografías, el paquete no las toca');
await medir.close();

/* ===================================================================
 * 6 — la pantalla
 * =================================================================== */
console.log('\nPRUEBA 6 — la pantalla de Exportar e importar');
const informe = {
  tokens: 'puestos',
  chrome: 'sin tocar',
  plantillas: { creadas: 0, actualizadas: 0 },
  globales: { creados: 0, actualizados: 0 },
  paginas: { creadas: 0, reemplazadas: 0, saltadas: 0, fallidas: 0 },
  enlaces: { reconectados: 0, 'sin destino': [] },
  avisos: [],
};
const pedidos = [];
const html = `<!doctype html><meta charset="utf-8"><title>kit</title>
<style>${CSS}</style>
<body class="wp-admin"><div id="krg-admin"></div>
<script>window.KrgAdmin={page:'krg-kit',view:'',pageId:0,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:true,canEditPages:true,home:'https://destino.test/'};</script>
<script src="file://${JS}/estilo.js"></script>
<script src="file://${JS}/app.js"></script>`;
const archivo = join(dir, 'kit.html');
writeFileSync(archivo, html);

const panel = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const errores = [];
panel.on('pageerror', (e) => errores.push(String(e)));
panel.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await panel.route('**/krg.test/**', async (route) => {
  const url = route.request().url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url === '/kit/import') {
    pedidos.push(JSON.parse(route.request().postData() || '{}'));
    return json(informe);
  }
  if (url === '/pages') return json([]);
  return json([]);
});
await panel.goto(`file://${archivo}`);
await panel.waitForSelector('#med-leer', { timeout: 15000 });

const href = await panel.getAttribute('#med-marcador', 'href');
ok(String(href).startsWith('javascript:') && href.includes('KrgMedidor') === false && href.length > 500,
  'el marcador se arrastra con el medidor entero dentro, sin depender de este sitio');

await panel.fill('#med-json', JSON.stringify(medida));
await panel.click('#med-leer');
await panel.waitForSelector('#med-aplicar', { timeout: 8000 });
const texto = (await panel.textContent('#med-prop')) || '';
ok(/#FEF6E7/i.test(texto) && /#3F5E58/i.test(texto), 'se ven los colores propuestos, con su hexadecimal');
ok(/Verdana/.test(texto) && /Georgia/.test(texto), 'y las dos tipografías');
ok((await panel.$$('.m-kit-swatch')).length === 5, 'cinco muestras de color a tamaño de verlas');

await panel.click('#med-aplicar');
await panel.waitForTimeout(400);
ok(pedidos.length === 1, 'al aplicar se manda al servidor');
const enviado = pedidos[0] || {};
ok(enviado.opts && enviado.opts.tokens === true && enviado.opts.paginas === false
  && enviado.opts.chrome === false && enviado.opts.biblioteca === false,
  `y sólo se tocan los tokens: ${JSON.stringify(enviado.opts)}`);
ok(enviado.pack && enviado.pack.tokens.tokens.color.background.value.toLowerCase() === '#fef6e7',
  'con la paleta dentro');
ok(/Paleta/.test((await panel.textContent('#kit-informe')) || ''), 'y el informe de siempre cuenta qué ha pasado');

const mala = { esto: 'no es una medida' };
await panel.fill('#med-json', JSON.stringify(mala));
await panel.click('#med-leer');
await panel.waitForTimeout(200);
ok(/colores/i.test((await panel.textContent('#med-prop')) || ''),
  'si se pega cualquier cosa, se dice en vez de reventar');
ok(pedidos.length === 1, 'y no se manda nada al servidor');
ok(errores.length === 0, `sin errores de JavaScript${errores.length ? ` — ${errores[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await panel.fill('#med-json', JSON.stringify(medida));
  await panel.click('#med-leer');
  await panel.waitForTimeout(300);
  await panel.screenshot({ path: `${ROOT}/captura-estilo.png`, fullPage: true });
  console.log(`\n  captura en ${ROOT}/captura-estilo.png`);
}

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas`);
console.log(fallos ? 'HAY QUE ARREGLARLO' : 'EL MEDIDOR DE ESTILO VA');
process.exit(fallos ? 1 : 0);
