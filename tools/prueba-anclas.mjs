#!/usr/bin/env node
/**
 * Menú de una sola página: ir a una sección y, sobre todo, VOLVER.
 *
 * El encargo: bajar funciona, pero estando abajo y pulsando «Inicio» la
 * página se quedaba clavada. La causa es de libro: la cortina deja
 * secciones en `position: sticky`, y de una sección pegada
 * `getBoundingClientRect().top` devuelve dónde está pegada ahora mismo
 * —no dónde vive en la página—, así que la cuenta daba «ya estás ahí» y
 * no se movía nadie.
 *
 * Se mide con la página de verdad: `tools/render-doc.php` con
 * `public.js` y `modules.js` incrustados, cinco secciones altas con su
 * ancla y una de ellas con cortina.
 *
 *   node tools/prueba-anclas.mjs
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const SECCIONES = [
  // La primera con cortina: es el caso que contó el usuario —estando
  // abajo, «Inicio» no subía—.
  { id: 'inicio', titulo: 'Inicio', cortina: true },
  { id: 'nosotros', titulo: 'Nosotros', cortina: true },
  { id: 'carta', titulo: 'La carta', cortina: false },
  { id: 'galeria', titulo: 'Galería', cortina: false },
  { id: 'contacto', titulo: 'Contacto', cortina: false },
];

function doc() {
  const n = (id, type, p = {}, children = []) => ({
    id, type, name: type, visible: true, source: 'local', globalId: 0,
    props: p, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
  });
  return {
    id: 1, title: 'Una sola página', slug: 'home', status: 'publish', checksum: 'c', seo: {}, settings: {},
    sections: SECCIONES.map((s, i) =>
      n('s' + i, 'section', {
        width: 'full',
        htmlId: s.id,
        minHeight: 'custom',
        minHeightValue: 700,
        minHeightUnit: 'px',
        heightMode: 'exact',
        curtain: s.cortina ? 'on' : 'off',
      }, [
        n('r' + i, 'row', {}, [
          n('c' + i, 'column', { span: 12 }, [n('h' + i, 'heading', { text: s.titulo, level: 'h2' })]),
        ]),
      ])
    ),
  };
}

const dir = mkdtempSync(join(tmpdir(), 'krg-anclas-'));
const file = join(dir, 'home.json');
writeFileSync(file, JSON.stringify(doc()));
const html = execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/render-doc.php`, file], { encoding: 'utf8' });
const pagina = join(dir, 'home.html');
// Un menú como el de la cabecera: enlaces con almohadilla. El manejador
// de `public.js` escucha en todo el documento, así que sirve igual.
const nav = `<nav id="menu" style="position:fixed;top:0;left:0;right:0;z-index:99;background:#fff;padding:10px;display:flex;gap:16px">
${SECCIONES.map((s) => `<a href="#${s.id}" data-ir="${s.id}">${s.titulo}</a>`).join('')}</nav>`;
writeFileSync(pagina, html.replace('<div class="m-page">', nav + '<div class="m-page">'));

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errores.push(m.text()); });
await page.goto('file://' + pagina);
await page.waitForTimeout(300);

/**
 * Dónde vive de verdad una sección, sin que la cortina confunda.
 *
 * Ni `offsetTop` ni la posición en pantalla sirven con una sección
 * pegada: las dos cuentan el sitio en el que está pegada ahora mismo.
 * Hay que quitarle la pegajosidad para medirla.
 */
const sitioDe = (id) => page.evaluate((id) => {
  const el = document.getElementById(id);
  const tocados = [];
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'sticky') { tocados.push([n, n.style.position]); n.style.position = 'static'; }
  }
  const y = Math.round(el.getBoundingClientRect().top + window.scrollY);
  tocados.forEach(([n, antes]) => { if (antes) n.style.position = antes; else n.style.removeProperty('position'); });
  return y;
}, id);

/** Hasta dónde se puede bajar: la última sección no llega arriba. */
const tope = () => page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
const metaDe = async (id) => Math.min(await sitioDe(id), await tope());

const donde = () => page.evaluate(() => Math.round(window.scrollY));

/** Pulsa el enlace del menú y espera a que la página deje de moverse. */
async function vamosA(id) {
  await page.click(`#menu [data-ir="${id}"]`);
  let ultimo = -1;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(80);
    const y = await donde();
    if (y === ultimo) break;
    ultimo = y;
  }
  return donde();
}

/* ------------------------------------------------------------------ */
console.log('\n--- Bajar (esto ya iba)');
{
  for (const id of ['carta', 'contacto']) {
    const meta = await metaDe(id);
    const y = await vamosA(id);
    ok(Math.abs(y - meta) <= 12, `«${id}»: la página se queda en ${y} y la sección empieza en ${meta}`);
  }
}

/* ------------------------------------------------------------------ */
console.log('\n--- Subir (esto es lo que se quedaba clavado)');
{
  // Desde el final, a la primera sección.
  const y0 = await donde();
  const inicio = await vamosA('inicio');
  ok(y0 > 1000, 'se parte desde el final de la página');
  ok(inicio <= 12, `«Inicio» sube del todo (se queda en ${inicio})`);

  // Y a una sección intermedia, estando debajo.
  await vamosA('contacto');
  const meta = await metaDe('nosotros');
  const y = await vamosA('nosotros');
  ok(Math.abs(y - meta) <= 12, `«Nosotros» —la de la cortina— sube a su sitio: ${y} contra ${meta}`);

  // Ida y vuelta varias veces: no se queda a medias.
  const idas = [];
  for (const id of ['galeria', 'inicio', 'contacto', 'carta', 'inicio']) {
    const m = await metaDe(id);
    const v = await vamosA(id);
    idas.push(Math.abs(v - m) <= 12);
  }
  ok(idas.every(Boolean), 'cinco saltos seguidos, arriba y abajo, todos llegan');
}

/* ------------------------------------------------------------------ */
console.log('\n--- Lo que no debe cambiar');
{
  ok((await page.evaluate(() => location.hash)) === '#inicio', 'la dirección del navegador se queda con el ancla');
  // Entrar con la almohadilla puesta también coloca la página.
  await page.goto('file://' + pagina + '#galeria');
  await page.waitForTimeout(900);
  const meta = await metaDe('galeria');
  const y = await donde();
  ok(Math.abs(y - meta) <= 12, `abrir la página con #galeria la coloca ahí (${y} contra ${meta})`);

  // Un enlace de verdad a otra página sigue navegando.
  const salta = await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://otra.test/pagina/#algo';
    a.textContent = 'fuera';
    document.body.appendChild(a);
    let evitado = false;
    a.addEventListener('click', (e) => { evitado = e.defaultPrevented; e.preventDefault(); }, { capture: false });
    a.click();
    return evitado;
  });
  ok(salta === false, 'un enlace a otra página no lo secuestra el menú');
}

ok(errores.length === 0, 'no hay errores en la consola' + (errores.length ? ': ' + errores[0] : ''));

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS` : `EL MENÚ DE UNA SOLA PÁGINA VA (${hechas} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
