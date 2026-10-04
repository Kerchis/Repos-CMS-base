#!/usr/bin/env node
/**
 * Banco del sistema de fondo, relleno y margen.
 *
 * Por que existe: estas tres cosas son las que mas veces se han dado por
 * buenas mirando una sola seccion en escritorio. Aqui se comprueban seis
 * tipos de seccion distintos en los tres tamaños de pantalla, con el
 * mismo recorrido que en produccion: documento JSON → saneador →
 * compilador de CSS → navegador de verdad → valor calculado.
 *
 * Tambien compara, letra por letra, lo que escribe el PHP con lo que
 * escribe el editor para el mismo estado: son dos emisores del mismo
 * sistema y no pueden decir cosas distintas.
 *
 *   node tools/prueba-caja.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

let ok = 0;
let fallos = 0;
const comprueba = (cond, texto) => {
  if (cond) {
    ++ok;
    console.log(`  OK    ${texto}`);
  } else {
    ++fallos;
    console.log(`  FALLA ${texto}`);
  }
};

/* ------------------------------------------------------------------ */
/* El documento: seis secciones, una por tipo de bloque                */
/* ------------------------------------------------------------------ */

const nodo = (id, type, props = {}, children = []) => ({ id, type, name: type, visible: true, props, styles: {}, children });

/** Caja completa: los cuatro lados de cada cosa, todos distintos. */
const caja = (bg, pad, mar) => ({
  'background-color': bg,
  'padding-top': `${pad[0]}px`,
  'padding-right': `${pad[1]}px`,
  'padding-bottom': `${pad[2]}px`,
  'padding-left': `${pad[3]}px`,
  'margin-top': `${mar[0]}px`,
  'margin-right': `${mar[1]}px`,
  'margin-bottom': `${mar[2]}px`,
  'margin-left': `${mar[3]}px`,
});

// Los valores del encargo: relleno 100/50/80/30 y margen 100/20/80/30.
const ESCRITORIO = caja('#ff0000', [100, 50, 80, 30], [100, 20, 80, 30]);
const TABLETA    = caja('#00ff00', [60, 40, 50, 20], [60, 10, 40, 10]);
const MOVIL      = caja('#0000ff', [20, 12, 24, 8], [20, 6, 16, 6]);

/** Los seis tipos que pide el encargo, con lo minimo para que pinten. */
const BLOQUES = [
  ['cta', nodo('b1', 'statement-cta', { title: 'Reserva tu mesa', theme: 'forest' })],
  ['carrusel', nodo('b2', 'review-slider', { theme: 'cream' })],
  ['carta', nodo('b3', 'menu-list', { title: 'Nuestra carta' })],
  ['carril', nodo('b4', 'product-rail', { title: 'Productos' })],
  ['mapa', nodo('b5', 'map', { url: '<iframe src="https://www.google.com/maps/embed?pb=1!2m3" title="Mapa"></iframe>', height: 360 })],
  ['panel', nodo('b6', 'split-panel', { title: 'Nuestra casa', body: 'Texto', theme: 'forest' })],
];

const secciones = BLOQUES.map(([nombre, bloque], i) => {
  const col = nodo(`c${i}`, 'column', { span: 12 }, [bloque]);
  const row = nodo(`r${i}`, 'row', {}, [col]);
  const sec = nodo(`s-${nombre}`, 'section', { width: 'boxed' }, [row]);
  sec.styles = { desktop: ESCRITORIO, tablet: TABLETA, mobile: MOVIL };
  return sec;
});

// Una septima: solo escritorio, para ver la herencia hacia abajo.
const heredera = nodo('s-herencia', 'section', { width: 'boxed' }, [
  nodo('rh', 'row', {}, [nodo('ch', 'column', { span: 12 }, [nodo('bh', 'statement-cta', { title: 'Hereda', theme: 'cream' })])]),
]);
heredera.styles = { desktop: ESCRITORIO };

