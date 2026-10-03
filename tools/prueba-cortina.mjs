#!/usr/bin/env node
/**
 * El motor de secciones con la cortina encendida.
 *
 * Por que existe: `modules.js` no solo anima. La cortina ESCRIBE estilos
 * en linea y clases sobre las secciones que vienen despues de una
 * seccion cortina, y el CSS las pinta con un selector de dos piezas
 * (`.m-curtain-above[style*="--m-curtain-bg"]`). Eso es un segundo
 * sistema decidiendo el fondo, y ninguna prueba lo veia porque el banco
 * servia la pagina sin JavaScript.
 *
 * Aqui se sirve la pagina COMO EN WORDPRESS —las tres hojas del tema,
 * la hoja del documento, `public.js` y `modules.js`— y se mide lo que
 * queda en pantalla despues de que la cortina haya hecho su trabajo.
 *
 * No se prueba un modulo concreto: se prueban siete tipos de seccion
 * distintos con la misma configuracion.
 *
 *   node tools/prueba-cortina.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
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

const nodo = (id, type, props = {}, children = []) => ({ id, type, name: type, visible: true, props, styles: {}, children });

/* La configuracion del encargo, la misma para todas: fondo, 50 de
   relleno por los cuatro lados y 50 de margen por los cuatro lados. */
const FONDO = '#3f5e58';
const FONDO_RGB = 'rgb(63, 94, 88)';
const CAJA = {
  'background-color': FONDO,
  'padding-top': '50px', 'padding-right': '50px', 'padding-bottom': '50px', 'padding-left': '50px',
  'margin-top': '50px', 'margin-right': '50px', 'margin-bottom': '50px', 'margin-left': '50px',
};
const CAJA_TABLETA = { ...CAJA, 'padding-top': '60px', 'background-color': '#00ff00' };
const CAJA_MOVIL = { ...CAJA, 'padding-top': '40px', 'background-color': '#0000ff' };

const fila = (sufijo, hijos, span = 12) =>
  nodo(`r-${sufijo}`, 'row', {}, [nodo(`c-${sufijo}`, 'column', { span }, hijos)]);

/* Siete secciones distintas, todas con la misma caja. El CTA es una mas:
   si algo falla solo en una, no es del motor; si falla en todas, si. */
const CASOS = [
  ['cta', { width: 'boxed' }, [fila('cta', [nodo('m-cta', 'statement-cta', { title: 'Reserva', theme: 'forest' })])]],
  ['texto', { width: 'boxed' }, [fila('texto', [nodo('m-texto', 'paragraph', { text: 'Texto de prueba para la sección genérica.' })])]],
  ['imagen', { width: 'boxed' }, [fila('imagen', [nodo('m-img', 'image', { url: 'https://ejemplo.test/x.jpg', alt: 'x' })])]],
  ['vacia', { width: 'boxed' }, [fila('vacia', [])]],
  ['columnas', { width: 'boxed' }, [
    nodo('r-cols', 'row', {}, [
      nodo('c-cols-1', 'column', { span: 6 }, [nodo('m-c1', 'heading', { text: 'Una', level: 'h3' })]),
      nodo('c-cols-2', 'column', { span: 6 }, [nodo('m-c2', 'heading', { text: 'Dos', level: 'h3' })]),
    ]),
  ]],
  ['full', { width: 'full' }, [fila('full', [nodo('m-full', 'heading', { text: 'Ancho completo', level: 'h2' })])]],
  ['alta', { width: 'boxed', minHeight: 'custom', minHeightValue: 90, minHeightUnit: 'vh', heightMode: 'min' },
    [fila('alta', [nodo('m-alta', 'heading', { text: 'Noventa', level: 'h2' })])]],
];

const secciones = [];

// La primera es la cortina: se queda quieta mientras las demas pasan por
// encima. Es la que dispara todo el sistema que se esta probando.
const cortina = nodo('s-cortina', 'section', { width: 'full', curtain: 'on', minHeight: 'half' }, [
  fila('cortina', [nodo('m-cortina', 'heading', { text: 'Cortina', level: 'h2' })]),
]);
cortina.styles = { desktop: { 'background-color': '#111111' } };
secciones.push(cortina);

for (const [nombre, props, hijos] of CASOS) {
  const s = nodo(`s-${nombre}`, 'section', props, hijos);
  s.styles = { desktop: CAJA, tablet: CAJA_TABLETA, mobile: CAJA_MOVIL };
  secciones.push(s);
}

// Y una ultima SIN fondo escrito: la cortina si tiene que taparla, que
// para eso esta. Es el control de que no se ha roto el efecto.
secciones.push(nodo('s-limpia', 'section', { width: 'boxed' }, [
  fila('limpia', [nodo('m-limpia', 'heading', { text: 'Sin fondo', level: 'h2' })]),
]));

const doc = { id: 1, title: 'Cortina', sections: secciones };

/* ------------------------------------------------------------------ */

mkdirSync(path.join(ROOT, '.captures'), { recursive: true });
const docFile = path.join(ROOT, '.captures/cortina-doc.json');
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

const PROPS = ['background-color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'position', 'z-index'];

const leer = (sel) =>
  page.evaluate(([s, props]) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const o = {
      enLinea: el.getAttribute('style') || '',
      clases: el.className,
      alto: Math.round(el.getBoundingClientRect().height),
      varCortina: el.style.getPropertyValue('--m-curtain-bg') || '',
    };
    props.forEach((p) => { o[p] = cs.getPropertyValue(p).trim(); });
    return o;
  }, [sel, PROPS]);

