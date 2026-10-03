# Auditoría del editor antes del reset de configuración

Fecha: 2026-10-03. Rama `arena/01a0f8eb-repos-cms-base`.
Objetivo: saber qué se puede reutilizar **antes** de borrar nada, y dejar por
escrito de qué depende cada pieza.

---

## 1. Mapa de archivos

| Archivo | Líneas | Qué es |
|---|---|---|
| `admin/assets/js/builder.js` | 3 828 | Constructor de páginas entero: estado, árbol, lienzo, inspector, guardado, historial. |
| `admin/assets/js/chrome.js` | 1 665 | Constructor de cabecera y pie. **Inspector propio**, con su `inspector()`, su `field()`, su `markDirty()`, su historial. |
| `admin/assets/js/app.js` | 1 972 | Pantallas de admin + `KrgUi` (campos de color, tipografía, `wire()`). Compartido. |
| `admin/assets/css/builder.css` | 601 | Estilos del constructor, incluido `.acc`. |
| `core/components/Catalog.php` + `BrandCatalog.php` | 2 481 | Catálogo: cada bloque declara `fields` con `key/type/group/label`. **Ya es un esquema.** |
| `core/style/DocumentCssCompiler.php` + `BoxStyles.php` | 771 | Motor de estilos: `node.styles[bp]` → CSS por `.m-n-{id}`. |
| `core/render/*` | 3 131 | Renderizadores. |
| `core/security/Sanitizer.php` | 653 | Lista blanca de props y de estilos. |

## 2. Modelo de datos actual (una sola fuente, ya correcta)

```
documento
└── sections[]            node
    ├── id, type, name, visible
    ├── props{}           datos del bloque (los declara el catálogo)
    ├── styles{desktop,tablet,mobile}{}   propiedades CSS
    ├── hiddenOn{}        visibilidad por tamaño
    ├── animation, animDuration, animDelay, animEasing
    ├── filters{hue,sat,brightness,contrast,invert,sepia}
    ├── customCss{before,main,after}
    ├── htmlId, htmlClass
    └── children[]
```

**Conclusión:** el modelo de datos NO es el problema y no hay que tocarlo. Ya
cumple «una sola fuente de verdad». Lo que está fragmentado es **quién pinta
los controles**.

## 3. El inspector actual: siete implementaciones paralelas

`inspector()` (L2398) es un despachador con seis variantes especializadas más
una genérica. Cada una decide **a mano** qué grupos enseña:

| Variante | Alinear | Fondo | Separación | Borde | Sombra | Filtros | Animación | Tipografía | Tamaño |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `imageInspector` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | propio |
| `galleryInspector` | ✔ | ✔ | ✔ | ✔ | — | — | — | — | propio |
| `videoInspector` | ✔ | ✔ | ✔ | — | — | — | — | — | propio |
| `everestInspector` | ✔ | ✔ | ✔ | — | — | — | — | — | — |
| `textInspector` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `layoutInspector` (sección/fila/columna) | ✔ | ✔ | ✔ | ✔ | — | — | ✔ | — | — |
| genérica (los 20 bloques de marca y el resto) | ✔ | — | ✔ | — | — | — | ✔ | parcial | parcial |

Es decir: **una galería no puede tener sombra, un vídeo no puede tener borde,
un CTA no puede tener tipografía propia** — no porque el motor no sepa, sino
porque nadie escribió esa línea en esa variante. Esa es la «configuración
fragmentada» del encargo.

## 4. Lo que sí funciona y hay que conservar

- **Pestañas Contenido / Diseño / Avanzado**: existen (`inspTabs()`, L1537) y el
  estado vive en `state.inspTab`.
- **Bloques de control ya escritos y probados**: `panelAlign`, `panelSpacing`,
  `panelBorder`, `panelShadow`, `panelFilters`, `panelAnim`, `panelSection`,
  `panelBg`, `panelTypography`, `panelTextSize`, `panelAdvanced`
  (ID/clase, **CSS personalizado**, visibilidad, transiciones, diagnóstico).
- **Campos desde el catálogo**: `fieldHtml(node, field)` sabe pintar 16 tipos
  (texto, número, select, color, imagen, repetidor, mapa…). No hay que
  reinventar ningún control: hay que **registrarlos**.
- **Guardado y preview**: `markDirty()` → `paintLiveCss()` → POST → saneador →
  `adoptSaved()`. Probado por `prueba-panel` (35) y `prueba-lienzo` (36).
- **Disposiciones**: `layoutGallery()`, `layoutThumbs()`, `openLayoutPicker()`,
  `applyRowLayout()`, `data-add-row`. Intactas.

## 5. Lo que falta o está mal

1. `.acc` **no es un acordeón**: es un `div` con borde y un `h5`. No se abre ni
   se cierra (`builder.css:265`).
2. La **configuración de página** se repite al principio de las siete variantes,
   siempre abierta, antes del elemento seleccionado.
3. No hay **cabecera de selección**: no se lee «SECCIÓN · CTA», solo el nombre
   del tipo suelto.
4. No hay **registro de controles**: añadir «sombra» a la galería exige editar
   su variante a mano. 7 sitios para cada cambio.
5. No hay grupos de **Tamaño**, **Posición**, **Transformación** ni
   **Atributos** salvo en imagen (y a medida).
6. `chrome.js` tiene **su propio inspector** sin ninguna de estas piezas:
   duplicación conceptual entre páginas y navegación.

## 6. Dependencias que no se pueden romper al borrar

- `bindInspector()` (L2731+) engancha por **atributos de datos**:
  `data-prop`, `data-prop-set`, `data-style`, `data-side`, `data-node`,
  `data-page`, `data-page-num`, `data-set`, `data-set-str`, `data-seo`,
  `data-css`, `data-hide-bp`, `data-anim`, `data-filter`, `data-media`,
  `data-rep*`, `data-gal-*`, `data-video-*`, `data-diag`, `data-insp-tab`.
  **Cualquier HTML nuevo debe emitir exactamente los mismos atributos**: así el
  guardado, el preview y los bancos siguen valiendo sin tocarse.
- `panelSnap()` / `panelRestore()` conservan foco y scroll entre repintados.
- `render()` no admite argumentos; repinta el inspector entero.
- Bancos que dependen del marcado del panel: `prueba-panel.mjs` (35) y
  `prueba-lienzo.mjs` (36).

## 7. Decisión

No se reescribe el modelo de datos, ni el guardado, ni el preview, ni los
renderizadores, ni la biblioteca de bloques. **Se reescribe la capa que decide
y pinta la configuración**: un registro de controles reutilizables + un
esquema por tipo de elemento + un inspector de acordeones que los compone.
Las siete variantes desaparecen; sus contenidos se conservan convertidos en
controles registrados.

---

# Parte 2 — Lo que se construyó

## 8. El núcleo: `admin/assets/js/builder-core.js`

