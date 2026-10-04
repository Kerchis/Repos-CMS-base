#!/usr/bin/env node
/**
 * El panel del constructor, de verdad, en un navegador.
 *
 * Por que hace falta: los otros bancos empiezan en el documento ya guardado.
 * El tramo que faltaba es el primero —tecleas en un campo del panel y eso
 * tiene que acabar dentro del documento que viaja a la API—, que es justo
 * donde se perdian el relleno, el margen y el fondo de las secciones.
 *
 * Carga `app.js` (que trae MApi y KrgUi) y `builder.js` tal cual se sirven
 * en el admin, con las llamadas a la API interceptadas: el registro es el
 * de verdad (tools/dump-registry.php) y el documento es una pagina de dos
 * secciones. Luego escribe en los campos como lo haria una persona y mira
 * el cuerpo del POST de guardado.
 *
 *   node tools/prueba-panel.mjs
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const REST = 'https://krg.test/wp-json/krg/v1';

const registry = JSON.parse(
  execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' })
);

/** Documento de partida: una seccion con un CTA y otra con un parrafo. */
function doc() {
  const nodo = (id, type, props = {}, children = []) => ({
    id, type, name: type, visible: true, source: 'local', globalId: 0,
    props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
  });
  const seccion = (id, dentro) =>
    nodo(id, 'section', { width: 'full', minHeight: 'auto' }, [
      nodo(id + '-row', 'row', {}, [nodo(id + '-col', 'column', { span: 12 }, [dentro])]),
    ]);
  return {
    id: 1, title: 'Prueba', slug: 'prueba', status: 'draft', checksum: 'c0',
    seo: {}, settings: { showHeader: true, showFooter: true },
    sections: [
      // Con su propio color, como en una instalacion de verdad: es el caso
      // en el que el bloque tapa el fondo de la seccion.
      seccion('secCta', nodo('cta1', 'statement-cta', { title: 'Reserva', theme: 'forest', bgColor: '#3f5e58' })),
      seccion('secTxt', nodo('p1', 'paragraph', { text: 'Hola' })),
    ],
  };
}

