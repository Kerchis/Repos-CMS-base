#!/usr/bin/env node
/**
 * El hueco entre columnas no puede echar la fila fuera de la pantalla.
 *
 * El fallo que esto vigila: una fila son doce pistas con once huecos
 * entre ellas. Con la «separación» en 40 px —un número normal, que se
 * pone desde el inspector sin mala intención— esos once huecos suman
 * 440 px. En un móvil de 390 px la fila no cabe ni estando vacía: las
 * columnas se salen por la derecha y el titular aparece cortado a
 * media palabra. No había forma de enterarse sin abrir la web en el
 * teléfono, porque en el escritorio se ve perfecto.
 *
 * Lo que se comprueba aquí:
 *
 *   1. Con separaciones normales (0, 16, 24) nada cambia: el hueco que
 *      se pide es el hueco que se pinta, en los tres tamaños.
 *   2. Con separaciones grandes (40, 64, 80) la fila sigue cabiendo:
 *      ni una columna se sale del ancho de la pantalla.
 *   3. El hueco vertical no se toca nunca: ese no desborda nada.
 *   4. Las columnas con tres y cuatro huecos, igual.
 *   5. Y el servidor y el panel escriben la misma regla, que si no la
 *      vista previa y la web dejan de parecerse.
 *
 *   node tools/prueba-huecos.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const PHP = `${ROOT}/.tools/php/php`;

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const dir = mkdtempSync(join(tmpdir(), 'krg-huecos-'));
let semilla = 0;
const nodo = (type, props, children) => {
  semilla += 1;
  return {
    id: `h${String(semilla).padStart(3, '0')}`,
    type,
    name: type,
    visible: true,
    source: 'local',
    globalId: 0,
    props: props || {},
    styles: { desktop: {}, tablet: {}, mobile: {} },
    children: children || [],
  };
};

/** Una sección con una fila de `cols` columnas y la separación dada. */
function seccionConFila(gap, cols) {
  const columnas = [];
  const span = Math.floor(12 / cols);
  for (let i = 0; i < cols; i += 1) {
    columnas.push(nodo('column', { span, spanTablet: span, spanMobile: 12 }, [
      nodo('paragraph', { text: `Columna número ${i + 1} con texto suficiente para que se note si se sale.` }),
    ]));
  }
  return nodo('section', { width: 'padded' }, [nodo('row', { gap, vAlign: 'start' }, columnas)]);
}

// Hasta 80, que es el máximo que deja poner el inspector; de nada
// vale probar con 200 porque el saneador lo recorta al entrar.
const CASOS = [
  { gap: 0, cols: 2 },
  { gap: 16, cols: 2 },
  { gap: 24, cols: 3 },
  { gap: 40, cols: 2 },
  { gap: 64, cols: 4 },
  { gap: 80, cols: 2 },
];

semilla = 0;
const doc = {
  id: 1,
  title: 'Huecos',
  slug: 'huecos',
  status: 'publish',
  seo: {},
  settings: {},
  sections: CASOS.map((c) => seccionConFila(c.gap, c.cols)),
};
const ruta = join(dir, 'huecos.json');
writeFileSync(ruta, JSON.stringify(doc));
const html = execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, ruta], { encoding: 'utf8' });
const archivo = join(dir, 'huecos.html');
writeFileSync(archivo, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});

const TAMANOS = [
  { nombre: 'móvil', width: 390, height: 844 },
  { nombre: 'tablet', width: 834, height: 1112 },
  { nombre: 'escritorio', width: 1440, height: 900 },
];