// Una octava con relleno escrito y sin nada dentro: no puede reaparecer
// por la puerta de atras. Vacia son cero pixeles, con relleno o sin el.
const vacia = nodo('s-vacia', 'section', { width: 'boxed' }, [
  nodo('rv', 'row', {}, [nodo('cv', 'column', { span: 12 }, [])]),
]);
vacia.styles = { desktop: ESCRITORIO };

const doc = { id: 1, title: 'Caja', sections: [...secciones, heredera, vacia] };

/* ------------------------------------------------------------------ */

mkdirSync(path.join(ROOT, '.captures'), { recursive: true });
const docFile = path.join(ROOT, '.captures/caja-doc.json');
writeFileSync(docFile, JSON.stringify(doc));

const pintar = (modo) =>
  execFileSync(path.join(ROOT, '.tools/php/php'), [path.join(ROOT, 'tools/render-doc.php'), docFile], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    env: { ...process.env, KRG_CANVAS: modo === 'canvas' ? '1' : '', KRG_PREVIEW: modo === 'preview' ? '1' : '' },
  });

const { chromium } = chromiumLib();
const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const leer = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const o = { enLinea: el.getAttribute('style') || '' };
    ['background-color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left'].forEach((p) => {
      o[p] = cs.getPropertyValue(p).trim();
    });
    return o;
  }, sel);

const COLOR = { '#ff0000': 'rgb(255, 0, 0)', '#00ff00': 'rgb(0, 255, 0)', '#0000ff': 'rgb(0, 0, 255)' };

async function revisa(sel, esperado, etiqueta) {
  const real = await leer(sel);
  if (!real) {
    ++fallos;
    console.log(`  FALLA ${etiqueta}: no existe ${sel}`);
    return;
  }
  const mal = [];
  Object.entries(esperado).forEach(([p, v]) => {
    const quiero = p === 'background-color' ? COLOR[v] : v;
    if (real[p] !== quiero) mal.push(`${p}=${real[p]} (esperaba ${quiero})`);
  });
  if (mal.length) {
    ++fallos;
    console.log(`  FALLA ${etiqueta}: ${mal.join(', ')}`);
  } else {
    ++ok;
    console.log(`  OK    ${etiqueta}: fondo ${real['background-color']}, relleno ${real['padding-top']}/${real['padding-right']}/${real['padding-bottom']}/${real['padding-left']}, margen ${real['margin-top']}/${real['margin-right']}/${real['margin-bottom']}/${real['margin-left']}`);
  }
}

async function cargar(modo, ancho) {
  const file = path.join(ROOT, `.captures/caja-${modo}-${ancho}.html`);
  writeFileSync(file, pintar(modo));
  await page.setViewportSize({ width: ancho, height: 1000 });
  await page.goto('file://' + file);
  await page.waitForTimeout(60);
}

const TAMANOS = [
  ['escritorio', 1440, ESCRITORIO],
  ['tableta', 900, TABLETA],
  ['móvil', 420, MOVIL],
];

for (const [modo, titulo] of [['publico', 'web pública'], ['preview', '«Preview»'], ['canvas', 'lienzo del editor']]) {
  for (const [nombre, ancho, esperado] of TAMANOS) {
    console.log(`\n${titulo} · ${nombre} (${ancho}px)`);
    await cargar(modo, ancho);
    for (const [bloque] of BLOQUES) {
      await revisa(`.m-n-s-${bloque}`, esperado, bloque);
    }
  }
}

/* Herencia: lo escrito solo en escritorio vale en los tres tamaños. */
console.log('\nHerencia hacia abajo: solo hay valores de escritorio');
for (const [nombre, ancho] of TAMANOS) {
  await cargar('publico', ancho);
  await revisa('.m-n-s-herencia', ESCRITORIO, `${nombre} hereda el escritorio`);
}

/* Una seccion vacia no se imprime en la web. En el lienzo si se ve, y
   se ve como el usuario la configuro: lo que el escribio manda sobre el
   relleno que trae el tema. Lo que sigue colapsando es el ALTO de la
   seccion (el preset de 90vh y los altos a medida), que es lo que haria
   inmanejable el lienzo. */
