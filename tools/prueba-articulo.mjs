#!/usr/bin/env node
/**
 * La pantalla «Editar entrada» del panel, en un navegador.
 *
 * Por que hace falta: el cuerpo del articulo ya no se escribe en un area
 * de texto pelada, sino en el editor clasico de WordPress (TinyMCE) con
 * sus pestanas «Visual» y «Texto» y el boton «Anadir multimedia». Eso
 * mueve tres cosas que se pueden romper sin que se note:
 *
 *   1. hay que montarlo (`wp.editor.initialize`) cuando la pantalla se
 *      dibuja, y WordPress imprime el editor DESPUES de nuestro script;
 *   2. al guardar hay que leer del editor (`wp.editor.getContent`), no
 *      del area de texto, que en modo Visual esta desfasada;
 *   3. al cambiar de pantalla hay que desmontarlo, o el siguiente no
 *      puede arrancar con el mismo identificador.
 *
 * Aqui no hay WordPress, asi que `wp.editor` es un doble: NO prueba que
 * TinyMCE funcione —eso lo pone WordPress— sino que el panel lo llama
 * como toca y que sin el la pantalla sigue siendo usable.
 *
 *   node tools/prueba-articulo.mjs
 */

import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const REST = 'https://krg.test/wp-json/krg/v1';

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

const ENTRADA = {
  id: 7,
  title: 'La miel de otono',
  subtitle: '',
  slug: 'miel-de-otono',
  excerpt: 'Un resumen',
  content: '<p>Lo que ya habia escrito.</p>',
  featuredImageId: 0,
  categories: [],
  tags: [],
  seo: { title: '', description: '' },
  status: 'draft',
};

/**
 * El doble de `wp.editor`.
 *
 * Imita lo que importa del de verdad: envuelve el area de texto en
 * `.wp-editor-wrap`, la esconde (modo Visual), guarda lo que se escribe
 * aparte y solo lo vuelca en el area cuando se lo piden. Asi, si el
 * panel leyera `textarea.value` en vez de `getContent()`, se guardaria
 * el texto viejo y la prueba lo caza.
 *
 * `tarde` retrasa la aparicion de `wp.editor` para imitar el orden real
 * de WordPress, que imprime el editor al final del pie.
 */
function doble({ tarde = 0 } = {}) {
  const instalar = () => {
    window.wp = window.wp || {};
    window.wp.editor = {
      llamadas: [],
      vivos: {},
      initialize(id, ajustes) {
        this.llamadas.push({ que: 'initialize', id, ajustes });
        const ta = document.getElementById(id);
        if (!ta) throw new Error('no hay area de texto ' + id);
        if (this.vivos[id]) throw new Error('ya habia un editor en ' + id);
        const envoltorio = document.createElement('div');
        envoltorio.className = 'wp-editor-wrap tmce-active';
        envoltorio.innerHTML =
          '<div class="wp-media-buttons"><button type="button" class="button insert-media">Anadir multimedia</button></div>' +
          '<div class="wp-editor-tabs">' +
          '<button type="button" class="wp-switch-editor switch-tmce">Visual</button>' +
          '<button type="button" class="wp-switch-editor switch-html">Texto</button></div>' +
          '<div class="wp-editor-container"><div class="mce-toolbar"></div></div>';
        ta.parentNode.insertBefore(envoltorio, ta);
        envoltorio.querySelector('.wp-editor-container').appendChild(ta);
        ta.classList.add('wp-editor-area');
        ta.style.display = 'none';
        this.vivos[id] = { envoltorio, contenido: ta.value };
      },
      /** Lo que «escribe» la persona en el modo Visual. */
      escribe(id, html) {
        if (!this.vivos[id]) throw new Error('no hay editor en ' + id);
        this.vivos[id].contenido = html;
      },
      getContent(id) {
        this.llamadas.push({ que: 'getContent', id });
        const vivo = this.vivos[id];
        const ta = document.getElementById(id);
        if (!vivo) return ta ? ta.value : '';
        if (ta) ta.value = vivo.contenido; // como el `editor.save()` real
        return vivo.contenido;
      },
      remove(id) {
        this.llamadas.push({ que: 'remove', id });
        const vivo = this.vivos[id];
        if (!vivo) return;
        const ta = document.getElementById(id);
        if (ta) {
          vivo.envoltorio.parentNode.insertBefore(ta, vivo.envoltorio);
          ta.style.display = '';
          ta.classList.remove('wp-editor-area');
        }
        vivo.envoltorio.remove();
        delete this.vivos[id];
      },
    };
  };
  if (tarde) setTimeout(instalar, tarde);
  else instalar();
}

