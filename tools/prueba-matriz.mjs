#!/usr/bin/env node
/**
 * La matriz del encargo: caja × contenedor × ancho × tamaño × modo.
 *
 * `prueba-caja.mjs` ya recorre seis tipos de bloque en los tres tamaños.
 * Lo que faltaba —y es donde se habían escondido los dos últimos fallos
 * de relleno— son las combinaciones de ANCHO (full / padded / boxed), el
 * caso «sin caja escrita» (que tiene que coger el token) y la prueba de
 * que lo que el usuario escribe gana a lo que trae el tema.
 *
 * Cada casilla se mira en los tres modos —web pública, «Preview» y
 * lienzo del editor— y se exige que den el MISMO número: es la única
 * forma de afirmar que el preview representa el frontend.
 *
 *   node tools/prueba-matriz.mjs
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

/** Caja completa con los cuatro lados distintos. */
const caja = (bg, pad, mar) => ({
  ...(bg ? { 'background-color': bg } : {}),
  'padding-top': `${pad[0]}px`,
  'padding-right': `${pad[1]}px`,
  'padding-bottom': `${pad[2]}px`,
  'padding-left': `${pad[3]}px`,
  'margin-top': `${mar[0]}px`,
  'margin-right': `${mar[1]}px`,
  'margin-bottom': `${mar[2]}px`,
  'margin-left': `${mar[3]}px`,
});

const ESCRITORIO = caja('#ff0000', [100, 50, 80, 30], [100, 20, 80, 30]);
const TABLETA = caja('#00ff00', [60, 40, 50, 20], [60, 10, 40, 10]);
const MOVIL = caja('#0000ff', [20, 12, 24, 8], [20, 6, 16, 6]);
const TRES = { desktop: ESCRITORIO, tablet: TABLETA, mobile: MOVIL };

/* ------------------------------------------------------------------ */
/* El documento                                                        */
/* ------------------------------------------------------------------ */

const contenido = (sufijo) =>
  nodo(`r-${sufijo}`, 'row', {}, [nodo(`c-${sufijo}`, 'column', { span: 12 }, [nodo(`m-${sufijo}`, 'heading', { text: 'Texto', level: 'h2' })])]);

const secciones = [];

// 0. La primera de la pagina, sin nada escrito: tiene que coger el ritmo
//    del token por arriba y por abajo.
secciones.push(nodo('s-primera', 'section', { width: 'boxed' }, [contenido('primera')]));

// 1. Los tres anchos, con la caja completa en los tres tamaños.
for (const w of ['full', 'padded', 'boxed']) {
  const s = nodo(`s-${w}`, 'section', { width: w }, [contenido(w)]);
  s.styles = TRES;
  secciones.push(s);
}

// 2. Fila, columna y modulo con caja propia (la seccion, sin nada).
const sHija = nodo('s-hijos', 'section', { width: 'boxed' }, [
  (() => {
    const row = nodo('r-hijo', 'row', {}, [
      (() => {
        const col = nodo('c-hijo', 'column', { span: 12 }, [
          (() => {
            const mod = nodo('m-hijo', 'heading', { text: 'Módulo', level: 'h2' });
            mod.styles = TRES;
            return mod;
          })(),
        ]);
        col.styles = TRES;
        return col;
      })(),
    ]);
    row.styles = TRES;
    return row;
  })(),
]);
secciones.push(sHija);

// 3. Sin caja escrita: tiene que coger el ritmo del token.
secciones.push(nodo('s-token', 'section', { width: 'boxed' }, [contenido('token')]));

// 4. Con relleno escrito Y un alto de seccion: lo escrito manda sobre el
//    relleno del tema, y el alto se respeta.
const sGana = nodo('s-gana', 'section', { width: 'boxed', minHeight: 'half', heightMode: 'min' }, [contenido('gana')]);
sGana.styles = { desktop: { 'padding-top': '41px', 'padding-bottom': '43px' } };
secciones.push(sGana);

// 5. Vacia con relleno y con alto de pantalla: en la web no se imprime;
//    en el lienzo se ve, con su relleno y sin el alto gigante.
const sVacia = nodo('s-vacia', 'section', { width: 'boxed', minHeight: 'screen' }, [
  nodo('r-vac', 'row', {}, [nodo('c-vac', 'column', { span: 12 }, [])]),
]);
sVacia.styles = { desktop: { 'padding-top': '77px', 'padding-bottom': '55px' } };
secciones.push(sVacia);

