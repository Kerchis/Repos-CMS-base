# Banco de pruebas del tema

Herramientas para verificar el tema **fuera de WordPress**, con PHP y
Chromium de verdad. Ninguna toca una instalación real: montan los
renderizadores con un mínimo de funciones de WordPress y miden el resultado.

Antes de nada, una vez por sesión:

```sh
bash tools/devenv.sh     # PHP 8.3 estático + Chromium + playwright-core en .tools/
```

| Herramienta | Qué hace |
| --- | --- |
| `tools/devenv.sh` | Prepara `.tools/php`, `.tools/chromium` y `playwright-core`. Idempotente. |
| `tools/lint-php.sh` | `php -l` sobre todos los `.php` del tema. |
| `tools/wp-shim.php` | El mínimo de WordPress que necesitan catálogo, registro, saneador y renderizadores. Todo con `function_exists`. |
| `tools/render.php` | Imprime el marcado real de un caso. `.tools/php/php tools/render.php` lista los casos. Tres contextos: sin nada = web pública, `KRG_PREVIEW=1` = pestaña «Preview», `KRG_CANVAS=1` = lienzo del constructor. |
| `tools/harness.mjs` | Monta una página completa con los CSS del tema alrededor de un caso y la deja en `.captures/`. |
| `tools/medir.mjs` | Mide las cajas de las secciones de un caso: `node tools/medir.mjs <caso> [ancho] [alto]`. |
| `tools/shoot.mjs` | Captura a 1440/834/390 e informa de errores de consola: `node tools/shoot.mjs <archivo|url> [carpeta]`. |
| `tools/prueba-vacias.mjs` | Contrato de secciones vacías: lo que no pinta nada ocupa 0 px en la web y sí se ve en el lienzo. |
| `tools/prueba-preview.mjs` | Contrato de contextos: «Preview» tiene que salir byte a byte igual que la web pública, y el andamiaje solo en el lienzo. |
| `tools/prueba-guardado.php` | Camino de guardado: pasa nodos por el saneador de verdad y comprueba qué propiedades sobreviven. |
| `tools/prueba-estilos.mjs` | Contrato de «lo que escribes en el panel manda»: documento real → saneador → compilador de CSS → navegador, y se lee el color, el relleno y la posición calculados. |

Chromium necesita sus librerías en el entorno:

```sh
export LD_LIBRARY_PATH="$PWD/.tools/chromium/lib/lib:$PWD/.tools/chromium/lib"
```

Las cuatro pruebas devuelven código 1 si falla alguna comprobación, así que
sirven tal cual en un gancho de integración continua:

```sh
bash tools/lint-php.sh
.tools/php/php tools/prueba-guardado.php
node tools/prueba-preview.mjs
node tools/prueba-vacias.mjs
node tools/prueba-estilos.mjs
```

`tools/render.php` trae dos ayudantes para montar casos por el camino
completo: `arbol()` (sección → fila → columna → módulos, como los intercala
el constructor) y `documento()` (pasa el árbol por `Sanitizer::document()`,
compila el CSS con `DocumentCssCompiler` y lo devuelve delante del marcado).
Son los que hacen falta para medir quién gana la cascada: llamar al
renderizador a pelo se salta justo el tramo donde se pierden los estilos.