Un archivo nuevo, `window.KrgBuilderCore`, que no conoce el documento ni el
guardado. Hace tres cosas y nada más:

| Pieza | Qué hace |
| --- | --- |
| `registerControl(id, {label, body, when, hint})` | Registra un grupo de ajustes **una vez**. `body(ctx)` devuelve el HTML de dentro; si devuelve vacío, el grupo no se pinta. |
| `setSchema(kind, {content, design, advanced})` | Declara qué controles ve cada clase de elemento, por pestaña. |
| `render(ctx)` | Pinta: configuración de página (plegada), cabecera «CLASE / Nombre», tres pestañas y los grupos del esquema. |
| `bindGroups(root)` | Abre y cierra. **No repinta**: cambia `hidden`, la clase `is-open` y `aria-expanded`. |

Orden de búsqueda del esquema: `ctx.schema` (lo que declare el bloque en el
catálogo, `def.inspector`) → `SCHEMAS[type]` → `SCHEMAS[kind]`. Lo que el
bloque no declare, lo hereda de su clase.

El estado abierto/cerrado vive en `localStorage["krg.insp.groups"]`, con la
clave = id del grupo. El primer grupo de cada pestaña nace abierto; lo que
toque el usuario se recuerda. Renombrar un id olvida esa preferencia.

## 9. Lo que se borró de `builder.js`

Veinte funciones, 675 líneas: `inspector`, `inspTabs`, `panelAlign`,
`panelSpacing`, `panelBorder`, `panelShadow`, `panelFilters`, `panelAnim`,
`panelSection`, `panelBg`, `panelAdvanced`, `panelTypography`, `panelHeading`,
`panelTextSize`, `imageInspector`, `galleryInspector`, `videoInspector`,
`everestInspector`, `textInspector`, `layoutInspector`. Y el mapa muerto
`groups`. En su sitio: ~45 cuerpos `body*()` registrados como controles y
nueve esquemas.

## 10. Lo que se borró de `chrome.js`

`inspector`, `headerFields`, `footerFields`, `footerChromeFields`,
`footerChromeAlign`, `copyrightFields`, `footerNodeFields`, `tabsHtml`,
`alignBar`, `chromeNavMode`, `animBar`. En su sitio: 24 controles
(`h.*`, `f.*`, `fn.*`) y tres esquemas (`chrome-header`, `chrome-footer`,
`chrome-node`) sobre **el mismo núcleo**. Los atributos `data-h*` / `data-f*`
no han cambiado: `bindInspector()` y el guardado siguen igual.

## 11. Grupos nuevos

- **Tamaño** (`size`): ancho/mín/máx, alto/mín/máx, con px, %, vw, vh, rem, em.
- **Posición** (`position`): static/relative/absolute/sticky, cuatro lados,
  z-index. Allowlist nueva en `Sanitizer::style_props()` y en
  `DocumentCssCompiler::STYLE_PROPS`, con validación propia por propiedad.
- **Transformación** (`transform`): `transform` y `transform-origin`, con un
  filtro que rechaza `url(`, `expression(` y las comillas.
- **Atributos** (`attributes`): `clave: valor` por línea. Solo `data-*`,
  `aria-*` y una lista corta (`title`, `role`, `lang`, `dir`, `tabindex`…).
  `on*`, `style`, `class`, `id`, `href` y `src` se rechazan en el guardado
  (`Sanitizer::html_attrs()`) y otra vez al imprimir
  (`ComponentRenders::with_user_attrs()`). Máximo 20 por bloque.

## 12. Bancos

- `tools/prueba-inspector.mjs` (77): estructura, contextualidad, acordeones con
  memoria, y la cadena entera de tipografía/borde/sombra/posición/
  transformación/atributos/CSS hasta el POST y de vuelta tras recargar.
- `tools/prueba-chrome.mjs` (31): la pantalla de cabecera y pie sobre el mismo
  núcleo, con sus envíos a `/header` y `/footer`.
- `prueba-panel` (35) y `prueba-lienzo` (36) siguen pasando: abren los grupos
  antes de escribir, como haría una persona.

---

# Parte 3 — Prioridad de estilos y el token `section`

## 13. El fallo del token: por qué `0px` lo rompía todo

El ritmo vertical de **todas** las secciones sale de una línea de `base.css`:

```css
:where(.m-c-section) { padding-block: var(--spacing-section, 96px); }
```

El `96px` del final no es «el valor por defecto»: es lo que se usa **solo si la
variable no existe**. Si en la base de datos `tokens.spacing.section` vale
`0px`, la variable existe y vale cero, el respaldo no entra, y el sitio entero
se queda sin aire. Y no se nota: el inspector de un bloque no enseña tokens, y
el panel de tokens enseña el `0px` como si alguien lo hubiera decidido.

Ningún archivo del tema escribe `0px` en ese token —se buscó en `Installer`,
`Seeder`, `ReferenceSeeder`, `PresetStore`, `TokenRepository`, `TokenCompiler`,
el panel de administración y los tres presets—. Lo que sí había es un sistema
que acepta ese valor, lo guarda y no sabe volver atrás.

**Lo que ahora existe:** `core/design/TokenDefaults.php`.

- `REQUIRED` es la única lista de «tokens sin los que el tema se ve roto», con
  su respaldo. Ese número es el mismo que el de `var(--spacing-section, 96px)`,
  y hay una comprobación que falla si dejan de coincidir.
- `is_empty()` decide qué es «aquí no hay nada»: vacío, `0`, `0px`, `0rem`,
  `none`…
- `fill()` se aplica **al leer** (`TokenRepository::get()`), así que el panel,
  el compilador de CSS y el frontend ven exactamente el mismo valor sin que
  nadie tenga que pulsar Guardar.
- `repair_once()` repara el valor en la base de datos **una sola vez**
  (marca en opciones `meridian_tokens_fix_section`) desde `maybe_upgrade()`.
  Si después se pone cero a propósito, se queda en cero: esa pasada no vuelve.
- El respaldo se busca primero en el preset activo, luego en el preset del
  tema y solo al final en la constante.

Un valor del usuario —`40px`, `72px`, `8vh`, `clamp(64px, 9vw, 132px)`— no se
toca jamás, ni al leer ni al reparar.

## 14. La prioridad: una capa, no `!important`

El problema de fondo era de arquitectura. Lo que escribe el usuario viaja en la
hoja del documento; lo que trae el tema, en tres archivos CSS. Las dos cosas
competían por **especificidad y orden**, y el tema tiene selectores de dos y
tres clases:

```css
.m-c-section[class*="is-mh-"].is-no-content { padding-block: 0 }   /* (0,3,0) */
.m-n-7f3a2b { padding-top: 50px }                                   /* (0,1,0) */
```

Ganaba el tema. La respuesta de siempre era `!important`, que soluciona esta
pelea y crea la siguiente.

