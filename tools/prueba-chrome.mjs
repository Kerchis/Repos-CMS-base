#!/usr/bin/env node
/**
 * El constructor de cabecera y pie, con el mismo motor que las páginas.
 *
 * Por que hace falta: el encargo pide un unico motor para paginas y
 * navegacion (puntos 28-30). Decirlo es facil; esto lo comprueba. La
 * pantalla de cabecera y pie carga `builder-core.js` y pinta sus
 * ajustes como grupos plegables del nucleo, con las mismas tres
 * pestañas y la misma cabecera de seleccion. Y lo que se toca tiene que
 * llegar al PUT de /header o /footer, no quedarse en la pantalla.
 *
 *   node tools/prueba-chrome.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = `${ROOT}/krg-cms/admin/assets/css`;
const REST = 'https://krg.test/wp-json/krg/v1';

const registry = JSON.parse(
  execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' })
);

const header = {
  logoId: 0, logoWidth: 140, height: 72, paddingY: 12, sticky: true,
  menuSlug: 'principal', ctaText: 'Reservar', ctaUrl: '#', align: 'left',
  background: '', color: '', transparent: false, animation: 'none',
};
const footer = {
  text: 'Pie', columns: 3, paddingY: 64, copyright: '© KRG', reveal: 'stagger',
  menuSlug: 'principal', showClassic: true,
  sections: [{
    id: 'fsec1', type: 'section', name: 'Sección del pie', visible: true, props: { layout: '6-6' },
    styles: { desktop: {}, tablet: {}, mobile: {} },
    children: [{
      id: 'frow1', type: 'row', name: 'Fila', visible: true, props: { layout: '6-6', gap: 24 },
      styles: { desktop: {}, tablet: {}, mobile: {} },
      children: [{
        id: 'fcol1', type: 'column', name: 'Columna', visible: true, props: { span: 6 },
        styles: { desktop: {}, tablet: {}, mobile: {} },
        children: [{
          id: 'ftxt1', type: 'paragraph', name: 'Párrafo', visible: true, props: { text: 'Hola' },
          styles: { desktop: {}, tablet: {}, mobile: {} }, children: [],
        }],
      }],
    }],
  }],
};

const enviados = { header: [], footer: [] };
let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

function paginaHtml(region) {
  // Con los estilos de verdad y dentro del armazón del admin de
  // WordPress. Sin ellos el panel no tiene ni altura ni barra, y lo que
  // se midiera aquí no sería lo que ve nadie.
  return `<!doctype html><meta charset="utf-8"><title>chrome</title>
<style>${readFileSync(`${CSS}/admin.css`, 'utf8')}</style>
<style>${readFileSync(`${CSS}/builder.css`, 'utf8')}</style>
<body class="wp-admin">
<div id="wpwrap"><div id="wpcontent" style="margin-left:160px"><div id="wpbody"><div id="wpbody-content">
<div id="krg-builder"></div>
</div></div></div></div>
<script>window.KrgAdmin={chrome:${JSON.stringify(region)},rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/chrome.js"></script>`;
}

const dir = mkdtempSync(join(tmpdir(), 'krg-chrome-'));
writeFileSync(join(dir, 'header.html'), paginaHtml('header'));
writeFileSync(join(dir, 'footer.html'), paginaHtml('footer'));

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

await page.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (req.method() === 'POST' || req.method() === 'PUT') {
    const cuerpo = JSON.parse(req.postData() || '{}');
    if (url.startsWith('/header')) { enviados.header.push(cuerpo); Object.assign(header, cuerpo); }
    if (url.startsWith('/footer')) { enviados.footer.push(cuerpo); Object.assign(footer, cuerpo); }
    return json(cuerpo);
  }
  if (url === '/header') return json(header);
  if (url === '/footer') return json(footer);
  if (url === '/menus') return json([{ slug: 'principal', name: 'Principal' }]);
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});

const esperar = (ms = 150) => page.waitForTimeout(ms);
const grupos = () => page.evaluate(() =>
  [...document.querySelectorAll('.b-insp .b-group')].map((g) => ({
    id: g.dataset.acc,
    titulo: g.querySelector('.acc-t')?.textContent.trim(),
    abierto: g.classList.contains('is-open'),
  })));
const abrirTodos = async () => {
  await page.evaluate(() => {
    document.querySelectorAll('.b-insp .b-group:not(.is-open) > .acc-h').forEach((b) => b.click());
  });
  await esperar(60);
};
async function esperarEnvio(lista, n, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (lista.length >= n) return true;
    await esperar(120);
  }
  return false;
}

/* ================================================================== */
console.log('\nPRUEBA 1 — la cabecera usa el núcleo del constructor');
await page.goto('file://' + join(dir, 'header.html'));
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
ok(await page.evaluate(() => !!window.KrgBuilderCore), 'la pantalla carga KrgBuilderCore');
ok(await page.evaluate(() => document.querySelectorAll('.b-insp [data-insp-tab]').length === 3),
  'tiene las tres pestañas Contenido / Diseño / Avanzado');
