#!/usr/bin/env node
/**
 * Banco de pruebas de «lo que escribes en el panel manda».
 *
 * Por que: un color o un relleno pasan por cuatro manos antes de verse
 * (panel → saneador → renderizador → cascada de CSS) y cualquiera de las
 * cuatro puede tirarlo sin avisar. Mirar el lienzo no vale como prueba:
 * el constructor repinta por su cuenta. Aqui se monta el documento con el
 * mismo saneador y el mismo compilador de CSS que usa WordPress, se abre
 * en un navegador de verdad y se lee el color calculado.
 *
 *   node tools/prueba-estilos.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */
import { ROOT, chromiumLib, render, pagina } from './harness.mjs';

const { chromium } = chromiumLib();
const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

let ok = 0;
let fallos = 0;

/** Lee una propiedad calculada del primer elemento que encaje. */
const leer = (sel, prop) =>
  page.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    if (!el) return '«no existe»';
    const cs = getComputedStyle(el);
    if (p === 'top') return Math.round(el.getBoundingClientRect().top);
    if (p === 'height') return Math.round(el.getBoundingClientRect().height);
    return cs.getPropertyValue(p).trim();
  }, [sel, prop]);

async function caso(nombre, comprobaciones) {
  const file = pagina(`estilos-${nombre}`, render(nombre));
  await page.goto('file://' + file);
  await page.waitForTimeout(60);
  console.log(`\n${nombre}`);
  for (const [sel, prop, esperado] of comprobaciones) {
    const real = await leer(sel, prop);
    const bien = typeof esperado === 'function' ? esperado(real) : String(real) === String(esperado);
    if (bien) {
      ++ok;
      console.log(`  OK    ${sel} ${prop} = ${real}`);
    } else {
      ++fallos;
      console.log(`  FALLA ${sel} ${prop} = ${real} (esperaba ${esperado})`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 1. Estilos del panel de diseño (node.styles → CSS del documento)    */
/* ------------------------------------------------------------------ */

await caso('estilos-fondo-cta', [['.m-n-cta1', 'background-color', 'rgb(217, 78, 39)']]);
await caso('estilos-fondo-seccion', [['.m-n-sec2', 'background-color', 'rgb(217, 78, 39)']]);
await caso('estilos-relleno-carta', [
  ['.m-n-carta1', 'padding-top', '40px'],
  ['.m-n-carta1', 'padding-bottom', '40px'],
]);
await caso('estilos-relleno-seccion-carta', [
  ['.m-n-sec3', 'padding-top', '40px'],
  ['.m-n-sec3', 'padding-bottom', '40px'],
]);

/* ------------------------------------------------------------------ */
/* 2. Alineación vertical dentro de una sección con alto              */
/* ------------------------------------------------------------------ */

// La sección mide 1400 px y la carta ~600: centrada tiene que empezar
// bastante por debajo del borde superior, no pegada a él.
await caso('estilos-valign-carta', [
  ['.m-n-sec4', 'height', (v) => Number(v) === 1400],
  ['.m-carta', 'top', (v) => Number(v) > 300],
]);

/* ------------------------------------------------------------------ */
/* 3. Colores propios del bloque, por encima del «Tema»               */
/* ------------------------------------------------------------------ */

await caso('colores-cta-tema', [
  // Sin color elegido manda el tema: verde de marca y texto crema.
  ['.m-n-cta4', 'background-color', 'rgb(63, 94, 88)'],
  ['.m-n-cta4', 'color', 'rgb(254, 246, 231)'],
]);

await caso('colores-cta-propio', [
  ['.m-n-cta3', 'background-color', 'rgb(217, 78, 39)'],
  ['.m-n-cta3', 'color', 'rgb(255, 249, 240)'],
  ['.m-n-cta3', 'padding-top', '40px'],
  ['.m-n-cta3', 'padding-bottom', '40px'],
]);

await caso('colores-token', [
  // Un token del sistema escrito como var(--color-primary) ya no se tira.
  ['.m-n-cta5', 'background-color', 'rgb(63, 94, 88)'],
]);

await caso('colores-carta-tema', [
  ['.m-n-carta5', 'padding-top', (v) => Number.parseFloat(v) > 60],
  ['.m-carta-price', 'color', 'rgb(192, 21, 47)'],
]);

await caso('colores-carta', [
  ['.m-n-carta4', 'background-color', 'rgb(16, 16, 16)'],
  ['.m-n-carta4', 'color', 'rgb(242, 242, 242)'],
  ['.m-n-carta4', 'padding-top', '50px'],
  ['.m-n-carta4', 'padding-bottom', '70px'],
  ['.m-carta-title', 'color', 'rgb(255, 209, 102)'],
  ['.m-carta-cat', 'color', 'rgb(6, 214, 160)'],
  ['.m-carta-name', 'color', 'rgb(17, 138, 178)'],
  ['.m-carta-desc', 'color', 'rgb(239, 71, 111)'],
  ['.m-carta-price', 'color', 'rgb(7, 59, 76)'],
  ['.m-carta-badge', 'color', 'rgb(131, 56, 236)'],
]);

await caso('colores-pie-partido', [
  // El tema del pie vive en el panel de texto, no en la raíz.
  ['.m-fs-panel', 'background-color', 'rgb(43, 65, 61)'],
  ['.m-fs-panel', 'color', 'rgb(254, 246, 231)'],
]);

/* ------------------------------------------------------------------ */
/* 4. Los temas siguen funcionando tal cual                            */
/* ------------------------------------------------------------------ */

await caso('carta-pestanas', [['.m-carta', 'background-color', 'rgb(255, 255, 255)']]);

console.log(`\n${ok}/${ok + fallos} comprobaciones correctas` + (fallos ? `  (${fallos} fallos)` : ''));
await browser.close();
process.exit(fallos ? 1 : 0);
