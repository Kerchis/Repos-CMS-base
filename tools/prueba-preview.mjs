#!/usr/bin/env node
/**
 * La pestana «Preview» tiene que ser la web publica.
 *
 * Compara el marcado de los tres contextos sobre los renderizadores de
 * verdad: web publica, pestana «Preview» (borrador, sin andamiaje) y
 * lienzo del constructor (con andamiaje). La regla es:
 *
 *   publico === preview        (byte a byte)
 *   lienzo  !== publico        (ahi si se ve lo vacio y lo apagado)
 *
 *   node tools/prueba-preview.mjs
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './harness.mjs';

const php = `${ROOT}/.tools/php/php`;
const casos = ['pruebas-vacias', 'carta-pestanas', 'pie-partido-izq'];

function marcado(caso, env) {
  return execFileSync(php, [`${ROOT}/tools/render.php`, caso], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

const fallos = [];
const linea = (ok, txt, extra) => {
  console.log(`${ok ? '  OK  ' : ' FALLA'}  ${txt}${extra ? '  — ' + extra : ''}`);
  if (!ok) fallos.push(txt);
};

for (const caso of casos) {
  const publico = marcado(caso, { KRG_CANVAS: '' });
  const preview = marcado(caso, { KRG_PREVIEW: '1' });
  const lienzo = marcado(caso, { KRG_CANVAS: '1' });

  linea(publico === preview, `«Preview» es identico a la web publica: ${caso}`,
    publico === preview ? `${publico.length} bytes` : `${publico.length} vs ${preview.length} bytes`);
  linea(!preview.includes('data-krg-id'), `«Preview» no lleva marcas de seleccion: ${caso}`);
  linea(!preview.includes('m-col-empty'), `«Preview» no lleva avisos de hueco vacio: ${caso}`);
  linea(!/is-empty/.test(preview), `«Preview» no lleva bloques en estado «añade contenido»: ${caso}`);
  linea(lienzo.includes('data-krg-id'), `el lienzo si lleva marcas de seleccion: ${caso}`);
}

// Lo apagado con el interruptor: solo existe en el lienzo.
const pubApagado = marcado('apagado', { KRG_CANVAS: '' });
const prevApagado = marcado('apagado', { KRG_PREVIEW: '1' });
const canApagado = marcado('apagado', { KRG_CANVAS: '1' });
linea(pubApagado.trim() === '', 'un bloque apagado no sale en la web publica', `${pubApagado.trim().length} bytes`);
linea(prevApagado.trim() === '', 'un bloque apagado no sale en «Preview»', `${prevApagado.trim().length} bytes`);
linea(canApagado.includes('is-hidden'), 'un bloque apagado si sale en el lienzo, marcado');

console.log(`\n${fallos.length ? `FALLAN ${fallos.length}` : 'TODAS LAS COMPROBACIONES PASAN'}`);
process.exit(fallos.length ? 1 : 0);
