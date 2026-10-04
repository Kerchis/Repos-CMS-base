#!/usr/bin/env node
/**
 * Las secciones V.2, una por una, de principio a fin.
 *
 * Por qué hace falta: una sección V.2 no es un módulo, es un árbol de
 * bloques. Si una pieza usa un slug que no existe, si una fila suma más
 * de doce columnas o si al servidor le llega algo que no sabe pintar,
 * el usuario se encuentra una sección rota en su página. Aquí se monta
 * cada plantilla igual que en el navegador y se comprueba:
 *
 *   1. que todos los bloques que usa existen en el registro de verdad;
 *   2. que cada pieza tiene nombre propio, para que el árbol se lea;
 *   3. que las columnas de cada fila caben en las doce del diseño;
 *   4. que el documento resultante sobrevive al saneado de PHP;
 *   5. que el servidor lo pinta sin un solo aviso y con los textos
 *      dentro del HTML.
 *
 *   node tools/prueba-v2.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './harness.mjs';

const PHP = `${ROOT}/.tools/php/php`;
const registry = JSON.parse(
  execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' })
);
const porSlug = new Map(registry.map((c) => [c.slug, c]));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

/* ------------------------------------------------------------------ */
/* El catálogo, cargado tal cual lo carga el navegador                  */

const dict = (obj, key) => {
  const v = obj[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  obj[key] = {};
  return obj[key];
};
const ventana = {
  KrgBuilderCore: {
    dict,
    styleBucket: (node, bp) => dict(dict(node, 'styles'), bp),
  },
};
// El archivo es un script de navegador: se ejecuta con `window` fingido.
const fuente = readFileSync(`${ROOT}/krg-cms/admin/assets/js/builder-v2.js`, 'utf8');
new Function('window', fuente)(ventana);
const V2 = ventana.KrgV2;

let semilla = 0;
// Mismo molde que `makeNode` del editor: id, tipo, nombre, props con los
// valores de fábrica del registro, estilos por tamaño e hijos.
const makeNode = (type) => {
  const def = porSlug.get(type);
  semilla += 1;
  return {
    id: `v2_${String(semilla).padStart(4, '0')}`,
    type,
    name: def ? def.name : type,
    visible: true,
    source: 'local',
    globalId: 0,
    props: JSON.parse(JSON.stringify((def && def.defaults) || {})),
    styles: { desktop: {}, tablet: {}, mobile: {} },
    children: [],
  };
};

console.log('PRUEBA 1 — el catálogo está donde tiene que estar');
ok(!!V2 && typeof V2.list === 'function' && typeof V2.build === 'function',
  'builder-v2.js expone KrgV2.list() y KrgV2.build()');
const lista = V2.list();
ok(lista.length >= 10, `hay ${lista.length} secciones V.2 en la paleta`);
ok(lista.every((s) => /V\.2$/.test(s.name)), 'todas se llaman «… V.2», sin confundirse con las de siempre');
ok(new Set(lista.map((s) => s.slug)).size === lista.length, 'ningún slug repetido');
ok(lista.every((s) => porSlug.has(s.desde)),
  `cada una dice de qué sección de siempre viene (${lista.map((s) => s.desde).join(', ')})`);
// Y lo más importante: ninguna pisa a un módulo existente.
ok(lista.every((s) => !porSlug.has(s.slug)),
  'ninguna sección V.2 sustituye ni renombra a un bloque del registro');

/* ------------------------------------------------------------------ */
/* Cada plantilla, por dentro                                          */

const recorrer = (n, fn, padre = null) => {
  fn(n, padre);
  (n.children || []).forEach((c) => recorrer(c, fn, n));
};

const CONTENEDORES = new Set(['section', 'row', 'column']);
const documentos = [];

console.log('\nPRUEBA 2 — cada sección V.2, pieza a pieza');
for (const ficha of lista) {
  semilla = 0;
  const sec = V2.build(ficha.slug, makeNode);
  if (!sec) {
    ok(false, `${ficha.name}: no se pudo montar`);
    continue;
  }
  const nodos = [];
  recorrer(sec, (n, padre) => nodos.push({ n, padre }));
  const hojas = nodos.filter(({ n }) => !CONTENEDORES.has(n.type));
  const desconocidos = [...new Set(nodos.map(({ n }) => n.type).filter((t) => !porSlug.has(t)))];
  const sinNombre = hojas.filter(({ n }) => !n.name || n.name === n.type);
  const filasAnchas = nodos
    .filter(({ n }) => n.type === 'row')
    .filter(({ n }) => (n.children || []).reduce((t, c) => t + Number(c.props?.span || 0), 0) > 12);
  const huerfanos = nodos.filter(({ n, padre }) =>
    n.type === 'column' && padre && padre.type !== 'row');
  const vacias = nodos.filter(({ n }) => CONTENEDORES.has(n.type) && !(n.children || []).length);

  console.log(`  — ${ficha.name} (desde «${porSlug.get(ficha.desde).name}»)`);
  ok(sec.type === 'section', `    es una sección, no un módulo suelto`);
  ok(hojas.length >= 3, `    tiene ${hojas.length} piezas editables y ${nodos.length - hojas.length} contenedores`);
  ok(desconocidos.length === 0, `    sólo usa bloques que ya existen${desconocidos.length ? `: sobran ${desconocidos.join(', ')}` : ''}`);
  ok(sinNombre.length === 0, `    cada pieza tiene nombre propio en el árbol${sinNombre.length ? `: faltan ${sinNombre.length}` : ''}`);
  ok(filasAnchas.length === 0, `    ninguna fila se pasa de doce columnas`);
  ok(huerfanos.length === 0, `    ninguna columna cuelga de donde no debe`);
  ok(vacias.length === 0, `    ningún contenedor se queda vacío`);

  documentos.push({ ficha, sec, hojas });
}

/* ------------------------------------------------------------------ */
/* Y ahora el servidor: saneado y pintado de verdad                     */

console.log('\nPRUEBA 3 — el servidor las sanea y las pinta sin un aviso');
const dir = mkdtempSync(join(tmpdir(), 'krg-v2-'));
for (const { ficha, sec, hojas } of documentos) {
  const doc = {
    id: 1,
    title: ficha.name,
    slug: 'v2',
    status: 'publish',
    seo: {},
    settings: {},
    sections: [JSON.parse(JSON.stringify(sec))],
  };
  const ruta = join(dir, `${ficha.slug}.json`);
  writeFileSync(ruta, JSON.stringify(doc));
  let html = '';
  let error = '';
  try {
    html = execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, ruta], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    error = String(e.stderr || e.message).slice(0, 300);
  }
  // Un aviso de PHP de verdad empieza la línea o viene en negrita; la
  // palabra suelta no vale, que en la hoja de estilos hay un token
  // llamado `--color-warning` y daba un falso positivo.
  const aviso = html.match(/(?:^|\n|<b>)\s*(Warning|Notice|Fatal error|Parse error|Deprecated|Uncaught [A-Za-z]+)\s*:/);
  const avisos = aviso ? aviso[1] : '';
  ok(!error, `${ficha.name}: el servidor la pinta${error ? ` — ${error}` : ''}`);
  ok(!avisos, `${ficha.name}: sin avisos de PHP en la salida${avisos ? ` — ${avisos}` : ''}`);
  // Los textos de las piezas tienen que acabar en el HTML, o la pieza
  // existe en el árbol pero no se ve en la web, que es peor que nada.
  const textos = hojas
    .map(({ n }) => n.props?.text)
    .filter((t) => typeof t === 'string' && t.length > 8)
    .slice(0, 4);
  const perdidos = textos.filter((t) => !html.includes(t.replace(/&/g, '&amp;')));
  ok(perdidos.length === 0,
    `${ficha.name}: sus textos salen en la web${perdidos.length ? ` — falta «${perdidos[0]}»` : ''}`);
  // Y cada pieza deja su clase por id, que es de donde cuelgan los
  // estilos que se configuren luego en el inspector.
  const conClase = hojas.filter(({ n }) => html.includes(`m-n-${n.id}`)).length;
  ok(conClase === hojas.length,
    `${ficha.name}: las ${hojas.length} piezas salen con su clase propia (${conClase})`);
}