const dir = mkdtempSync(join(tmpdir(), 'krg-articulo-'));

/** Abre la pantalla de edicion con (o sin) el doble del editor. */
async function abrePantalla(browser, { editor = true, tarde = 0 } = {}) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errores = [];
  const guardados = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

  if (editor) await page.addInitScript(doble, { tarde });

  await page.route('**/krg.test/**', async (route) => {
    const req = route.request();
    const url = req.url().replace(REST, '');
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url === '/blog/7' && req.method() === 'PUT') {
      guardados.push(JSON.parse(req.postData() || '{}'));
      return json(ENTRADA);
    }
    if (url === '/blog/7') return json(ENTRADA);
    if (url === '/blog/taxonomies') return json({ categories: [], tags: [] });
    if (url === '/blog') return json({ items: [] });
    return json([]);
  });

  const html = `<!doctype html><meta charset="utf-8"><title>blog</title>
<body><div id="krg-admin"></div>
<script>window.KrgAdmin={page:'krg-blog',view:'edit',pageId:7,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php'};</script>
<script src="file://${JS}/app.js"></script>`;
  const file = join(dir, `blog-${editor ? 'con' : 'sin'}-${tarde}.html`);
  writeFileSync(file, html);
  await page.goto('file://' + file);
  await page.waitForSelector('#content', { timeout: 15000, state: 'attached' });
  return { page, errores, guardados };
}

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});

/* ------------------------------------------------------------------ */
console.log('\n--- Con el editor de WordPress disponible');
{
  const { page, errores, guardados } = await abrePantalla(browser);
  await page.waitForSelector('.wp-editor-wrap', { timeout: 5000 });

  const init = await page.evaluate(() => wp.editor.llamadas.find((l) => l.que === 'initialize'));
  ok(!!init, 'el panel monta el editor al abrir la entrada');
  ok(init && init.id === 'content', 'lo monta sobre el area de texto del contenido');
  ok(!!(init && init.ajustes && init.ajustes.mediaButtons), 'pide el boton «Anadir multimedia»');
  ok(!!(init && init.ajustes && init.ajustes.quicktags), 'pide la pestana «Texto» (quicktags)');
  ok(!!(init && init.ajustes && init.ajustes.tinymce), 'pide el modo «Visual» (TinyMCE)');

  // Lo que se ve: el cuadro con sus pestanas y su boton, y la barra de
  // etiquetas vieja fuera de la vista (no borrada: es el plan B).
  const visto = await page.evaluate(() => {
    const alto = (sel) => {
      const n = document.querySelector(sel);
      return n ? n.getBoundingClientRect().height : 0;
    };
    const tb = document.querySelector('#tb');
    return {
      envoltorio: alto('.wp-editor-wrap'),
      multimedia: alto('.wp-media-buttons .insert-media'),
      visual: alto('.switch-tmce'),
      texto: alto('.switch-html'),
      barraVieja: tb ? tb.getBoundingClientRect().height : -1,
      existeBarraVieja: !!tb,
      dentro: !!document.querySelector('.wp-editor-container #content'),
      campo: !!document.querySelector('.m-field .wp-editor-wrap'),
    };
  });
  ok(visto.envoltorio > 0, 'el cuadro del editor se ve');
  ok(visto.multimedia > 0, 'se ve el boton «Anadir multimedia»');
  ok(visto.visual > 0 && visto.texto > 0, 'se ven las pestanas «Visual» y «Texto»');
  ok(visto.dentro, 'el area de texto queda dentro del editor');
  ok(visto.campo, 'el editor vive dentro del campo «Contenido» del panel');
  ok(visto.existeBarraVieja, 'la barra de etiquetas de antes sigue en el documento (plan B)');
  ok(visto.barraVieja === 0, 'pero no ocupa sitio cuando esta el editor');

  // Guardar: lo que viaja es lo del editor, no lo del area de texto.
  await page.evaluate(() => {
    wp.editor.escribe('content', '<h2>Nuevo titular</h2><figure><img src="https://ej.test/a.jpg" alt="a"></figure><p>Cuerpo <strong>nuevo</strong>.</p>');
    document.getElementById('content').value = 'ESTO ES LO VIEJO';
  });
  await page.click('#draft');
  await page.waitForTimeout(400);
  const cuerpo = guardados[0] || {};
  ok(guardados.length === 1, 'al pulsar «Guardar borrador» sale una peticion');
  ok((cuerpo.content || '').includes('Nuevo titular'), 'se guarda lo que hay en el editor');
  ok(!(cuerpo.content || '').includes('ESTO ES LO VIEJO'), 'no se guarda el area de texto desfasada');
  ok((cuerpo.content || '').includes('<img'), 'la imagen insertada viaja en el guardado');
  ok(cuerpo.title === 'La miel de otono', 'los demas campos siguen viajando igual');

  // Desmontar y volver a montar: es lo que hace `shell()` al cambiar de
  // pantalla. Si no se desmontara, el siguiente montaje chocaria con el
  // editor viejo (el doble, como TinyMCE, se queja si el id esta cogido).
  const ciclo = await page.evaluate(() => {
    const alto = (sel) => {
      const n = document.querySelector(sel);
      return n ? n.getBoundingClientRect().height : 0;
    };
    const antes = wp.editor.llamadas.filter((l) => l.que === 'remove').length;
    KrgEditor.desmonta();
    const tras = {
      envoltorio: !!document.querySelector('.wp-editor-wrap'),
      areaVisible: alto('#content') > 0,
      removes: wp.editor.llamadas.filter((l) => l.que === 'remove').length - antes,
    };
    let error = '';
    try { KrgEditor.monta(); } catch (e) { error = String(e); }
    // Y otra vez sin desmontar a mano: el montaje limpia lo anterior.
    try { KrgEditor.monta(); } catch (e) { error = error || String(e); }
    return { ...tras, error, envoltorios: document.querySelectorAll('.wp-editor-wrap').length };
  });
  ok(ciclo.removes === 1, 'desmontar avisa al editor de WordPress');
  ok(!ciclo.envoltorio, 'al desmontar desaparece el cuadro');
  ok(ciclo.areaVisible, 'y vuelve a quedar el area de texto de siempre');
  ok(ciclo.error === '', 'se puede volver a montar sobre el mismo campo' + (ciclo.error ? ': ' + ciclo.error : ''));
  ok(ciclo.envoltorios === 1, 'y no se quedan dos editores encima del mismo campo');

  ok(errores.length === 0, 'no hay errores en la consola' + (errores.length ? ': ' + errores[0] : ''));
  await page.close();
}