const cab = await page.evaluate(() => ({
  kind: document.querySelector('.b-insp .b-sel-kind')?.textContent.trim(),
  name: document.querySelector('.b-insp .b-sel-name')?.textContent.trim(),
}));
ok(cab.kind === 'Cabecera' && !!cab.name, `la cabecera del panel dice «${cab.kind} / ${cab.name}»`);
const gH = await grupos();
ok(gH.length >= 1 && gH.filter((x) => x.abierto).length === 1,
  `los ajustes vienen en grupos plegables (${gH.length} en Contenido, 1 abierto)`);

console.log('\nPRUEBA 2 — los grupos de Diseño de la cabecera');
await page.click('.b-insp [data-insp-tab="design"]');
await esperar();
const idsH = (await grupos()).map((x) => x.id);
for (const g of ['h.align', 'h.navMode', 'h.colors', 'h.logo', 'h.size', 'h.glass', 'h.anim']) {
  ok(idsH.includes(g), `está el grupo ${g}`);
}

console.log('\nPRUEBA 3 — tocar un control llega al guardado de la cabecera');
await abrirTodos();
let n = enviados.header.length;
await page.fill('.b-insp [data-h-num="height"]', '96');
ok(await esperarEnvio(enviados.header, n + 1), 'el cambio se envía');
ok(Number(enviados.header[enviados.header.length - 1].height) === 96,
  `alto guardado = ${enviados.header[enviados.header.length - 1].height}`);
n = enviados.header.length;
await page.evaluate(() => document.querySelector('.b-insp [data-h-set="navModeDesktop"][data-v="drawer"]').click());
ok(await esperarEnvio(enviados.header, n + 1), 'el tipo de menú se envía');
ok(enviados.header[enviados.header.length - 1].navModeDesktop === 'drawer',
  `tipo de menú en escritorio = ${enviados.header[enviados.header.length - 1].navModeDesktop}`);

console.log('\nPRUEBA 4 — Avanzado de la cabecera');
await page.click('.b-insp [data-insp-tab="advanced"]');
await esperar();
await abrirTodos();
const idsA = (await grupos()).map((x) => x.id);
ok(idsA.includes('h.adaptive') && idsA.includes('h.advanced'), 'color adaptativo y avanzado');
n = enviados.header.length;
await page.fill('.b-insp [data-h="htmlId"]', 'cabecera-sitio');
ok(await esperarEnvio(enviados.header, n + 1), 'el identificador CSS se envía');
ok(enviados.header[enviados.header.length - 1].htmlId === 'cabecera-sitio',
  `id guardado = ${enviados.header[enviados.header.length - 1].htmlId}`);

console.log('\nPRUEBA 5 — recargar y seguir viendo lo guardado');
await page.reload();
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
await page.click('.b-insp [data-insp-tab="design"]');
await esperar();
await abrirTodos();
ok(await page.inputValue('.b-insp [data-h-num="height"]') === '96', 'el alto sigue en 96');
await page.click('.b-insp [data-insp-tab="advanced"]');
await esperar();
await abrirTodos();
ok(await page.inputValue('.b-insp [data-h="htmlId"]') === 'cabecera-sitio', 'el identificador CSS sigue puesto');