console.log('\nPRUEBA 4 — sobreviven al guardado, que es donde se pierden las cosas');
// El saneador del servidor es quien decide qué se guarda de verdad. Si
// una pieza o su texto no pasa por aquí, el usuario la coloca, guarda y
// al volver no está.
for (const { ficha, sec, hojas } of documentos) {
  const ruta = join(dir, `${ficha.slug}-save.json`);
  writeFileSync(ruta, JSON.stringify({
    id: 1, title: ficha.name, slug: 'v2', status: 'publish', seo: {}, settings: {},
    sections: [JSON.parse(JSON.stringify(sec))],
  }));
  let vuelto = null;
  let error = '';
  try {
    vuelto = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/sanear.php`, ruta], { encoding: 'utf8' }));
  } catch (e) {
    error = String(e.stderr || e.message).slice(0, 200);
  }
  if (!vuelto) {
    ok(false, `${ficha.name}: el saneador la rechaza — ${error}`);
    continue;
  }
  const quedan = [];
  (function walk(list) {
    (list || []).forEach((n) => { quedan.push(n); walk(n.children); });
  })(vuelto.sections);
  const ids = new Set(quedan.map((n) => n.id));
  const perdidas = hojas.filter(({ n }) => !ids.has(n.id));
  ok(perdidas.length === 0,
    `${ficha.name}: las ${hojas.length} piezas siguen ahí tras guardar${perdidas.length ? ` — se perdió «${perdidas[0].n.name}»` : ''}`);
  const nombres = quedan.filter((n) => n.name).length;
  ok(nombres === quedan.length, `${ficha.name}: y conservan su nombre en el árbol (${nombres}/${quedan.length})`);
  const conEstilos = quedan.filter((n) => n.styles && n.styles.desktop && Object.keys(n.styles.desktop).length).length;
  const puestos = [];
  (function walk(list) {
    (list || []).forEach((n) => {
      if (n.styles && n.styles.desktop && Object.keys(n.styles.desktop).length) puestos.push(n.id);
      walk(n.children);
    });
  })([sec]);
  ok(conEstilos === puestos.length,
    `${ficha.name}: los rellenos y altos que trae puestos también se guardan (${conEstilos}/${puestos.length})`);
}

console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