console.log('\nUna sección vacía: cero en la web, visible y fiel en el lienzo');
await cargar('publico', 1440);
comprueba(await page.locator('.m-n-s-vacia').count() === 0, 'en la web pública ni se imprime');
await cargar('canvas', 1440);
const enLienzo = await page.evaluate(() => {
  const el = document.querySelector('.m-n-s-vacia');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { pt: cs.paddingTop, pb: cs.paddingBottom, alto: Math.round(el.getBoundingClientRect().height) };
});
comprueba(!!enLienzo, 'en el lienzo sí se puede ver y seleccionar');
comprueba(
  enLienzo && enLienzo.pt === ESCRITORIO['padding-top'] && enLienzo.pb === ESCRITORIO['padding-bottom'],
  `y con el relleno que escribió el usuario: ${enLienzo?.pt}/${enLienzo?.pb}`
);

/* El atributo style sigue limpio: un solo emisor, la hoja del documento. */
console.log('\nUn solo sitio escribe la caja');
await cargar('publico', 1440);
for (const [bloque] of BLOQUES) {
  const real = await leer(`.m-n-s-${bloque}`);
  comprueba(
    real && !/background|padding|margin/.test(real.enLinea),
    `${bloque}: nada de caja en el atributo style (${real ? real.enLinea || 'vacío' : 'NO EXISTE'})`
  );
}
const hoja = await page.evaluate(() => {
  const out = [];
  [...document.styleSheets].forEach((h) => {
    let r = null;
    try { r = h.cssRules; } catch (e) { return; }
    const mira = (reglas) => [...reglas].forEach((x) => {
      if (x.cssRules) return mira(x.cssRules);
      if (!x.selectorText || !x.style) return;
      ['background-color', 'padding-top', 'margin-top'].forEach((p) => {
        if (x.style.getPropertyValue(p) && x.style.getPropertyPriority(p)) {
          out.push(`${x.selectorText} { ${p} !important }`);
        }
      });
    });
    mira(r);
  });
  return out;
});
comprueba(hoja.length === 0, `ninguna regla de caja lleva !important: ${hoja.join(', ') || 'ninguna'}`);

/* ------------------------------------------------------------------ */
/* Los dos emisores dicen lo mismo                                      */
/* ------------------------------------------------------------------ */
console.log('\nEl PHP y el editor escriben exactamente lo mismo');
// `cssCaja()` vive en el núcleo desde que páginas y navegación comparten
// inspector: es la misma copia para las dos pantallas.
const builder = readFileSync(path.join(ROOT, 'krg-cms/admin/assets/js/builder-core.js'), 'utf8');
const trozo = builder.match(/const CAJA_PROPS = \[[\s\S]*?\];[\s\S]*?function cssCaja\(styles\) \{[\s\S]*?\n  \}/);
comprueba(!!trozo, 'se encuentra cssCaja() en el núcleo del editor');
const muestras = [
  ESCRITORIO,
  { 'background-color': 'var(--color-primary)', 'padding-top': '0px' },
  { 'margin-left': 'auto', 'margin-right': 'auto', 'padding-bottom': '2rem' },
  {},
];
const declaraPhp = (st) =>
  execFileSync(path.join(ROOT, '.tools/php/php'), [path.join(ROOT, 'tools/caja-php.php')], {
    encoding: 'utf8',
    input: JSON.stringify(st),
  }).trim();
const declaraJs = await page.evaluate((args) => {
  const [fuente, lista] = args;
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${fuente}; return cssCaja;`)();
  return lista.map((st) => fn(st).join(';'));
}, [trozo ? trozo[0] : 'function cssCaja(){return []}', muestras]);
muestras.forEach((st, i) => {
  const a = declaraPhp(st);
  const b = declaraJs[i];
  comprueba(a === b, `${JSON.stringify(st).slice(0, 48)}… → PHP «${a}» / editor «${b}»`);
});

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
