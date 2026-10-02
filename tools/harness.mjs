/**
 * Monta una pagina de prueba con el marcado REAL del tema.
 *
 * Centraliza lo que comparten tools/medir.mjs y tools/prueba-vacias.mjs:
 * llamar a los renderizadores con el PHP estatico y envolver su salida en
 * una pagina con los mismos tokens, CSS y cabecera que WordPress.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export function chromiumLib() {
  const require = createRequire(path.join(ROOT, 'tools/'));
  return require(path.join(ROOT, '.tools/npm/node_modules/playwright-core'));
}

/** Ejecuta un caso de tools/render.php y devuelve su marcado. */
export function render(caso, { canvas = false } = {}) {
  return execFileSync(path.join(ROOT, '.tools/php/php'), [path.join(ROOT, 'tools/render.php'), caso], {
    encoding: 'utf8',
    env: { ...process.env, KRG_CANVAS: canvas ? '1' : '' },
  });
}

function tokens() {
  const preset = JSON.parse(readFileSync(path.join(ROOT, 'krg-cms/presets/honeycomb.json'), 'utf8')).tokens;
  const vars = [];
  for (const [group, prefix] of [['color', 'color'], ['font', 'font'], ['spacing', 'spacing']]) {
    for (const [k, v] of Object.entries(preset[group] || {})) {
      vars.push(`--${prefix}-${k}:${typeof v === 'object' ? v.value : v}`);
    }
  }
  vars.push('--page-max-width:1360px');
  return vars.join(';');
}

/** Escribe la pagina en .captures y devuelve su ruta. */
export function pagina(nombre, markup, { canvas = false } = {}) {
  const css = ['base.css', 'components.css', 'modules.css']
    .map((f) => readFileSync(path.join(ROOT, 'krg-cms/assets/css', f), 'utf8'))
    .join('\n');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>:root,.krg-root{${tokens()};--m-header-h:76px}</style>
<style>${css}</style>
<style>
  body{margin:0;background:var(--color-background)}
  /* Lo que en WordPress emite DocumentCssCompiler para cada columna. */
  .m-c-row > .m-c-column{grid-column:span 12;min-width:0}
  .m-c-row:has(> .m-c-column:nth-child(2)) > .m-c-column{grid-column:span 6}
  .qa-ph{display:block;width:100%;height:100%;min-height:120px;background:#d9c7a3}
  .m-sp-media .qa-ph{position:absolute;inset:0}
  header.stub{height:76px;background:var(--color-primary);position:sticky;top:0;z-index:5}
</style>
</head><body class="krg-root${canvas ? ' krg-preview' : ''}"><header class="stub"></header><main class="m-page">
${markup}
</main></body></html>`;

  mkdirSync(path.join(ROOT, '.captures'), { recursive: true });
  const file = path.join(ROOT, '.captures', `${nombre}.html`);
  writeFileSync(file, html);
  return file;
}

/** Caja de cada seccion de primer nivel, con su espacio muerto. */
export const medirSecciones = () => {
  const r = (n) => Math.round(n * 10) / 10;
  const secs = [...document.querySelectorAll('main > .m-c-section')];
  const envoltorio = (el) => el.matches('.m-container, .m-c-row, .m-c-column');
  return secs.map((s, i) => {
    const cs = getComputedStyle(s);
    const box = s.getBoundingClientRect();
    let fondo = box.top;
    s.querySelectorAll('*').forEach((el) => {
      if (envoltorio(el)) return;
      const b = el.getBoundingClientRect();
      if (b.height > 0 && b.width > 0) fondo = Math.max(fondo, b.bottom);
    });
    const id = (s.className.match(/m-n-([A-Za-z0-9_-]+)/) || [, ''])[1];
    return {
      i,
      id,
      clases: s.className,
      alto: r(box.height),
      padTop: cs.paddingTop,
      padBottom: cs.paddingBottom,
      colaVacia: r(box.bottom - fondo),
      huecoSiguiente: i + 1 < secs.length ? r(secs[i + 1].getBoundingClientRect().top - box.bottom) : 0,
    };
  });
};