Ahora las tres hojas del tema están dentro de `@layer krg { … }` y la hoja del
documento no está en ninguna capa. En CSS, **lo que no está en una capa gana a
lo que sí lo está, por especificidad que tenga**. Resultado:

- `.m-n-xxxx{padding-top:50px}` gana a cualquier regla del tema sin forzar nada;
- deja de importar el orden de carga: aunque un plugin de caché reordene las
  hojas, lo del panel sigue ganando;
- entre las tres hojas del tema no cambia nada: comparten la misma capa y el
  mismo orden de siempre;
- los `!important` que quedan en el tema son los justificados —
  `prefers-reduced-motion`, los controles nativos de vídeo, la cabecera
  transparente— y siguen funcionando: un `!important` dentro de una capa sigue
  ganando.

`is-no-content` se queda como está y sigue colapsando el **alto** configurado de
una sección vacía (que es lo que haría inmanejable el lienzo), pero ya no puede
comerse el relleno que haya escrito el usuario.

## 15. Un solo emisor

`DocumentCssCompiler::inline_styles()` copiaba el tamaño de escritorio al
atributo `style` del elemento **además** de la hoja. Dos emisores del mismo
valor: el atributo gana siempre, así que las reglas de tablet y móvil llevaban
`!important` solo para poder corregir a su propia pareja.

Ya no se usa al pintar. El único emisor es la hoja del documento, los tres
tamaños compiten en igualdad y no hay ningún `!important` en los estilos del
usuario —ni en PHP (`push_styles()`) ni en el editor (`paintLiveCss()`), que
ahora escriben exactamente lo mismo—. El atributo `style` se queda para lo que
es del bloque: `--m-sec-h`, el parallax, las variables de tema.

## 16. Bancos nuevos

- `tools/prueba-tokens.php` (32): el token inservible se detecta, se rellena al
  leer y se repara una vez; el valor del usuario nunca se toca; el panel y el
  CSS dicen lo mismo; el respaldo del CSS y el del PHP son el mismo número.
- `tools/prueba-matriz.mjs` (91): los tres anchos de sección × fondo, relleno y
  margen por los cuatro lados × escritorio/tableta/móvil × web pública,
  «Preview» y lienzo —exigiendo que los tres modos den el **mismo** número—,
  más fila, columna y módulo con caja propia, sección sin nada escrito (manda
  el token), sección vacía (cero en la web, visible y fiel en el lienzo),
  transparencia, ancho completo de borde a borde y «lo del panel gana al tema».

---

# Parte 4 — La cortina y el fondo de las secciones

## 17. Qué es el sistema cortina

Son **dos** efectos con el mismo gesto, no uno:

**Pie cortina** (`Menus::footer()['reveal'] === 'curtain'`). El pie se queda
fijo al fondo de la ventana y la página se desliza por encima hasta
descubrirlo. Piezas: la clase `is-reveal-curtain` en el `<footer>`, la clase
`m-curtain-on` que `modules.js` pone en el `<body>` **solo si el pie cabe en la
pantalla** (≤ 92 % del alto), un `div.m-curtain-spacer` que reserva el alto del
pie (`--m-footer-h`, medido en JS), y `body.m-curtain-on .m-page`, que recibe
`position:relative; z-index:1` y un fondo opaco para que el pie no se vea por
los huecos.

**Cortina por sección** (`props.curtain === 'on'` → clase `is-curtain`). La
sección se queda quieta (`position:sticky`) mientras las siguientes pasan por
encima. `modules.js` mide y añade `is-curtain-on`; si la sección es más alta
que la ventana la ancla por abajo con `--m-curtain-top` negativo. A **todos**
los hermanos posteriores les pone `m-curtain-above`, que les da
`position:relative; z-index:1`.

No usa `::before`, ni `::after`, ni elementos hijos, ni `transform`, ni
`overflow`. El fondo que se ve en una sección es el del propio `<section>`.
`--m-sec-h` no es de la cortina: es el alto a medida de la sección
(`minHeightValue` + unidad → `svh` o `px`), que `ComponentRenders` escribe en
el atributo `style` y usan las reglas `.is-mh-custom`.

## 18. Por qué el fondo elegido volvía al anterior

Porque había **dos sistemas decidiendo el fondo**, y el que ganaba era el que
no sabía nada del panel.

`modules.js` leía el fondo calculado de cada sección posterior a la cortina y,
si salía transparente, le escribía el color del `<body>` en el atributo del
elemento:

```js
next.style.setProperty("--m-curtain-bg", getComputedStyle(document.body).backgroundColor);
```

Y el CSS lo pintaba con:

```css
.m-curtain-above[style*="--m-curtain-bg"] { background-color: var(--m-curtain-bg); }
```

Dos piezas en el selector (clase + atributo) contra la **una** del panel
(`.m-n-xxxx { background-color: #3f5e58 }`). Ganaba la cortina. Y como la
decisión dependía del fondo que hubiera **en el instante de medir**, el
resultado cambiaba según cuándo se repintara el lienzo: el color aparecía un
momento y volvía el beige de la página.

Reproducido en el banco, sobre la versión anterior:

```
FALLA al instante en el lienzo: fondo rgb(254, 246, 231)   ← el beige del sitio
FALLA y sin escribirle nada encima: style="--m-curtain-bg: rgb(254, 246, 231);"
```

## 19. El arreglo

El JavaScript de la cortina ya no decide colores. Mide geometría —que es lo
suyo— y marca con una clase. El fondo opaco de respaldo lo pone el CSS, una
sola declaración, siempre la misma:

```css
.m-curtain-above:not([class*="is-theme-"]) {
  background-color: var(--m-curtain-bg, var(--color-background, #fff));
}
```

Como vive en `@layer krg` y la hoja del documento no vive en ninguna capa,
**cualquier fondo configurado le gana**, sin `!important` y sin depender del
orden de carga ni del instante de la medida. `--m-curtain-bg` se conserva como
punto de entrada para quien quiera otro color de respaldo, y al re-arrancar se
limpia el que hubieran dejado versiones anteriores. El pie cortina pierde su
`paintPage()` por el mismo motivo: `body.m-curtain-on .m-page` ya tenía el
mismo respaldo en CSS.

## 20. El banco que no veía nada

`tools/render-doc.php` servía la página **sin los tokens y sin el JavaScript
del tema**. Dos agujeros que escondían justo esta clase de fallo: sin tokens,
`--color-background` no existe, el `body` sale transparente y la cortina no
encuentra color que escribir; sin `modules.js`, la cortina directamente no
existe. Ahora el banco sirve lo mismo que WordPress: tokens compilados, las
tres hojas del tema, la hoja del documento, `public.js` y `modules.js`.