/* ================================================================== */
console.log('\nPRUEBA 6 — el pie, mismo motor');
await page.goto('file://' + join(dir, 'footer.html'));
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
const cabF = await page.evaluate(() => document.querySelector('.b-insp .b-sel-kind')?.textContent.trim());
ok(cabF === 'Pie', `la cabecera del panel dice «${cabF}»`);
const idsF = (await grupos()).map((x) => x.id);
ok(idsF.includes('f.content') && idsF.includes('f.copyright'), 'contenido del pie y copyright');
await abrirTodos();
n = enviados.footer.length;
await page.fill('.b-insp [data-f="copyright"]', '© 2026 KRG');
ok(await esperarEnvio(enviados.footer, n + 1), 'el copyright se envía');
ok(enviados.footer[enviados.footer.length - 1].copyright === '© 2026 KRG',
  `copyright guardado = ${enviados.footer[enviados.footer.length - 1].copyright}`);

console.log('\nPRUEBA 7 — un bloque dentro del pie se configura igual que en una página');
await page.evaluate(() => {
  const el = document.querySelector('[data-sel="ftxt1"]') || [...document.querySelectorAll('[data-sel]')].pop();
  if (el) el.click();
});
await esperar(200);
const cabN = await page.evaluate(() => ({
  kind: document.querySelector('.b-insp .b-sel-kind')?.textContent.trim(),
  name: document.querySelector('.b-insp .b-sel-name')?.textContent.trim(),
  volver: !!document.querySelector('.b-insp [data-froot]'),
}));
ok(!!cabN.kind && !!cabN.name, `la cabecera dice «${cabN.kind} / ${cabN.name}»`);
ok(cabN.volver, 'y deja volver a los ajustes del pie');
await page.click('.b-insp [data-insp-tab="design"]');
await esperar();
await abrirTodos();
const idsN = (await grupos()).map((x) => x.id);
// El pie monta el MISMO inspector que las páginas: estos grupos son
// los que antes no existían aquí.
const esperados = ['align', 'background', 'spacing', 'size', 'border', 'shadow', 'animation'];
const faltan = esperados.filter((g) => !idsN.includes(g));
ok(faltan.length === 0, `diseño completo, como en páginas (faltan: ${faltan.join(', ') || 'ninguno'})`);
await page.click('.b-insp [data-insp-tab="advanced"]');
await esperar();
await abrirTodos();
const idsAvanzado = (await grupos()).map((x) => x.id);
const faltanA = ['cssId', 'visibility', 'position', 'transform', 'transitions', 'attributes', 'customCss'].filter((g) => !idsAvanzado.includes(g));
ok(faltanA.length === 0, `y avanzado completo (faltan: ${faltanA.join(', ') || 'ninguno'})`);
await page.click('.b-insp [data-insp-tab="design"]');
await esperar();
await abrirTodos();
n = enviados.footer.length;
await page.fill('.b-insp [data-side="padding-top"]', '32');
ok(await esperarEnvio(enviados.footer, n + 1), 'el relleno de arriba del bloque se envía');
const guardadoN = JSON.stringify(enviados.footer[enviados.footer.length - 1]?.sections || []);
ok(guardadoN.includes('"padding-top":"32px"'), `y viaja como estilo del nodo: ${guardadoN.includes('"padding-top":"32px"') ? 'padding-top:32px' : guardadoN.slice(0, 120)}`);

// Y cada tamaño con el suyo, que es lo otro que aquí no había.
await page.click('#bps [data-bp="tablet"]');
await esperar(200);
await abrirTodos();
n = enviados.footer.length;
await page.fill('.b-insp [data-side="padding-top"]', '8');
ok(await esperarEnvio(enviados.footer, n + 1), 'en tablet se escribe otro relleno');
const porTamano = JSON.stringify(enviados.footer[enviados.footer.length - 1]?.sections || []);
ok(porTamano.includes('"desktop":{"padding-top":"32px"}') && porTamano.includes('"tablet":{"padding-top":"8px"}'),
  'escritorio y tablet se guardan por separado');