for (const t of TAMANOS) {
  console.log(`\nPRUEBA — ${t.nombre} (${t.width} px)`);
  const page = await browser.newPage({ viewport: { width: t.width, height: t.height } });
  await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('file://' + archivo);
  await page.waitForTimeout(200);

  // Nada de `getComputedStyle`: Chrome devuelve el `min(40px, 8.18%)`
  // tal cual, sin resolver, y `parseFloat` de eso es cero. Lo que vale
  // es dónde han acabado las columnas.
  const medidas = await page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    return [...document.querySelectorAll('.m-row')].map((fila) => {
      const caja = fila.getBoundingClientRect();
      const cols = [...fila.querySelectorAll(':scope > .m-col')].map((c) => {
        const b = c.getBoundingClientRect();
        return { izq: b.left, der: b.right, arr: b.top, aba: b.bottom, ancho: b.width };
      });
      const apilado = cols.length > 1 && cols[1].arr >= cols[0].aba - 1;
      const suma = cols.reduce((t, c) => t + c.ancho, 0);
      return {
        anchoFila: caja.width,
        apilado,
        // Las columnas cubren las doce pistas, así que lo que sobra del
        // ancho de la fila son los huecos.
        huecoH: !apilado && cols.length > 1 ? (caja.width - suma) / (cols.length - 1) : null,
        huecoV: apilado ? cols[1].arr - cols[0].aba : null,
        sale: cols.some((c) => c.der > ancho + 1 || c.izq < -1),
      };
    });
  });
  await page.close();

  medidas.forEach((m, i) => {
    const caso = CASOS[i];
    // El tope es del ancho de la fila repartido entre los ONCE huecos
    // de las doce pistas, no entre las columnas que haya puestas.
    const tope = (m.anchoFila * 0.9) / 11;
    const esperado = Math.min(caso.gap, tope);
    const cabe = caso.gap <= tope;
    ok(!m.sale, `separación ${caso.gap} px en ${caso.cols} columnas: ninguna se sale de la pantalla`);
    if (m.apilado) {
      ok(Math.abs(m.huecoV - caso.gap) <= 1,
        `    apiladas: el hueco vertical es el pedido, ${Math.round(m.huecoV)} px, sin recortar`);
    } else if (cabe) {
      // Si cabe, el valor pedido es sagrado: nada de encoger lo que ya
      // se veía bien.
      ok(Math.abs(m.huecoH - caso.gap) <= 1,
        `    y el hueco de verdad es el pedido (${Math.round(m.huecoH)} px), porque cabe`);
    } else {
      ok(m.huecoH > 0 && Math.abs(m.huecoH - esperado) <= 1.5,
        `    se recorta a ${Math.round(m.huecoH)} px porque ${caso.gap} no cabía (tope ${Math.round(tope)})`);
    }
  });
}

await browser.close();

console.log('\nPRUEBA — el servidor y el panel escriben lo mismo');
// Si uno recorta y el otro no, la vista previa y la web dejan de
// parecerse, que es el pecado original de este proyecto.
const php = readFileSync(`${ROOT}/krg-cms/core/style/DocumentCssCompiler.php`, 'utf8');
const core = readFileSync(`${ROOT}/krg-cms/admin/assets/js/builder-core.js`, 'utf8');
const campos = readFileSync(`${ROOT}/krg-cms/admin/assets/js/builder-fields.js`, 'utf8');
ok(/function grid_gap/.test(php), 'el compilador del servidor tiene su `grid_gap()`');
ok(/function gridGap/.test(core), 'y el constructor su `gridGap()`, en el núcleo compartido');
ok(/gridGap\(g, 12\)/.test(campos), 'la vista viva del panel la usa para las filas');
ok(!/gap:\$\{g\}px;grid-template-columns:repeat\(12/.test(campos),
  'y ya no queda ningún sitio escribiendo el hueco a pelo');
const tope = php.match(/90 \/ \( \$pistas - 1 \)/) && core.match(/90 \/ \(pistas - 1\)/);
ok(!!tope, 'los dos reparten el mismo 90 % entre los huecos');

console.log('');
if (fallos) {
  console.log(`HAY ${fallos} FALLOS (${hechas - fallos} comprobaciones correctas)`);
  process.exit(1);
}
console.log(`LOS HUECOS NO DESBORDAN (${hechas} comprobaciones)`);