Con los tokens puestos salió además una verdad que el banco tapaba: un módulo
con tema (`is-theme-forest`) **sí** pinta encima de la sección. No es un fallo
—es lo que significa poner tema a un bloque— y el inspector ya lo avisa y
ofrece pintar el bloque de un clic. Las pruebas 10 y 11 de `prueba-lienzo`
daban por bueno lo contrario y se han corregido.

## 21. Bancos nuevos

- `tools/prueba-cortina.mjs` (83): siete tipos de sección detrás de una sección
  cortina, con el JavaScript real cargado.
- `tools/prueba-motor.mjs` (41): el protocolo completo en el editor —configurar,
  mirar, esperar al guardado automático **y a la recarga del marco**, volver a
  mirar, recargar el editor entero y mirar otra vez— sobre dos secciones
  distintas y en los tres tamaños.

---

# Parte 5 — El fondo que se veía, se guardaba «bien» y volvía atrás

## 22. El síntoma, tal y como llegó

Una sección con alto a medida (90 % de la pantalla) y un CTA dentro. Se elige
el color de fondo: **el lienzo se pone verde**. Se guarda. El marco se recarga
y la sección vuelve a beige, con el CTA pintado de verde en una franja en
medio. **Y el campo del inspector sigue diciendo `#3f5e58`.**

Tres turnos de diagnóstico se fueron detrás de la hipótesis equivocada —la
cortina, la especificidad, la caché— porque el síntoma encaja con todas. Lo
que cerró el caso fue el propio informe de **Avanzado → Revisar este bloque**:

```
1. Estado del editor: []
6. No hay ningún estilo puesto en este tamaño: no hay nada que comprobar.
```

`[]`, no `{}`. El bloque **no tenía ningún estilo guardado**. No había que
buscar quién pisaba el color: el color nunca salió del navegador.

## 23. La causa: PHP no distingue lista de diccionario, JSON sí

En PHP, un array vacío es las dos cosas a la vez. `wp_json_encode` tiene que
elegir, y elige lista:

```php
$bp = [ 'desktop' => [], 'tablet' => [], 'mobile' => [] ];
wp_json_encode( $bp );   // {"desktop":[],"tablet":[],"mobile":[]}
```

El panel recibía un **array** donde esperaba un objeto. Y en JavaScript eso no
falla: falla al guardar.

```js
const a = [];                       // lo que llegó de PHP
a["background-color"] = "#3f5e58";  // lo que escribió el panel
a["background-color"]               // → "#3f5e58"   (el campo lo enseña)
Object.keys(a)                      // → ["background-color"]  (el lienzo lo pinta)
JSON.stringify(a)                   // → "[]"        ← aquí se pierde
```

`JSON.stringify` **descarta las propiedades con nombre de un array**. El valor
viajaba hasta el borde de la red y se evaporaba sin un solo error, en ninguna
capa. Por eso se veía en el lienzo (que pinta desde la memoria), seguía en el
inspector (que lee de la memoria) y no estaba en la base de datos.

Y por eso el mismo fallo afectaba a **relleno, margen, tipografía, borde,
sombra y a `props`**: a todo lo que cayera en un bucket que hubiera llegado
vacío. Un nodo que ya tenía algún estilo funcionaba perfectamente —su bucket
era un objeto de verdad—, lo que explica que el sistema pareciera funcionar a
ratos.

## 24. El arreglo, en los dos extremos

**Navegador** (`builder-core.js`, lo que arregla los documentos ya guardados):
`dict()` convierte el array en objeto conservando lo que le hubieran colgado, y
`adoptDoc()` recorre el documento entero en cuanto entra en el editor. Los tres
puntos de entrada —carga inicial, respuesta del guardado y revisión
restaurada— pasan por ahí, en `builder.js` y en `chrome.js`.

**Servidor** (`Sanitizer::styles()` y `BoxStyles::migrate_node()`): un tamaño
sin nada ya no se guarda como `[]`, se omite. El JSON deja de mentir.

No hace falta tocar nada más: ni la hoja del documento, ni la especificidad, ni
la caché, ni el orden de carga. Todo eso ya estaba bien.

## 25. Por qué catorce bancos en verde no vieron nada

El servidor falso de `prueba-motor.mjs` devolvía **tal cual** lo que el
navegador le mandaba, y sus documentos de prueba traían `styles: {desktop: {}}`
escrito a mano en JavaScript: objetos de verdad desde el principio. El banco
no podía ver el fallo porque no reproducía ni la forma del JSON ni el saneador.

Ahora `tools/sanear.php` pasa cada POST por `Sanitizer::document()` +
`BoxStyles::migrate_document()` + `wp_json_encode`, igual que WordPress, y el
banco comprueba **el cuerpo del POST**, no sólo lo que se ve:

```
FALLA el fondo viaja en el guardado: null
FALLA y SIGUE ahí tras guardar y recargar el marco: rgb(254, 246, 231)
```

Eso es lo que da el código anterior. Con el arreglo, 58/58.

**Regla que queda:** un banco que simula el servidor no prueba el guardado.
Si el servidor falso no corre el código del servidor de verdad, lo único que
se está probando es que el navegador habla consigo mismo.

## 26. «Estirar» servía para tres módulos de sesenta

Al elegir «Alineación vertical: estirar», sólo crecían `.m-sp`, `.m-bh` y
`.m-map`. Con cualquier otro bloque el control no hacía nada visible. Además
el lienzo del constructor **ni siquiera sincronizaba la clase**: la lista de
`is-va-*` tenía `start`, `center` y `end`, y `stretch` faltaba.

Ahora estira cualquier bloque, y hay un segundo eje —**«Contenido dentro del
bloque estirado»**, arriba / centro / abajo— porque un bloque que ocupa todo
el alto necesita decir dónde va su contenido.

Tres detalles que costaron:

1. **No se convierte el bloque en flex.** Fue la primera versión y la tumbó el
   banco: volver flex una raíz que era bloque cambia el flujo horizontal de
   sus hijos (un botón centrado en línea pasa a ocupar todo el ancho; un texto
   con `margin: 0 auto` se encoge). Se usa `align-content`, que reparte el alto
   sobrante sin tocar el flujo. En un navegador que aún no lo soporte el bloque
   se estira igual y el contenido se queda arriba: exactamente como estaba.
2. **La fila escribe su `align-items` en la hoja del documento**, que no está
   en ninguna capa y le gana a cualquier regla del tema. Había que propagar el
   estirado por el árbol en `DocumentCssCompiler`.
3. **`align-items` no bastaba.** La fila es una rejilla: el elemento se estira
   dentro de *su pista*, y la pista seguía midiendo lo que el contenido. Hacía
   falta `align-content: stretch` para que la pista llenara la rejilla.

`tools/prueba-estirar.mjs` renderiza **los 47 módulos del registro** dos veces,
con y sin estirar, y compara su reparto horizontal interno. Si algún módulo se
desmonta por dentro, salta.

