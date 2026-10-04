#!/usr/bin/env node
/**
 * Categorías y etiquetas del blog: crear, duplicar, eliminar y el
 * interruptor de «que se vean o no en la web».
 *
 * Dos mitades, porque el encargo tiene dos lados:
 *
 *   1. PHP (`tools/categorias-php.php`): el módulo de categorías pintado
 *      por el camino real con el interruptor encendido y apagado, en la
 *      web pública y en el lienzo, y el ajuste guardándose y volviendo.
 *   2. Navegador: la pantalla de Blog del panel con `admin.css` de
 *      verdad y una API simulada **con estado**, para que duplicar o
 *      borrar se note en la tabla como se notaría en WordPress.
 *
 *   node tools/prueba-categorias.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();
const JS = `${ROOT}/krg-cms/admin/assets/js`;
const CSS = readFileSync(`${ROOT}/krg-cms/admin/assets/css/admin.css`, 'utf8');
const REST = 'https://krg.test/wp-json/krg/v1';

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};

/* ================================================================== */
/* 1. El lado PHP                                                      */
/* ================================================================== */
console.log('\n--- El módulo de categorías en la web');
{
  const r = JSON.parse(execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/categorias-php.php`], { encoding: 'utf8' }));

  ok(r.porDefecto.showCategories === true, 'sin tocar nada, las categorías se ven (como antes del interruptor)');
  ok(r.encendido.publico.includes('Recetas') && r.encendido.publico.includes('m-cat-list'),
    'encendido: la web pública lista las categorías');
  ok(r.encendido.publico.includes('/category/recetas/'), 'encendido: con su enlace al archivo');
  ok(r.apagado.publico === '', 'apagado: la web pública no pinta nada del módulo');
  ok(r.apagado.lienzo.includes('ocultas en la web'),
    'apagado: en el lienzo el bloque sigue estando, con el aviso de por qué no se ve');
  ok(r.apagado.lienzo.includes('data-krg-id="cat1"'), 'apagado: y se puede seleccionar en el editor');
  ok(r.trasApagar.showCategories === false && r.trasEncender.showCategories === true,
    'el ajuste se guarda y se vuelve a leer en los dos sentidos');
  ok(r.reencendido.publico.includes('Recetas'), 'al volver a encenderlo, la web lo pinta otra vez');
  ok(JSON.stringify(r.opcionCruda) === '{"showCategories":false}',
    'lo guardado es una opción propia del blog, no un retoque de los ajustes generales');
}

/* ================================================================== */
/* 2. La pantalla del panel                                            */
/* ================================================================== */
console.log('\n--- La pantalla de Blog del panel');

/** Servidor simulado con estado: lo que se crea o se borra, queda. */
function servidor() {
  const st = {
    categories: [
      { id: 1, name: 'Sin categoría', slug: 'sin-categoria', count: 1, isDefault: true, taxonomy: 'category' },
      { id: 3, name: 'Recetas', slug: 'recetas', count: 4, isDefault: false, taxonomy: 'category' },
    ],
    tags: [{ id: 9, name: 'miel', slug: 'miel', count: 2, isDefault: false, taxonomy: 'post_tag' }],
    settings: { showCategories: true },
    entradas: [
      { id: 7, title: 'Hello world!', status: 'publish', categories: [1], tags: [] },
      { id: 8, title: 'Receta de otoño', status: 'draft', categories: [3], tags: [9] },
    ],
    peticiones: [],
    rechazaAjustes: false,
    // Como WordPress con un autor que no puede publicar: el estado baja
    // a «pendiente de revisión».
    sinPermisoPublicar: false,
    siguienteId: 20,
  };
  st.lista = (tax) => (tax === 'post_tag' ? st.tags : st.categories);
  return st;
}

async function abrePantalla(browser, st) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => d.accept());

  await page.route('**/krg.test/**', async (route) => {
    const req = route.request();
    const entero = req.url().replace(REST, '');
    const [url, query = ''] = entero.split('?');
    const tax = /taxonomy=post_tag/.test(query) ? 'post_tag' : 'category';
    const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
    st.peticiones.push({ metodo: req.method(), url: entero, cuerpo });
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (url === '/blog' && req.method() === 'GET') return json(JSON.parse(JSON.stringify(st.entradas)));
    const dupPost = url.match(/^\/blog\/(\d+)\/duplicar$/);
    if (dupPost && req.method() === 'POST') {
      const orig = st.entradas.find((e) => e.id === Number(dupPost[1]));
      const copia = { ...orig, id: st.siguienteId++, title: `${orig.title} (copia)`, status: 'draft' };
      st.entradas.push(copia);
      return json(copia);
    }
    const unaEntrada = url.match(/^\/blog\/(\d+)$/);
    if (unaEntrada && req.method() === 'PUT') {
      const e = st.entradas.find((x) => x.id === Number(unaEntrada[1]));
      // Guardado parcial: solo se escribe lo que viene.
      for (const k of Object.keys(cuerpo)) e[k] = cuerpo[k];
      if (e.status === 'publish' && st.sinPermisoPublicar) e.status = 'pending';
      return json(JSON.parse(JSON.stringify(e)));
    }
    const porDefecto = url.match(/^\/blog\/terms\/(\d+)\/predeterminada$/);
    if (porDefecto && req.method() === 'PUT') {
      const id = Number(porDefecto[1]);
      st.categories.forEach((t) => { t.isDefault = t.id === id; });
      return json({ id });
    }
    if (url === '/blog/taxonomies') {
      return json({ categories: st.categories, tags: st.tags, authors: [], settings: st.settings });
    }
    if (url === '/blog/settings' && req.method() === 'PUT') {
      if (st.rechazaAjustes) return json({ code: 'nope', message: 'No se pudo guardar' }, 500);
      st.settings = { showCategories: !!cuerpo.showCategories };
      return json(st.settings);
    }
    if (url === '/blog/terms' && req.method() === 'POST') {
      const t = {
        id: st.siguienteId++,
        name: cuerpo.name,
        slug: String(cuerpo.name).toLowerCase().replace(/\s+/g, '-'),
        count: 0,
        isDefault: false,
        taxonomy: cuerpo.taxonomy,
      };
      st.lista(cuerpo.taxonomy).push(t);
      return json(t);
    }
    const dup = url.match(/^\/blog\/terms\/(\d+)\/duplicar$/);
    if (dup && req.method() === 'POST') {
      const orig = st.lista(tax).find((t) => t.id === Number(dup[1]));
      const copia = {
        id: st.siguienteId++,
        name: `${orig.name} (copia)`,
        slug: `${orig.slug}-copia`,
        // Duplicar se lleva las entradas: el contador tiene que salir igual.
        count: orig.count,
        isDefault: false,
        taxonomy: tax,
      };
      st.lista(tax).push(copia);
      return json({ term: copia, posts: orig.count });
    }
    const uno = url.match(/^\/blog\/terms\/(\d+)$/);
    if (uno && req.method() === 'DELETE') {
      const lista = st.lista(tax);
      const i = lista.findIndex((t) => t.id === Number(uno[1]));
      if (i >= 0) lista.splice(i, 1);
      return json({ ok: true, id: Number(uno[1]), taxonomy: tax });
    }
    return json([]);
  });

  // Dentro del armazón del admin de WordPress y con el CSS de verdad:
  // un interruptor que no se ve no es un interruptor.
  const html = `<!doctype html><meta charset="utf-8"><title>blog</title>
<style>${CSS}</style>
<body class="wp-admin"><div id="wpwrap"><div id="wpcontent"><div id="wpbody"><div id="wpbody-content">
<div id="krg-admin"></div>
</div></div></div></div>
<script>window.KrgAdmin={page:'krg-blog',view:'',pageId:0,rest:${JSON.stringify(REST)},nonce:'n',admin:'/wp-admin/admin.php'};</script>
<script src="file://${JS}/app.js"></script>`;
  const dir = mkdtempSync(join(tmpdir(), 'krg-cats-'));
  const file = join(dir, 'blog.html');
  writeFileSync(file, html);
  await page.goto('file://' + file);
  await page.waitForSelector('#tax-table table', { timeout: 15000 });
  return { page, errores, file };
}

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});

const st = servidor();
const { page, errores, file } = await abrePantalla(browser, st);

/** Lo que se ve en la tabla de términos ahora mismo. */
const filas = () => page.$$eval('#tax-table tbody tr', (trs) =>
  trs.map((tr) => [...tr.children].map((td) => td.textContent.trim())));

/* --- Lo que se ve ------------------------------------------------- */
{
  const visto = await page.evaluate(() => {
    const alto = (sel) => {
      const n = document.querySelector(sel);
      return n ? n.getBoundingClientRect().height : 0;
    };
    const titulos = [...document.querySelectorAll('h1,h2')].map((h) => h.textContent.trim());
    return {
      titulos,
      switchAlto: alto('.m-switch'),
      pista: alto('.m-switch-track'),
      pestanas: [...document.querySelectorAll('#tax-tabs [data-tax]')].map((b) => b.textContent.trim()),
      tablaAlta: alto('#tax-table'),
      entradasIntactas: document.querySelectorAll('#blog-table tbody tr').length,
      nota: document.querySelector('#tax-note').textContent.trim(),
    };
  });
  ok(visto.titulos.includes('Blog'), 'la pantalla de Blog sigue siendo la de siempre');
  ok(visto.titulos.includes('Categorías y etiquetas'), 'y debajo aparece el apartado de categorías y etiquetas');
  ok(visto.entradasIntactas === 2, 'la lista de entradas de arriba sigue en su sitio');
  ok(visto.switchAlto > 0 && visto.pista > 0, 'el interruptor se ve');
  ok(visto.pestanas.join('|') === 'Categorías|Etiquetas', 'hay pestaña de categorías y de etiquetas');
  ok(visto.tablaAlta > 0, 'la tabla de términos se ve');
  ok(visto.nota.includes('se ven en la web'), 'y un texto que explica qué hace el interruptor');

  const f = await filas();
  ok(f.length === 2, 'salen las dos categorías que hay');
  ok(f[1][0] === 'Recetas' && f[1][1] === 'recetas' && f[1][2] === '4',
    'con su nombre, su slug y cuántas entradas tiene');
  ok(f[0][0].includes('por defecto'), 'la categoría por defecto se marca');
  ok(await page.$eval('[data-rm="1"]', (b) => b.disabled), 'y no deja borrarla');
}

/* --- La lista de entradas ------------------------------------------ */
{
  const cabeceras = await page.$$eval('#blog-table thead th', (th) => th.map((n) => n.textContent.trim()));
  ok(cabeceras.join('|') === 'Título|Categorías|Etiquetas|Estado|',
    'la lista de entradas enseña categorías, etiquetas y estado: ' + cabeceras.join('|'));

  const resumenes = await page.$$eval('#blog-table .m-pick-sum', (n) => n.map((x) => x.textContent.trim()));
  ok(resumenes[0] === 'Sin categoría' && resumenes[1] === '—',
    'cada entrada enseña sus categorías y sus etiquetas (o un guion)');
  ok(resumenes[2] === 'Recetas' && resumenes[3] === 'miel', 'y la segunda, las suyas');

  // Poner una categoría desde la lista, sin abrir la entrada.
  await page.click('#blog-table .m-pick[data-pick="categories"][data-id="7"] > summary');
  await page.click('#blog-table .m-pick[data-pick="categories"][data-id="7"] [data-term="3"]');
  await page.waitForTimeout(250);
  const envio = st.peticiones.filter((p) => p.metodo === 'PUT' && p.url === '/blog/7').pop();
  ok(!!envio && JSON.stringify(envio.cuerpo) === '{"categories":[1,3]}',
    'marcar una categoría manda solo las categorías: ' + JSON.stringify(envio && envio.cuerpo));
  ok(!('title' in (envio.cuerpo || {})) && !('content' in (envio.cuerpo || {})),
    'y no toca el título ni el cuerpo de la entrada');
  ok(st.entradas[0].categories.join(',') === '1,3', 'el servidor se queda con las dos');
  const sum = await page.$eval('#blog-table .m-pick[data-pick="categories"][data-id="7"] .m-pick-sum', (n) => n.textContent.trim());
  ok(sum === 'Sin categoría, Recetas', 'y la fila lo enseña al momento: ' + sum);

  // Cambiar el estado desde la lista.
  await page.selectOption('#blog-table [data-estado="7"]', 'draft');
  await page.waitForTimeout(250);
  const est = st.peticiones.filter((p) => p.metodo === 'PUT' && p.url === '/blog/7').pop();
  ok(JSON.stringify(est.cuerpo) === '{"status":"draft"}', 'cambiar el estado manda solo el estado');
  ok(st.entradas[0].status === 'draft', 'y la entrada pasa a borrador');

  // Si el servidor no deja publicar, el desplegable no miente.
  st.sinPermisoPublicar = true;
  await page.selectOption('#blog-table [data-estado="7"]', 'publish');
  await page.waitForTimeout(250);
  const quedo = await page.$eval('#blog-table [data-estado="7"]', (s) => s.value);
  ok(quedo === 'pending', 'si no se puede publicar, el desplegable se queda en «pendiente»');
  st.sinPermisoPublicar = false;

  // Duplicar una entrada.
  const antes = await page.$$eval('#blog-table tbody tr', (t) => t.length);
  await page.click('#blog-table [data-dup-post="8"]');
  await page.waitForTimeout(300);
  const copia = st.entradas.find((e) => e.title === 'Receta de otoño (copia)');
  ok(!!copia && copia.status === 'draft', 'duplicar crea una copia en borrador');
  ok(copia && copia.categories.join(',') === '3', 'con las mismas categorías');
  const ahora = await page.$$eval('#blog-table tbody tr', (t) => t.length);
  ok(ahora === antes + 1, 'y la copia aparece en la lista sin recargar');
}

/* --- Crear --------------------------------------------------------- */
{
  await page.fill('#tax-name', 'Postres');
  await page.click('#tax-add');
  await page.waitForTimeout(300);
  const envio = st.peticiones.filter((p) => p.url === '/blog/terms' && p.metodo === 'POST').pop();
  ok(!!envio && envio.cuerpo.name === 'Postres' && envio.cuerpo.taxonomy === 'category',
    'crear manda el nombre y la taxonomía correctos');
  const f = await filas();
  ok(f.some((r) => r[0] === 'Postres'), 'la categoría nueva aparece en la tabla');
  ok(await page.$eval('#tax-name', (i) => i.value) === '', 'y el campo se queda vacío para la siguiente');
}

/* --- Duplicar ------------------------------------------------------ */
{
  await page.click('[data-dup="3"]');
  await page.waitForTimeout(300);
  const envio = st.peticiones.filter((p) => p.metodo === 'POST' && p.url.includes('/duplicar')).pop();
  ok(!!envio && envio.url === '/blog/terms/3/duplicar?taxonomy=category', 'duplicar llama a su endpoint con la taxonomía');
  const f = await filas();
  const copia = f.find((r) => r[0] === 'Recetas (copia)');
  ok(!!copia, 'la copia aparece en la tabla');
  ok(copia && copia[2] === '4', 'y se lleva las mismas entradas que la original');
}

/* --- Eliminar ------------------------------------------------------ */
{
  const antes = (await filas()).length;
  const id = st.categories.find((t) => t.name === 'Recetas (copia)').id;
  await page.click(`[data-rm="${id}"]`);
  await page.waitForTimeout(300);
  const envio = st.peticiones.filter((p) => p.metodo === 'DELETE').pop();
  ok(!!envio && envio.url === `/blog/terms/${id}?taxonomy=category`, 'eliminar llama a su endpoint con la taxonomía');
  const f = await filas();
  ok(f.length === antes - 1 && !f.some((r) => r[0] === 'Recetas (copia)'), 'la fila desaparece de la tabla');
  ok(f.some((r) => r[0] === 'Recetas'), 'y la original se queda donde estaba');
}

/* --- Nombrar otra categoría predeterminada -------------------------- */
{
  ok(await page.$eval('[data-rm="1"]', (b) => b.disabled), 'la predeterminada no se puede borrar');
  ok(!(await page.$('[data-def="1"]')), 'la que ya es predeterminada no ofrece el botón');
  await page.click('[data-def="3"]');
  await page.waitForTimeout(300);
  const envio = st.peticiones.filter((p) => p.url.includes('/predeterminada')).pop();
  ok(!!envio && envio.url === '/blog/terms/3/predeterminada' && envio.metodo === 'PUT',
    'nombrar predeterminada llama a su endpoint');
  ok(st.categories.find((t) => t.id === 3).isDefault === true, 'el servidor la marca como predeterminada');
  ok(!(await page.$eval('[data-rm="1"]', (b) => b.disabled)),
    'y entonces «Sin categoría» ya se puede borrar, que era el problema');
  ok(await page.$eval('[data-rm="3"]', (b) => b.disabled), 'la nueva predeterminada pasa a estar protegida');
  // Se deja como estaba para lo que viene detrás.
  await page.click('[data-def="1"]');
  await page.waitForTimeout(300);
}

/* --- Etiquetas ----------------------------------------------------- */
{
  await page.click('#tax-tabs [data-tax="post_tag"]');
  await page.waitForTimeout(100);
  const f = await filas();
  ok(f.length === 1 && f[0][0] === 'miel', 'la pestaña de etiquetas enseña las etiquetas');
  ok((await page.$eval('#tax-name', (i) => i.placeholder)).includes('etiqueta'), 'y el campo pide un nombre de etiqueta');
  await page.fill('#tax-name', 'otoño');
  await page.click('#tax-add');
  await page.waitForTimeout(300);
  const envio = st.peticiones.filter((p) => p.url === '/blog/terms' && p.metodo === 'POST').pop();
  ok(envio.cuerpo.taxonomy === 'post_tag', 'crear desde esa pestaña crea una etiqueta, no una categoría');
  ok((await filas()).some((r) => r[0] === 'otoño'), 'la etiqueta nueva aparece');
  await page.click('#tax-tabs [data-tax="category"]');
  await page.waitForTimeout(100);
  ok((await filas()).some((r) => r[0] === 'Recetas'), 'y volver a categorías enseña las categorías');
}

/* --- El interruptor ------------------------------------------------ */
{
  const punto = () => page.$eval('.m-switch-dot', (n) => getComputedStyle(n).transform);
  const encendido = await punto();
  await page.click('.m-switch');
  await page.waitForTimeout(350);
  const envio = st.peticiones.filter((p) => p.url === '/blog/settings' && p.metodo === 'PUT').pop();
  ok(!!envio && envio.cuerpo.showCategories === false, 'apagarlo manda showCategories:false');
  ok(st.settings.showCategories === false, 'y el servidor se queda con el valor nuevo');
  const apagado = await punto();
  ok(apagado !== encendido, 'el interruptor se mueve al verlo');
  ok((await page.$eval('#tax-note', (n) => n.textContent)).includes('ocultas'),
    'el texto de debajo explica que quedan ocultas');

  // Recargar la pantalla: el interruptor tiene que acordarse.
  await page.goto('file://' + file);
  await page.waitForSelector('#tax-table table', { timeout: 15000 });
  ok(await page.$eval('#cats-vis', (i) => !i.checked), 'tras recargar sigue apagado');
  ok((await filas()).some((r) => r[0] === 'Postres'), 'y las categorías creadas siguen ahí');

  // Hasta aqui, ni un error en la consola. Se mira ANTES de provocar el
  // fallo de abajo, que si deja uno (el 500 del servidor) a proposito.
  ok(errores.length === 0, 'no hay errores en la consola' + (errores.length ? ': ' + errores[0] : ''));

  // Si el servidor dice que no, el interruptor no se queda mintiendo.
  st.rechazaAjustes = true;
  await page.click('.m-switch');
  await page.waitForTimeout(350);
  ok(await page.$eval('#cats-vis', (i) => !i.checked), 'si el guardado falla, el interruptor vuelve a su sitio');
  st.rechazaAjustes = false;
}

// Lo unico que puede haber quedado es el 500 que se provoco adrede.
const inesperados = errores.filter((e) => !/500|Internal Server Error|No se pudo guardar/.test(e));
ok(inesperados.length === 0, 'ningun error inesperado en la consola' + (inesperados.length ? ': ' + inesperados[0] : ''));

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS` : `CATEGORÍAS Y ETIQUETAS VAN (${hechas} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
