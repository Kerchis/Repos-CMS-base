#!/usr/bin/env node
/**
 * Las tarjetas de una rejilla de entradas, medidas en un navegador.
 *
 * Por qué hace falta: las tarjetas del blog no pasaban por la tarjeta
 * compartida, así que no tenían proporción —la foto entraba con su alto
 * natural y salían larguísimas— y el contenedor era un `.m-grid` sin
 * ninguna regla CSS, de modo que ni siquiera formaban rejilla.
 *
 * Aquí se pinta el documento por la cadena real (`tools/render-doc.php`
 * con entradas de prueba) y se mide lo que se ve: columnas, proporción,
 * alto fijo, el color fundido sobre la foto y su cambio al pasar el
 * ratón, el título como cita y el logo.
 *
 *   node tools/prueba-blog.mjs
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, chromiumLib } from './harness.mjs';

const { chromium } = chromiumLib();

let fallos = 0;
let hechas = 0;
const ok = (cond, msg) => {
  hechas++;
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${msg}`);
  if (!cond) fallos++;
};
const casi = (a, b, tol = 0.06) => Math.abs(a - b) <= tol * b;

const dir = mkdtempSync(join(tmpdir(), 'krg-blog-'));

/** Documento de una página con una rejilla de entradas. */
function doc(props) {
  const n = (id, type, p = {}, children = []) => ({
    id, type, name: type, visible: true, source: 'local', globalId: 0,
    props: p, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
  });
  return {
    id: 1, title: 'Blog', slug: 'blog', status: 'publish', checksum: 'c', seo: {}, settings: {},
    sections: [
      n('s1', 'section', { width: 'padded', minHeight: 'auto' }, [
        n('r1', 'row', {}, [
          n('c1', 'column', { span: 12 }, [n('bg1', 'blog-grid', { count: 3, ...props })]),
        ]),
      ]),
    ],
  };
}

