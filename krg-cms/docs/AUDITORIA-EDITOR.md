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