await page.click('#bps [data-bp="desktop"]');
await esperar(150);

console.log('\nPRUEBA 8 — los grupos recuerdan cómo quedaron, también aquí');
await page.evaluate(() => {
  const g = document.querySelector('.b-insp [data-acc="animation"]');
  if (g && g.classList.contains('is-open')) g.querySelector('.acc-h').click();
});
await esperar();
await page.reload();
await page.waitForSelector('#krg-builder .b-insp .b-group', { timeout: 15000 });
const recordado = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('krg.insp.groups') || '{}')['animation'];
  } catch (e) { return null; }
});
ok(recordado === false, 'el grupo que se cerró sigue cerrado después de recargar');

console.log('\nPRUEBA 9 — repintar no te devuelve al principio del panel');
// Mismo arreglo que en la pantalla de páginas, mismo ayudante del núcleo:
// el panel se rehace entero con innerHTML y antes volvía arriba.
await page.click('.b-insp [data-insp-tab="design"]');
await esperar(150);
await abrirTodos();
// Pantalla baja a propósito: así hay barra que perder, que es el caso
// que se nos escapaba.
await page.setViewportSize({ width: 1600, height: 520 });
await esperar(200);
await page.evaluate(() => { document.querySelector('.b-insp').scrollTop = 99999; });
await esperar(150);
const antesY = await page.evaluate(() => Math.round(document.querySelector('.b-insp').scrollTop));
ok(antesY > 40, `el panel se puede desplazar: ${antesY}px`);
await page.evaluate(() => {
  const b = document.querySelector('.b-insp [data-f-set], .b-insp [data-h-set]');
  if (b) b.click();
});
await esperar(250);
const despuesY = await page.evaluate(() => Math.round(document.querySelector('.b-insp').scrollTop));
ok(Math.abs(despuesY - antesY) <= 2, `y tras tocar un ajuste sigue donde estaba: ${antesY} → ${despuesY}px`);

await page.setViewportSize({ width: 1600, height: 1100 });

console.log('\nPRUEBA 10 — el panel de la izquierda es el de páginas');
await page.goto('file://' + join(dir, 'footer.html'));
await page.waitForSelector('#chrome-left .b-tree', { timeout: 15000 });
await page.evaluate(() => {
  document.querySelectorAll('#chrome-left .b-pal-group:not(.is-open) .acc-h').forEach((b) => b.click());
});
await esperar(200);
const izq = await page.evaluate(() => ({
  bloques: document.querySelectorAll('#chrome-left [data-add]').length,
  categorias: document.querySelectorAll('#chrome-left .b-sec h4').length,
  asas: document.querySelectorAll('#chrome-left [data-drag]').length,
  duplicar: document.querySelectorAll('#chrome-left [data-dup]').length,
  ocultar: document.querySelectorAll('#chrome-left [data-hid]').length,
  borrar: document.querySelectorAll('#chrome-left [data-del]').length,
  plantilla: !!document.querySelector('#chrome-left [data-add-v2="pie-v2"]'),
  globales: document.querySelectorAll('#chrome-left [data-glb]').length,
}));
ok(izq.bloques > 40, `la paleta trae todos los bloques del registro (${izq.bloques}), no una lista corta`);
ok(izq.asas >= 4 && izq.duplicar >= 4 && izq.ocultar >= 4 && izq.borrar >= 4,
  `cada nodo del árbol tiene asa de arrastre, duplicar, ocultar y borrar (${izq.asas}/${izq.duplicar}/${izq.ocultar}/${izq.borrar})`);
ok(izq.globales === 0, 'y no ofrece «convertir en global», que aquí no aplica');
ok(izq.plantilla, 'está «Pie partido V.2» en el grupo de secciones V.2');

console.log('\nPRUEBA 11 — arrastrar y soltar dentro del pie');
// Se añade un segundo párrafo y se arrastra por encima del primero.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#chrome-left [data-add]')].find((x) => x.dataset.add === 'paragraph');
  if (b) b.click();
});
await esperar(250);
const antesOrden = await page.evaluate(() =>
  [...document.querySelectorAll('#chrome-left [data-sel]')].map((x) => x.dataset.sel).join(','));
