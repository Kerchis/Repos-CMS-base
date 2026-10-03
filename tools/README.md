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
| `tools/sanear.php` | Pasa un documento por `Sanitizer::document()` + `BoxStyles::migrate_document()` y lo imprime como JSON, igual que contestaría la API. Lo usa el servidor falso de `prueba-motor.mjs` para que el banco vea lo que el servidor cambia al guardar —incluida la forma del JSON. |
| `tools/medir.mjs` | Mide las cajas de las secciones de un caso: `node tools/medir.mjs <caso> [ancho] [alto]`. |
| `tools/shoot.mjs` | Captura a 1440/834/390 e informa de errores de consola: `node tools/shoot.mjs <archivo|url> [carpeta]`. |
| `tools/prueba-vacias.mjs` | Contrato de secciones vacías: lo que no pinta nada ocupa 0 px en la web y sí se ve en el lienzo. |
| `tools/prueba-preview.mjs` | Contrato de contextos: «Preview» tiene que salir byte a byte igual que la web pública, y el andamiaje solo en el lienzo. |
| `tools/prueba-guardado.php` | Camino de guardado: pasa nodos por el saneador de verdad y comprueba qué propiedades sobreviven. |
| `tools/prueba-estilos.mjs` | Contrato de «lo que escribes en el panel manda»: documento real → saneador → compilador de CSS → navegador, y se lee el color, el relleno y la posición calculados. |
| `tools/prueba-panel.mjs` | El tramo anterior: el panel del constructor de verdad en Chromium con la API simulada. Teclea en «Relleno» y «Margen», elige color con el cuadrito, lo quita con la ✕, recarga y comprueba el cuerpo de cada POST (35). |
| `tools/prueba-inspector.mjs` | El inspector nuevo: cabecera del elemento, tres pestañas, grupos plegables con memoria, ajustes contextuales y la cadena completa (escribir → estado → POST → recargar) de tipografía, borde, sombra, posición, transformación, atributos y CSS personalizado (77). |
| `tools/prueba-chrome.mjs` | La pantalla de cabecera y pie sobre el mismo núcleo que las páginas: mismos acordeones, y lo que se toca llega a `/header` y `/footer`; con los estilos de verdad y dentro del armazón del admin (33). |
| `tools/prueba-lienzo.mjs` | El tramo que faltaba: el constructor entero con su iframe de verdad. Teclea en el panel y lee el color que **se ve** dentro del lienzo (33). |
| `tools/prueba-caja.mjs` | Contrato de fondo, relleno y margen: seis tipos de sección × tres tamaños × web pública / «Preview» / lienzo, herencia hacia abajo, sección vacía con relleno, cero `!important` y comparación letra por letra entre el PHP y el editor (72). |
| `tools/prueba-matriz.mjs` | La matriz del encargo: los tres anchos de sección (full/padded/boxed) × fondo, relleno y margen × escritorio/tableta/móvil × web pública/«Preview»/lienzo, más fila, columna y módulo con caja propia, sección sin nada escrito (manda el token), sección vacía, transparencia y «lo del panel gana al tema» (91). |
| `tools/prueba-carta.mjs` | La carta de restaurante de punta a punta: el árbol del inspector (categoría → plato → adiciones → fotos), los dos paneles del constructor dentro del admin de WordPress y, en la página pública, la pestaña «Todo» sin adiciones, el símbolo de la moneda, el visor de fotos del plato y que editar no te devuelva al principio de la lista (113). |
| `tools/prueba-tokens.php` | El token que el tema no puede perder: detecta un `spacing.section` inservible, lo rellena al leer, lo repara una sola vez en la base de datos, no toca jamás un valor del usuario y comprueba que el panel y el CSS dicen lo mismo (32). |
| `tools/prueba-cortina.mjs` | El motor de secciones con la cortina encendida: siete tipos de sección detrás de una sección cortina × fondo, relleno y margen × tres tamaños × tres modos, con `public.js` y `modules.js` cargados de verdad. Comprueba que la cortina sigue tapando lo transparente y que NO escribe nada sobre las secciones (83). |
| `tools/prueba-motor.mjs` | El protocolo del encargo en el editor real: altura 90vh + fondo + relleno 50 + margen 50 en dos secciones distintas, midiendo antes de guardar, **después** del guardado automático y de la recarga del marco, y otra vez tras recargar el editor entero; más los tres tamaños (41). |
| `tools/caja-php.php` | Escribe las declaraciones de caja de un estado JSON. Lo usa `prueba-caja.mjs` para comparar los dos emisores. |
| `tools/render-doc.php` | Convierte un documento JSON en una página HTML completa por la cadena real, con los CSS del tema incrustados. Lo usa `prueba-lienzo.mjs` para servir el lienzo. |
| `tools/dump-registry.php` | Vuelca el catálogo de componentes como JSON para alimentar al constructor en `prueba-panel.mjs`. |

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
node tools/prueba-panel.mjs
node tools/prueba-inspector.mjs
node tools/prueba-chrome.mjs
node tools/prueba-lienzo.mjs
node tools/prueba-matriz.mjs
.tools/php/php tools/prueba-tokens.php
node tools/prueba-cortina.mjs
node tools/prueba-motor.mjs
node tools/prueba-caja.mjs
node tools/prueba-estirar.mjs
node tools/prueba-carta.mjs            # KRG_SHOT=1 deja además las capturas del árbol, del visor y del plato en móvil
```

`tools/render.php` trae dos ayudantes para montar casos por el camino
completo: `arbol()` (sección → fila → columna → módulos, como los intercala
el constructor) y `documento()` (pasa el árbol por `Sanitizer::document()`,
compila el CSS con `DocumentCssCompiler` y lo devuelve delante del marcado).
Son los que hacen falta para medir quién gana la cascada: llamar al
renderizador a pelo se salta justo el tramo donde se pierden los estilos.

## `prueba-panel.mjs`

Los demás bancos empiezan en el documento ya guardado. Éste empieza antes:
carga `app.js` y `builder.js` tal cual se sirven en el admin, con las
llamadas a la API interceptadas, escribe en las casillas como lo haría una
persona y comprueba que el valor aparece en el cuerpo del POST y que el
panel lo vuelve a enseñar al volver a seleccionar la sección. El registro de
componentes es el real: lo vuelca `dump-registry.php` desde el catálogo PHP.

El último caso pone un servidor que devuelve el documento sin estilos y
comprueba que el constructor lo detecta y lo dice en la barra de estado.

## `prueba-lienzo.mjs`

`prueba-panel.mjs` llega hasta el POST; de ahí en adelante su API simulada no
devuelve ninguna página, así que el iframe se queda vacío y `paintLiveCss()`
se sale sin hacer nada. Es decir: ningún banco miraba el sitio donde la
persona mira. Éste sí.

El panel se sirve desde `https://krg.test/wp-admin/krg-builder.html` con
`app.js`, `builder.js` y los dos CSS del admin incrustados, y el lienzo desde
`https://krg.test/?krg_preview=…` con el HTML que imprime `render-doc.php`.
Mismo origen, que es la única forma de que el padre pueda leer
`contentDocument` — y de que el repintado en vivo sea comprobable.

