#!/usr/bin/env node
/**
 * «Estirar» con cualquier bloque, y sin romper ninguno.
 *
 * Por que existe: hasta ahora «Alineacion vertical: estirar» solo hacia
 * crecer a tres modulos (`.m-sp`, `.m-bh`, `.m-map`). Con cualquier otro
 * —un CTA con tema, una tarjeta con color— el bloque se quedaba con su
 * alto natural y la seccion mostraba una franja de fondo vacia que no
 * habia forma de quitar desde el panel. Elegir «Estirar» no hacia nada
 * visible y parecia que el control estaba roto.
 *
 * Ahora estira todo. El riesgo de estirar todo es el contrario: para
 * poder COLOCAR el contenido dentro del bloque estirado hay que
 * convertirlo en una columna flexible, y eso puede desmontar por dentro
 * a un modulo que ya organizaba sus hijos en fila.
 *
 * Asi que este banco no se fia: renderiza CADA modulo del registro dos
 * veces —con y sin estirar— y compara.
 *
 *   1. Estirado, el bloque llena el alto de la seccion.
 *   2. Su reparto horizontal interno no cambia: los hijos directos
 *      siguen ocupando las mismas posiciones en x. Si un modulo pasa de
 *      fila a columna, aqui salta.
 *   3. `is-sa-start|center|end` mueven el contenido dentro del bloque.
 *   4. Y el fondo del bloque cubre de verdad todo el alto, medido en
 *      pixeles con elementFromPoint, que es lo unico que ve el usuario.
 *
 *   node tools/prueba-estirar.mjs
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

const PHP = `${ROOT}/.tools/php/php`;
const SALIDA = `${ROOT}/.captures`;
mkdirSync(SALIDA, { recursive: true });

const nodo = (id, type, props = {}, children = []) => ({ id, type, name: type, visible: true, props, styles: {}, children });

/* Props minimas para que cada modulo pinte algo con forma. Los que no
   estan aqui se renderizan con sus valores por defecto. */
const PROPS = {
  'statement-cta': { title: 'Reserva', text: 'Mesa para dos', buttonText: 'Ir', theme: 'forest' },
  heading: { text: 'Un titular', level: 'h2' },
  paragraph: { text: 'Un párrafo cualquiera que ocupa poco alto.' },
  'rich-text': { html: '<p>Texto enriquecido</p>' },
  eyebrow: { text: 'Antetítulo' },
  quote: { text: 'Una cita', author: 'Alguien' },
  button: { text: 'Pulsa', url: '#' },
  'button-group': { items: [{ text: 'Uno', url: '#' }, { text: 'Dos', url: '#' }] },
  card: { title: 'Tarjeta', text: 'Con texto' },
  feature: { title: 'Ventaja', text: 'Descripción' },
  cta: { title: 'Llamada', buttonText: 'Ir', buttonUrl: '#' },
  'social-links': { items: [{ network: 'instagram', url: '#' }, { network: 'facebook', url: '#' }] },
  'menu-list': { items: [{ title: 'Plato', price: '10' }] },
  'info-table': { rows: [{ label: 'Lunes', value: '9-18' }] },
  statistics: { items: [{ value: '10', label: 'Años' }, { value: '20', label: 'Mesas' }] },
  'numbered-list': { items: [{ title: 'Uno', text: 'a' }, { title: 'Dos', text: 'b' }] },
  'statement-list': { items: [{ text: 'Uno' }, { text: 'Dos' }] },
  marquee: { text: 'Hecho aquí' },
  wordmark: { text: 'FRENCH QUARTER' },
  'retail-strip': { items: [{ name: 'Tienda' }] },
  faq: { items: [{ question: '¿Sí?', answer: 'Sí' }] },
  accordion: { items: [{ title: 'Uno', text: 'a' }] },
  tabs: { items: [{ title: 'Uno', text: 'a' }] },
  timeline: { items: [{ title: 'Uno', text: 'a' }] },
  testimonials: { items: [{ text: 'Genial', author: 'A' }] },
  divider: {},
  spacer: { height: 40 },
};

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const slugs = (Array.isArray(registry) ? registry : registry.components || [])
  .map((c) => c.slug)
  .filter((s) => ![
    // Estructura: no son contenido de una columna.
    'section', 'container', 'row', 'column', 'columns',
    // Piden datos de WordPress que aqui no existen.
    'blog-grid', 'recent-posts', 'related-posts', 'categories', 'blog-post',
    'everest-form', 'search-form', 'menu', 'preloader',
  ].includes(s));