n = enviados.footer.length;
const movido = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('#chrome-left [data-sel]')].map((x) => x.dataset.sel);
  const nuevo = ids[ids.length - 1];
  const grip = document.querySelector(`#chrome-left [data-drag="${nuevo}"]`);
  const destino = document.querySelector('#chrome-left .hd[data-nid="ftxt1"]');
  if (!grip || !destino) return null;
  const dt = new DataTransfer();
  grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const r = destino.getBoundingClientRect();
  const arriba = { bubbles: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 2 };
  destino.dispatchEvent(new DragEvent('dragover', arriba));
  destino.dispatchEvent(new DragEvent('drop', arriba));
  return nuevo;
});
await esperar(300);
const despuesOrden = await page.evaluate(() =>
  [...document.querySelectorAll('#chrome-left [data-sel]')].map((x) => x.dataset.sel).join(','));
ok(!!movido, 'hay asa de arrastre y un sitio donde soltar');
ok(antesOrden !== despuesOrden, `el bloque cambia de sitio al soltarlo (${antesOrden.slice(0, 40)}… → ${despuesOrden.slice(0, 40)}…)`);
ok(await esperarEnvio(enviados.footer, n + 1), 'el movimiento se envía al servidor');
const trasArrastre = JSON.stringify(enviados.footer[enviados.footer.length - 1]?.sections || []);
ok(trasArrastre.includes(String(movido)), 'y el cambio se guarda en el pie');

console.log('\nPRUEBA 12 — «Pie partido por piezas»: cada trozo, un bloque');
await page.goto('file://' + join(dir, 'footer.html'));
await page.waitForSelector('#chrome-left .b-tree', { timeout: 15000 });
const antesNodos = await page.evaluate(() => document.querySelectorAll('#chrome-left [data-sel]').length);
await page.click('#chrome-left [data-add-v2="pie-v2"]');
await esperar(400);
const piezas = await page.evaluate(() => {
  const nombres = [...document.querySelectorAll('#chrome-left [data-sel]')].map((x) => x.textContent.trim());
  return {
    total: nombres.length,
    nombres: nombres,
    tiene: (t) => nombres.includes(t),
  };
});
ok(piezas.total > antesNodos + 15, `la plantilla añade sus piezas al árbol (${antesNodos} → ${piezas.total} bloques)`);
const buscados = ['Foto del pie', 'Antetítulo', 'Teléfono', 'Horario entre semana', 'Redes sociales', 'Servicios', 'Empresa', 'Enlaces legales', 'Copyright'];
const sinPieza = buscados.filter((t) => !piezas.nombres.includes(t));
ok(sinPieza.length === 0, `y cada trozo es un bloque con nombre propio (faltan: ${sinPieza.join(', ') || 'ninguno'})`);
// Y se editan de uno en uno, no como campos de un módulo gigante.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#chrome-left [data-sel]')].find((x) => x.textContent.trim() === 'Teléfono');
  if (b) b.click();
});
await esperar(250);
const elegido = await page.evaluate(() => ({
  titulo: document.querySelector('.b-insp .b-sel-name')?.textContent.trim(),
  campo: document.querySelector('.b-insp [data-prop="text"]')?.value,
}));
ok(elegido.titulo === 'Teléfono', `al pulsar una pieza se edita sólo ella («${elegido.titulo}»)`);
ok((elegido.campo || '').includes('000'), `con su propio texto («${elegido.campo || ''}»)`);
n = enviados.footer.length;
await page.fill('.b-insp [data-prop="text"]', '+34 600 123 456');
ok(await esperarEnvio(enviados.footer, n + 1), 'y lo que se escribe en esa pieza se guarda');
const guardadoPieza = JSON.stringify(enviados.footer[enviados.footer.length - 1]?.sections || []);
ok(guardadoPieza.includes('+34 600 123 456'), 'dentro de las secciones del pie, como un nodo más');

