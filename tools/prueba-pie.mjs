#!/usr/bin/env node
/**
 * «Pie partido» contra el ejemplo que dio el usuario.
 *
 * El ejemplo es: una foto a sangre en una mitad y, al lado, el bloque
 * de contacto a la izquierda con las columnas de enlaces a su derecha
 * —en la MISMA línea—, una raya, y abajo los enlaces legales a un lado
 * y el copyright al otro, también en la misma línea.
 *
 * Lo que había no se parecía: las columnas caían debajo del teléfono y
 * el copyright debajo de los enlaces legales, porque el hueco entre
 * bloques era tan grande que no cabían. Aquí se mide en el navegador,
 * con el marcado y el CSS de verdad.
 *
 *   node tools/prueba-pie.mjs            # KRG_SHOT=1 deja la captura
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
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

const PROPS = {
  mediaSide: 'left',
  ratio: 'copy-wide',
  height: 'custom',
  heightValue: 460,
  heightUnit: 'px',
  imageId: 501,
  eyebrow: 'CALL US',
  phone: '0123456789',
  lines: [{ text: 'Monday to Friday: 10am - 5pm' }, { text: 'Weekend: 10am - 3pm' }],
  social: [
    { network: 'facebook', url: 'https://facebook.com/x' },
    { network: 'instagram', url: 'https://instagram.com/x' },
    { network: 'x', url: 'https://x.com/x' },
    { network: 'github', url: 'https://github.com/x' },
    { network: 'dribbble', url: 'https://dribbble.com/x' },
  ],
  columns: [{ title: 'Services' }, { title: 'Company' }],
  links: [
    { column: 'Services', label: '1on1 Coaching', url: '#' },
    { column: 'Services', label: 'Company Review', url: '#' },
    { column: 'Services', label: 'Accounts Review', url: '#' },
    { column: 'Services', label: 'HR Consulting', url: '#' },
    { column: 'Services', label: 'SEO Optimisation', url: '#' },
    { column: 'Company', label: 'About', url: '#' },
    { column: 'Company', label: 'Meet the Team', url: '#' },
    { column: 'Company', label: 'Accounts Review', url: '#' },
  ],
  legal: [
    { label: 'Terms & Conditions', url: '#' },
    { label: 'Privacy Policy', url: '#' },
    { label: 'Cookies', url: '#' },
  ],
  copyright: '© 2022. Company Name. All rights reserved.',
  showRule: true,
  theme: 'light',
  align: 'left',
};

const dir = mkdtempSync(join(tmpdir(), 'krg-pie-'));

function doc(extra = {}) {
  const n = (id, type, p = {}, children = []) => ({
    id, type, name: type, visible: true, source: 'local', globalId: 0,
    props: p, styles: { desktop: {}, tablet: {}, mobile: {} }, children,
  });
  return {
    id: 2, title: 'Pie', slug: 'pie', status: 'publish', checksum: 'c', seo: {}, settings: {},
    sections: [
      n('s1', 'section', { width: 'full', minHeight: 'auto' }, [
        n('r1', 'row', {}, [
          n('c1', 'column', { span: 12 }, [n('fs1', 'footer-split', { ...PROPS, ...extra })]),
        ]),
      ]),
    ],
  };
}

async function abre(page, extra, nombre) {
  const file = join(dir, nombre + '.json');
  writeFileSync(file, JSON.stringify(doc(extra)));
  const html = execFileSync(`${ROOT}/.tools/php/php`, [`${ROOT}/tools/render-doc.php`, file], { encoding: 'utf8' });
  const pagina = join(dir, nombre + '.html');
  writeFileSync(pagina, html);
  await page.goto('file://' + pagina);
  await page.waitForSelector('.m-fs', { timeout: 15000 });
  // La foto de prueba no existe; para mirar la maquetación da igual,
  // pero para la captura se pone una de verdad si está a mano.
  const foto = `${ROOT}/.tools/foto-tarjeta.jpg`;
  if (existsSync(foto)) {
    await page.evaluate((f) => document.querySelectorAll('.m-fs-img').forEach((i) => { i.removeAttribute('srcset'); i.src = f; }), 'file://' + foto);
  }
  return html;
}

const browser = await chromium.launch({
  executablePath: `${ROOT}/.tools/chromium/chromium`,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errores.push(m.text()); });

/* ------------------------------------------------------------------ */
console.log('\n--- Como el ejemplo: todo en su línea');
{
  await abre(page, {}, 'base');
  const m = await page.evaluate(() => {
    const r = (s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { t: Math.round(b.top), l: Math.round(b.left), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const titulos = [...document.querySelectorAll('.m-fs-col-title')].map((n) => n.textContent.trim());
    const porColumna = [...document.querySelectorAll('.m-fs-col')].map((c) => [...c.querySelectorAll('.m-fs-links a')].map((a) => a.textContent.trim()));
    return {
      foto: r('.m-fs-media'),
      panel: r('.m-fs-panel'),
      contacto: r('.m-fs-contact'),
      cols: r('.m-fs-cols'),
      legal: r('.m-fs-legal'),
      copy: r('.m-fs-copy'),
      raya: getComputedStyle(document.querySelector('.m-fs-bottom')).borderTopWidth,
      titulos,
      porColumna,
      ancho: Math.round(document.querySelector('.m-fs').getBoundingClientRect().width),
    };
  });
  ok(m.foto.l === 0, 'la foto llega al borde de la pantalla, sin margen');
  ok(m.foto.w > 0 && m.panel.l >= m.foto.r - 1, 'y el texto va al lado, no encima');
  ok(Math.abs(m.foto.w / m.ancho - 0.4) < 0.06, `la foto ocupa unos dos quintos (${Math.round((m.foto.w / m.ancho) * 100)}%)`);

  ok(Math.abs(m.contacto.t - m.cols.t) < 4, 'el contacto y las columnas de enlaces empiezan a la misma altura');
  ok(m.cols.l > m.contacto.l, 'con las columnas a la derecha del contacto');
  ok(m.contacto.b > m.cols.t, 'o sea: en la misma línea, no una debajo de otra');

  ok(m.titulos.join('|') === 'Services|Company', `los títulos de las columnas son los escritos: ${m.titulos.join('|')}`);
  ok(m.porColumna[0].length === 5 && m.porColumna[1].length === 3, 'y cada enlace cae en la columna que se le dijo');
  ok(m.porColumna[0][0] === '1on1 Coaching' && m.porColumna[1][0] === 'About', 'en el orden escrito');

  ok(Math.abs(m.legal.t - m.copy.t) < 6, 'abajo, los enlaces legales y el copyright comparten línea');
  ok(m.copy.r > m.legal.r, 'con el copyright pegado a la derecha');
  ok(parseFloat(m.raya) > 0, 'y una raya separándolos del resto');
}

/* ------------------------------------------------------------------ */
console.log('\n--- Las redes');
{
  const m = await page.evaluate(() => {
    const iconos = [...document.querySelectorAll('.m-fs-soc')];
    return {
      cuantos: iconos.length,
      dibujados: iconos.filter((a) => a.querySelector('svg')).length,
      distintos: new Set(iconos.map((a) => a.querySelector('svg').innerHTML)).size,
      conNombre: iconos.filter((a) => (a.textContent || '').trim().length > 0).length,
      enLinea: new Set(iconos.map((a) => Math.round(a.getBoundingClientRect().top))).size === 1,
      instagramDeLinea: !!document.querySelectorAll('.m-fs-soc')[1].querySelector('rect'),
    };
  });
  ok(m.cuantos === 5 && m.dibujados === 5, 'las cinco redes se dibujan');
  ok(m.distintos === 5, 'y cada una con su icono, no el mismo repetido');
  ok(m.conNombre === 5, 'cada enlace dice su nombre para quien no ve los iconos');
  ok(m.enLinea, 'van en una fila');
  ok(m.instagramDeLinea, 'el de Instagram es de línea y no un cuadrado negro relleno');
}

/* ------------------------------------------------------------------ */
console.log('\n--- Lo que se puede cambiar');
{
  await abre(page, { mediaSide: 'right' }, 'derecha');
  const d = await page.evaluate(() => {
    const foto = document.querySelector('.m-fs-media').getBoundingClientRect();
    const panel = document.querySelector('.m-fs-panel').getBoundingClientRect();
    return { fotoDerecha: foto.left > panel.left, pegada: Math.round(foto.right) >= Math.round(window.innerWidth) - 1 };
  });
  ok(d.fotoDerecha && d.pegada, 'la foto se puede poner a la derecha, también a sangre');

  await abre(page, {}, 'movil');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(150);
  const mv = await page.evaluate(() => {
    const foto = document.querySelector('.m-fs-media').getBoundingClientRect();
    const panel = document.querySelector('.m-fs-panel').getBoundingClientRect();
    const contacto = document.querySelector('.m-fs-contact').getBoundingClientRect();
    const cols = document.querySelector('.m-fs-cols').getBoundingClientRect();
    return { apilado: foto.bottom <= panel.top + 1, textoDebajo: cols.top >= contacto.bottom - 1, sinDesborde: document.documentElement.scrollWidth <= 391 };
  });
  ok(mv.apilado, 'en móvil la foto va arriba y el texto debajo');
  ok(mv.textoDebajo, 'y ahí sí se apilan contacto y columnas, que no caben de otra forma');
  ok(mv.sinDesborde, 'sin desbordar a lo ancho');
  await page.setViewportSize({ width: 1440, height: 900 });
}

/* ------------------------------------------------------------------ */
console.log('\n--- Sin datos no inventa nada');
{
  await abre(page, { imageId: 0, social: [], columns: [], links: [], legal: [], copyright: '', lines: [] }, 'vacio');
  const v = await page.evaluate(() => ({
    sinFoto: !document.querySelector('.m-fs-media'),
    sinColumnas: !document.querySelector('.m-fs-cols'),
    sinAbajo: !document.querySelector('.m-fs-bottom'),
    telefono: !!document.querySelector('.m-fs-phone'),
  }));
  ok(v.sinFoto, 'sin imagen, el pie no deja un hueco vacío');
  ok(v.sinColumnas && v.sinAbajo, 'ni columnas ni línea inferior si no hay nada que poner');
  ok(v.telefono, 'y lo que sí está escrito se sigue viendo');
}

if (process.env.KRG_SHOT === '1') {
  await abre(page, {}, 'captura');
  await page.waitForTimeout(400);
  await page.locator('.m-fs').screenshot({ path: `${ROOT}/captura-pie.png` });
  console.log('\n  (captura en captura-pie.png)');
}

ok(errores.length === 0, 'no hay errores en la consola' + (errores.length ? ': ' + errores[0] : ''));

await browser.close();
console.log(`\n${fallos ? `HAY ${fallos} FALLOS` : `EL PIE PARTIDO VA (${hechas} comprobaciones)`}`);
process.exit(fallos ? 1 : 0);
