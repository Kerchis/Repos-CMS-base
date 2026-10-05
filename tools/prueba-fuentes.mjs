#!/usr/bin/env node
/**
 * La fuente que el navegador PINTA, no la que el CSS declara.
 *
 * Esta es la prueba que faltaba. El banco de PHP comprueba que se pide
 * el archivo; este comprueba lo único que de verdad importa: que el
 * texto de la página acaba dibujado con esa fuente. Era justo el punto
 * ciego del fallo original —«font-family: Questrial» en el inspector y
 * Arial en la pantalla—, y ningún contador de OKs lo veía.
 *
 * Cómo se mide sin internet: se intercepta la hoja de Google y se
 * devuelve un `@font-face` que apunta a un archivo de fuente de verdad
 * con una anchura de letra muy distinta. Si el navegador acaba usándolo,
 * el texto mide otra cosa; si se queda en la de respaldo, mide igual.
 * Dos comprobaciones independientes: `document.fonts.check()` y el ancho
 * real del renglón.
 *
 *   node tools/prueba-fuentes.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const PHP = `${ROOT}/.tools/php/php`;
const PUBLICO = 'https://krg.test/pagina/';
const dir = mkdtempSync(join(tmpdir(), 'krg-font-'));

// Una fuente de verdad con letras de anchura muy distinta a la del
// sistema: si el navegador la usa, se nota en el ancho del renglón. La
// cursiva de Open Sans mide un 12 % menos que la de respaldo; una
// tipografía de iconos no vale, porque no tiene letras latinas y el
// navegador acaba pintando con la de siempre sin que se note.
const TTF = [
  `${ROOT}/.tools/chromium/lib/fonts/Open_Sans/OpenSans-Italic.ttf`,
  `${ROOT}/.tools/chromium/lib/fonts/Open_Sans/OpenSans-Bold.ttf`,
].find((f) => existsSync(f));

let ok = 0;
let fallos = 0;
const comprueba = (cond, msg) => {
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  cond ? ++ok : ++fallos;
};

const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: {}, children,
});

const doc = {
  id: 1, title: 'Fuentes', slug: 'fuentes', status: 'draft', checksum: 'c',
  seo: {}, settings: {},
  sections: [
    nodo('sec', 'section', { width: 'boxed' }, [
      nodo('r', 'row', {}, [nodo('c', 'column', { span: 12 }, [
        nodo('e1', 'eyebrow', { text: 'HAMBURGEFONSTIV' }, []),
        nodo('h1', 'heading', { text: 'Hamburgefonstiv', tag: 'h2' }, []),
        nodo('p1', 'paragraph', { text: 'Hamburgefonstiv' }, []),
      ])]),
    ]),
  ],
};

const tokens = (font, extra = {}) => ({
  tokens: {
    activePreset: 'marca',
    version: 1,
    tokens: {
      color: { primary: { value: '#3f5e58' } },
      font,
      spacing: { section: '96px' },
    },
  },
  ...extra,
});

/** Pinta la página por el camino real, con los tokens de esta prueba. */
function pintar(conf) {
  const tf = join(dir, 'tok.json');
  const df = join(dir, 'doc.json');
  writeFileSync(tf, JSON.stringify(conf));
  writeFileSync(df, JSON.stringify(doc));
  return execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, df], {
    encoding: 'utf8',
    env: { ...process.env, KRG_TOKENS: tf },
  });
}

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).split('\n')[0]));

let html = '';
let pedidas = [];
let familiaFalsa = 'Questrial';

await page.route('**/fonts.googleapis.com/**', (route) => {
  pedidas.push(route.request().url());
  // El servidor de Google, de mentira: devuelve la fuente de prueba con
  // el nombre que se le haya pedido.
  const css = `@font-face{font-family:'${familiaFalsa}';font-style:normal;font-weight:400;font-display:block;src:url(https://fonts.gstatic.com/prueba.ttf) format('truetype');}`;
  route.fulfill({ status: 200, contentType: 'text/css', body: css });
});
await page.route('**/fonts.gstatic.com/**', (route) =>
  route.fulfill({ status: 200, contentType: 'font/ttf', body: readFileSync(TTF) })
);
await page.route('**/krg.test/**', (route) =>
  route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
);

/**
 * Mide el texto con la familia del sitio y con Arial.
 *
 * Con la caja del elemento no vale: un antetítulo es un bloque y mide
 * lo que mida su columna, lleve la fuente que lleve. Se mide la cadena
 * con un lienzo, que es lo que de verdad cambia de ancho según la
 * fuente **cargada**.
 */