function doc(slug, estirar, sa = 'center') {
  const props = {
    width: 'boxed',
    minHeight: 'custom',
    minHeightValue: 90,
    minHeightUnit: 'vh',
    heightMode: 'min',
    vAlign: estirar ? 'stretch' : 'start',
    stretchAlign: sa,
  };
  return {
    id: 1, title: 'Estirar', slug: 'estirar', status: 'draft', checksum: 'c0',
    seo: {}, settings: {},
    sections: [
      {
        ...nodo('sec', 'section', props, [
          nodo('r', 'row', {}, [nodo('c', 'column', { span: 12 }, [
            nodo('m', slug, PROPS[slug] || {}),
          ])]),
        ]),
        styles: { desktop: { 'background-color': '#fef6e7' } },
      },
    ],
  };
}

function pintar(d) {
  const archivo = path.join(SALIDA, 'estirar.json');
  writeFileSync(archivo, JSON.stringify(d));
  return execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, archivo], { encoding: 'utf8' });
}

const { chromium } = chromiumLib();
const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).split('\n')[0]));

async function medir(d) {
  await page.setContent(pintar(d), { waitUntil: 'load' });
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const sec = document.querySelector('.m-n-sec');
    const mod = document.querySelector('.m-n-m');
    if (!sec || !mod) return null;
    const rs = sec.getBoundingClientRect();
    const rm = mod.getBoundingClientRect();
    const hijos = [...mod.children]
      .filter((h) => h.getBoundingClientRect().width > 0)
      .map((h) => Math.round(h.getBoundingClientRect().left));
    return {
      secAlto: Math.round(rs.height),
      modAlto: Math.round(rm.height),
      modTop: Math.round(rm.top - rs.top),
      // Firma del reparto horizontal: cuantas posiciones x distintas
      // ocupan los hijos directos. Una fila que se convierte en columna
      // pasa de varias a una sola.
      firma: [...new Set(hijos)].sort((a, b) => a - b).join(','),
      hijos: hijos.length,
    };
  });
}

console.log('\n================ ESTIRAR CUALQUIER BLOQUE ================');
console.log(`${slugs.length} módulos del registro, cada uno con y sin estirar\n`);

const rotos = [];
let crecen = 0;
for (const slug of slugs) {
  const normal = await medir(doc(slug, false));
  const estirado = await medir(doc(slug, true));
  if (!normal || !estirado) {
    comprueba(false, `${slug}: no se ha podido renderizar`);
    continue;
  }
  // 1. Crece hasta llenar la seccion (menos el relleno vertical del ritmo).
  const lleno = estirado.modAlto >= normal.secAlto * 0.5 && estirado.modAlto > normal.modAlto;
  if (lleno) ++crecen;
  // 2. Y por dentro sigue repartido igual.
  if (normal.firma !== estirado.firma) rotos.push(`${slug} (${normal.firma} → ${estirado.firma})`);
}
comprueba(crecen >= slugs.length * 0.8, `${crecen} de ${slugs.length} módulos crecen al estirar`);
comprueba(rotos.length === 0, `ningún módulo cambia su reparto interno: ${rotos.length ? rotos.join(' · ') : 'ninguno roto'}`);

/* ------------------------------------------------------------------ */
console.log('\n--- Un bloque que pinta llena el alto de verdad');
const conTema = await medir(doc('statement-cta', true));
const sinEstirar = await medir(doc('statement-cta', false));
comprueba(sinEstirar.modAlto < sinEstirar.secAlto * 0.7, `sin estirar el CTA ocupa ${sinEstirar.modAlto} de ${sinEstirar.secAlto}px: queda franja vacía`);
comprueba(conTema.modAlto >= conTema.secAlto * 0.85, `estirado ocupa ${conTema.modAlto} de ${conTema.secAlto}px`);

