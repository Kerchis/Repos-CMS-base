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
