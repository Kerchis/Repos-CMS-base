#!/usr/bin/env node
/**
 * Pruebas 1 a 15 del contrato de secciones vacias.
 *
 * Una seccion sin contenido real no debe ocupar NADA en la web publica,
 * tenga el alto que tenga configurado; una seccion con contenido debe
 * comportarse exactamente igual que antes. Esto lo comprueba sobre la
 * salida de los renderizadores de verdad, en escritorio, tableta y movil.
 *
 *   node tools/prueba-vacias.mjs
 *
 * Devuelve codigo 1 si falla alguna comprobacion.
 */
import { ROOT, chromiumLib, render, pagina, medirSecciones } from './harness.mjs';

// Sin ningun modulo dentro: en el lienzo se colapsan a una banda baja.
const VACIAS_REALES = ['t1-vacia', 't2-vacia90', 't3-vacia400', 't3b-filavacia'];
// Tiene un modulo, pero escondido en los tres tamanos: fuera del
// frontend, y en el lienzo intacta, porque alli hay que poder editarla.
const OCULTA = 't3c-oculta';
// Lleva modulos de verdad, pero sin datos que pintar (un carrusel sin
// resenas, una rejilla de blog sin entradas): fuera del frontend, y en el
// lienzo presente y con su aviso.
const SIN_DATOS = 't9-sindatos';
const VACIAS = [...VACIAS_REALES, OCULTA, SIN_DATOS];
const CON_CONTENIDO = ['t4-titulo', 't7-mapa', 't8-contenido90', 't5-imagen', 't6-mixto'];
const VENTANAS = [
  ['escritorio', 1440, 1197],
  ['tableta', 834, 1112],
  ['movil', 390, 844],
];

const fallos = [];
const lineas = [];

function comprueba(nombre, ok, detalle) {
  lineas.push(`${ok ? '  OK  ' : ' FALLA'}  ${nombre}${detalle ? '  — ' + detalle : ''}`);
  if (!ok) fallos.push(nombre);
}

const { chromium } = chromiumLib();
const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function mide(caso, { canvas = false } = {}, W, H) {
  const file = pagina(`prueba-${caso}${canvas ? '-lienzo' : ''}`, render(caso, { canvas }), { canvas });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('file://' + file);
  await page.waitForTimeout(200);
  const filas = await page.evaluate(medirSecciones);
  const extra = await page.evaluate(() => ({
    desborde: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    alturaMain: Math.round(document.querySelector('main').getBoundingClientRect().height),
  }));
  await page.close();
  return { filas, ...extra };
}

for (const [etiqueta, W, H] of VENTANAS) {
  lineas.push(`\n== ${etiqueta} (${W}x${H}) ==`);

  /* --- Frontend ------------------------------------------------- */
  const front = await mide('pruebas-vacias', {}, W, H);
  const ids = front.filas.map((f) => f.id);

  for (const v of VACIAS) {
    comprueba(`vacia fuera del DOM: ${v}`, !ids.includes(v));
  }
  for (const c of CON_CONTENIDO) {
    const f = front.filas.find((x) => x.id === c);
    comprueba(`con contenido presente y visible: ${c}`, !!f && f.alto > 0, f ? `${f.alto}px` : 'ausente');
  }

  // 8: la altura configurada se respeta cuando SI hay contenido.
  const t8 = front.filas.find((x) => x.id === 't8-contenido90');
  const esperado = Math.round(H * 0.9);
  comprueba(
    'alto 90% respetado con contenido',
    !!t8 && Math.abs(t8.alto - esperado) <= 1,
    t8 ? `${t8.alto}px vs ${esperado}px` : 'ausente'
  );

  // 11 y 12: ni antes ni despues de una vacia queda hueco.
  const huecos = front.filas.filter((f) => Math.abs(f.huecoSiguiente) > 0.5);
  comprueba('sin hueco entre secciones consecutivas', huecos.length === 0,
    huecos.map((f) => `${f.id}:${f.huecoSiguiente}`).join(' '));

  comprueba('sin desborde horizontal', front.desborde === 0, `${front.desborde}px`);

  /* --- Lienzo del constructor ----------------------------------- */
  const lienzo = await mide('pruebas-vacias', { canvas: true }, W, H);
  const idsL = lienzo.filas.map((f) => f.id);
  comprueba('el lienzo si muestra las vacias', VACIAS.every((v) => idsL.includes(v)),
    `${idsL.length} secciones`);
  const altosVacias = VACIAS_REALES.map((v) => lienzo.filas.find((f) => f.id === v)?.alto);
  comprueba('en el lienzo las vacias miden 120px', altosVacias.every((a) => a === 120),
    altosVacias.join('/'));
  const altoSinDatos = lienzo.filas.find((f) => f.id === SIN_DATOS)?.alto;
  comprueba('en el lienzo el modulo sin datos avisa y ocupa',
    (altoSinDatos ?? 0) > 0, `${altoSinDatos}px`);
  const altoOculta = lienzo.filas.find((f) => f.id === OCULTA)?.alto;
  comprueba('en el lienzo la seccion con contenido oculto conserva su alto',
    Math.abs((altoOculta ?? 0) - H) <= 1, `${altoOculta}px vs ${H}px`);

  /* --- 9 y 10: quitar y volver a poner contenido ---------------- */
  const sin = await mide('dinamica-sin', {}, W, H);
  comprueba('al quitar el contenido vuelve a 0', sin.filas.length === 0 && sin.alturaMain === 0,
    `${sin.filas.length} secciones, main ${sin.alturaMain}px`);
  const con = await mide('dinamica-con', {}, W, H);
  comprueba('al volver a poner contenido reaparece con su alto',
    con.filas.length === 1 && Math.abs(con.filas[0].alto - H) <= 1,
    con.filas[0] ? `${con.filas[0].alto}px vs ${H}px` : 'ausente');
}

await browser.close();

console.log(lineas.join('\n'));
console.log(`\n${fallos.length ? `FALLAN ${fallos.length}` : 'TODAS LAS COMPROBACIONES PASAN'}`);
process.exit(fallos.length ? 1 : 0);
