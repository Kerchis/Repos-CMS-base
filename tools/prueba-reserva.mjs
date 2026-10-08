#!/usr/bin/env node
/**
 * Reserva de mesa: el selector en la web y la pantalla de reservas.
 *
 * El banco de PHP comprueba las reglas; este comprueba las manos. Un
 * selector de fecha es de esas cosas que parecen bien en una captura y
 * fallan al usarlas: el día que no se puede elegir, la hora que se
 * queda marcada al cambiar de día, el botón de «+» que pasa del tope,
 * o el teclado que no llega a ninguna parte.
 *
 * Lo que se comprueba, en un navegador de verdad:
 *
 *   1. Que al cargar aparece el selector y desaparecen los campos
 *      nativos —que siguen ahí, llevando el valor— y que empieza con
 *      un día elegido y ninguna hora puesta.
 *   2. Que la tira de días sólo trae días con hueco: ni los lunes que
 *      el restaurante cierra ni la fecha marcada como cerrada.
 *   3. Que elegir día y hora rellena los campos que viajan en el envío
 *      y escribe el resumen en voz alta.
 *   4. Que cambiar de día borra la hora que ya no existe, en vez de
 *      mandar una hora de otro día.
 *   5. Que el teclado hace lo mismo que el ratón y que el contador de
 *      comensales respeta el tope.
 *   6. Que sin hora no se envía, que al enviar viaja lo elegido y que
 *      el botón de WhatsApp aparece con el enlace que da el servidor.
 *   7. Y que la pantalla «Reservas» del panel enseña lo que hay,
 *      agrupado por día, y deja confirmar, cancelar y borrar.
 *
 *   node tools/prueba-reserva.mjs
 *
 * Necesita la variable LD_LIBRARY_PATH de tools/README.md.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = `${ROOT}/krg-cms/admin/assets/css`;
const PHP = `${ROOT}/.tools/php/php`;
const REST = 'https://krg.test/wp-json/krg/v1';
const AJAX = 'https://krg.test/wp-admin/admin-ajax.php';
const dir = mkdtempSync(join(tmpdir(), 'krg-reserva-'));

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

/* =================================================================== */
/* La sección en la web                                                */

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = new Date();
// Una fecha cerrada a mano, lejos del borde: cuatro días más adelante,
// y si cae en lunes —que ya está cerrado— se pasa al siguiente.
const cerrada = (() => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 4, 12);
  if (d.getDay() === 1) d.setDate(d.getDate() + 1);
  return iso(d);
})();

const turno = (label, start, end, dias) => {
  const t = { label, start, end };
  ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'].forEach((k) => { t[k] = false; });
  dias.forEach((k) => { t[k] = true; });
  return t;
};

const doc = {
  id: 7,
  title: 'Reservas',
  slug: 'reservas',
  sections: [{
    id: 's1',
    type: 'section',
    props: { width: 'padded' },
    children: [{
      id: 'r1',
      type: 'row',
      props: { layout: '12', gap: 24 },
      children: [{
        id: 'c1',
        type: 'column',
        props: { span: 12 },
        children: [{
          id: 'bk1',
          type: 'booking-form',
          props: {
            submit: 'Pedir mesa',
            success: 'Hemos recibido tu petición.',
            destino: 'ambos',
            whatsapp: '+57 300 123 4567',
            email: 'reservas@restaurante.test',
            turnos: [
              turno('Comida', '13:00', '15:30', ['mar', 'mie', 'jue', 'vie', 'sab', 'dom']),
              turno('Cena', '20:00', '22:30', ['jue', 'vie', 'sab']),
            ],
            slot: 30,
            lead: 0,
            days: 14,
            closed: cerrada,
            guests: 2,
            maxGuests: 6,
            showMessage: true,
          },
          children: [],
        }],
      }],
    }],
  }],
};

const docFile = join(dir, 'doc.json');
writeFileSync(docFile, JSON.stringify(doc));
const htmlWeb = execFileSync(PHP, [`${ROOT}/tools/render-doc.php`, docFile], { encoding: 'utf8' });
const archivoWeb = join(dir, 'reserva.html');
writeFileSync(archivoWeb, htmlWeb);

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const errores = [];
// La hoja de Google Fonts no se puede bajar desde un `file://` sin red:
// ese aviso es del banco, no de la pagina.
const ruido = (t) => /ERR_CONNECTION_CLOSED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(t);
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) errores.push(m.text()); });