/** Lo que de verdad se ve en un punto de la seccion, como lo ve el ojo. */
const queSeVe = (sel, fraccion) =>
  page.evaluate(([s, f]) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height * f));
    const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
    let n = document.elementFromPoint(x, y);
    while (n) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'transparent' && bg.replace(/\s/g, '') !== 'rgba(0,0,0,0)') return bg;
      n = n.parentElement;
    }
    return 'nada';
  }, [sel, fraccion]);

async function cargar(modo, ancho) {
  const file = path.join(ROOT, `.captures/cortina-${modo}-${ancho}.html`);
  writeFileSync(file, pintar(modo));
  await page.setViewportSize({ width: ancho, height: 1000 });
  await page.goto('file://' + file, { waitUntil: 'load' });
  // La cortina mide en `load` y vuelve a medir tras un respiro.
  await page.waitForTimeout(350);
}

const NOMBRES = CASOS.map(([n]) => n);
const TAMANOS = [['escritorio', 1440, CAJA], ['tableta', 900, CAJA_TABLETA], ['móvil', 420, CAJA_MOVIL]];
const MODOS = [['publico', 'web pública'], ['preview', '«Preview»'], ['canvas', 'lienzo del editor']];
const COLOR = { '#3f5e58': FONDO_RGB, '#00ff00': 'rgb(0, 255, 0)', '#0000ff': 'rgb(0, 0, 255)' };

/* 1 · La cortina sigue funcionando. */
console.log('\nLa cortina sigue haciendo su trabajo');
await cargar('publico', 1440);
const cort = await leer('.m-n-s-cortina');
comprueba(!!cort && /is-curtain/.test(cort.clases), `la sección cortina lleva su clase: ${cort?.clases}`);
comprueba(!!cort && /is-curtain-on/.test(cort.clases), 'modules.js la ha encendido (is-curtain-on)');
comprueba(!!cort && cort.position === 'sticky', `y se queda quieta: position ${cort?.position}`);
const encima = await leer('.m-n-s-cta');
comprueba(!!encima && /m-curtain-above/.test(encima.clases), 'la siguiente pasa por delante (m-curtain-above)');
comprueba(!!encima && encima['z-index'] === '1', `con z-index ${encima?.['z-index']}`);
const limpia = await leer('.m-n-s-limpia');
comprueba(
  !!limpia && limpia['background-color'] !== 'rgba(0, 0, 0, 0)',
  `una sección sin fondo escrito sí la tapa la cortina: ${limpia?.['background-color']}`
);
// Y lo hace el CSS, no el JavaScript: nada escrito en el elemento.
comprueba(!!limpia && limpia.enLinea === '', `y sin escribirle nada encima: style="${limpia?.enLinea}"`);
comprueba(!!limpia && limpia.varCortina === '', 'sin --m-curtain-bg en línea');

/* 2 · El fondo configurado manda, en los siete tipos de sección. */
for (const [modo, titulo] of MODOS) {
  for (const [tam, ancho, esperado] of TAMANOS) {
    console.log(`\n${titulo} · ${tam} (${ancho}px) · fondo, relleno y margen con la cortina encendida`);
    await cargar(modo, ancho);
    for (const n of NOMBRES) {
      if (n === 'vacia' && modo !== 'canvas') continue; // en la web no se imprime
      const real = await leer(`.m-n-s-${n}`);
      if (!real) { ++fallos; console.log(`  FALLA ${n}: no existe`); continue; }
      const mal = [];
      Object.entries(esperado).forEach(([p, v]) => {
        const quiero = p === 'background-color' ? COLOR[v] : v;
        if (real[p] !== quiero) mal.push(`${p}=${real[p]} (esperaba ${quiero})`);
      });
      if (real.varCortina) mal.push(`la cortina le ha escrito --m-curtain-bg:${real.varCortina}`);
      if (mal.length) { ++fallos; console.log(`  FALLA ${n}: ${mal.join(', ')}`); }
      else { ++ok; console.log(`  OK    ${n}`); }
    }
  }
}

/* 3 · La sección alta: todo su espacio es del color configurado. */
console.log('\nUna sección de 90vh es del color configurado de arriba abajo');
for (const [modo, titulo] of MODOS) {
  await cargar(modo, 1440);
  const alta = await leer('.m-n-s-alta');
  comprueba(alta && alta.alto >= 890 && alta.alto <= 910, `${titulo}: mide ${alta?.alto}px (90vh de 1000)`);
  for (const [donde, f] of [['arriba', 0.05], ['centro', 0.5], ['abajo', 0.95]]) {
    const visto = await queSeVe('.m-n-s-alta', f);
    comprueba(visto === FONDO_RGB, `${titulo}, ${donde}: se ve ${visto}`);
  }
}

/* 4 · Nada de esto viaja en el atributo style de la sección. */
console.log('\nUn solo emisor: la cortina no escribe estilos sobre las secciones');
await cargar('publico', 1440);
for (const n of NOMBRES.filter((x) => x !== 'vacia')) {
  const real = await leer(`.m-n-s-${n}`);
  comprueba(!/background|padding|margin|curtain-bg/.test(real?.enLinea || ''), `${n}: style="${real?.enLinea || ''}"`);
}

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
