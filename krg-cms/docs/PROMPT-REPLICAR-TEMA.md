# Prompt para construir KRG CMS desde cero (especificación 1.13.16)

Copia **todo** el bloque entre las dos líneas `---`.  
Al final pega **solo** marca, paleta y adjunta los 4 archivos del tema.  
**No hay zip ni carpeta `krg-cms`.** El agente construye el tema entero a partir de este texto.

---

# CONSTRUYE KRG CMS DESDE CERO

Eres un agente que **implementa un tema WordPress completo** llamado **KRG CMS**: CMS + constructor visual + design system. El administrador construye páginas, blog, identidad y navegación **sin tocar código**.

**No te den (ni pidas) un zip, un tema `krg-cms` ni un motor previo.** Este prompt **es** la especificación. Genera todos los archivos. Lo único extra que el usuario pega al final son **colores** y **4 archivos de un tema de referencia** (tokens/layout). Úsalos **solo** para el preset de identidad (tokens CSS, ritmos, radios). **No** copies su motor de páginas, ni Gutenberg, ni un page builder comercial.

Versión del producto a alcanzar: **1.13.16**. PHP 8.1+, WordPress 6.4+. Entrega: carpeta de tema `krg-cms/` lista para `wp-content/themes/krg-cms/`.

Si un archivo de referencia del usuario tiene un componente/bloque **igual** a uno del catálogo de abajo, **no dupliques el slug**. Mapea al componente CMS. Si hace falta variante de marca: slug `{marca}-{rol}` y etiqueta «Hero Novamix», nunca el mismo nombre en la paleta.

## Prohibido

- Elementor, Divi, WPBakery, Beaver, Bricks, Visual Composer, builders comerciales, SaaS obligatorio.
- Gutenberg como motor de páginas (off en `page`). Motor propio JSON: página → secciones → filas → columnas → componentes.
- Pedir o esperar un zip / carpeta base del CMS.
- Hardcodear hex de marca en CSS de componentes. Todo `var(--color-*)` / `var(--font-*)`.
- Copy real del cliente dentro de PHP de componentes (solo placeholders en `defaults`).
- UI fake: cada botón add/delete/save/publish/color/blog persiste.
- Fatals o stack traces en la UI. Errores al admin en **español humano**.
- Implementar “todo a la vez” sin que lo anterior funcione: fases, pero el **alcance final** es todo este documento.
- Insertar formularios Everest o mapas vía Gutenberg.

## Identidad de código vs visible

- Visible: **KRG CMS**. Menú, `?page=krg*`, REST `krg/v1`, preview `krgcms_preview`, HTML `krg-admin` / `krg-builder`. Text Domain `krg-cms`. Nunca mostrar “Meridian”.
- Interno permitido: namespace PHP `Meridian\`, opciones `meridian_*`, caps `meridian_*`, meta `_meridian_*` (compatibilidad).
- Theme header `style.css`: Theme Name **KRG CMS**, Version 1.13.16, Requires PHP 8.1, Requires at least 6.4.

---

## Fases (todas obligatorias al final)

1. Tema arranca, menú KRG CMS, permalinks, caps, Gutenberg off en pages.  
2. Tokens + identidad + asistente. Paleta del usuario → preset inicial.  
3. REST páginas + constructor (árbol, paleta, iframe, guardar POST, publicar).  
4. Inspectores (contenido/diseño/avanzado) + align + live CSS.  
5. Catálogo completo de componentes (tabla de abajo) con render público.  
6. Header/footer visual, navegación, blog, SEO, usuarios, configuración + caché.  
7. Media avanzada: imagen fill/parallax, galería, video, Everest, maps, cards picker.

No des por cerrado el producto si falta cualquier ítem de “Criterio de aceptación”.

---

## Árbol de archivos (créalo)

```
krg-cms/
  style.css
  functions.php          → require core/bootstrap.php
  header.php footer.php index.php page.php front-page.php
  home.php single.php archive.php search.php searchform.php 404.php
  core/constants.php bootstrap.php autoload.php CoreHooks.php PublicAssets.php
  core/admin/{Assets,Capabilities,Gutenberg,Menu,Users}.php
  core/api/{Routes,Controller}.php
  core/cache/DocumentCache.php
  core/components/{Catalog,Registry}.php
  core/content/{Document,PageRepository,GlobalsRepository,PostTypes,RevisionRepository,Seeder}.php
  core/db/Installer.php
  core/design/{TokenCompiler,TokenRepository}.php
  core/forms/Contact.php
  core/log/Logger.php
  core/media/Prefetch.php
  core/navigation/Menus.php
  core/render/{ComponentRenders,NodeRenderer,PageRenderer,Preview,RenderContext}.php
  core/security/{Sanitizer,UrlValidator}.php
  core/seo/{Head,Sitemap}.php
  core/style/{Breakpoints,Chrome,DocumentCssCompiler}.php
  admin/assets/css/{admin.css,builder.css}
  admin/assets/js/{app.js,builder.js,chrome.js}
  assets/css/{base.css,components.css}
  assets/js/{public.js,maps.js,preview.js}
