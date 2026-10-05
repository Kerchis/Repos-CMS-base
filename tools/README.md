# Banco de pruebas del tema

Herramientas para verificar el tema **fuera de WordPress**, con PHP y
Chromium de verdad. Ninguna toca una instalación real: montan los
renderizadores con un mínimo de funciones de WordPress y miden el resultado.

Antes de nada, una vez por sesión:

```sh
bash tools/devenv.sh     # PHP 8.3 estático + Chromium + playwright-core en .tools/
bash tools/pruebas.sh    # y ya está: pasa todos los bancos de golpe (unos 4 min)
```

| Herramienta | Qué hace |
| --- | --- |
| `tools/devenv.sh` | Prepara `.tools/php`, `.tools/chromium` y `playwright-core`. Idempotente. |
| `tools/pruebas.sh` | Pasa **todos** los bancos de una vez —lint, los de PHP y los del navegador—, enseña un resumen y devuelve código 1 si alguno falla. Los descubre solos (`tools/prueba-*.php` y `tools/prueba-*.mjs`), así que un banco nuevo entra sin tocar ninguna lista. `bash tools/pruebas.sh v2 panel` corre solo esos, `--rapido` se salta el navegador y `--lista` enseña lo que hay. Es lo que ejecuta GitHub en cada empujón. |
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
| `tools/prueba-panel.mjs` | El tramo anterior: el panel del constructor de verdad en Chromium con la API simulada. Teclea en «Relleno» y «Margen», elige color con el cuadrito, lo quita con la ✕, recarga y comprueba el cuerpo de cada POST (35). Y la paleta en dos grupos: «Secciones V.1» recogidas con sus 60 bloques intactos y «Secciones V.2» con las treinta nuevas y «Piezas V.2» con los diecisiete bloques básicos ya metidos en su sección: al añadir cualquiera de las dos, todas sus piezas quedan con nombre en el árbol y la sección viaja entera al servidor (53). |
| `tools/prueba-inspector.mjs` | El inspector nuevo: cabecera del elemento, tres pestañas, grupos plegables con memoria, ajustes contextuales y la cadena completa (escribir → estado → POST → recargar) de tipografía, borde, sombra, posición, transformación, atributos y CSS personalizado (77). |
| `tools/prueba-chrome.mjs` | La pantalla de cabecera y pie sobre el **mismo constructor** que las páginas: mismos acordeones y mismo inspector —fondo, relleno por tamaño, borde, sombra, posición, atributos—, la paleta con los 60 bloques del registro, el árbol con arrastrar y soltar, duplicar, ocultar y borrar, la plantilla «Pie partido por piezas» (cada texto, la foto y las redes como bloques propios), la barra de arriba con los mismos botones y los paneles que se pliegan, que al guardar la vista se recarga sola sólo si cambió la estructura, que pulsar un bloque en la vista lo selecciona en el panel, y que todo llega a `/header` y `/footer`, la tipografía del menú (familia, peso, tamaño, caja y espaciado) y el editor de texto con formato de los bloques del pie; con los estilos de verdad y dentro del armazón del admin (74). |
| `tools/prueba-lienzo.mjs` | El tramo que faltaba: el constructor entero con su iframe de verdad. Teclea en el panel y lee el color que **se ve** dentro del lienzo (33). |
| `tools/prueba-caja.mjs` | Contrato de fondo, relleno y margen: seis tipos de sección × tres tamaños × web pública / «Preview» / lienzo, herencia hacia abajo, sección vacía con relleno, cero `!important` y comparación letra por letra entre el PHP y el editor (72). |
| `tools/prueba-matriz.mjs` | La matriz del encargo: los tres anchos de sección (full/padded/boxed) × fondo, relleno y margen × escritorio/tableta/móvil × web pública/«Preview»/lienzo, más fila, columna y módulo con caja propia, sección sin nada escrito (manda el token), sección vacía, transparencia y «lo del panel gana al tema» (91). |
| `tools/prueba-carta.mjs` | La carta de restaurante de punta a punta: el árbol del inspector (categoría → plato → adiciones → fotos), los dos paneles del constructor dentro del admin de WordPress y, en la página pública, la pestaña «Todo» sin adiciones, el símbolo de la moneda, el visor de fotos del plato y que editar no te devuelva al principio de la lista (113). |
| `tools/prueba-cta.mjs` | El fondo del «CTA display»: la foto cubre el bloque —o la sección entera—, el encaje y el anclaje salen del panel, los modos de fusión llegan al navegador y el parallax mueve la foto —y solo la foto— al rodar (43). |
| `tools/prueba-categorias.mjs` | Categorías y etiquetas del blog: el módulo de categorías pintado por el camino real con el interruptor encendido y apagado (web pública / lienzo), y la pantalla del panel con la API simulada **con estado** —crear, duplicar con sus entradas, eliminar, pestañas, y el interruptor que se guarda, sobrevive a la recarga y se echa atrás si el servidor falla; más la lista de entradas con sus categorías, etiquetas y estado editables desde la propia fila, duplicar una entrada, nombrar otra categoría predeterminada para poder borrar la vieja y la página de la entrada ejecutada con `single.php` de verdad, donde apagado no puede quedar ni un enlace a la categoría o la etiqueta (69). |
| `tools/prueba-articulo.mjs` | La pantalla «Editar entrada»: monta el editor clásico de WordPress (pestañas Visual/Texto y «Añadir multimedia») sobre el campo Contenido, guarda lo que hay **en el editor** y no el área de texto desfasada, lo desmonta al cambiar de pantalla y, si WordPress no lo sirve, deja la pantalla usable con su barra de etiquetas (31). |
| `tools/prueba-blog.mjs` | Las tarjetas de una rejilla de entradas, medidas en el navegador: que forman rejilla de verdad, la proporción y el alto fijo que elige el panel, el color fundido sobre la foto y su cambio al pasar el ratón, el título como cita —que sigue siendo un `h3`—, el interruptor de la fecha —apagada de serie—, la alineación del texto en los dos ejes y las siete posiciones del logo, más que el color no se salga de la tarjeta (58). Con `KRG_SHOT=1` deja `captura-tarjetas-blog.png` y `captura-tarjetas-hover.png` (usa `.tools/foto-tarjeta.jpg` si está; si no, las fotos salen vacías). |
| `tools/prueba-anclas.mjs` | Menú de una sola página: cinco secciones con ancla —dos con cortina— y los saltos del menú medidos de verdad, bajando y **subiendo**. Una sección pegada decía estar donde está pegada, así que volver arriba no movía la página (10). |
| `tools/prueba-v2.mjs` | Las **secciones V.2** una por una: que sólo usan bloques que ya existen en el registro, que cada pieza tiene nombre propio en el árbol, que ninguna fila se pasa de doce columnas, que el servidor las pinta sin un aviso de PHP, que sus textos y sus clases por id salen en la web y que sobreviven al saneador del guardado. Las treinta y seis secciones enteras y las diecisiete piezas sueltas, que traen su sección, su fila y su columna montadas. Los módulos del blog se pintan con entradas y categorías de mentira (`KRG_ENTRADAS`, `KRG_CATEGORIAS`), que si no devuelven cadena vacía y el verde es falso (768). |
| `tools/prueba-copiar.mjs` | Copiar y pegar bloques y aspectos: copiar una sección entera y pegarla con sus piezas y sus identificadores nuevos, pegar un bloque suelto justo debajo del elegido, rechazar una columna fuera de una fila, cortar y volver a pegar, copiar sólo el estilo y dárselo a otro bloque sin tocar su texto, los atajos de teclado —y que dentro de una casilla Ctrl+C siga copiando letras—, que todo sobreviva al guardado y a recargar el panel, **que lo copiado en una página se pegue en otra** y que en la web pública se vea (39). |
| `tools/prueba-historial.mjs` | El historial y el autoguardado en el panel: la lista con las fechas y los orígenes en palabras, el autor y el tamaño de cada versión; «Ver qué cambió» diciendo qué vuelve, qué desaparece y qué cambia antes de tocar nada; restaurar; y la red de seguridad del guardado —si el POST falla, reintenta con esperas crecientes, deja una copia en el navegador y al volver a entrar la ofrece; y si no hay nada que recuperar, no molesta (31). |
| `tools/prueba-versiones.php` | El historial por el lado del servidor, con un `$wpdb` de mentira: que el guardado automático no llene la tabla —mismo contenido no escribe nada, dos cambios del mismo minuto actualizan la misma fila—, que lo hecho a mano y lo publicado siempre dejen su versión, que la lista diga de cada una cuántas secciones y cuántos bloques tenía la página (que es lo que permite reconocer «la de antes de borrarlo todo») y que una versión suelta se pueda leer entera y saneada (20). |
| `tools/prueba-huecos.mjs` | La separación entre columnas no puede echar la fila fuera de la pantalla. Una fila son doce pistas con **once** huecos: con la separación en 40 px suman 440 px y en un móvil de 390 px la fila no cabe ni vacía, así que el texto salía cortado por la derecha. Mide la separación de verdad —por dónde han quedado las columnas, que `getComputedStyle` devuelve el `min()` sin resolver— con seis separaciones (0, 16, 24, 40, 64, 80) en tres tamaños, y comprueba que lo que cabía no se toca, que lo que no cabía se recorta y que el hueco vertical se respeta siempre (41). |
| `tools/prueba-pie.mjs` | El pie partido contra el ejemplo: foto a sangre en dos quintos, el bloque de contacto y las columnas de enlaces **en la misma línea**, los títulos y el reparto de enlaces por columna, la raya y la barra de abajo con los legales a un lado y el copyright al otro, los cinco iconos de redes distintos, la foto a la derecha, el apilado en móvil y el pie sin datos (25). Con `KRG_SHOT=1` deja `captura-pie.png`. |
| `tools/prueba-tarjetas.mjs` | El carril de productos: las tarjetas alinean categoría, título y enlace aunque los textos midan distinto, y la lista del panel son fichas plegables con miniatura que se arrastran para ordenar (32). |
| `tools/prueba-editor.mjs` | El editor de texto con botones, de punta a punta: poner una palabra en negrita en el panel, verlo guardado, recargar el panel, encontrarlo igual, cambiarlo desde la pestaña «HTML», pegar desde fuera sin que entre maquetado ajeno y comprobar que la web lo pinta como formato y no como etiquetas escritas (21). |
| `tools/prueba-familias.mjs` | El panel de Apariencia: cuatro familias tipográficas —la nueva «Texto general» incluida—, que arranca sin elegir, que al elegirla viaja en `tokens.font.ui` que al volver a entrar sigue puesta, que una familia de un solo peso avisa de que no tiene negrita y que una escrita a mano se puede marcar para cargarla de Google (21). |
| `tools/prueba-prosa.php` | El texto con formato y las tipografías por el camino de PHP: qué marcas sobreviven al guardado y cuáles se caen, los veintidós módulos que imprimen prosa, el titular grande que no se puede partir letra a letra cuando lleva marcado, el `alt` sin etiquetas, el CSS de la tipografía del menú y la cuarta familia en la hoja de tokens y en `modules.css` (64). |
| `tools/prueba-fuentes.php` | Que la fuente elegida se **descargue**: el catálogo con los pesos reales de cada familia, una del catálogo y una escrita a mano pedidas a Google, una del sistema que no pide nada, la tipografía de la cabecera y del pie, y que ninguna familia declarada en el CSS se quede sin su archivo. Incluye las fuentes subidas a la Biblioteca de WordPress: dirección en `https` —si se queda en `http` el navegador la bloquea por contenido mixto—, el `format()` sacado de la extensión real del archivo, la cara repetida declarada una sola vez, el atajo `file:./` resuelto, y el esquema corregido también en lo que imprime WordPress por su cuenta (46). |
| `tools/prueba-fuentes.mjs` | Lo mismo pero mirando lo que el navegador **pinta**, que es lo que el inspector no enseña: se intercepta la hoja de Google, se devuelve una fuente de prueba de otra anchura y se mide el renglón. Incluye la reproducción del fallo antiguo —familia declarada, archivo nunca pedido, Arial en pantalla— (19). |
| `tools/prueba-tokens.php` | El token que el tema no puede perder: detecta un `spacing.section` inservible, lo rellena al leer, lo repara una sola vez en la base de datos, no toca jamás un valor del usuario y comprueba que el panel y el CSS dicen lo mismo (32). |
| `tools/prueba-cortina.mjs` | El motor de secciones con la cortina encendida: siete tipos de sección detrás de una sección cortina × fondo, relleno y margen × tres tamaños × tres modos, con `public.js` y `modules.js` cargados de verdad. Comprueba que la cortina sigue tapando lo transparente y que NO escribe nada sobre las secciones (83). |
| `tools/prueba-motor.mjs` | El protocolo del encargo en el editor real: altura 90vh + fondo + relleno 50 + margen 50 en dos secciones distintas, midiendo antes de guardar, **después** del guardado automático y de la recarga del marco, y otra vez tras recargar el editor entero; más los tres tamaños (41). |
| `tools/categorias-php.php` | Pinta el módulo de categorías con el interruptor encendido y apagado y devuelve un JSON. Lo usa `prueba-categorias.mjs`. |
| `tools/caja-php.php` | Escribe las declaraciones de caja de un estado JSON. Lo usa `prueba-caja.mjs` para comparar los dos emisores. |
| `tools/render-doc.php` | Convierte un documento JSON en una página HTML completa por la cadena real, con los CSS del tema incrustados. Con `KRG_ENTRADAS=3` inventa tres entradas de blog para que las rejillas de entradas tengan algo que pintar, y con `KRG_TOKENS=tokens.json` monta una instalación con esos tokens, cabecera y pie. Imprime también los `<link>` de las fuentes, como hace WordPress con lo que el tema encola. Lo usa `prueba-lienzo.mjs` para servir el lienzo. |
| `tools/dump-registry.php` | Vuelca el catálogo de componentes como JSON para alimentar al constructor en `prueba-panel.mjs`. |

Chromium necesita sus librerías en el entorno:

```sh
export LD_LIBRARY_PATH="$PWD/.tools/chromium/lib/lib:$PWD/.tools/chromium/lib"
```

Todos los bancos devuelven código 1 si falla alguna comprobación, así que
basta con uno:

```sh
bash tools/pruebas.sh
```

Eso es exactamente lo que corre GitHub en cada empujón
(`.github/workflows/pruebas.yml`): monta el entorno con el mismo
`tools/devenv.sh` —no hay dos recetas que mantener—, guarda `.tools` en la
caché para que las rondas siguientes empiecen en segundos y deja la tabla de
resultados en el resumen del trabajo.

Para correr uno suelto mientras se trabaja:

```sh
node tools/prueba-huecos.mjs
.tools/php/php tools/prueba-tokens.php
bash tools/pruebas.sh carta cta          # o varios, con el resumen de siempre
```

Algunos aceptan `KRG_SHOT=1` y dejan además sus capturas: `prueba-carta`,
`prueba-cta`, `prueba-tarjetas`, `prueba-blog` y `prueba-pie`.

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