## 27. Bancos nuevos y ampliados

- `tools/prueba-estirar.mjs` (18): los 47 módulos estirados y sin estirar, las
  tres posiciones del contenido, dos columnas que no deben desalinearse.
- `tools/prueba-motor.mjs` (41 → **58**): servidor falso con el saneador real,
  comprobación del **cuerpo del POST** y el ciclo completo de «Estirar».
- `tools/sanear.php`: el saneador de verdad a disposición de los bancos.

---

# Parte 6 — La carta, como un árbol

## 28. El problema: dos listas planas y un folio de scroll

El inspector pintaba `categories` y `items` como dos repetidores
independientes, todo abierto a la vez. Con cuatro categorías y veinte platos
eso son cientos de píxeles de scroll, y para saber qué hay en «Postres» había
que leerse los veinte platos y mirar el desplegable de cada uno.

## 29. La decisión: cambiar la vista, no los datos

`categories` sigue siendo una lista plana y cada plato sigue llevando su campo
`category`. **Ninguna carta existente se migra y el frontend no se entera.**
El árbol es sólo otra forma de enseñar los mismos datos: el `data-i` de cada
control es el índice real en la lista plana, así que los manejadores de
siempre (`data-rep`, `data-rep-move`, `data-rep-del`…) siguen valiendo tal
cual, sin duplicar lógica.

Tres niveles:

```
▾ DESAYUNOS                    2   ↑ ↓ ⧉ ✕     ← categoría (categories[ci])
  │ Nombre de la categoría
  │ ▾ Huevos benedictinos  24.9  +4  ↑ ↓ ⧉ ✕   ← plato (items[i])
  │   │ Nombre, descripción, precio, categoría, foto…
  │   │ ▾ ADICIONES              4             ← items[i].addons[j]
  │   │   Huevo frito (x2)      10.9      ↑ ↓ ✕
  │   │   + Añadir adición
  │ + Añadir plato a «DESAYUNOS»
+ Añadir categoría
```

El contador de cada rama (`2`, `+4`) existe para no tener que abrirla: dice
cuántos platos tiene la categoría y cuántas adiciones el plato.

## 30. Lo que había que no perder

Un plato con una categoría que ya no existe (porque se renombró o se borró)
**no desaparece**: cae en un grupo final «Sin categoría» con el aviso de qué
hacer. Antes seguía en la lista larga, invisible entre los demás, y en la web
pública se renderiza igual — es decir, estaba publicado y no se podía
encontrar. El banco lo comprueba.

## 31. Adiciones

Nuevas, en tres sitios:

- **Datos:** `items[i].addons[] = { name, price }`. No hizo falta tocar el
  saneador: `Sanitizer::field()` ya se llamaba a sí mismo cuando un subcampo
  es un repetidor. Lo que no existía era la forma de escribirlo.
- **Panel:** `subListHtml()` pinta la lista dentro del ítem en dos columnas
  (nombre y precio), porque una adición no es una ficha: es una línea. Es
  genérico, así que cualquier módulo puede anidar una lista a partir de ahora.
- **Web:** `menu_addons()` imprime un `<ul>` dentro del `<li>` del plato, con
  su título. Va **fuera** del enlace del plato: es información, no parte de lo
  que se pulsa. El título se configura por bloque (`addonsLabel`).

## 32. Banco

`tools/prueba-carta.mjs` (23). No comprueba que el HTML tenga buena pinta;
comprueba que los datos sobreviven: que cada plato sale bajo su categoría y
sólo bajo la suya, que el huérfano no se pierde, que plegar **no** marca el
documento como modificado, que «Añadir plato a Postres» lo crea ya en Postres,
y que una adición escrita a mano **viaja en el cuerpo del POST**, vuelve tras
recargar el editor y aparece en la página pública.

---

# Parte 7 — Plegar de verdad, adiciones generales y paneles que se quitan de en medio

## 33. El plegado cambiaba el signo y no plegaba nada

El árbol marcaba la rama como cerrada, ponía el atributo `hidden` y
cambiaba el `−` por un `+`… y el cuerpo seguía ahí. La causa:

```css
.tree-b { display: grid; }     /* mío */
[hidden] { display: none; }    /* del navegador */
```

`hidden` es un atributo y el `display:none` que lo acompaña lo pone la hoja
del **navegador**. Cualquier `display` escrito en la hoja del **autor** le
gana, pase lo que pase con la especificidad: el origen manda primero. Una
línea lo arregla:

```css
.tree-b[hidden] { display: none; }
```

El repo ya tenía el mismo caso resuelto así en `modules.css` para
`.m-carta-item[hidden]`, que es lo que usa el filtro de las pestañas.

**Y el banco lo daba por bueno.** Comprobaba `cuerpo.hidden`, que es la
propiedad: estaba puesta, luego verde. Ahora mide el alto real:

```
FALLA y DEJA DE VERSE de verdad: el cuerpo mide 1681px
```

Tercera vez en este proyecto que una aserción pregunta por el estado y no
por lo que se ve. **Preguntar por el atributo no es comprobar nada.**

## 34. Adiciones de la categoría

Las de un plato ya estaban; faltaban las generales —el bloque ADICIONES que
vale para todos los desayunos—. Se añaden a `categories[]` con la misma
forma (`{name, price}`), y en la página salen así:

- **Bloques separados:** cierran la categoría, a lo ancho, tras sus platos.
- **Pestañas:** entran en la rejilla como un `<li>` más con su `data-cat`,
  de modo que **el filtro que ya existía las enseña y las esconde sin una
  sola línea de JavaScript nueva**.

En el panel aparecen solas: `subListHtml()` es genérico y `categories` es un
repetidor como cualquier otro. Se pintan después de los platos, igual que
salen en la página.

## 35. Los dos paneles: esconder y ensanchar

El izquierdo ya se arrastraba, el derecho no. Ahora los dos van por la misma
función (`PANELES` en `builder.js`): mismo tope (220–620 px), misma memoria
en `localStorage`, misma forma de esconderse. Botones **Estructura** y
**Ajustes** en la barra, doble clic en el tirador como atajo, y un raíl
pegado al borde para traer de vuelta el panel escondido.

Dos cosas que sólo se ven midiendo, y que el banco pilló:

1. **La rejilla recolocaba sola a los hijos.** Al esconder un panel sus cajas
   desaparecen y el lienzo se iba a la columna 1: **24 px de ancho**. Cada
   hijo lleva ahora su `grid-column` explícito. Esto además arregla el editor
   de cabecera y pie, que usa la misma rejilla con un hijo menos.
2. **Dos botones más en la barra ensanchaban la aplicación entera** y el
   panel derecho se salía de la pantalla. La barra ahora se recorta por
   dentro (`overflow-x`) en vez de empujar el ancho de todo.

## 36. Por qué los botones «no se dejaban»