```

Autoload PSR-4 simple: `Meridian\` → `core/` con clases en subcarpetas.

### `core/constants.php`

```
MERIDIAN_VERSION 1.13.16
MERIDIAN_PATH / URI
MERIDIAN_REST 'krg/v1'
MERIDIAN_META_DRAFT '_meridian_draft'
MERIDIAN_META_PUBLISHED '_meridian_published'
MERIDIAN_META_ENABLED '_meridian_enabled'
MERIDIAN_META_CHECKSUM '_meridian_checksum'
Opciones: meridian_tokens, meridian_settings, meridian_header, meridian_footer,
meridian_menus, meridian_seo_global, meridian_identity, meridian_role_caps
```

### Hooks (`bootstrap.php`)

`after_setup_theme` setup; `init` post types + installer maybe_upgrade + preview query var; `rest_api_init`; `after_switch_theme` install; `admin_menu` + redirect `meridian*`→`krg*`; enqueue admin/public; `wp_head` SEO; Gutenberg filter pages; preview guard; AJAX `krg_contact` (+ legacy `meridian_contact`); prime PageRenderer en front/page; sitemap; robots_txt.

Caps: `meridian_manage`, `meridian_edit_pages`, `meridian_publish_pages`, `meridian_manage_templates`. Admin las tiene todas.

Tablas: `{prefix}meridian_revisions` (snapshot longtext, checksum, origin, author, created_at), `{prefix}meridian_logs`.

CPT internos: `meridian_global`, `meridian_template` (no públicos).

---

## Modelo de documento (JSON en post meta)

Página:

```
version, id, type: 'page', title, slug, status, parentId, featuredImageId,
seo: { title, description, canonical, ogTitle, ogDescription, ogImageId, robots },
settings: { showHeader, showFooter, layout },
sections: Node[]
```

Nodo:

```
id, type, name, visible, locked, source: 'local'|'global', globalId,
htmlId, htmlClass,
hiddenOn: { desktop, tablet, mobile },
animation, animDuration, animDelay, animEasing,
filters: { hue, sat, brightness, contrast, invert, sepia },
customCss: { before, main, after },
props: {}, styles: { desktop: {cssProp: value}, tablet, mobile },
children: Node[]
```

IDs: `n_` + uuid (fallback Date.now + random si no hay `crypto.randomUUID`).  
Checksum SHA-256 del doc **sin** `checksum`, `previewUrl`, `publicUrl`.  
Sanitizer schema-aware al guardar. Select con `options` vacías **no borra** valores numéricos. `formId` es **number** + absint.

Guardar meta: `wp_json_encode` UNICODE/SLASHES; si encode falla → error español, no vaciar. `Document::decode` intenta `json_decode` y `wp_unslash`.

Si el POST de guardado **no trae** `sections` (array) → **400** «No se recibió el contenido…» y **no** se sobreescribe el draft.

---

## REST `krg/v1` (todas reales)

Permisos: edit → `meridian_edit_pages` o `edit_pages`; publish → `meridian_publish_pages`; manage → `meridian_manage`.

| Método | Ruta | Función |
|---|---|---|
| GET | `/bootstrap` | counts, pages resumidas, tokens, identity |
| GET/POST | `/pages` | list / create |
| GET/PATCH/DELETE | `/pages/{id}` | get / save (PATCH alias) / trash |
| POST | `/pages/{id}/save` | **guardar draft (usar este desde el constructor)** |
| POST | `/pages/{id}/publish` | publicar HTML+CSS cache |
| POST | `/pages/{id}/duplicate` | copia con ids nuevos |
| POST | `/pages/{id}/settings` | status, visibility, password, isFront |
| POST | `/site/front` | pageOnFront |
| GET | `/pages/{id}/preview-url` | |
| GET | `/pages/{id}/revisions` | |
| POST | `/pages/{id}/revisions/{rid}/restore` | |
| GET | `/registry` | catálogo público + `everestForms` + `pluginActive` |
| GET/PUT | `/tokens` | |
| POST | `/tokens/presets/{slug}/activate` | |
| GET/PUT | `/menus` | |
| GET/PUT | `/header` `/footer` | chrome |
| GET/PUT | `/identity` | |
| POST | `/onboard` | asistente |
| GET/PUT | `/seo` | |
| GET/PUT | `/settings` | debug |
| POST | `/cache/flush` | borra HTML/CSS/SUM + chrome transient + `wp_cache_flush` |
| GET/POST | `/globals` | |
| PUT/DELETE | `/globals/{id}` | |
| GET/POST | `/templates` | |
| … | `/templates/{id}` | |
| GET/POST | `/blog` | |
| GET/PUT/DELETE | `/blog/{id}` | |
| GET | `/blog/taxonomies` | |
| GET/POST | `/blog/terms` | |
| GET/POST | `/users` | |
| PUT/DELETE | `/users/{id}` | |
| GET/PUT | `/roles` | matriz caps |
| POST | `/export` `/import` | paquete JSON |

Fetch admin (`app.js` `MApi`): `credentials: 'same-origin'`. Headers: `Content-Type`, extras, **`X-WP-Nonce` el último** (si el spread pisa el nonce → 403). Body JSON.

---

## Panel SPA (`admin/assets/js/app.js`)

Admin esconde barra WP / menú WP (`Assets::hide_wp_chrome`). Shell: aside + main.

**← a la izquierda de “KRG CMS”** → `wp-admin` (escritorio).  
**En el constructor**, ← → `admin.php?page=krg` (Inicio KRG), **no** al escritorio.

Menú: Inicio · Asistente (manage) · Páginas · Blog · Plantillas · Globales · Identidad y tokens · Navegación · Header/Footer visual · SEO · Usuarios · Configuración · Ver sitio. Active state correcto.

### Inicio
KPI páginas, borradores, entradas. Accesos asistente, nueva página, chrome.

### Asistente (pasos, POST `/onboard`)
Nombre, eslogan, logo, favicon, paleta, CTA header, título/subtítulo hero portada. Aplica tokens + identity + chrome + home de verdad.

### Páginas
Tabla: título (link constructor), slug, estado (draft/pending/publish), visibilidad (public/protected+password/private), portada, Editar / Duplicar / Eliminar.  
Barra portada: select página publicada o “últimas entradas” + Usar como portada. Borrador no puede ser portada. Export/import JSON.

### Blog
CRUD posts, cats, tags, destacada, estados. Front semántico.

### Identidad y tokens
siteName, tagline, logo media, favicon 32/512. Colores token + picker. Fonts. Typo roles (size, weight, line-height, tracking). Spacing/radius/shadow/surface. Presets activables. Export/import tokens. Componentes **nunca** hex de marca.

### Navegación
Menús header/footer, orden, URLs, CTA, sticky, logo. PUT `/menus`.

### Header/Footer visual
`krg-builder&chrome=header` (`chrome.js`): mismo undo/redo/historial, color solo de ese chrome, PUT `/header` o `/footer`.

### SEO
Global + `/sitemap.xml` + robots. Por página en el inspector.

### Usuarios
CRUD WP: login, nombre, email, rol, password. No borrar propia ni último admin. Matriz roles. Editor no ve tokens.

### Configuración
Debug. Export/import paquete. Resumen caps. **Caché → Borrar caché** (`POST /cache/flush`). No borra páginas.

---

## Constructor (`builder.js` + `builder.css`)

Canvas = iframe preview autenticada (`Preview::url`). Breakpoints Desktop 1280 / Tablet 768 / Mobile 390.

Barra: ← KRG · título · breakpoints · Deshacer · Rehacer · Historial · estado · **Guardar** · Preview · Publicar.

- Autosave 1200 ms + Guardar (Ctrl+S) + save on `visibilitychange` hidden.
- Guardar: **POST `/pages/{id}/save`**. Payload documento con `sections`. Actualiza checksum y `previewUrl`. Recarga iframe `previewUrl&t=`.
- Publicar: save + POST publish.
- Historial: list + restore.
- Undo/redo snapshots.

### Izquierda
Paleta por categoría. Layouts 12 cols: 12, 6-6, 4-4-4, 3-3-3-3, 8-4, 4-8, 9-3, 3-9, 6-3-3, 3-3-6, 3-6-3.  
Anidados (columnas con filas interiores + “destacado”): Pila + destacado, Destacado + pila, Barra izq. + filas, Filas + barra der., Barras laterales, Pila + dos destacados, Dos destacados + pila, Destacado 1/3 + filas, Filas + destacado 1/3, Dos filas + destacado, Destacado + dos filas, Barras + dos filas, Dos filas + dos destacados, Dos destacados + dos filas, Destacado 1/3 + dos filas, Dos filas + destacado 1/3.

**Estructura:** panel **220–560 px** ensanchable (splitter `--b-left`), scroll, wrap.  
Doble clic nombre → rename (`node.name`; section también `props.name`). Enter/Escape.  
**⋮⋮ HTML5 DnD:** before/after/inside. No drop en sí mismo. Tipos: section←row, row←column, column←módulos (no section/column).  
↑↓ hermanos. **‹ ›** entre columnas; si la fila tiene 1 columna, **sube** a la fila 2/3·1/3 exterior (climb). Toast si no hay destino.  
Duplicar, ocultar, plantilla, global, eliminar.

Añadir módulo: a la columna/fila/sección seleccionada; si no, crea section→row→column.

### Inspector (derecha)

Siempre **campos de página**: title, slug, parent, showHeader, showFooter, SEO title/description/canonical/ogTitle/ogDescription/robots (4 combos), ogImageId + botón media.

Pestañas Contenido / Diseño / Avanzado (textos, image, gallery, video, everest-form; el resto con los mismos grupos).

**Align/distribute (Illustrator)** en todo nodo: 6 alinear `alignH`/`alignV` start|center|end|stretch + 2 distribuir `distribute` none|x|y. Fila `vAlign`. Columna `contentHAlign`/`contentVAlign`. Clases `.m-align-h-*` `.m-align-v-*` `.is-dist-*`.

**Diseño por breakpoint** (`styles[bp]`):

- Color texto y fondo: **color nativo + hex**. Solo ese nodo. **No** tokens globales. Live CSS `!important` en `.m-n-{id}` **y** títulos internos (`.m-hero-title`, `.m-heading`, h1–h6, `.m-eyebrow`…).
- Tipo: familia var(--font-*), peso 300/400/600/700, italic, underline/line-through, uppercase/capitalize, align left/center/right/justify.
- Tamaño: font-size 10–96px, line-height %, letter-spacing.
- Padding/margin por lado. Borde 4 radios, none/solid/dashed/dotted, grosor, color. Sombra 5 presets. Filtros hue/sat/brightness/contrast/invert/sepia.
- Animación none/fade/slide/zoom/bounce/flip; ms duración/retardo; easing.
- Transición duración/retardo/curva.
- Imagen: width %, height, max-width, object-fit, object-position.

**Avanzado:** htmlId, htmlClass, CSS before/main/after (sanitizar sin `url(` javascript @import), hiddenOn mobile/tablet/desktop, visible, locked.

Live CSS en iframe `#krg-live-styles` al cambiar (incl. gallery height, video size, parallax data-attrs, align classes).

---

## Catálogo (Catalog.php + ComponentRenders.php)

Placeholders en defaults. Inspector desde schema + dedicados image/gallery/video/everest/text.

### Layout
- **section**: name, fullWidth, background color/token, htmlId. Children *.
- **container**: narrow.
- **row**: layout, gap 0–80, vAlign start/center/end/stretch.
- **column**: span, spanTablet, spanMobile 1–12, contentVAlign, contentHAlign.
- **columns**: desktop/tablet/mobile count, gap.
- **spacer**: height px.
- **divider**: solid|dashed.

### Texto
- **hero**: eyebrow, title, subtitle, align, imageId (media), repeater buttons {text,url,variant primary|secondary|outline}.
- **heading**: text, tag h1–h6, align, link.
- **paragraph**: text, align.
- **rich-text**: html; editor Visual/Texto, B/I/U, lista, enlace, Añadir media.
- **eyebrow**: text.
- **quote**: text, cite.

### Media — image (inspector propio)
imageId+imageUrl (thumb, Añadir/Cambiar/Quitar), alt, link, linkTarget _self|_blank, lightbox, centerOnMobile, radius sm|md|lg|full, objectFit cover|contain|fill, **fillMode natural|fill** (fill estira a columna/sección), **parallax** bool, parallaxZoom 0–40 default 8, parallaxAmount 0–40 default 10, parallaxInvert. JS `.m-figure.is-parallax`. Lightbox `.js-krg-lightbox`.

### Media — gallery (inspector propio)
items[] {imageId,imageUrl,alt} añadir una o varias. layout carousel|grid, fullWidth, height 120–900 default 420, objectFit cover|contain, arrows, keyboard, autoplay, interval 1500–15000, cols desktop/tablet/mobile, **mismo parallax**. Carrusel: flechas discretas, dots, teclado. CSS `--m-gal-h`. JS `[data-gallery]`.

### Media — video (inspector propio)
source link|upload. url (mp4/YouTube/Vimeo) o videoId+videoUrl (wp.media type=video). sizeMode auto|full|fullWidth|fullHeight|custom. width, height 80–1200, fit cover|contain, autoplay default true, loop default true, volume 0–100 default 0.  
**Sin UI al visitante:** no `controls`; controlslist nodownload nofullscreen noremoteplayback; disable PiP; contextmenu off; clic pausa/play. YouTube-nocookie embed controls=0 modestbranding disablekb fs=0; Vimeo background=1 controls=0. Advertir que YT/Vimeo no se bloquean del todo. Autoplay muted si volumen 0 o política del browser.

### Botones
button: text, url, target, variant primary|secondary|outline|ghost.  
button-group: children button, align.

### Contenido
card: title, text, imageId+imageUrl **picker**, url.  
**cards-grid:** repeater; imagen **botón biblioteca** (`data-rep-media`), no input ID.  
feature / feature-grid. testimonials repeater. faq / accordion q/a. tabs. statistics. timeline. cta.

### Blog (WP_Query real)
blog-grid, recent-posts, related-posts, categories, blog-post.

### Forms
**contact-form:** submit, success, showPhone, showSubject. Front `js-krg-form`, nonce `krg_contact`, honeypot, AJAX `krg_contact`.  
**everest-form:** formId number. Registry GET rellena `everestForms` desde CPT `everest_form`. Desplegable. do_shortcode `[everest_form id="N"]` (fallback `everest_forms`). Plugin off → mensaje. Encolar EVF_Frontend_Scripts si el doc tiene el nodo. **Sanitizer no puede vaciar formId.**

### Other
**map:** mapsUrl (URL o iframe Google, incl. maps.app.goo.gl expandido). height 180–720. UrlValidator solo Google.  
social-links repeater. logo-grid. menu (slug).

---

## Público

Templates: si la page tiene documento KRG, render `PageRenderer` (header/footer según settings). Preview usa draft + nonce. Publicado usa meta published; HTML/CSS cache por checksum; preview **no** usa esa caché.

`PublicAssets`: base.css + components.css + tokens inline + chrome CSS + doc CSS. public.js siempre; maps.js si hay map; preview.js si preview.

`public.js`: menú móvil, tabs, lightbox, gallery, parallax, video sin controles, form AJAX.

Tokens compilados a `:root { --color-primary: … }`. Preset inicial = **paleta del usuario**. Segundo preset opcional si los 4 archivos traen otra paleta.

---

## Seguridad

Sanitizer de documento/nodo/props/styles (allowlist CSS). UrlValidator http/https, maps host Google. Nonces REST y contact. Caps en cada ruta. kses richtext. customCss strip `</` javascript expression @import behavior `url(`.

Revisiones: insert/update; si la tabla falla, **el save de la página sigue**.

---

## Criterio de aceptación (todo debe pasar)

1. Tema activable. Menú KRG CMS. ← sidebar = wp-admin. ← constructor = Inicio KRG.  
2. Color de un título (picker) → canvas ya → Guardar → Publicar → visitante; resto sin cambiar paleta.  
3. Guardar POST no 403, no vacía página, recarga conserva props (Everest formId, gallery items, videoId).  
4. Preview `krgcms_preview`.  
5. Árbol: rename, drag, ↑↓‹› con climb, splitter. Layouts simples y anidados.  
6. Imagen/galería biblioteca + fill + parallax zoom/amount/invert.  
7. Video enlace o archivo, tamaños, autoplay/volumen, sin visor/descarga.  
8. Cards-grid: Añadir imagen, no ID.  
9. Everest en paleta forms; se ve y se guarda. Contact-form propio existe.  
10. Maps URL/iframe. Align/distribute + vAlign columnas.  
11. Páginas estado/visibilidad/portada. Tokens, chrome, nav, blog, SEO, usuarios.  
12. Configuración → Borrar caché.  
13. Paleta: ningún extra del tema se llama igual que un slug CMS.  
14. Home 200, `/sitemap.xml` 200. Editor no ve tokens.

---

## INPUTS (único extra del usuario)

No hay zip. Construye el CMS entero con este prompt. Abajo el usuario pega:

Marca:  
Paleta (hex + rol de cada color):  
(Adjunta 4 archivos de referencia visual del tema: tokens/CSS/DESIGN o equivalentes. Solo identidad/layout, no el motor.)

---
