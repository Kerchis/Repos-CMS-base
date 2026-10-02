#!/usr/bin/env node
/**
 * Mide una pagina montada con el marcado REAL del tema.
 *
 * Por que: una franja vacia entre dos bloques puede salir del relleno de
 * la seccion, del espacio que sobra cuando el contenido es mas bajo que
 * el alto configurado, o de una seccion intermedia. A ojo no se
 * distinguen. Esto imprime, para cada seccion, de donde sale cada pixel.
 *
 *   node tools/medir.mjs <caso> [ancho] [alto] [--lienzo]
 *   node tools/medir.mjs hueco-b-panel-corto 1440 1197
 *
 * El caso es uno de los de tools/render.php. Con --lienzo se rinde como
 * el lienzo del constructor, donde lo vacio si se imprime.
 */
import { ROOT, chromiumLib, render, pagina, medirSecciones } from './harness.mjs';

const args = process.argv.slice(2);
const canvas = args.includes('--lienzo');
const [caso, w, h] = args.filter((a) => !a.startsWith('--'));
const W = Number(w || 1440);
const H = Number(h || 1197);
if (!caso) {
  console.error('Uso: node tools/medir.mjs <caso> [ancho] [alto] [--lienzo]');
  process.exit(1);
}

const file = pagina(`medir-${caso}${canvas ? '-lienzo' : ''}`, render(caso, { canvas }), { canvas });

const { chromium } = chromiumLib();
const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto('file://' + file);
await page.waitForTimeout(250);

const filas = await page.evaluate(medirSecciones);
const desborde = await page.evaluate(
  () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
);

console.log(`\ncaso: ${caso}${canvas ? ' (lienzo)' : ''}   ventana: ${W}x${H}   desborde horizontal: ${desborde}px`);
console.table(filas.map(({ clases, ...r }) => r));
const muerto = filas.reduce((a, f) => a + Math.max(0, f.colaVacia) + Math.max(0, f.huecoSiguiente), 0);
console.log(`espacio muerto total: ${Math.round(muerto)} px\n`);

await browser.close();