/** Pinta el documento por la cadena real y lo abre en el navegador. */
async function abre(page, props, nombre) {
  const file = join(dir, nombre + '.json');
  writeFileSync(file, JSON.stringify(doc(props)));
  const html = execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/render-doc.php`, file], {
    encoding: 'utf8',
    env: { ...process.env, KRG_ENTRADAS: '3' },
  });
  const pagina = join(dir, nombre + '.html');
  writeFileSync(pagina, html);
  await page.goto('file://' + pagina);
  await page.waitForSelector('.m-bgrid', { timeout: 15000 });
  return html;
}

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errores.push(m.text()); });

/* ------------------------------------------------------------------ */
console.log('\n--- Lo de siempre, pero en rejilla y rectangular');
{
  await abre(page, {}, 'basico');
  const m = await page.evaluate(() => {
    const cajas = [...document.querySelectorAll('.m-bgrid-item')].map((n) => n.getBoundingClientRect());
    const media = document.querySelector('.m-card-media').getBoundingClientRect();
    return {
      cuantas: cajas.length,
      enFila: cajas.length === 3 && cajas[0].top === cajas[1].top && cajas[1].top === cajas[2].top,
      distintas: cajas.length === 3 && cajas[0].left < cajas[1].left && cajas[1].left < cajas[2].left,
      w: media.width,
      h: media.height,
      velo: !!document.querySelector('.m-card-veil'),
      logo: !!document.querySelector('.m-card-logo-img'),
      titulo: document.querySelector('.m-card-title')?.tagName,
      fecha: document.querySelector('.m-card-cat')?.textContent.trim(),
      resumen: !!document.querySelector('.m-card-text'),
    };
  });
  ok(m.cuantas === 3, 'salen las tres entradas');
  ok(m.enFila && m.distintas, 'y van en fila, como rejilla de tres columnas');
  ok(casi(m.w / m.h, 3 / 2), `la tarjeta es rectangular 3:2 (mide ${Math.round(m.w)}×${Math.round(m.h)})`);
  ok(m.h < 400, 'y ya no es una tira larguísima');
  ok(!m.velo, 'sin color configurado no se pinta ninguna capa encima');
  ok(!m.logo, 'ni ningún logo');
  ok(m.titulo === 'H3', 'el título de la entrada sigue siendo un encabezado de verdad');
  ok(!!m.fecha, 'la fecha se ve');
  ok(m.resumen, 'y el resumen también');
}

/* ------------------------------------------------------------------ */
console.log('\n--- El tamaño lo elige el panel');
{
  for (const [ratio, esperado] of [['wide', 16 / 9], ['square', 1], ['portrait', 4 / 5]]) {
    await abre(page, { ratio }, 'r-' + ratio);
    const r = await page.evaluate(() => {
      const b = document.querySelector('.m-card-media').getBoundingClientRect();
      return b.width / b.height;
    });
    ok(casi(r, esperado), `proporción «${ratio}» = ${esperado.toFixed(2)} (sale ${r.toFixed(2)})`);
  }
  await abre(page, { cardHeight: 300 }, 'alto');
  const alto = await page.evaluate(() => document.querySelector('.m-card-media').getBoundingClientRect().height);
  ok(Math.round(alto) === 300, `con alto fijo la tarjeta mide 300 px (sale ${Math.round(alto)})`);

  await abre(page, { desktop: 2 }, 'cols');
  const dos = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.m-bgrid-item')].map((n) => n.getBoundingClientRect());
    return c[0].top === c[1].top && c[2].top > c[0].top;
  });
  ok(dos, 'con dos columnas, la tercera baja a la siguiente fila');

  await page.setViewportSize({ width: 390, height: 900 });
  const movil = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.m-bgrid-item')].map((n) => n.getBoundingClientRect());
    return c[0].top < c[1].top && c[1].top < c[2].top;
  });
  ok(movil, 'en móvil se apilan en una sola columna');
  await page.setViewportSize({ width: 1440, height: 1100 });
}

/* ------------------------------------------------------------------ */
console.log('\n--- Color, fusión y lo que pasa al pasar el ratón');
{
  await abre(page, {
    cardStyle: 'overlay',
    quoteTitle: true,
    logoId: 77,
    logoWidth: 90,
    veilColor: '#3f5e58',
    blend: 'multiply',
    hoverColor: '#000000',
    hoverBlend: 'luminosity',
    showExcerpt: false,
  }, 'fusion');

  const antes = await page.evaluate(() => {
    const v = document.querySelector('.m-card-veil');
    const c = getComputedStyle(v);
    const t = document.querySelector('.m-card-title');
    const ct = getComputedStyle(t);
    const logo = document.querySelector('.m-card-logo-img');
    return {
      color: c.backgroundColor,
      fusion: c.mixBlendMode,
      tapa: v.getBoundingClientRect().height > 0,
      tag: t.tagName,
      comillaIni: getComputedStyle(t, '::before').content,
      comillaFin: getComputedStyle(t, '::after').content,
      tamTitulo: parseFloat(ct.fontSize),
      logoAncho: logo ? logo.getBoundingClientRect().width || parseFloat(getComputedStyle(logo).maxWidth) : 0,
      logoDebajo: logo && t ? logo.getBoundingClientRect().top >= t.getBoundingClientRect().bottom - 1 : false,
      resumen: !!document.querySelector('.m-card-text'),
      aislado: getComputedStyle(document.querySelector('.m-card-media')).isolation,
      colorTitulo: getComputedStyle(t).color,
      colorCuerpo: getComputedStyle(document.querySelector('.m-card-body')).color,
    };
  });
  ok(antes.color === 'rgb(63, 94, 88)', `el color del panel se pinta sobre la foto (${antes.color})`);
  ok(antes.fusion === 'multiply', 'con el modo de fusión elegido');
  ok(antes.tapa, 'y la capa cubre la foto');
  ok(antes.aislado === 'isolate', 'la fusión se queda dentro de la tarjeta, no tiñe la sección');
  ok(antes.tag === 'H3', 'el título como cita sigue siendo un encabezado');
  ok(antes.comillaIni.includes('“') && antes.comillaFin.includes('”'), 'y se ve entrecomillado');
  ok(antes.tamTitulo >= 22, `el título de cita va en grande (${Math.round(antes.tamTitulo)}px)`);
  ok(antes.logoAncho > 0 && antes.logoAncho <= 90, `el logo respeta su ancho (${Math.round(antes.logoAncho)}px)`);
  ok(antes.logoDebajo, 'y va debajo del título');
  ok(!antes.resumen, 'el resumen se puede quitar desde el panel');
  // Con el texto encima de la foto, el titular no puede quedarse con el
  // color negro de los titulares: se leeria fatal.
  ok(antes.colorTitulo === antes.colorCuerpo,
    `sobre la foto, el título se lee en el color de la tarjeta (${antes.colorTitulo})`);

  await page.hover('.m-bcard');
  await page.waitForTimeout(450);
  const encima = await page.evaluate(() => {
    const c = getComputedStyle(document.querySelector('.m-card-veil'));
    return { color: c.backgroundColor, fusion: c.mixBlendMode };
  });
  ok(encima.color === 'rgb(0, 0, 0)', `al pasar el ratón cambia el color (${encima.color})`);
  ok(encima.fusion === 'luminosity', 'y el modo de fusión');
  ok(encima.color !== antes.color || encima.fusion !== antes.fusion, 'o sea, el hover se nota');

  // Y la tarjeta de al lado sigue como estaba: el hover es de una.
  const vecina = await page.evaluate(() => {
    const v = document.querySelectorAll('.m-card-veil')[1];
    return getComputedStyle(v).mixBlendMode;
  });
  ok(vecina === 'multiply', 'la tarjeta de al lado no se entera');
}

/* ------------------------------------------------------------------ */
console.log('\n--- Lo que no debe cambiar');
{
  // Sin entradas la rejilla no imprime nada en la web pública: eso ya
  // era así y tiene que seguir siéndolo.
  const file = join(dir, 'vacio.json');
  writeFileSync(file, JSON.stringify(doc({})));
  const sinEntradas = execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/render-doc.php`, file], {
    encoding: 'utf8',
    env: { ...process.env, KRG_ENTRADAS: '0' },
  });
  // Ojo: la hoja de estilos del tema va incrustada y nombra `.m-bgrid`;
  // lo que no debe aparecer es la lista.
  ok(!sinEntradas.includes('<ul class="m-bgrid">'), 'sin entradas publicadas la rejilla no pinta nada');

  const enLienzo = execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/render-doc.php`, file], {
    encoding: 'utf8',
    env: { ...process.env, KRG_ENTRADAS: '0', KRG_CANVAS: '1' },
  });
  ok(enLienzo.includes('Todavía no hay entradas'), 'pero en el editor avisa de que faltan entradas');
}

/* ------------------------------------------------------------------ */
console.log('\n--- Que el color no se salga de la tarjeta');
{
  await abre(page, { cardStyle: 'overlay', veilColor: '#3f5e58', blend: 'multiply', quoteTitle: true }, 'sinsobrante');
  const m = await page.evaluate(() => {
    const card = document.querySelector('.m-bcard');
    const r = (n) => { const b = n.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
    return {
      card: r(card),
      foto: r(card.querySelector('.m-card-media')),
      velo: r(card.querySelector('.m-card-veil')),
      cuerpo: r(card.querySelector('.m-card-body')),
      recorte: getComputedStyle(card).overflow,
    };
  });
  ok(m.card.h === m.foto.h, `la tarjeta mide lo mismo que la foto: ${m.card.h} y ${m.foto.h}`);
  ok(m.velo.b <= m.card.b, 'el color no se sale por abajo');
  ok(m.cuerpo.b <= m.card.b, 'y el degradado del texto tampoco');
  ok(m.recorte === 'hidden', 'lo que se pinte dentro se queda dentro de las esquinas');
}

/* ------------------------------------------------------------------ */
console.log('\n--- La fecha, el centrado y dónde va el logo');
{
  await abre(page, { showDate: false }, 'sinfecha');
  ok(!(await page.$('.m-card-cat')), 'la fecha se puede apagar desde el panel');
  await abre(page, { showDate: true }, 'confecha');
  ok(!!(await page.$('.m-card-cat')), 'y volver a encenderla');

  for (const [valor, esperado] of [['center', 'center'], ['right', 'right'], ['left', 'start']]) {
    await abre(page, { textAlign: valor, linkText: 'Leer más' }, 'ta-' + valor);
    const m = await page.evaluate(() => {
      const cuerpo = document.querySelector('.m-card-body');
      const caja = cuerpo.getBoundingClientRect();
      const cta = document.querySelector('.m-card-cta').getBoundingClientRect();
      return {
        alineado: getComputedStyle(cuerpo).textAlign,
        // El enlace es una caja suelta: con `text-align` a secas se
        // quedaba pegado a la izquierda aunque el texto fuera centrado.
        centrado: Math.abs((cta.left + cta.right) / 2 - (caja.left + caja.right) / 2) < 3,
        aLaDerecha: Math.abs(cta.right - (caja.right - parseFloat(getComputedStyle(cuerpo).paddingRight))) < 3,
      };
    });
    ok(m.alineado === esperado, `alineación «${valor}» → ${m.alineado}`);
    if (valor === 'center') ok(m.centrado, 'centrado mueve también el enlace, no solo el texto');
    if (valor === 'right') ok(m.aLaDerecha, 'a la derecha, el enlace también se va a la derecha');
  }

  const sitios = [
    ['top-left', 'arriba', 'izquierda'],
    ['top-center', 'arriba', 'centro'],
    ['top-right', 'arriba', 'derecha'],
    ['bottom-left', 'abajo', 'izquierda'],
    ['bottom-center', 'abajo', 'centro'],
    ['bottom-right', 'abajo', 'derecha'],
  ];
  for (const [pos, alto, lado] of sitios) {
    await abre(page, { logoId: 77, logoWidth: 80, logoPos: pos, cardStyle: 'overlay' }, 'logo-' + pos);
    const m = await page.evaluate(() => {
      const foto = document.querySelector('.m-card-media').getBoundingClientRect();
      const logo = document.querySelector('.m-card-logo').getBoundingClientRect();
      const medio = (a) => (a.left + a.right) / 2;
      return {
        dentro: logo.top >= foto.top - 1 && logo.bottom <= foto.bottom + 1 && logo.left >= foto.left - 1 && logo.right <= foto.right + 1,
        arriba: logo.top - foto.top < foto.height / 2,
        izquierda: logo.left - foto.left < 40,
        derecha: foto.right - logo.right < 40,
        centrado: Math.abs(medio(logo) - medio(foto)) < 3,
      };
    });
    const bien = m.dentro
      && (alto === 'arriba' ? m.arriba : !m.arriba)
      && (lado === 'izquierda' ? m.izquierda : lado === 'derecha' ? m.derecha : m.centrado);
    ok(bien, `el logo se puede clavar ${alto} a la ${lado === 'centro' ? 'mitad' : lado} (${pos})`);
  }

  await abre(page, { logoId: 77, logoPos: 'body', quoteTitle: true }, 'logo-body');
  const debajo = await page.evaluate(() => {
    const t = document.querySelector('.m-card-title').getBoundingClientRect();
    const l = document.querySelector('.m-card-logo').getBoundingClientRect();
    return l.top >= t.bottom - 1 && !document.querySelector('.m-card-media > .m-card-logo');
  });
  ok(debajo, 'y «debajo del título» lo deja donde estaba, en el texto');
}

/* ------------------------------------------------------------------ */
/* Capturas, solo si se piden: KRG_SHOT=1 node tools/prueba-blog.mjs   */
/* ------------------------------------------------------------------ */
if (process.env.KRG_SHOT === '1') {
  await abre(page, {
    cardStyle: 'overlay',
    ratio: 'landscape',
    quoteTitle: true,
    logoId: 77,
    logoWidth: 86,
    logoPos: 'bottom-center',
    textAlign: 'center',
    veilColor: '#3f5e58',
    blend: 'multiply',
    hoverColor: '#1d4b4f',
    hoverBlend: 'color',
    showExcerpt: false,
    showDate: false,
  }, 'captura');
  // Las fotos de prueba no existen: para la captura se ponen una foto
  // y un logotipo de verdad, que es lo que hay que mirar.
  const foto = 'file://' + ROOT + '/.tools/foto-tarjeta.jpg';
  const logo = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 60" width="250" height="60"><text x="0" y="42" font-family="Georgia,serif" font-size="34" letter-spacing="6" fill="white">MIEL&#160;&amp;&#160;CO</text></svg>');
  const titulos = ['Miel cruda de azahar', 'Cómo cata un apicultor', 'Tres postres con miel'];
  await page.evaluate(([foto, logo, titulos]) => {
    document.querySelectorAll('.m-card-img').forEach((i) => { i.src = foto; });
    document.querySelectorAll('.m-card-logo-img').forEach((i) => { i.src = logo; i.removeAttribute('width'); i.removeAttribute('height'); });
    document.querySelectorAll('.m-card-title').forEach((t, i) => { t.textContent = titulos[i] || t.textContent; });
  }, [foto, logo, titulos]);
  await page.waitForTimeout(500);
  await page.locator('.m-bgrid').screenshot({ path: `${ROOT}/captura-tarjetas-blog.png` });
  await page.hover('.m-bcard');
  await page.waitForTimeout(600);
  await page.locator('.m-bgrid').screenshot({ path: `${ROOT}/captura-tarjetas-hover.png` });
  console.log('\n  (capturas en captura-tarjetas-blog.png y captura-tarjetas-hover.png)');
}

ok(errores.length === 0, 'no hay errores en la consola' + (errores.length ? ': ' + errores[0] : ''));

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS` : `LAS TARJETAS DEL BLOG VAN (${hechas} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