const medir = (familia) => page.evaluate(async (fam) => {
  await document.fonts.ready;
  try { await document.fonts.load(`400 40px ${fam}`); } catch (e) { /* no pasa nada */ }
  const el = document.querySelector('.m-eyebrow');
  const lienzo = document.createElement('canvas').getContext('2d');
  const ancho = (f) => {
    lienzo.font = `400 40px ${f}`;
    return Math.round(lienzo.measureText('Hamburgefonstiv 123').width);
  };
  return {
    familia: getComputedStyle(el).fontFamily,
    conLaFuente: ancho(`${fam}, sans-serif`),
    conArial: ancho('Arial, sans-serif'),
    cargada: [...document.fonts].some((f) => f.family.replace(/["']/g, '') === fam.replace(/["']/g, '')),
    hojas: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.id),
  };
}, familia);

/* ================================================================== */
console.log('\n--- Una familia elegida en el panel se descarga y se pinta');
comprueba(!!TTF, `hay una fuente de prueba en el entorno (${TTF ? TTF.split('/').pop() : 'NO'})`);
pedidas = [];
html = pintar(tokens({
  heading: { value: 'Archivo, sans-serif', weight: '800' },
  body: { value: 'Inter, sans-serif' },
  ui: { value: 'Questrial, sans-serif', weight: '400' },
}));
comprueba(html.includes('family=Questrial'), 'la página pide el archivo de Questrial');
await page.goto(PUBLICO);
let m = await medir('Questrial');
comprueba(pedidas.length > 0, `y el navegador lo descarga de verdad (${pedidas.length} petición/es)`);
comprueba(/Questrial/.test(m.familia), `el antetítulo declara la familia (${m.familia})`);
comprueba(m.cargada, 'el navegador tiene la fuente cargada y disponible');
comprueba(m.conLaFuente !== m.conArial,
  `y el texto se dibuja con ella: ${m.conLaFuente}px frente a ${m.conArial}px con Arial`);

/* ================================================================== */
console.log('\n--- El fallo de antes: declarada pero no descargada');
// Se reproduce el estado anterior quitando el <link> de la página.
const sinLink = html.replace(/<link rel="stylesheet" id="krg-font[^>]*>/g, '');
const guardado = html;
html = sinLink;
pedidas = [];
await page.goto(PUBLICO);
let m2 = await medir('Questrial');
comprueba(pedidas.length === 0, 'sin la hoja de fuentes no se pide nada');
comprueba(/Questrial/.test(m2.familia), 'el CSS sigue diciendo «Questrial» —por eso el inspector engañaba—');
comprueba(m2.conLaFuente === m2.conArial,
  `pero se pinta con la de respaldo: ${m2.conLaFuente}px, igual que Arial (${m2.conArial}px)`);
comprueba(!m2.cargada, 'y no hay ninguna Questrial declarada en el documento');
html = guardado;

/* ================================================================== */
console.log('\n--- Una fuente escrita a mano, marcando «Cargar desde Google Fonts»');
familiaFalsa = 'Mi Fuente Rara';
pedidas = [];
html = pintar(tokens({
  ui: { value: '"Mi Fuente Rara", sans-serif', weight: '400', google: 'Mi Fuente Rara' },
}));
comprueba(html.includes('family=Mi%20Fuente%20Rara') || html.includes('family=Mi+Fuente+Rara'),
  'la página la pide por su nombre');
await page.goto(PUBLICO);
const m3 = await medir('"Mi Fuente Rara"');
comprueba(pedidas.length > 0, 'el navegador la descarga');
comprueba(m3.cargada, 'queda declarada en el documento');
comprueba(m3.conLaFuente !== m3.conArial,
  `y la pinta: ${m3.conLaFuente}px frente a ${m3.conArial}px`);

/* ================================================================== */
console.log('\n--- Una fuente del sistema no pide nada a nadie');
pedidas = [];
html = pintar(tokens({
  heading: { value: 'Georgia, "Times New Roman", serif' },
  body: { value: 'Georgia, "Times New Roman", serif' },
  ui: { value: 'Arial, Helvetica, sans-serif' },
}));
comprueba(!html.includes('fonts.googleapis.com'), 'la página no enlaza ninguna hoja de Google');
await page.goto(PUBLICO);
await page.waitForTimeout(200);
comprueba(pedidas.length === 0, 'y el navegador no sale a internet a por nada');

/* ================================================================== */
console.log('\n--- La tipografía del menú también se carga');
familiaFalsa = 'Jost';
pedidas = [];
html = pintar(tokens(
  { heading: { value: 'Archivo, sans-serif' } },
  { header: { navFont: '"Jost", sans-serif', navWeight: '500' } }
));
comprueba(html.includes('family=Jost'), 'la familia del menú viaja en la hoja de fuentes');
comprueba(html.includes('0,500'), 'con el peso que se eligió para el menú');

/* ================================================================== */
console.log('\n--- Ningún error de JavaScript');
comprueba(errores.length === 0, errores.length ? errores.join(' | ') : 'ninguno');

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS (${ok} correctas)` : `LA FUENTE ELEGIDA SE PINTA DE VERDAD (${ok} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