Qué se mide, siempre con `getComputedStyle` dentro del marco:

- el color de fondo, el relleno y el margen que se acaban de teclear;
- que aparecen **al instante**, sin guardar ni recargar;
- que siguen ahí tras recargar el constructor entero;
- que la web pública y la pestaña «Preview» pintan lo mismo;
- que ninguna capa de dentro cubre la sección;
- que el diagnóstico del inspector acierta: dice «✔» cuando el valor manda y,
  cuando se cuela una hoja con `!important`, nombra la regla y su media query.

Dos trampas que costaron un rato y están resueltas en el banco: el POST de
guardado no incluye `previewUrl`, así que el servidor simulado tiene que
volver a ponerlo al devolver la página (WordPress lo hace) o el iframe
desaparece al recargar; y un iframe servido por https no carga hojas
`file://`, así que los CSS van incrustados o la cascada que se mide no es la
de verdad.

## Diagnóstico de estilos (dentro del producto)

Pestaña «Avanzado» del inspector, botón **Revisar este bloque**. Recorre la
misma cadena en la instalación de quien lo pulsa y escribe un informe
copiable: estado del editor, último guardado y descartes del servidor,
cuántos elementos `.m-n-{id}` hay en el lienzo, el atributo `style` real,
pedido contra calculado propiedad por propiedad y, si no coinciden, todas las
reglas CSS que declaran esa propiedad sobre ese elemento con su selector, su
`@media` y su `!important`. Está en `diagnosticar()` y `reglasQueTocan()`
(`admin/assets/js/builder.js`). No cambia nada: solo mira.

## Preguntarle al elemento o preguntarle al pixel

`prueba-lienzo.mjs` daba por buena la cadena entera midiendo
`getComputedStyle(.m-n-secA).backgroundColor`. Es verdad y no sirve: un
bloque de dentro puede pintar encima, y entonces la seccion es roja y la
pantalla verde al mismo tiempo. Las dos medidas son correctas; solo una
contesta la pregunta de quien mira.

Desde la PRUEBA 10 el banco pregunta por el punto: centro de la seccion,
`elementFromPoint`, y hacia arriba hasta el primer fondo opaco. Eso devuelve
el color **y** quien lo pinta. Con eso se reprodujo en dos minutos lo que la
captura de una instalacion de verdad enseñaba: seccion `#f5f500`, pantalla
`#3f5e58`, lo pinta `.m-c-statement-cta`.

El aviso del panel usa esa misma medida (`blockingBg()` en `builder.js`), asi
que ya no avisa de lo que no pasa ni calla lo que si.