// 6. Transparente: relleno si, fondo no. No puede aparecer un fondo de
//    la nada ni perderse el relleno.
const sTrans = nodo('s-trans', 'section', { width: 'boxed' }, [contenido('trans')]);
sTrans.styles = { desktop: { 'padding-top': '33px', 'padding-left': '22px', 'margin-bottom': '11px' } };
secciones.push(sTrans);

const doc = { id: 1, title: 'Matriz', sections: secciones };

/* ------------------------------------------------------------------ */

mkdirSync(path.join(ROOT, '.captures'), { recursive: true });
const docFile = path.join(ROOT, '.captures/matriz-doc.json');
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
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left'];

const leer = (sel) =>
  page.evaluate(([s, props]) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const o = { enLinea: el.getAttribute('style') || '', ancho: Math.round(el.getBoundingClientRect().width) };
    props.forEach((p) => { o[p] = cs.getPropertyValue(p).trim(); });
    return o;
  }, [sel, PROPS]);

const COLOR = { '#ff0000': 'rgb(255, 0, 0)', '#00ff00': 'rgb(0, 255, 0)', '#0000ff': 'rgb(0, 0, 255)' };

async function revisa(sel, esperado, etiqueta) {
  const real = await leer(sel);
  if (!real) {
    ++fallos;
    console.log(`  FALLA ${etiqueta}: no existe ${sel}`);
    return null;
  }
  const mal = [];
  Object.entries(esperado).forEach(([p, v]) => {
    const quiero = p === 'background-color' ? COLOR[v] || v : v;
    if (real[p] !== quiero) mal.push(`${p}=${real[p]} (esperaba ${quiero})`);
  });
  if (mal.length) {
    ++fallos;
    console.log(`  FALLA ${etiqueta}: ${mal.join(', ')}`);
  } else {
    ++ok;
    console.log(`  OK    ${etiqueta}`);
  }
  return real;
}

async function cargar(modo, ancho) {
  const file = path.join(ROOT, `.captures/matriz-${modo}-${ancho}.html`);
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
const MODOS = [['publico', 'web pública'], ['preview', '«Preview»'], ['canvas', 'lienzo del editor']];

/* 1 · La matriz: ancho × tamaño × modo, sobre la seccion. */
const registro = {};
for (const [modo, titulo] of MODOS) {
  for (const [nombre, ancho, esperado] of TAMANOS) {
    console.log(`\n${titulo} · ${nombre} (${ancho}px) · los tres anchos de sección`);
    await cargar(modo, ancho);
    for (const w of ['full', 'padded', 'boxed']) {
      const real = await revisa(`.m-n-s-${w}`, esperado, `ancho ${w}`);
      registro[`${w}|${nombre}`] = registro[`${w}|${nombre}`] || [];
      if (real) registro[`${w}|${nombre}`].push([modo, PROPS.map((p) => real[p]).join('|')]);
    }
    console.log(`  — fila, columna y módulo con caja propia`);
    await revisa('.m-n-r-hijo', esperado, 'fila');
    await revisa('.m-n-c-hijo', esperado, 'columna');
    await revisa('.m-n-m-hijo', esperado, 'módulo');
  }
}

/* 2 · Los tres modos tienen que dar el mismo numero. */
console.log('\nEl preview y el lienzo dicen lo mismo que la web pública');
for (const [clave, lecturas] of Object.entries(registro)) {
  const unicos = new Set(lecturas.map(([, firma]) => firma));
  comprueba(unicos.size === 1, `${clave}: ${unicos.size === 1 ? 'idénticos en los tres modos' : [...unicos].join('  ≠  ')}`);
}

/* 3 · Una seccion sin caja escrita coge el ritmo del token.
      La primera de la pagina lo lleva arriba y abajo; a partir de la
      segunda el tema quita el de arriba a proposito, para que dos
      secciones seguidas no sumen dos ritmos. */
console.log('\nSin nada escrito manda el token de espaciado');
for (const [modo, titulo] of MODOS) {
  await cargar(modo, 1440);
  // El valor que toca es el del token resuelto por el navegador, no un
  // numero escrito a mano: el preset del tema usa un `clamp()`.
  const ritmo = await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;visibility:hidden;padding-block:var(--spacing-section, 96px)';
    document.body.appendChild(d);
    const v = getComputedStyle(d).paddingTop;
    d.remove();
    return v;
  });
  const primera = await leer('.m-n-s-primera');
  comprueba(primera && primera['padding-top'] === ritmo && primera['padding-bottom'] === ritmo,
    `${titulo}, primera de la página: ${primera?.['padding-top']}/${primera?.['padding-bottom']} (token ${ritmo})`);
  const seguida = await leer('.m-n-s-token');
  comprueba(seguida && seguida['padding-top'] === '0px' && seguida['padding-bottom'] === ritmo,
    `${titulo}, pegada a la anterior: ${seguida?.['padding-top']}/${seguida?.['padding-bottom']}`);
}