El usuario dijo que los paneles seguían sin esconderse a gusto. El banco
decía 36/36. Los dos tenían razón: **el banco montaba el constructor en una
página vacía y el constructor de verdad vive dentro del admin de
WordPress**, con un menú lateral que se come 160 px.

Con esos 160 px menos la barra de arriba no cabe, y yo le había puesto
recorte interno (`overflow-x:auto`) con la barra de scroll oculta
(`scrollbar-width:none`). Resultado: los botones existían, respondían y
estaban **fuera de la pantalla**, sin nada que lo delatara.

```
FALLA la barra de arriba no esconde botones por el lado
FALLA los 4 botones de plegar se ven y se alcanzan: left/barra✔ right/barra✔
```

Tres cambios:

1. **La barra se parte en varias líneas** (`flex-wrap`) en vez de recortarse.
   `grid-template-rows: auto 1fr` para que pueda crecer. Nada queda nunca
   fuera de alcance.
2. **Un botón de plegar en el borde de cada panel** (`‹` y `›`, dentro del
   propio tirador), que es donde se busca y no depende de que la barra tenga
   sitio. Pulsarlo no arranca un arrastre.
3. `max-width: 100%` en vez de `100vw`: el constructor mide lo que su hueco
   en el admin, no lo que el monitor.

**El banco ahora monta el armazón del admin** —`#wpwrap > #wpcontent` con su
margen de 160 px— y comprueba que todo cabe, que la barra no recorta y que
los cuatro botones de plegar se ven y se alcanzan. Verificado al revés:
con el código anterior, esas aserciones fallan.

**Regla:** un banco que no reproduce el contenedor real no prueba la
interfaz, sólo el componente. Es la misma lección del servidor falso que
no corría el saneador.

## 37. Pendiente, no tocado

En el banco de pruebas, si se **recarga** el editor en el sitio (`reload`) en
vez de abrirlo de nuevo, pulsar un bloque en el árbol de estructura no lo
selecciona. **Pasa igual con el código anterior a estos cambios** —se
comprobó volviendo a `HEAD`—, así que no es una regresión de esta tanda y se
deja anotado para mirarlo aparte.


---

# Parte 8 — La carta: «Todo» limpio, precios con moneda y fotos del plato

## 38. «Todo» enseña platos, no adiciones

**Lo que pedía el encargo:** en la pestaña «Todo» no puede salir ninguna
adición —ni las de un plato ni las de una categoría—; solo platos. Las
adiciones viven en la pestaña de su categoría.

El filtro de pestañas ya existía (`initMenuList`) y se limitaba a comparar
`data-cat`. En «Todo» (`*`) enseñaba *todo*, incluidos los bloques de
adiciones de categoría, que viajan dentro de la rejilla como un ítem más.

**Arreglo, en el filtro que ya había:**

- Los ítems `.is-addons` (adiciones de categoría) se esconden cuando el
  filtro es `*`, y además dejan de contar para el mensaje de «no hay
  platos»: no son platos.
- El JS marca la carta con `is-todo`, y una sola regla esconde las
  adiciones de cada plato:
  `.m-carta.is-todo .m-carta-item > .m-carta-addons { display: none }`.

Sin pestañas (carta en bloques) la clase no se pone nunca, así que ese modo
queda exactamente como estaba. Ni datos nuevos, ni marcado nuevo, ni un
segundo sistema de filtrado.

## 39. El símbolo de la moneda lo pone la carta

El usuario escribe `24.9` y la página muestra `$24.9`. Lo pone el
renderizador, no el panel, para que nadie tenga que teclearlo ni recordarlo,
y para que cambiar de símbolo sea un campo y no una revisión de cien precios.

`BrandRenders::menu_price()` se aplica al precio del plato **y** a los de las
adiciones. Reglas:

- Campo vacío → sigue vacío (no aparece un `$` suelto).
- Si el texto ya empieza por algo que no es un número (`$`, `€`, `COP`) o
  lleva letras (`Gratis`, `s/n`) → se deja tal cual. **Nunca sale `$$`.**
- El símbolo es editable (`currency`, por defecto `$`); en blanco, no se
  pone ninguno.

## 40. Las fotos del plato se abren en grande

**Datos:** cada plato gana `photos`, una sublista con la **misma forma que la
galería del tema** (`imageId` / `imageUrl` / `alt`). No hay tipo de campo
nuevo ni almacenamiento nuevo: `Sanitizer::field()` ya recorre repetidores
anidados, así que el guardado funcionaba antes de escribir una línea.

**Inspector:** dentro de cada plato, una rama «Fotos del plato» que enseña
miniaturas —no IDs— con flechas para ordenar, ✕ para quitar y un campo de
texto alternativo por foto. El botón «Añadir fotos» abre la mediateca en modo
múltiple: se eligen seis de una vez. Reutiliza los manejadores que ya había
(`data-sub-move`, `data-sub-del`, `data-sub` para el alt); lo único nuevo es
`data-sub-fotos`.

**Página pública:** la foto del plato pasa a ser un `<button>` con la imagen
dentro y las fotos en un `<template>`. El `<template>` es inerte: **el
navegador no descarga esas imágenes hasta que se abre el visor**, así que un
plato con seis fotos no pesa más que uno con una. Si el plato no tiene fotos
extra, se amplía la suya.

El visor es un `<dialog>` modal —el mismo patrón que el de las reseñas—, así
que el foco queda atrapado, `Escape` cierra y el fondo queda inerte sin una
línea de JS de accesibilidad. Lleva flechas, teclado (← →), miniaturas,
contador «2 / 3», arrastre lateral en el móvil, y el nombre, el precio y la
descripción del plato debajo. Con una sola foto no pinta flechas ni
miniaturas.

Dos detalles que eran trampas:

- **Un `<button>` no puede ir dentro de un `<a>`.** Si el plato tiene enlace
  *y* foto ampliable, el enlace envuelve solo el texto y la foto se queda
  fuera. Antes el marcado habría sido inválido.
- **En el lienzo del constructor no se pinta el botón**: ahí pulsar una foto
  tiene que seleccionar el módulo, no abrir una ventana.

## 41. De paso: las adiciones del plato ya no compiten por la fila

Las adiciones son hermanas del cuerpo dentro de un `li` en `flex`, así que
se colocaban como una tercera columna. Ahora el plato envuelve
(`flex-wrap`) y las adiciones ocupan la línea entera, sangradas al ancho de
la foto. Es el mismo marcado; solo el CSS que faltaba.

## 42. Pruebas

`tools/prueba-carta.mjs` pasa de 43 a **87** comprobaciones. Las nuevas
cubren los tres encargos en la página de verdad (render público completo con
su CSS y su JS, fotos servidas por la red del banco):

