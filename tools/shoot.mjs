/**
 * Capturas de pantalla reales del frontend.
 *
 * Hasta ahora no habia navegador en el entorno, asi que el maquetado se
 * entregaba sin verificar. Con el chromium que monta tools/devenv.sh si se
 * puede mirar: este script abre un archivo o una URL en los tres anchos de
 * referencia y guarda un PNG de pagina completa por cada uno.
 *
 *   bash tools/devenv.sh
 *   node tools/shoot.mjs krg-cms/docs/vista-previa.html
 *   node tools/shoot.mjs http://localhost:3000/ .captures/home
 *
 * Tambien devuelve por consola los errores de consola y las peticiones
 * fallidas, que es donde suelen esconderse los fallos de JS.
 */

import { chromium } from '../.tools/npm/node_modules/playwright-core/index.mjs';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const target = process.argv[2];
const outDir = process.argv[3] || '.captures';

if (!target) {
  console.error('Uso: node tools/shoot.mjs <archivo|url> [carpeta-salida]');
  process.exit(1);
}

const url = /^https?:/.test(target) ? target : pathToFileURL(resolve(target)).href;
mkdirSync(outDir, { recursive: true });

const executablePath = process.env.CHROMIUM_BIN || resolve('.tools/chromium/chromium');
if (!existsSync(executablePath)) {
  console.error('No encuentro chromium. Ejecuta antes: bash tools/devenv.sh');
  process.exit(1);
}

// Las librerias del sistema viajan con el binario, no estan en la imagen.
const libs = `${resolve('.tools/chromium/lib/lib')}:${resolve('.tools/chromium/lib')}`;
process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
  ? `${libs}:${process.env.LD_LIBRARY_PATH}`
  : libs;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

const problems = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${vp.name}] consola: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${vp.name}] excepcion: ${e.message}`));
  page.on('requestfailed', (r) => {
    // Los mapas y las fuentes remotas no cargan en este entorno: no es noticia.
    if (/google|gstatic|maps/.test(r.url())) return;
    problems.push(`[${vp.name}] peticion fallida: ${r.url()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(900);

  const file = join(outDir, `${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${vp.name.padEnd(8)} ${vp.width}x${vp.height}  ->  ${file}`);
  await page.close();
}

await browser.close();

if (problems.length) {
  console.log('\nIncidencias detectadas:');
  for (const p of [...new Set(problems)].slice(0, 25)) console.log('  ' + p);
} else {
  console.log('\nSin errores de consola ni peticiones rotas.');
}