/* 4 · Lo escrito por el usuario gana al token y al tema, sin !important. */
console.log('\nLo escrito en el panel gana al relleno del tema');
for (const [modo, titulo] of MODOS) {
  await cargar(modo, 1440);
  const real = await leer('.m-n-s-gana');
  comprueba(real && real['padding-top'] === '41px' && real['padding-bottom'] === '43px',
    `${titulo}: ${real?.['padding-top']}/${real?.['padding-bottom']} (esperaba 41px/43px)`);
}

/* 5 · Nada de esto viaja en el atributo style: un solo emisor. */
console.log('\nUn solo emisor: el atributo style no lleva caja');
await cargar('publico', 1440);
for (const sel of ['s-full', 's-padded', 's-boxed', 's-gana', 's-trans']) {
  const real = await leer(`.m-n-${sel}`);
  const sucio = /padding|margin|background-color/.test(real?.enLinea || '');
  comprueba(!sucio, `${sel}: style="${real?.enLinea || ''}"`);
}

/* 6 · Transparente: ni fondo inventado ni relleno perdido. */
console.log('\nSin fondo escrito, la sección no pinta fondo');
for (const [modo, titulo] of MODOS) {
  await cargar(modo, 1440);
  const real = await leer('.m-n-s-trans');
  comprueba(real && real['background-color'] === 'rgba(0, 0, 0, 0)', `${titulo}: fondo ${real?.['background-color']}`);
  comprueba(real && real['padding-top'] === '33px' && real['padding-left'] === '22px' && real['margin-bottom'] === '11px',
    `${titulo}: relleno 33/22 y margen 11 → ${real?.['padding-top']}/${real?.['padding-left']}/${real?.['margin-bottom']}`);
}

/* 7 · Ancho completo: de borde a borde, con el relleno escrito. */
console.log('\nAncho completo: de borde a borde de la ventana');
for (const [nombre, ancho] of TAMANOS) {
  await cargar('publico', ancho);
  const real = await leer('.m-n-s-full');
  // Lleva margen lateral escrito, asi que el ancho es ventana - margenes.
  const margenes = parseInt(real['margin-left']) + parseInt(real['margin-right']);
  comprueba(real.ancho === ancho - margenes, `${nombre}: ${real.ancho}px de ${ancho - margenes}px disponibles`);
}

/* 8 · Seccion vacia: cero en la web, visible y fiel en el lienzo. */
console.log('\nSección vacía');
await cargar('publico', 1440);
comprueba(await page.locator('.m-n-s-vacia').count() === 0, 'en la web pública ni se imprime');
await cargar('preview', 1440);
comprueba(await page.locator('.m-n-s-vacia').count() === 0, 'en «Preview» tampoco');
await cargar('canvas', 1440);
const vacia = await leer('.m-n-s-vacia');
comprueba(!!vacia, 'en el lienzo se ve y se puede seleccionar');
comprueba(vacia && vacia['padding-top'] === '77px' && vacia['padding-bottom'] === '55px',
  `con el relleno escrito: ${vacia?.['padding-top']}/${vacia?.['padding-bottom']}`);
const altoVacia = await page.evaluate(() => Math.round(document.querySelector('.m-n-s-vacia').getBoundingClientRect().height));
comprueba(altoVacia < 300, `y sin el alto de pantalla que tenía configurado: ${altoVacia}px`);

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