- «Todo»: 4 platos, 0 adiciones de plato, 0 bloques de categoría; en
  «Desayunos» vuelven las dos; volver a «Todo» las esconde otra vez.
- Moneda: los cuatro precios y los tres de adiciones salen con `$`, el
  `24.9` del usuario se ve `$24.9` y nunca hay `$$`.
- Visor: se abre, es modal de verdad (`:modal`), trae las 3 fotos con nombre
  y precio, flechas, teclado, vuelta circular, miniaturas, `Escape`, ✕, el
  caso de una sola foto y el `<template>` que no descarga nada.
- Inspector: la rama de fotos con su cuenta, sus miniaturas y su alt.
- Guardado: el saneador conserva las tres fotos con su id y su alt.
- Lienzo: ahí **no** hay botón de ampliar.

Verificado al revés: con los seis archivos anteriores (`git checkout
origin/<rama>`), **11 de esas comprobaciones fallan**.

Barrido completo tras el cambio: lint 61 · guardado 63 · tokens 32 ·
estilos 82 · panel 35 · lienzo 37 · matriz 91 · caja 72 · inspector 77 ·
chrome 31 · cortina 83 · motor 58 · estirar 18 · **carta 87** · vacías ·
preview. Todo en verde.

**Nota de herramientas:** `tools/wp-shim.php` no tenía
`wp_get_attachment_image()`, así que ningún banco podía usar un plato con
foto sin morir. Ya está. Es la misma clase de hueco de siempre: un banco que
no puede representar el caso, no lo prueba.


---

# Parte 9 — La carta, segunda vuelta

## 43. Las adiciones de una categoría salían en TODAS las pestañas

Era el fallo de verdad detrás de «que se muestren en la pestaña que les
toca». El filtro de pestañas sí marcaba el bloque con `hidden`; lo que
pasaba es que no servía de nada:

```css
.m-carta-item[hidden]       { display: none; }   /* línea 2126 */
.m-carta-item.is-addons     { display: block; }  /* línea 2233 */
```

Misma especificidad (0,2,0) y la segunda va después, así que **ganaba
`display:block`**: el bloque de adiciones de «Desayunos» seguía a la vista
estando en «Postres». La prueba anterior no lo cazó porque solo miraba
«Todo» y «Desayunos», y en «Todo» el bloque *parecía* escondido por otro
motivo (se le vaciaba el contenido).

Arreglo, sin `!important`: una regla **después** y con más peso,
`.m-carta-item.is-addons[hidden]` (0,3,0). Es la misma lección de siempre:
`hidden` es un atributo, y cualquier `display` de autor le gana.

Ahora el banco recorre las pestañas: en «Desayunos» solo salen las de
desayunos, en «Postres» solo las de postres, en «Todo» ninguna, y tampoco
se cuelan las adiciones del plato de otra categoría.

## 44. El plato con foto, ordenado en cualquier ancho

Al meter una foto, el nombre y la descripción se caían a la línea de abajo
y el plato quedaba desordenado (foto arriba, texto debajo, a todo lo ancho).
Lo había provocado el `flex-wrap: wrap` que se añadió para las adiciones:
con `flex: 1 1 auto` / `width: 100%`, el texto pide su ancho natural y
envuelve.

Lo que tiene que envolver son **las adiciones**, nunca el texto:

```css
.m-carta-item > .m-carta-link,
.m-carta-item > .m-carta-body { flex: 1 1 0; width: auto; min-width: 0; }
.m-carta-item > .m-carta-addons { flex: 1 0 100%; }
```

Base `0` en vez de `auto`: el texto encoge en lugar de empujar. Resultado,
el orden que pedía el encargo —foto a la izquierda, nombre y precio en la
misma línea, descripción debajo y adiciones sangradas al ancho de la foto—
y se comprueba midiendo a 1600, 834 y 390 px.

## 45. El visor, completo

- **Las adiciones del plato entran en el visor.** Se copia el bloque que ya
  pinta la carta (`cloneNode`), así que no hay un segundo sitio donde
  escribirlas ni se le puede olvidar un precio ni el símbolo.
- **Deslizar con el dedo** de verdad: `touch-action: pan-y` para que el
  navegador no se quede el gesto horizontal, captura de puntero, y el
  arrastre solo cuenta si recorre más de 40 px **y** es más horizontal que
  vertical —bajar la página sigue bajando la página—. Se cancela el
  arrastre nativo de las imágenes, que partía el gesto.
- Las flechas del teclado ya estaban y siguen: ← → con vuelta circular.

## 46. Pruebas

`tools/prueba-carta.mjs`: **87 → 106**. Nuevas: adiciones por pestaña (las
tres combinaciones), adiciones dentro del visor con su precio, deslizar a
izquierda y derecha, el roce corto que no debe cambiar de foto, el gesto
vertical que tampoco, y la maquetación del plato con foto en escritorio,
tableta y móvil.

Verificado al revés con `krg-cms/assets/{css/modules.css,js/modules.js}` de
la versión anterior: las comprobaciones de pestañas fallan («en «Postres»
NO se cuelan las de Desayunos: desayunos, postres») y la del visor revienta
porque no existe el hueco de las adiciones.

Barrido completo en verde: lint 61 · guardado 63 · tokens 32 · estilos 82 ·
panel 35 · lienzo 37 · matriz 91 · caja 72 · inspector 77 · chrome 31 ·
cortina 83 · motor 58 · estirar 18 · **carta 106** · vacías · preview.


---

# Parte 10 — Editar sin perder el sitio

## 47. Por qué saltaba al principio

Al pulsar «Añadir adición» —o cualquier cosa que repinte el inspector— la
lista volvía al principio. Lo primero fue mirar **qué** se movía, porque en
las capturas del usuario el panel derecho no se había movido ni un píxel:
los campos de abajo («Título de las adiciones», «Símbolo de la moneda») se
veían exactamente igual antes y después.

Lo que se movía era la caja de dentro. El árbol de la carta tiene su propia
barra:

```css
.b-tree { max-height: 42vh; overflow: auto; }
```

`panelSnap()` ya guardaba la posición de los dos paneles, y por eso el panel
no saltaba. Pero el panel **es el mismo elemento** entre repintados, así que
el navegador le conserva la posición casi siempre; el árbol, en cambio, es
un elemento **nuevo** cada vez (`innerHTML`), y un elemento nuevo nace en
cero. No había nada que recuperar porque nadie lo había guardado.

## 48. Arreglo: guardar todo lo que esté desplazado, no solo el panel

Dos ayudantes en `builder-core.js` —el núcleo que ya comparten la pantalla
de páginas y la de cabecera y pie, para no hacer dos copias—:

- `scrollSnap(raíz)` recorre la rama y apunta la posición de **cada** caja
  desplazada, con una referencia estable: `data-tree` si la tiene (así
  sobrevive aunque al repintar sobre o falte un hijo) y, si no, su camino
  por posición.