/* ------------------------------------------------------------------ */
console.log('\n--- Si WordPress imprime el editor tarde');
{
  const { page, errores } = await abrePantalla(browser, { tarde: 400 });
  await page.waitForSelector('.wp-editor-wrap', { timeout: 5000 });
  const init = await page.evaluate(() => wp.editor.llamadas.find((l) => l.que === 'initialize'));
  ok(!!init, 'el panel espera y lo monta igual');
  const oculta = await page.evaluate(() => document.querySelector('#tb').getBoundingClientRect().height);
  ok(oculta === 0, 'y esconde la barra de etiquetas cuando llega');
  ok(errores.length === 0, 'no hay errores en la consola' + (errores.length ? ': ' + errores[0] : ''));
  await page.close();
}

/* ------------------------------------------------------------------ */
console.log('\n--- Sin editor de WordPress (plan B)');
{
  const { page, errores, guardados } = await abrePantalla(browser, { editor: false });
  await page.waitForTimeout(300);
  const barra = await page.evaluate(() => document.querySelector('#tb').getBoundingClientRect().height);
  ok(barra > 0, 'la barra de etiquetas se ve');
  ok(await page.evaluate(() => !document.querySelector('.wp-editor-wrap')), 'no se inventa ningun editor');
  const alto = await page.evaluate(() => document.querySelector('#content').getBoundingClientRect().height);
  ok(alto > 100, 'el area de texto se ve y se puede escribir');

  await page.fill('#content', 'Escrito a mano');
  await page.click('#draft');
  await page.waitForTimeout(400);
  ok((guardados[0] || {}).content === 'Escrito a mano', 'se guarda lo que hay en el area de texto');
  ok(errores.length === 0, 'no hay errores en la consola' + (errores.length ? ': ' + errores[0] : ''));
  await page.close();
}

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS` : `LA PANTALLA DE ENTRADAS VA (${hechas} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