const envios = [];
let respuestaWa = true;
await page.route('**/krg.test/**', async (route) => {
  envios.push(route.request().postData() || '');
  const data = { message: 'Hemos recibido tu petición.' };
  if (respuestaWa) {
    data.wa = { url: 'https://wa.me/573001234567?text=Reserva', label: 'Enviar por WhatsApp' };
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
});
// Abrir WhatsApp en medio de una prueba deja una pestaña suelta: aquí
// sólo interesa saber que se intenta.
await page.addInitScript(({ ajax }) => {
  window.KrgPublic = { ajax, nonce: 'n', i18n: { sending: 'Enviando…', sent: 'Enviado', error: 'No se pudo enviar' } };
  window.__abiertas = [];
  window.open = (u) => { window.__abiertas.push(u); return null; };
}, { ajax: AJAX });

await page.goto(`file://${archivoWeb}`);
await page.waitForSelector('.m-bk-dia', { timeout: 15000 });

console.log('PRUEBA 1 — el selector sustituye a los campos de siempre');
ok(await page.isVisible('.m-bk-pick'), 'el selector se ve');
ok(!(await page.isVisible('.m-bk-nativo')), 'y los campos nativos se esconden');
ok(await page.$eval('form.m-booking', (f) => f.classList.contains('is-js')), 'el formulario se marca como «con guion»');
ok(await page.$eval('input[name=fecha]', (i) => !!i.value), 'arranca con un día elegido');
ok(await page.$eval('input[name=hora]', (i) => i.value === ''), 'y sin hora: la elige quien reserva');
ok(await page.$eval('input[name=fecha]', (i) => !i.hasAttribute('required')),
  'los campos nativos dejan de ser obligatorios para el navegador, que ya no los ve');
const sel0 = await page.$$eval('.m-bk-dia.is-sel', (els) => els.length);
ok(sel0 === 1, `hay exactamente un día marcado (${sel0})`);

console.log('\nPRUEBA 2 — sólo los días que existen');
const dias = await page.$$eval('.m-bk-dia', (els) => els.map((e) => e.getAttribute('data-f')));
ok(dias.length > 5, `la tira trae varios días (${dias.length})`);
ok(dias.every((f) => new Date(`${f}T12:00:00`).getDay() !== 1), 'ningún lunes: ese día no hay turnos');
ok(!dias.includes(cerrada), `el día marcado como cerrado no está (${cerrada})`);
ok(dias.every((f, i) => i === 0 || f > dias[i - 1]), 'y van en orden');
const hoyIso = iso(hoy);
ok(dias.every((f) => f >= hoyIso), 'sin días que ya pasaron');

console.log('\nPRUEBA 3 — elegir día y hora rellena lo que se envía');
const horas = await page.$$eval('.m-bk-hora', (els) => els.map((e) => e.getAttribute('data-h')));
ok(horas.length > 0, `el día elegido ofrece horas (${horas.length})`);
ok(horas.every((h) => /^\d{2}:\d{2}$/.test(h)), 'escritas como horas');
await page.click(`.m-bk-hora[data-h="${horas[horas.length - 1]}"]`);
ok(await page.$eval('input[name=hora]', (i) => i.value) === horas[horas.length - 1],
  'al pulsar una hora, el campo que viaja en el envío se rellena');
ok(await page.$eval('.m-bk-hora.is-sel', (e) => e.getAttribute('aria-checked')) === 'true',
  'y la ficha queda marcada también para quien no ve la pantalla');
await page.waitForTimeout(400); // el color va con transición: se mide cuando llega
const pintado = await page.$eval('.m-bk-hora.is-sel', (e) => getComputedStyle(e).backgroundColor);
ok(pintado === 'rgb(63, 94, 88)', `y se pinta con el verde de la marca, no sólo con una clase (${pintado})`);
const resumen = (await page.textContent('[data-bk-resumen]')) || '';
ok(resumen.includes(horas[horas.length - 1]) && /personas/.test(resumen),
  `el resumen dice qué se ha pedido: «${resumen.trim()}»`);
ok(await page.isVisible('[data-bk-resumen]'), 'y se ve');

console.log('\nPRUEBA 4 — cambiar de día no deja una hora colgada');
// Un día con cena (jueves, viernes o sábado) y otro en el que sólo hay
// comida: la hora de la cena no puede sobrevivir al salto.
const diaCena = dias.find((f) => [4, 5, 6].includes(new Date(`${f}T12:00:00`).getDay()));
const diaComida = dias.find((f) => [2, 3, 0].includes(new Date(`${f}T12:00:00`).getDay()));
await page.click(`.m-bk-dia[data-f="${diaCena}"]`);
await page.click('.m-bk-hora[data-h="22:00"]');
ok(await page.$eval('input[name=hora]', (i) => i.value) === '22:00', 'se pide una mesa para la cena');
await page.click(`.m-bk-dia[data-f="${diaComida}"]`);
ok(await page.$eval('input[name=fecha]', (i) => i.value) === diaComida, 'el día cambia');
const horasOtro = await page.$$eval('.m-bk-hora', (els) => els.map((e) => e.getAttribute('data-h')));
ok(!horasOtro.includes('22:00'), 'ese día no hay cena');
ok(await page.$eval('input[name=hora]', (i) => i.value) === '',
  'así que la hora se borra en vez de mandar una que no existe');
ok(await page.$$eval('.m-bk-dia.is-sel', (els) => els.length) === 1, 'y sigue habiendo un solo día marcado');
ok((await page.textContent('[data-bk-resumen]') || '') === '', 'el resumen se calla hasta que se elija otra hora');

console.log('\nPRUEBA 5 — el teclado y el contador');
const antesFlecha = await page.$eval('input[name=fecha]', (i) => i.value);
await page.focus('.m-bk-dia.is-sel');
await page.keyboard.press('ArrowRight');
const trasFlecha = await page.$eval('input[name=fecha]', (i) => i.value);
ok(trasFlecha !== antesFlecha, `la flecha mueve de día (${antesFlecha} → ${trasFlecha})`);
ok(await page.$eval('.m-bk-dia.is-sel', (e) => e.getAttribute('data-f')) === trasFlecha,
  'y lo que se ve marcado es lo que se ha elegido');
await page.keyboard.press('Home');
ok(await page.$eval('input[name=fecha]', (i) => i.value) === dias[0], 'con Inicio se vuelve al primer día');

const pulsa = async (boton, veces) => {
  for (let i = 0; i < veces; i++) {
    if (await page.$eval(boton, (b) => b.disabled)) break;
    await page.click(boton);
  }
};
await pulsa('[data-bk-mas]', 10);
ok(await page.$eval('input[name=comensales]', (i) => Number(i.value)) === 6, 'el contador se para en el máximo del bloque');
ok(await page.$eval('[data-bk-mas]', (b) => b.disabled), 'y el botón de más se apaga al llegar');
await page.click('[data-bk-mas]', { force: true });
ok(await page.$eval('input[name=comensales]', (i) => Number(i.value)) === 6, 'ni forzando el clic se pasa del tope');
await pulsa('[data-bk-menos]', 10);
ok(await page.$eval('input[name=comensales]', (i) => Number(i.value)) === 1, 'y no baja de una persona');
ok(await page.$eval('[data-bk-menos]', (b) => b.disabled), 'con el botón de menos apagado');
await page.click('[data-bk-mas]');
await page.click('[data-bk-mas]');

console.log('\nPRUEBA 6 — enviar');
await page.fill('input[name=name]', 'Ana Gómez');
await page.fill('input[name=phone]', '300 123 4567');
await page.fill('textarea[name=message]', 'Una trona, por favor');
// Sin hora elegida no se manda nada.
await page.evaluate(() => { document.querySelector('input[name=hora]').value = ''; });
await page.click('button[type=submit]');
await page.waitForTimeout(250);
ok(envios.length === 0, 'sin hora no se envía');
ok(/Elige el día y la hora/.test((await page.textContent('.m-form-msg')) || ''), 'y se dice qué falta');

const horaFinal = (await page.$$eval('.m-bk-hora', (els) => els.map((e) => e.getAttribute('data-h'))))[0];
await page.click(`.m-bk-hora[data-h="${horaFinal}"]`);
await page.click('button[type=submit]');
await page.waitForSelector('.m-bk-wa', { timeout: 8000 });
ok(envios.length === 1, 'con todo puesto se envía una vez');
const cuerpo = envios[0];
ok(/name="action"[\s\S]*krg_booking/.test(cuerpo), 'al manejador de reservas');
ok(cuerpo.includes(horaFinal) && cuerpo.includes(dias[0]), 'con el día y la hora elegidos');
ok(/name="comensales"[\s\S]*?\r?\n\r?\n3/.test(cuerpo), 'y con los comensales del contador');
ok(cuerpo.includes('Ana Gómez') && cuerpo.includes('300 123 4567'), 'con el nombre y el teléfono');
ok(/name="nodeId"[\s\S]*?bk1/.test(cuerpo), 'diciendo de qué bloque viene, para que el servidor lea sus reglas');
ok(!cuerpo.includes('573001234567') && !cuerpo.includes('reservas@restaurante.test'),
  'y sin el destino: eso lo pone el servidor, no el navegador');

const enlace = await page.getAttribute('.m-bk-wa', 'href');
ok(enlace === 'https://wa.me/573001234567?text=Reserva', 'el botón de WhatsApp lleva el enlace que dio el servidor');
ok((await page.getAttribute('.m-bk-wa', 'rel') || '').includes('noopener'), 'abriéndose con cuidado');
ok(((await page.textContent('.m-bk-wa')) || '').includes('WhatsApp'), 'y con el texto configurado');
ok((await page.evaluate(() => window.__abiertas.length)) === 1,
  'además se intenta abrir solo; si el navegador lo frena, queda el botón');
ok(/Hemos recibido tu petición/.test((await page.textContent('.m-form-msg')) || ''), 'se confirma por escrito');
ok(await page.$eval('input[name=name]', (i) => i.value) === '', 'y los datos personales se limpian del formulario');
ok(await page.$eval('input[name=fecha]', (i) => !!i.value), 'dejando el selector listo para otra');

respuestaWa = false;
await page.fill('input[name=name]', 'Luis');
await page.fill('input[name=phone]', '300 999 8877');
await page.click(`.m-bk-hora[data-h="${(await page.$$eval('.m-bk-hora', (els) => els.map((e) => e.getAttribute('data-h'))))[0]}"]`);
await page.click('button[type=submit]');
await page.waitForTimeout(400);
ok(envios.length === 2, 'una segunda reserva también sale');
ok(!(await page.$('.m-bk-wa')), 'y si el destino es sólo el correo, no aparece ningún botón de WhatsApp');
ok(errores.length === 0, `sin errores de JavaScript${errores.length ? ` — ${errores[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await page.reload();
  await page.waitForSelector('.m-bk-dia', { timeout: 15000 });
  await page.click('.m-bk-hora');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ROOT}/captura-reserva-web.png`, fullPage: true });
}
await page.close();

/* =================================================================== */
/* La pantalla «Reservas» del panel                                    */

console.log('\nPRUEBA 7 — la pantalla de reservas');

const dia1 = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1, 12));
const dia2 = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 2, 12));
const base = [
  { id: 1, nombre: 'Ana Gómez', email: 'ana@correo.test', telefono: '+57 300 123 4567', fecha: dia1, hora: '21:30', comensales: 4, mensaje: 'Una trona', estado: 'nueva', cuando: `${dia1} 21:30`, pagina: 7 },
  { id: 2, nombre: 'Luis Prieto', email: '', telefono: '300 999 8877', fecha: dia1, hora: '22:00', comensales: 2, mensaje: '', estado: 'confirmada', cuando: `${dia1} 22:00`, pagina: 7 },
  { id: 3, nombre: 'Marta Ruiz', email: '', telefono: '301 222 3344', fecha: dia2, hora: '13:30', comensales: 6, mensaje: '', estado: 'nueva', cuando: `${dia2} 13:30`, pagina: 7 },
];
let reservas = base.map((r) => ({ ...r }));
const cambios = [];
const borrados = [];

const htmlPanel = `<!doctype html><meta charset="utf-8"><title>reservas</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<body class="wp-admin"><div id="krg-admin"></div>
<script>window.KrgAdmin={page:'krg-reservas',view:'',pageId:0,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?',canManage:true,canEditPages:true,home:'https://restaurante.test/'};</script>
<script src="file://${JS}/app.js"></script>`;
const archivoPanel = join(dir, 'panel.html');
writeFileSync(archivoPanel, htmlPanel);

const panel = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
const sucio = [];
panel.on('pageerror', (e) => sucio.push(String(e)));
panel.on('console', (m) => { if (m.type() === 'error') sucio.push(m.text()); });
panel.on('dialog', (d) => d.accept());

await panel.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.startsWith('/bookings?')) {
    const cuales = new URL(req.url()).searchParams.get('cuales') || 'proximas';
    const vivas = reservas.filter((r) => (cuales === 'canceladas' ? r.estado === 'cancelada' : r.estado !== 'cancelada'));
    return json({
      cuales,
      hoy: iso(hoy),
      total: reservas.length,
      resumen: { nueva: vivas.filter((r) => r.estado === 'nueva').length, confirmada: 0, cancelada: 0 },
      reservas: cuales === 'pasadas' ? [] : vivas,
    });
  }
  const mCambio = url.match(/^\/bookings\/(\d+)$/);
  if (mCambio && req.method() === 'POST') {
    const id = Number(mCambio[1]);
    const estado = JSON.parse(req.postData() || '{}').estado;
    cambios.push({ id, estado });
    reservas = reservas.map((r) => (r.id === id ? { ...r, estado } : r));
    return json(reservas.find((r) => r.id === id));
  }
  if (mCambio && req.method() === 'DELETE') {
    const id = Number(mCambio[1]);
    borrados.push(id);
    reservas = reservas.filter((r) => r.id !== id);
    return json({ deleted: true });
  }
  return json([]);
});

await panel.goto(`file://${archivoPanel}`);
await panel.waitForSelector('.m-res', { timeout: 15000 });

const grupos = await panel.$$eval('.m-res-dia h3', (els) => els.map((e) => e.textContent.trim()));
ok(grupos.length === 2, `las reservas salen agrupadas por día (${grupos.length} días)`);
ok(/\d/.test(grupos[0]), `con el día escrito en palabras: «${grupos[0]}»`);
const textoPanel = (await panel.textContent('#res-lista')) || '';
ok(/Ana Gómez/.test(textoPanel) && /21:30/.test(textoPanel), 'con quién y a qué hora');
ok(/4 personas/.test(textoPanel), 'y cuántos son');
ok(/Una trona/.test(textoPanel), 'la nota del cliente también se lee');
ok(/Sin confirmar/.test(textoPanel) && /Confirmada/.test(textoPanel), 'y en qué estado está cada una');
const tel = await panel.$eval('.m-res-datos a', (a) => a.getAttribute('href'));
ok(tel.startsWith('tel:'), `el teléfono se puede llamar de un clic (${tel})`);
const wa = await panel.$$eval('.m-res-datos a', (els) => els.map((e) => e.getAttribute('href')).find((h) => h.includes('wa.me')));
ok(wa === 'https://wa.me/573001234567', `y escribirle por WhatsApp (${wa})`);

await panel.click('.m-res[data-res="1"] [data-res-estado="confirmada"]');
await panel.waitForTimeout(400);
ok(cambios.length === 1 && cambios[0].id === 1 && cambios[0].estado === 'confirmada', 'se puede confirmar');
ok(!(await panel.$('.m-res[data-res="1"] [data-res-estado="confirmada"]')),
  'y el botón desaparece: ya está confirmada');

await panel.click('.m-res[data-res="3"] [data-res-borrar]');
await panel.waitForTimeout(400);
ok(borrados.length === 1 && borrados[0] === 3, 'se puede borrar, después de preguntar');
ok(!(await panel.$('.m-res[data-res="3"]')), 'y desaparece de la lista');

await panel.click('[data-res-tab="canceladas"]');
await panel.waitForTimeout(400);
ok(/No hay reservas aquí/.test((await panel.textContent('#res-lista')) || ''),
  'una pestaña vacía lo dice, en vez de quedarse muda');
await panel.click('[data-res-tab="proximas"]');
await panel.waitForSelector('.m-res', { timeout: 8000 });
ok((await panel.$$('.m-res')).length === 2, 'y se puede volver');
ok(sucio.length === 0, `sin errores de JavaScript${sucio.length ? ` — ${sucio[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await panel.screenshot({ path: `${ROOT}/captura-reservas.png`, fullPage: true });
  console.log(`\n  capturas en ${ROOT}/captura-reserva-web.png y ${ROOT}/captura-reservas.png`);
}

/* =================================================================== */
/* El bloque en el constructor                                         */

console.log('\nPRUEBA 8 — configurarlo desde el panel');

const registry = JSON.parse(execFileSync(PHP, [`${ROOT}/tools/dump-registry.php`], { encoding: 'utf8' }));
const nodo = (id, type, props = {}, children = []) => ({
  id, type, name: type, visible: true, source: 'local', globalId: 0,
  props, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
});
const docCons = {
  id: 1, title: 'Reservas', slug: 'reservas', status: 'draft', checksum: 'c0',
  seo: {}, settings: { showHeader: true, showFooter: true },
  sections: [
    nodo('sec1', 'section', { width: 'padded' }, [
      nodo('row1', 'row', { gap: 24 }, [
        nodo('col1', 'column', { span: 12 }, [
          nodo('bk1', 'booking-form', {
            submit: 'Pedir mesa',
            destino: 'ambos',
            whatsapp: '+57 300 123 4567',
            turnos: [turno('Comida', '13:00', '15:30', ['mar', 'mie'])],
          }),
        ]),
      ]),
    ]),
  ],
};

const htmlCons = `<!doctype html><meta charset="utf-8"><title>constructor</title>
<link rel="stylesheet" href="file://${CSS}/admin.css">
<link rel="stylesheet" href="file://${CSS}/builder.css">
<body><div id="krg-builder"></div>
<script>window.KrgAdmin={pageId:1,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php?'};</script>
<script src="file://${JS}/app.js"></script>
<script src="file://${JS}/builder-core.js"></script>
<script src="file://${JS}/builder-v2.js"></script>
<script src="file://${JS}/builder-paginas.js"></script>
<script src="file://${JS}/builder-fields.js"></script>
<script src="file://${JS}/builder.js"></script>`;
const archivoCons = join(dir, 'constructor.html');
writeFileSync(archivoCons, htmlCons);

const cons = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const feos = [];
cons.on('pageerror', (e) => feos.push(String(e)));
cons.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) feos.push(m.text()); });
const guardados = [];
await cons.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await cons.route('**/krg.test/**', async (route) => {
  const req = route.request();
  const url = req.url().replace(REST, '');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.method() === 'POST' && /^\/pages\/1(\/save)?$/.test(url)) {
    guardados.push(JSON.parse(req.postData() || '{}'));
    return json({ ...docCons, checksum: `c${guardados.length}` });
  }
  if (url === '/pages/1') return json(docCons);
  if (url === '/registry') return json(registry);
  if (url === '/tokens') return json({ data: { color: {}, font: {}, typography: {}, spacing: {} } });
  return json([]);
});
await cons.goto(`file://${archivoCons}`);
await cons.waitForSelector('#krg-builder .b-insp', { timeout: 15000 });
await cons.click('.hd[data-nid="bk1"]');
await cons.waitForTimeout(300);

ok(await cons.$('[data-prop="destino"]') !== null, 'el inspector trae el desplegable de a dónde llega la reserva');
ok(await cons.$('[data-prop="whatsapp"]') !== null, 'y el campo del número');
ok(await cons.$('[data-prop="email"]') !== null, 'y el del correo');
const opciones = await cons.$$eval('[data-prop="destino"] option', (els) => els.map((e) => e.value));
ok(JSON.stringify(opciones) === JSON.stringify(['correo', 'whatsapp', 'ambos']), `con las tres salidas: ${opciones.join(', ')}`);
ok(await cons.$eval('[data-prop="destino"]', (s2) => s2.value) === 'ambos', 'enseñando la que está puesta');
const repetidor = (await cons.textContent('[data-rep="turnos"], .b-rep[data-tree="turnos"]')) || '';
ok(/Turnos/i.test(repetidor), 'los turnos salen como lista para añadir y quitar');
ok(/Mi[ée]rcoles/i.test(repetidor), 'con los días de la semana uno a uno');

await cons.selectOption('[data-prop="destino"]', 'whatsapp');
await cons.fill('[data-prop="whatsapp"]', '+34 910 000 000');
await cons.waitForFunction(() => true);
await cons.waitForTimeout(1600);
ok(guardados.length >= 1, 'cambiarlo guarda solo');
const ultimo = guardados[guardados.length - 1];
const propsGuardadas = JSON.stringify(ultimo).match(/"whatsapp":"([^"]*)"/);
ok(propsGuardadas && propsGuardadas[1] === '+34 910 000 000', `y el número nuevo viaja al servidor (${propsGuardadas ? propsGuardadas[1] : 'nada'})`);
ok(/"destino":"whatsapp"/.test(JSON.stringify(ultimo)), 'con el destino elegido');
ok(await cons.$eval('[data-prop="whatsapp"]', (i) => i.value) === '+34 910 000 000',
  'y el inspector se queda con lo escrito, sin repintarse encima');
ok(feos.length === 0, `sin errores de JavaScript${feos.length ? ` — ${feos[0]}` : ''}`);

if (process.env.KRG_SHOT) {
  await cons.screenshot({ path: `${ROOT}/captura-reserva-panel.png`, fullPage: false });
}

await browser.close();
console.log(`\n${hechas - fallos}/${hechas} comprobaciones correctas`);
console.log(fallos ? 'HAY QUE ARREGLARLO' : 'LA RESERVA VA EN LA WEB Y EN EL PANEL');
process.exit(fallos ? 1 : 0);