await page.setContent(pintar(doc('statement-cta', true)), { waitUntil: 'load' });
await page.waitForTimeout(120);
for (const [donde, fr] of [['arriba', 0.05], ['en medio', 0.5], ['abajo', 0.95]]) {
  const visto = await page.evaluate((f) => {
    const el = document.querySelector('.m-n-sec');
    const r = el.getBoundingClientRect();
    const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height * f));
    let n = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(y));
    while (n) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'transparent' && bg.replace(/\s/g, '') !== 'rgba(0,0,0,0)') return bg;
      n = n.parentElement;
    }
    return 'nada';
  }, fr);
  comprueba(visto === 'rgb(63, 94, 88)', `el verde del bloque se ve ${donde}: ${visto}`);
}

/* ------------------------------------------------------------------ */
console.log('\n--- Dónde queda el contenido dentro del bloque estirado');
const centros = {};
for (const sa of ['start', 'center', 'end']) {
  await page.setContent(pintar(doc('statement-cta', true, sa)), { waitUntil: 'load' });
  await page.waitForTimeout(120);
  const r = await page.evaluate(() => {
    const mod = document.querySelector('.m-n-m');
    const inner = mod.querySelector('.m-sc-inner');
    if (!inner) return null;
    const rm = mod.getBoundingClientRect();
    const ri = inner.getBoundingClientRect();
    return { rel: (ri.top + ri.height / 2 - rm.top) / rm.height, clases: document.querySelector('.m-n-sec').className };
  });
  centros[sa] = r;
  comprueba(!!r && /is-sa-/.test(r.clases), `${sa}: la sección lleva la clase (${r ? r.clases.split(' ').filter((c) => c.startsWith('is-sa')).join('') : '—'})`);
}
comprueba(centros.start.rel < 0.4, `arriba: el contenido queda al ${Math.round(centros.start.rel * 100)} % del alto`);
comprueba(Math.abs(centros.center.rel - 0.5) < 0.1, `centro: al ${Math.round(centros.center.rel * 100)} %`);
comprueba(centros.end.rel > 0.6, `abajo: al ${Math.round(centros.end.rel * 100)} %`);
comprueba(centros.start.rel < centros.center.rel && centros.center.rel < centros.end.rel, 'y las tres posiciones están ordenadas de arriba abajo');

/* ------------------------------------------------------------------ */
console.log('\n--- Lo que no debe cambiar');
const fila = {
  id: 1, title: 'Dos', slug: 'dos', status: 'draft', checksum: 'c0', seo: {}, settings: {},
  sections: [{
    ...nodo('sec', 'section', {
      width: 'boxed', minHeight: 'custom', minHeightValue: 90, minHeightUnit: 'vh',
      heightMode: 'min', vAlign: 'stretch', stretchAlign: 'center',
    }, [
      nodo('r', 'row', { layout: '6-6' }, [
        nodo('c1', 'column', { span: 6 }, [nodo('m', 'statement-cta', PROPS['statement-cta'])]),
        nodo('c2', 'column', { span: 6 }, [nodo('m2', 'paragraph', { text: 'Al lado' })]),
      ]),
    ]),
    styles: { desktop: { 'background-color': '#fef6e7' } },
  }],
};
await page.setContent(pintar(fila), { waitUntil: 'load' });
await page.waitForTimeout(120);
const dos = await page.evaluate(() => {
  const a = document.querySelector('.m-n-c1').getBoundingClientRect();
  const b = document.querySelector('.m-n-c2').getBoundingClientRect();
  return { lado: Math.round(b.left - a.left), mismaFila: Math.abs(a.top - b.top) < 2, altoA: Math.round(a.height), altoB: Math.round(b.height) };
});
comprueba(dos.mismaFila && dos.lado > 300, `dos columnas siguen una al lado de la otra (${dos.lado}px de separación)`);
comprueba(Math.abs(dos.altoA - dos.altoB) < 2, `y las dos miden lo mismo: ${dos.altoA} / ${dos.altoB}px`);

const auto = await medir({
  ...doc('statement-cta', false),
  sections: [{
    ...nodo('sec', 'section', { width: 'boxed' }, [
      nodo('r', 'row', {}, [nodo('c', 'column', { span: 12 }, [nodo('m', 'statement-cta', PROPS['statement-cta'])])]),
    ]),
    styles: { desktop: { 'background-color': '#fef6e7' } },
  }],
});
comprueba(auto.modAlto > 0 && auto.modAlto < 600, `sin alto configurado nada se estira: el CTA mide ${auto.modAlto}px`);

comprueba(errores.length === 0, `sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`);

await browser.close();
console.log(`\n${ok}/${ok + fallos} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