console.log('\nPRUEBA 13 — la barra de arriba y los paneles, como en páginas');
const barra = await page.evaluate(() => ({
  botones: [...document.querySelectorAll('.b-top button, .b-top a')].map((b) => b.textContent.trim()),
  etiqueta: document.querySelector('.b-bp-label')?.textContent.trim(),
  tiradores: document.querySelectorAll('.b-layout .b-split').length,
  railes: document.querySelectorAll('.b-layout .b-show').length,
}));
const faltanBotones = ['Deshacer', 'Rehacer', 'Estructura', 'Ajustes', 'Historial', 'Actualizar vista', 'Preview', 'Guardar']
  .filter((t) => !barra.botones.includes(t));
ok(faltanBotones.length === 0, `están los mismos botones (faltan: ${faltanBotones.join(', ') || 'ninguno'})`);
ok(/\d+ × \d+/.test(barra.etiqueta || ''), `y la medida del lienzo a la vista: ${barra.etiqueta}`);
ok(barra.tiradores === 2 && barra.railes === 2, 'los dos paneles tienen tirador y raíl para volver a abrirlos');

await page.click('.b-top [data-panel="left"]');
await esperar(200);
const plegado = await page.evaluate(() => ({
  oculto: document.querySelector('.b-layout').classList.contains('is-no-left'),
  rail: !document.querySelector('[data-show="left"]').hidden,
}));
ok(plegado.oculto && plegado.rail, 'se puede esconder la estructura y queda su raíl');
await page.click('[data-show="left"]');
await esperar(200);
const vuelto = await page.evaluate(() => !document.querySelector('.b-layout').classList.contains('is-no-left'));
ok(vuelto, 'y vuelve a abrirse desde el raíl');
await page.click('.b-top [data-panel="right"]');
await esperar(200);
const derecha = await page.evaluate(() => document.querySelector('.b-layout').classList.contains('is-no-right'));
ok(derecha, 'y lo mismo con el panel de ajustes');
await page.click('[data-show="right"]');
await esperar(150);

console.log('\nPRUEBA 14 — al guardar, la vista se vuelve a pintar');
const srcAntes = await page.evaluate(() => document.querySelector('.b-canvas iframe').src);
n = enviados.footer.length;
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#chrome-left [data-add]')].find((x) => x.dataset.add === 'heading');
  if (b) b.click();
});
ok(await esperarEnvio(enviados.footer, n + 1), 'añadir un bloque al pie se guarda');
await esperar(700);
const srcDespues = await page.evaluate(() => document.querySelector('.b-canvas iframe').src);
ok(srcAntes !== srcDespues, 'y la vista se recarga sola para enseñarlo');
// Escribir texto no recarga: eso se pinta en vivo, sin parpadeo.
const srcTexto = await page.evaluate(() => document.querySelector('.b-canvas iframe').src);
n = enviados.footer.length;
await page.fill('.b-insp [data-prop="text"]', 'Hola pie');
ok(await esperarEnvio(enviados.footer, n + 1), 'escribir en un bloque se guarda');
await esperar(700);
ok(srcTexto === await page.evaluate(() => document.querySelector('.b-canvas iframe').src),
  'y eso no recarga la vista: se pinta en vivo');

console.log('\nPRUEBA 15 — pulsar en la vista selecciona el bloque');
await page.evaluate(() => {
  window.postMessage({ source: 'krg', type: 'select', id: 'ftxt1' }, '*');
});
await esperar(300);
const elegidoDesdeLienzo = await page.evaluate(() => ({
  nombre: document.querySelector('.b-insp .b-sel-name')?.textContent.trim(),
  marcado: !!document.querySelector('#chrome-left [data-tree="ftxt1"].sel, #chrome-left .sec.sel'),
}));
ok(elegidoDesdeLienzo.nombre === 'Párrafo', `el panel pasa a ese bloque («${elegidoDesdeLienzo.nombre}»)`);
ok(elegidoDesdeLienzo.marcado, 'y el árbol lo marca');

console.log('\nPRUEBA 16 — ningún error de JavaScript');
ok(errores.length === 0, errores.length ? errores.slice(0, 3).join(' | ') : 'ninguno');

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas${fallos ? `  (${fallos} fallos)` : ''}`);
process.exit(fallos ? 1 : 0);