- `scrollRestore(raíz, lista)` las devuelve a su sitio.

`panelSnap()`/`panelRestore()` los usan para los dos paneles, y
`chrome.js::paintInspector()` hace lo mismo. **Sin un segundo sistema:** es
el mecanismo que ya existía, ampliado.

De paso, al añadir una adición **el cursor cae en el campo nuevo**, listo
para escribir. Y si esa fila queda justo fuera de la caja, se empuja a mano
lo mínimo y **solo la caja del árbol**: `scrollIntoView()` mueve todos los
contenedores de arriba, y ese era precisamente el salto que molestaba —se
probó, movía el panel 177 px, y se descartó.

## 49. El banco de cabecera y pie no cargaba los estilos

Al escribir la prueba equivalente para `chrome.js` apareció otra vez el
agujero de §36: **ese banco montaba el panel sin una sola hoja de estilos**,
así que `.b-right` no tenía ni altura ni barra y cualquier medida de
desplazamiento daba cero. Ahora monta `admin.css` + `builder.css` dentro del
armazón del admin, como el de la carta.

Dicho con todas las letras: en cabecera y pie el arreglo es **un seguro**,
no una corrección de algo roto. Ahí el inspector no tiene cajas con barra
propia y el panel exterior conservaba la posición solo. La prueba de esa
pantalla pasa también con el código anterior; la que demuestra el fallo y su
arreglo es la de la carta.

## 50. Pruebas

`prueba-carta` **106 → 113**, `prueba-chrome` **31 → 33**:

- el árbol se puede desplazar por dentro;
- tras «Añadir adición» se queda donde estaba (± 2 px) y el panel no se
  mueve ni un píxel;
- el cursor cae en la fila nueva y la fila nueva se ve;
- añadir un plato y borrar una adición tampoco mueven nada;
- y en cabecera y pie, repintar no mueve el panel.

Verificado al revés con `builder.js` de la versión anterior:
**«tras Añadir adición la lista se queda donde estaba: 1077 → 0px»** —
exactamente lo que contaba el usuario— y el foco se quedaba en `BODY`.

Barrido completo en verde: lint 61 · guardado 63 · tokens 32 · estilos 82 ·
panel 35 · lienzo 37 · matriz 91 · caja 72 · inspector 77 · **chrome 33** ·
cortina 83 · motor 58 · estirar 18 · **carta 113** · vacías · preview.


---

# Parte 11 — El fondo del «CTA display»

## 51. Qué había y qué faltaba

Antes de tocar nada: el bloque **ya tenía** «Imagen de fondo» y la foto
**ya cubría** el bloque entero —se midió: capa, foto y bloque dan la misma
caja, 1240×451 en una sección con sangrado y la pantalla completa en una a
todo lo ancho—. Lo que no existía era el **parallax** y los **modos de
fusión**, y faltaban dos controles de encuadre.

Lo añadido:

| Campo | Grupo | Qué hace |
|---|---|---|
| `bgFit` | Diseño | `cover` (cubre, recorta lo que sobre) o `contain` (la enseña entera) |
| `bgPosition` | Diseño | qué parte manda al recortar: centro, arriba, abajo, izquierda, derecha |
| `blend` | Colores | 14 modos de fusión con el color de fondo del bloque |
| `parallax` + `parallaxZoom` + `parallaxAmount` + `parallaxInvert` | Diseño | los mismos cuatro de la galería, con los mismos nombres y rangos |

## 52. Parallax: el mismo motor, no otro

`public.js` ya tenía un motor de parallax que lee `data-parallax-zoom`,
`-amount` y `-dir` de la caja y `--m-px-zoom` para la ampliación de partida.
Se le añadieron **dos líneas**: el selector incluye `.m-sc.is-parallax`, y
`pxImgs()` devuelve `.m-sc-bg` para este bloque —si devolviera todas las
imágenes movería también los iconos del titular, que se comprueba que
siguen quietos—.

En PHP, los atributos del parallax estaban **copiados dos veces** (imagen y
galería). A la tercera se consolidaron en
`ComponentRenders::parallax_attrs()`, que ahora usan los tres. Verificado
que la salida de imagen y galería es la misma que antes: solo cambia el
orden del atributo `style` respecto a los `data-*`, ninguna declaración.

## 53. Fusión: dónde va la `mix-blend-mode`

La trampa: `.m-sc-media` lleva `z-index:-1` para quedarse detrás del texto,
y **un elemento posicionado con z-index crea su propio contexto de
apilado**. Una `mix-blend-mode` puesta en la imagen solo se mezclaría con su
capa —transparente— y no haría absolutamente nada; se vería igual con
`multiply` que sin él.

Va, por tanto, **en la capa** (`.m-sc-media`), cuyo telón sí es el fondo del
bloque gracias al `isolation: isolate` que `.m-sc` ya tenía. Así `multiply`
tiñe la foto con el color del bloque y `luminosity` la deja en blanco y
negro sobre ese color. La veladura entra en la mezcla: con ella a 0 % se ve
la fusión pura.

## 54. En el lienzo, al momento

`paintLiveCss()` gana una rama para `statement-cta` —hermana de la que ya
tenía la galería— que escribe `--m-sc-fit`, `--m-sc-pos`, `--m-sc-blend`,
la opacidad de la veladura y la clase `is-parallax` **en el elemento**. En
el elemento y no en la hoja en vivo porque el servidor también las pinta en
línea, y un estilo en línea le gana a cualquier hoja.

## 55. Pruebas

Banco nuevo, `tools/prueba-cta.mjs` (**34**), porque esto es un bloque con
CSS, JS y panel y no cabía en ninguno de los otros:

- la capa y la foto miden exactamente lo que el bloque, y en una sección a
  todo lo ancho eso es la pantalla entera;
- `contain` y el anclaje salen del panel (`object-fit` / `object-position`
  calculados);
- `multiply`, `screen` y `luminosity` llegan al navegador; un valor
  inventado vuelve a `normal`; sin foto no se pinta capa;
- el parallax marca la clase, pasa los tres ajustes, **mueve la foto al
  rodar** y deja los iconos quietos; invertir cambia el signo del
  desplazamiento al mismo scroll;
- el panel ofrece los campos donde se buscan (fusión en «Colores»), el
  lienzo lo enseña sin guardar, y lo tocado viaja en el POST y vuelve tras
  recargar el editor.

Verificado al revés con los seis archivos de la versión anterior: **12
comprobaciones fallan** (encaje, anclaje, las tres fusiones y todo el
parallax).

Barrido completo en verde: lint 61 · guardado 63 · tokens 32 · estilos 82 ·
panel 35 · lienzo 37 · matriz 91 · caja 72 · inspector 77 · chrome 33 ·
cortina 83 · motor 58 · estirar 18 · carta 113 · **cta 34** · vacías ·
preview.