const guardados = [];
let ultimo = null;
// Cuando esta a true, el servidor simulado devuelve el documento sin
// estilos: asi se comprueba que el constructor lo nota y avisa.
let servidorTragon = false;
let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const html = `<!doctype html><meta charset="utf-8"><title>panel</title>
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;

const dir = mkdtempSync(join(tmpdir(), 'krg-panel-'));
const file = join(dir, 'panel.html');
writeFileSync(file, html);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (req.method() === 'POST' && /\/pages\/1(\/save)?$/.test(url)) {
    const cuerpo = JSON.parse(req.postData() || '{}');
    guardados.push(cuerpo);
    ultimo = JSON.parse(JSON.stringify(cuerpo));
    const resp = JSON.parse(JSON.stringify(cuerpo));
    if (servidorTragon) {
      const limpiar = (list) => (list || []).forEach((n) => {
        n.styles = { desktop: {}, tablet: {}, mobile: {} };
        limpiar(n.children);
      });
      limpiar(resp.sections);
    }
    return json({ ...resp, checksum: 'c' + guardados.length });
  }
  if (url === '/pages/1') return json(ultimo || doc());
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

await page.goto('file://' + file);
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });

/** Selecciona un nodo del arbol por su id. */
async function seleccionar(id) {
  await page.evaluate((nid) => {
    const el = document.querySelector(`[data-sel="${nid}"]`);
    if (!el) throw new Error('no esta en el arbol: ' + nid);
    el.click();
  }, id);
  await page.click('[data-insp-tab="design"]');
  await page.waitForTimeout(150);
  await abrirTodos();
}

/**
 * Abre todos los grupos plegados del inspector.
 *
 * El panel nuevo nace con los grupos cerrados menos el primero, asi que
 * una persona pulsa el titulo antes de escribir. El banco hace lo mismo:
 * si esto deja de abrirlos, los controles no se ven y las pruebas de
 * abajo fallan, que es exactamente lo que queremos que pase.
 */
async function abrirTodos() {
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
  });
  await page.waitForTimeout(60);
}

/** Escribe en una casilla de Relleno/Margen como lo haria una persona. */
async function escribirLado(prop, valor) {
  const sel = `.b-insp [data-side="${prop}"]`;
  await page.waitForSelector(sel, { timeout: 5000 });
  await page.fill(sel, String(valor));
  await page.waitForTimeout(80);
}

/** Espera al guardado automatico (1,2 s de espera + red). */
async function esperarGuardado(n) {
  await page.waitForFunction(() => true);
  const t0 = Date.now();
  while (guardados.length < n && Date.now() - t0 < 8000) {
    await page.waitForTimeout(100);
  }
  return guardados.length >= n;
}

const nodoDe = (cuerpo, id) => {
  let res = null;
  const walk = (list) => (list || []).forEach((n) => {
    if (n.id === id) res = n;
    walk(n.children);
  });
  walk(cuerpo.sections);
  return res;
};

/* ------------------------------------------------------------------ */
console.log('\nSección: Relleno y Margen (panel «Separación»)');
await seleccionar('secCta');
await escribirLado('padding-top', 50);
await escribirLado('margin-bottom', 30);
ok(await esperarGuardado(1), 'el cambio dispara un guardado');
let sec = guardados.length ? nodoDe(guardados[guardados.length - 1], 'secCta') : null;
ok(!!sec, 'la sección viaja en el documento guardado');
ok(sec?.styles?.desktop?.['padding-top'] === '50px', `padding-top guardado = ${sec?.styles?.desktop?.['padding-top']}`);
ok(sec?.styles?.desktop?.['margin-bottom'] === '30px', `margin-bottom guardado = ${sec?.styles?.desktop?.['margin-bottom']}`);

console.log('\nSección: color de fondo');
await page.waitForSelector('.b-insp [data-style="background-color"]');
await page.fill('.b-insp [data-style="background-color"]', '#D94E27');
const n0 = guardados.length;
ok(await esperarGuardado(n0 + 1), 'el color dispara un guardado');
sec = nodoDe(guardados[guardados.length - 1], 'secCta');
ok(sec?.styles?.desktop?.['background-color'] === '#D94E27', `background guardado = ${sec?.styles?.desktop?.['background-color']}`);

// Aqui no hay lienzo que mirar (la API simulada no devuelve pagina), asi
// que el panel decide por lo que declara el documento: el bloque lleva su
// propio color, luego tapa.
console.log('\n«Pintar también el bloque» copia el color al bloque de dentro');
await page.waitForSelector('.b-insp [data-paint-child]');
// El aviso sale al escribir el color, sin volver a seleccionar nada.
ok(true, 'el aviso de «lo tapa un bloque» aparece al poner el color');
// Y sobrevive a perder el foco: el `change` del campo no puede borrar el
// boton entre el mousedown y el click de quien lo esta pulsando.
// Pulsar en la cabecera del elemento: quita el foco sin tocar nada.
await page.click('.b-insp .b-sel-name');
ok(await page.locator('.b-insp [data-paint-child]').count() === 1,
  'el botón sigue ahí después de que el campo pierda el foco');
await page.click('.b-insp [data-paint-child]');
const n9 = guardados.length;
ok(await esperarGuardado(n9 + 1), 'pintar el bloque dispara un guardado');
const cta = nodoDe(guardados[guardados.length - 1], 'cta1');
ok(cta?.props?.bgColor === '#D94E27', `el bloque recibe bgColor = ${cta?.props?.bgColor}`);

console.log('\nBloque de dentro (panel «Espaciado»)');
await seleccionar('cta1');
await escribirLado('padding-top', 25);
const n1 = guardados.length;
ok(await esperarGuardado(n1 + 1), 'el cambio en el bloque dispara un guardado');
const blo = nodoDe(guardados[guardados.length - 1], 'cta1');
ok(blo?.styles?.desktop?.['padding-top'] === '25px', `padding-top del bloque = ${blo?.styles?.desktop?.['padding-top']}`);

console.log('\nLo anterior no se pierde al seguir editando');
sec = nodoDe(guardados[guardados.length - 1], 'secCta');
ok(sec?.styles?.desktop?.['padding-top'] === '50px', 'la sección conserva su relleno');
ok(sec?.styles?.desktop?.['background-color'] === '#D94E27', 'la sección conserva su fondo');

console.log('\nEl panel vuelve a enseñar lo guardado');
await seleccionar('secCta');
const visto = await page.inputValue('.b-insp [data-side="padding-top"]');
ok(visto === '50', `la casilla Arriba enseña ${JSON.stringify(visto)}`);

console.log('\nTras recargar el constructor, el panel enseña lo guardado');
await page.reload();
await page.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await seleccionar('secCta');
const tras = await page.evaluate(() => ({
  texto: document.querySelector('.b-insp [data-style="background-color"]')?.value,
  muestra: document.querySelector('.b-insp [data-style="background-color"]')?.closest('.m-pick')?.querySelector('[data-pick-hex]')?.value,
  relleno: document.querySelector('.b-insp [data-side="padding-top"]')?.value,
}));
ok(tras.texto === '#D94E27', `campo de texto = ${tras.texto}`);
ok(tras.muestra === '#d94e27', `cuadrito del color = ${tras.muestra}`);
ok(tras.relleno === '50', `relleno Arriba = ${tras.relleno}`);

console.log('\nSi el servidor descarta un estilo, el panel avisa');
servidorTragon = true;
await seleccionar('secTxt');
await escribirLado('padding-top', 70);
const n2 = guardados.length;
await esperarGuardado(n2 + 1);
await page.waitForTimeout(400);
const aviso = await page.textContent('.b-warn');
ok(/descart/i.test(aviso || ''), `aviso visible: ${JSON.stringify((aviso || '').slice(0, 60))}`);
ok(/padding-top/.test(aviso || ''), 'el aviso nombra la propiedad perdida');
servidorTragon = false;

// Nadie escribe un hexadecimal a mano: se pulsa el cuadrito y se elige en
// el selector del sistema. Eso es otro control y otro camino.
// Un campo vacío tiene que parecer vacío: era lo que hacía creer que el
// panel ya tenía un color puesto y que el render lo ignoraba.
console.log('\nUn campo de color vacío se ve vacío');
await seleccionar('secTxt');
const vacio = await page.evaluate(() => {
  const campo = document.querySelector('.b-insp [data-style="background-color"]');
  const fila = campo.closest('.m-pick');
  return { valor: campo.value, hueco: campo.placeholder, marcado: fila.classList.contains('is-empty'), tieneX: !!fila.querySelector('[data-pick-clear]') };
});
ok(vacio.valor === '', 'el campo llega sin valor');
ok(!/^#/.test(vacio.hueco), `el texto de ayuda no parece un color: ${JSON.stringify(vacio.hueco)}`);
ok(vacio.marcado, 'el cuadrito se marca como vacío');
ok(vacio.tieneX, 'hay botón para quitar el color');

console.log('\nElegir el color con el cuadrito (no escribiendo el hex)');
await seleccionar('secTxt');
await page.evaluate(() => {
  const campo = document.querySelector('.b-insp [data-style="background-color"]');
  const cuadro = campo.closest('.m-pick').querySelector('[data-pick-hex]');
  cuadro.value = '#00ff00';
  cuadro.dispatchEvent(new Event('input', { bubbles: true }));
});
const n7 = guardados.length;
ok(await esperarGuardado(n7 + 1), 'elegir en el cuadrito dispara un guardado');
const secV = nodoDe(guardados[guardados.length - 1], 'secTxt');
ok(secV?.styles?.desktop?.['background-color'] === '#00ff00', `fondo elegido con el cuadrito = ${secV?.styles?.desktop?.['background-color']}`);

const trasElegir = await page.evaluate(() => {
  const fila = document.querySelector('.b-insp [data-style="background-color"]').closest('.m-pick');
  return { marcado: fila.classList.contains('is-empty'), texto: fila.querySelector('.m-pick-val').value };
});
ok(!trasElegir.marcado, 'al elegir color se quita la marca de vacío');
ok(trasElegir.texto === '#00ff00', `la casilla de texto se sincroniza: ${trasElegir.texto}`);

console.log('\nLa ✕ vuelve a dejarlo sin color');
// Ojo: hay otra ✕ antes (la del color de borde). Hay que pulsar la del
// campo de fondo, no la primera que aparezca.
await page.evaluate(() => {
  document.querySelector('.b-insp [data-style="background-color"]').closest('.m-pick').querySelector('[data-pick-clear]').click();
});
const nX = guardados.length;
ok(await esperarGuardado(nX + 1), 'quitar el color dispara un guardado');
await page.waitForTimeout(2200);
const secX = nodoDe(guardados[guardados.length - 1], 'secTxt');
ok(!secX?.styles?.desktop?.background, `el fondo queda sin valor: ${JSON.stringify(secX?.styles?.desktop?.background)}`);

console.log('\nColor propio del bloque, también con el cuadrito');
await seleccionar('cta1');
const hayPicker = await page.evaluate(() => {
  const inp = document.querySelector('.b-insp [data-color-picker]');
  if (!inp) return false;
  inp.value = '#0000ff';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
});
ok(hayPicker, 'el bloque tiene selector de color');
const n8 = guardados.length;
ok(await esperarGuardado(n8 + 1), 'el color del bloque dispara un guardado');
const ctaC = nodoDe(guardados[guardados.length - 1], 'cta1');
ok(JSON.stringify(ctaC?.props?.bgColor || '').includes('0000ff'), `bgColor del bloque = ${JSON.stringify(ctaC?.props?.bgColor)}`);

console.log('\nEl aviso entiende el color guardado como objeto, no lo escupe en crudo');
// El selector de color guarda {mode,token,value}. Si el aviso lo trata
// como una cadena, enseña «[object Object]» y queda como un error.
await seleccionar('secCta');
await page.fill('.b-insp [data-style="background-color"]', '#D94E27');
await page.waitForSelector('.b-insp [data-bg-note] p');
const textoAviso = await page.locator('.b-insp [data-bg-note]').innerText();
ok(!/object Object/.test(textoAviso), `el aviso no enseña basura: «${textoAviso.replace(/\s+/g, ' ').trim().slice(0, 90)}»`);
ok(/#0000ff/i.test(textoAviso), 'y nombra el color real del bloque');

if (errores.length) {
  console.log('\nErrores de consola:');
  errores.forEach((e) => console.log('  ' + e));
  fallos += errores.length;
}

await browser.close();
const total = hechas + errores.length;
console.log(`\n${total - fallos}/${total} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
