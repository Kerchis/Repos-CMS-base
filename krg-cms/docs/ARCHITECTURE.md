# KRG CMS

**Plataforma CMS + constructor visual + design system para WordPress**  
Documento de arquitectura — Fase 0 (sin implementación)  
Versión: 1.0 · 2026-09-28  
Estado: **pendiente de aprobación**

---

## 0. Lectura de requisitos y referencias

### 0.1 Qué se está construyendo

No es un sitio. Es una **plataforma de administración de contenido y construcción de páginas**, empaquetada como **tema WordPress autosuficiente**, con núcleo propio (modelo de páginas, secciones, componentes, tokens, API, renderer). El administrador construye y mantiene el sitio **sin tocar PHP, HTML, CSS ni JS**.

El código define estructura, lógica, componentes y comportamiento.  
El administrador define contenido, diseño, identidad, páginas, blog y navegación.

### 0.2 Qué se excluye de forma explícita

- Elementor, Divi, WPBakery, Beaver, Bricks, Visual Composer y cualquier constructor comercial.
- Gutenberg / bloques de Gutenberg como motor de páginas.
- Plugins premium o SaaS obligatorios.
- Prototipos con botones que no persisten.
- Identidad hardcodeada (`background: #D94E27` en decenas de archivos).
- Contenido escrito dentro de plantillas de componente.

### 0.3 Análisis de los archivos de referencia

Se recibieron cuatro archivos técnicos extraídos del sitio **Swap** (editorial mint / lima):

| Archivo | Qué aporta | Qué no se debe copiar literal |
|---|---|---|
| `tokens.json` | Forma de tokens (color, font, typography, spacing, radius, shadow, surface) con `$value` / `$type` / `$description` | Nombres semánticos de Swap (`mint-wash`, `vivid-lime`) como identidad por defecto |
| `variables.css` | Capa CSS `:root` lista para inyectar | Valores mint/lima como tema único |
| `theme.css` | Mapeo tipo Tailwind `@theme` | Dependencia de Tailwind v4 |
| `DESIGN.md` | Escala tipográfica, layout (max-width 1200, section 80–120, card padding 30, radius 24), componentes, Do/Don't | Reglas de marca Swap (“nunca fondo oscuro”, “solo lima como acento”, serif ultra-thin 100) como ley del CMS |

**Decisión:** se adopta la **arquitectura de tokens y las magnitudes de layout** de Swap. **No** se adopta la identidad visual Swap como tema por defecto.

### 0.4 Colorimetría

**La imagen de colorimetría no está en los archivos adjuntos.** Se usa la paleta explícita del brief como **preset inicial “Marca”**, 100 % editable.

| Token semántico inicial | HEX | Rol |
|---|---|---|
| Primario | `#D94E27` | Acciones, acentos fuertes, CTAs |
| Secundario | `#512517` | Superficies oscuras, header/footer, énfasis |
| Terciario / dorado | `#E19C31` | Destacados, badges, hover cálido |
| Amarillo | `#E7D600` | Highlight puntual |
| Éxito / verde | `#7EB733` | Success, acento natural |
| Info / azul | `#274E97` | Links, info, foco |
| Texto | `#1D1D1B` | Texto principal |
| Fondo | `#FFFFFF` | Canvas |
| Superficie | `#F5F5F3` | Gris muy claro (~15 % de uso) |
| Borde | `#E2DED8` | Separadores |

Distribución inicial (orientativa, no rígida): 65 % blanco · 15 % gris claro · 10 % marrón · 5 % verde · 3 % naranja · 1 % dorado · 1 % amarillo · &lt;1 % azul.

Se incluirá un segundo preset **“Editorial Mint”** (valores Swap) para demostrar el sistema de presets. Cambiar de preset reescribe tokens semánticos, no el código de componentes.

### 0.5 Principio de capas (obligatorio)

```
A. Estructura     → árbol página > secciones > componentes
B. Contenido      → props de cada nodo (textos, media, URLs)
C. Estilos        → styles por breakpoint, siempre vía tokens o overrides
D. Configuración  → visibilidad, SEO, header/footer, publicación
E. Datos          → CPT, meta, tablas, options
F. Componentes    → registry + schema + render PHP
G. Presentación   → renderer + CSS compilado
```

Un componente **nunca** contiene copy real. Solo placeholders en `defaults` del schema.

---

## A. Arquitectura

### A.1 Forma de entrega

**Tema WordPress profesional autosuficiente** llamado **KRG CMS** (código PHP interno `Meridian\`).

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| Core | `theme/core` | Registry, renderer, tokens, documents, REST, seguridad, cache |
| Admin UI | `theme/admin` | Panel propio (SPA ligera) + builder |
| Componentes | `theme/components` | Schema + render PHP + CSS del componente |
| Templates WP | raíz del tema | `front-page.php`, `page.php`, `single.php`, etc. (cáscaras) |
| Público | `theme/assets` + renderer | HTML semántico, CSS de tokens + CSS del documento |

No se requiere plugin aparte en v1. El tema registra CPT, rutas REST, menús de admin y rewrites. Más adelante el core puede extraerse a `mu-plugin` sin cambiar el contrato de API.

**WordPress se usa como:**

- Autenticación, roles, nonces, media library, cron, permalinks.
- CPT / posts nativos para **blog**.
- `page` nativo como **contenedor de permalink** (el documento del builder vive en meta + tabla de revisiones).
- REST API como transporte.

**WordPress no se usa como:**

- Motor de layout (Gutenberg off en páginas KRG CMS).
- Almacén opaco de HTML mezclado con shortcodes.

### A.2 Stack técnico v1

| Pieza | Elección | Motivo |
|---|---|---|
| PHP | 8.1+ | Tipos, readonly, enums |
| Frontend público | PHP renderer + CSS variables + JS mínimo | SEO, first paint, sin hidratar un framework |
| Admin / builder | ES modules vanilla + CSS del admin (sin React/Vue) | Cero build obligatorio, instalable como tema clásico |
| Estado del builder | Documento JSON en memoria + API | Una sola fuente de verdad |
| Canvas | iframe del frontend con `?meridian_preview=` | El preview **es** el sitio público |
| Persistencia | `page` + meta draft/published + tabla `revisiones` | Permalinks WP + historial propio |
| Tokens | JSON versionable → compilador CSS | Cambio global sin tocar componentes |
| Media | `wp.media` | No pedir URLs a mano |
| Blog editor | Editor semántico propio (no Gutenberg) | HTML limpio |

Se evita Tailwind, npm y bundlers en v1. Si más adelante el admin crece, se puede introducir un build **solo para admin**, nunca para el público.

### A.3 Principios de diseño de software

1. **Schema-first.** Nada es editable si no está declarado en el schema del componente.
2. **Un documento, dos estados.** `draft` (trabajo) y `published` (público). Preview lee draft. Sitio lee published.
3. **IDs estables.** Cada nodo (`section`, `component`) tiene UUID. El CSS compilado y el historial dependen de ello.
4. **Compilar, no interpretar en caliente de más.** Tokens y estilos de documento se compilán a CSS. El HTML no lleva decenas de inline styles salvo overrides puntuales.
5. **Misma render function** en público, preview y (si aplica) export HTML.
6. **Fail closed.** Permisos denegados, URLs inválidas, JSON corrupto → mensaje humano + log técnico.
7. **Extensión por registro.** Un desarrollador añade un componente con `registerComponent()`, sin parchear el core.

### A.4 Diagrama de capas

```
┌──────────────────────────────────────────────────────────┐
│  Admin UI  (dashboard, builder, design, blog, menus)     │
└────────────────────────────┬─────────────────────────────┘
                             │ REST krg/v1  + nonce
┌────────────────────────────▼─────────────────────────────┐
│  API Layer  (controllers, schema validation, caps)       │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│  Domain                                                     │
│  Documents · Registry · Tokens · Menus · SEO · Revisions │
└──────────────┬─────────────────────────────┬─────────────┘
               │                             │
               ▼                             ▼
     Data Layer (WPDB)              Renderer / Compilers
     pages, meta, tables            HTML + CSS + sitemap
               │                             │
               ▼                             ▼
         MySQL / WP                    Sitio público
```

### A.5 Namespaces PHP

```
Meridian\
  Core\          bootstrap, autoload, constants
  Admin\         menús WP, assets admin, builder boot
  Api\           REST routes
  Auth\          capabilities, nonces
  Content\       PageRepository, Document, Revision
  Components\    Registry, Schema, FieldTypes
  Render\        PageRenderer, NodeRenderer, Context
  Design\        TokenRepository, TokenCompiler, Preset
  Style\         DocumentCssCompiler, Responsive
  Navigation\    MenuRepository, Header, Footer
  Blog\          posts, taxonomies, blog editor
  Seo\           meta, sitemap, robots, schema.org
  Media\         attachment helpers
  Forms\         definition, validation, mail
  Security\      sanitizer, kses, url validator
  Cache\         document cache, css cache
  ImportExport\  JSON pack
  Log\           debug logger
  Support\       Str, Arr, Uuid, Http
```

---

## B. Estructura de carpetas

```
meridian/                          # tema WP
├── style.css                      # encabezado del tema (identidad vía tokens, no CSS de marca)
├── functions.php                  # bootstrap único: carga core/bootstrap.php
├── index.php
├── front-page.php                 # cáscara → renderer
├── page.php
├── single.php
├── archive.php
├── search.php
├── 404.php
├── header.php                     # get_header: imprime Header document
├── footer.php
├── screenshot.png
│
├── core/
│   ├── bootstrap.php
│   ├── autoload.php
│   ├── constants.php
│   ├── api/
│   │   ├── Routes.php
│   │   ├── controllers/
│   │   │   ├── PagesController.php
│   │   │   ├── DocumentsController.php
│   │   │   ├── ComponentsController.php
│   │   │   ├── TokensController.php
│   │   │   ├── MenusController.php
│   │   │   ├── HeaderFooterController.php
│   │   │   ├── BlogController.php
│   │   │   ├── SeoController.php
│   │   │   ├── MediaController.php
│   │   │   ├── TemplatesController.php
│   │   │   ├── RevisionsController.php
│   │   │   └── ImportExportController.php
│   │   └── SchemaValidator.php
│   ├── content/
│   │   ├── Document.php
│   │   ├── PageRepository.php
│   │   ├── RevisionRepository.php
│   │   └── TemplateRepository.php
│   ├── components/
│   │   ├── Registry.php
│   │   ├── ComponentDefinition.php
│   │   └── FieldTypes.php
│   ├── render/
│   │   ├── PageRenderer.php
│   │   ├── NodeRenderer.php
│   │   └── RenderContext.php
│   ├── design/
│   │   ├── TokenRepository.php
│   │   ├── TokenCompiler.php
│   │   └── Presets.php
│   ├── style/
│   │   ├── DocumentCssCompiler.php
│   │   └── Breakpoints.php
│   ├── navigation/
│   ├── blog/
│   ├── seo/
│   ├── forms/
│   ├── security/
│   ├── cache/
│   ├── import-export/
│   ├── log/
│   └── db/
│       ├── Installer.php          # dbDelta tablas
│       └── schema.php
│
├── inc/
│   ├── setup.php                  # theme supports, image sizes
│   ├── enqueue.php                # público: tokens.css dinámico + document css
│   ├── post-types.php             # meridian_template, meridian_global
│   ├── admin.php                  # menú WP → admin UI
│   ├── capabilities.php
│   ├── disable-gutenberg.php
│   └── preview.php                # query vars de preview
│
├── admin/                         # UI del administrador (no es wp-admin default)
│   ├── index.php                  # shell del panel
│   ├── builder.php                # shell del constructor
│   ├── assets/
│   │   ├── css/
│   │   │   ├── admin.css
│   │   │   └── builder.css
│   │   └── js/
│   │       ├── app.js             # router del panel
│   │       ├── api.js
│   │       ├── builder/
│   │       │   ├── canvas.js
│   │       │   ├── tree.js
│   │       │   ├── palette.js
│   │       │   ├── inspector.js
│   │       │   ├── history.js     # undo local
│   │       │   └── autosave.js
│   │       ├── views/             # dashboard, pages, blog, design...
│   │       └── fields/            # controles: color, spacing, typography...
│   └── views/
│       ├── dashboard.php
│       ├── pages.php
│       ├── builder.php
│       ├── components.php
│       ├── design/
│       ├── blog/
│       ├── menus.php
│       ├── header.php
│       ├── footer.php
│       ├── seo.php
│       └── settings.php
│
├── components/                    # un folder = un componente
│   ├── _layout/
│   │   ├── section/
│   │   ├── container/
│   │   ├── columns/
│   │   ├── spacer/
│   │   └── divider/
│   ├── _text/
│   │   ├── heading/
│   │   ├── paragraph/
│   │   ├── rich-text/
│   │   ├── eyebrow/
│   │   └── quote/
│   ├── _media/
│   │   ├── image/
│   │   ├── gallery/
│   │   └── video/
│   ├── _buttons/
│   │   ├── button/
│   │   └── button-group/
│   ├── _content/
│   │   ├── card/
│   │   ├── cards-grid/
│   │   ├── feature/
│   │   ├── feature-grid/
│   │   ├── testimonials/
│   │   ├── faq/
│   │   ├── accordion/
│   │   ├── tabs/
│   │   ├── statistics/
│   │   ├── timeline/
│   │   └── cta/
│   ├── _navigation/
│   │   ├── header/
│   │   ├── footer/
│   │   ├── menu/
│   │   └── social-links/
│   ├── _blog/
│   │   ├── blog-grid/
│   │   ├── blog-post/
│   │   ├── categories/
│   │   ├── related-posts/
│   │   └── recent-posts/
│   ├── _forms/
│   │   ├── contact-form/
│   │   ├── input/
│   │   ├── textarea/
│   │   ├── select/
│   │   ├── checkbox/
│   │   └── radio/
│   └── _other/
│       ├── map/
│       └── logo-grid/
│
│   # cada componente:
│   #   schema.php     declaración
│   #   render.php     HTML
│   #   style.css      solo var(--token) — sin hex
│   #   icon.svg
│
├── templates/                     # plantillas de página JSON (semilla)
│   ├── landing.json
│   ├── corporate.json
│   ├── services.json
│   ├── contact.json
│   ├── product.json
│   ├── blog.json
│   └── article.json
│
├── presets/                       # design tokens de fábrica
│   ├── marca.json                 # paleta del brief
│   └── editorial-mint.json        # referencia Swap
│
├── assets/
│   ├── css/
│   │   ├── base.css               # reset mínimo, focus, a11y
│   │   ├── layout.css             # container, grid helpers
│   │   └── utilities.css          # muy limitado; no framework
│   ├── js/
│   │   ├── public.js              # menú mobile, acordeón, tabs, lazy
│   │   └── forms.js
│   ├── images/
│   └── fonts/
│
├── languages/
│   └── meridian.pot               # i18n lista (no multiidioma de contenido en v1)
│
├── docs/
│   ├── ARCHITECTURE.md            # este documento
│   ├── COMPONENTS.md              # cómo registrar un componente
│   ├── TOKENS.md
│   ├── API.md
│   └── TESTING.md
│
└── README.md
```

Cada archivo de componente es pequeño. El renderer no supera ~200 líneas. Los controllers REST no mezclan HTML.

---

## C. Modelo de datos

### C.1 Estrategia

Híbrido deliberado:

| Entidad | Almacén | Por qué |
|---|---|---|
| Página pública | CPT nativo `page` | Permalinks, estados, autores, caps WP |
| Documento builder | post meta `_meridian_draft` y `_meridian_published` | JSON versionable, separado de `post_content` |
| Revisiones | tabla `wp_meridian_revisions` | Diffs, restore, autosave sin inflar `wp_posts` |
| Componentes globales | CPT `meridian_global` + documento JSON | Reutilización real |
| Plantillas | CPT `meridian_template` | Biblioteca |
| Tokens / presets | `wp_options` (`meridian_tokens`, `meridian_presets`) + historial opcional | Poca escritura, mucha lectura |
| Header / Footer | options `meridian_header`, `meridian_footer` (documentos) | Un solo origen |
| Menús | tabla `wp_meridian_menus` o option JSON | Anidación y visibilidad propias |
| Blog | `post` + `category` + `post_tag` + users | No reinventar |
| SEO | meta por post + options globales | Por entidad |
| Media | `attachment` WP | Biblioteca nativa |
| Ajustes | `meridian_settings` option | Debug, permisos, maps key, etc. |

`post_content` de las páginas KRG CMS se rellena en **publish** con un HTML semántico **generado** (fallback RSS/búsqueda/SEO). La fuente de verdad sigue siendo el JSON.

### C.2 Documento de página (JSON)

```json
{
  "version": 1,
  "id": 12,
  "type": "page",
  "title": "Servicios",
  "slug": "servicios",
  "status": "draft",
  "parentId": 0,
  "seo": {
    "title": "",
    "description": "",
    "canonical": "",
    "ogTitle": "",
    "ogDescription": "",
    "ogImageId": 0,
    "robots": "index,follow"
  },
  "featuredImageId": 0,
  "settings": {
    "showHeader": true,
    "showFooter": true,
    "layout": "default"
  },
  "sections": [
    {
      "id": "sec_01HZY...",
      "type": "section",
      "name": "Hero",
      "visible": true,
      "locked": false,
      "globalId": null,
      "props": {
        "htmlId": "",
        "htmlClass": "",
        "background": { "mode": "token", "token": "color.background" }
      },
      "styles": {
        "desktop": { "padding": { "top": "var(--spacing-section)", "bottom": "var(--spacing-section)" } },
        "tablet": {},
        "mobile": {}
      },
      "children": [
        {
          "id": "cmp_01HZY...",
          "type": "hero",
          "source": "local",
          "globalId": null,
          "props": {
            "eyebrow": "Servicios",
            "title": "Construimos plataformas",
            "subtitle": "",
            "imageId": 0,
            "buttons": [
              { "text": "Hablar", "url": "/contacto", "style": "primary" }
            ]
          },
          "styles": { "desktop": {}, "tablet": {}, "mobile": {} },
          "children": []
        }
      ]
    }
  ]
}
```

Reglas:

- `source: local | global`. Si `global`, `props` pueden contener **overrides de instancia** (solo claves permitidas). El resto se resuelve del documento global.
- `styles.{desktop,tablet,mobile}`: mobile/tablet **solo overrides**. Desktop es la base (desktop-first). El compilador genera cascade.
- Valores de color/fuente/radio/sombra en estilos referencian tokens (`token:color.primary`) o un override explícito marcado `mode: custom`. El inspector empuja a tokens.
- No se aceptan claves que no existan en el schema del `type`.

### C.3 Tablas custom

```sql
-- wp_meridian_revisions
id BIGINT PK
post_id BIGINT
entity_type VARCHAR(32)   -- page | global | header | footer | template
snapshot LONGTEXT         -- JSON
author_id BIGINT
origin VARCHAR(32)        -- autosave | manual | publish | restore
created_at DATETIME
checksum CHAR(64)

-- wp_meridian_menus
id BIGINT PK
slug VARCHAR(64) UNIQUE   -- header | footer | secondary | custom-...
name VARCHAR(190)
items LONGTEXT            -- JSON árbol
updated_at DATETIME

-- wp_meridian_logs  (solo si debug)
id BIGINT PK
level VARCHAR(16)
message TEXT
context LONGTEXT
created_at DATETIME
```

Índices: `(post_id, created_at)`, `(entity_type, post_id)`.

Retención: últimos 50 snapshots por entidad; autosaves colapsados (uno cada 5 min + el último).

### C.4 Tokens persistidos

```json
{
  "version": 1,
  "activePreset": "marca",
  "tokens": {
    "color": {
      "primary": { "value": "#D94E27", "type": "color", "label": "Primario" },
      "secondary": { "value": "#512517", "type": "color" },
      "tertiary": { "value": "#E19C31", "type": "color" },
      "background": { "value": "#FFFFFF", "type": "color" },
      "surface": { "value": "#F5F5F3", "type": "color" },
      "text": { "value": "#1D1D1B", "type": "color" },
      "text-secondary": { "value": "#5C5854", "type": "color" },
      "border": { "value": "#E2DED8", "type": "color" },
      "success": { "value": "#7EB733", "type": "color" },
      "warning": { "value": "#E19C31", "type": "color" },
      "error": { "value": "#C0392B", "type": "color" },
      "info": { "value": "#274E97", "type": "color" },
      "highlight": { "value": "#E7D600", "type": "color" }
    },
    "font": {
      "heading": { "value": "\"Playfair Display\", Georgia, serif", "type": "fontFamily" },
      "body": { "value": "Inter, system-ui, sans-serif", "type": "fontFamily" },
      "special": { "value": "Inter, system-ui, sans-serif", "type": "fontFamily" }
    },
    "typography": { },
    "spacing": { },
    "radius": { },
    "shadow": { },
    "layout": {
      "page-max-width": { "value": "1200px" },
      "section-gap": { "value": "96px" },
      "card-padding": { "value": "30px" }
    },
    "breakpoint": {
      "tablet": { "value": "768px" },
      "desktop": { "value": "1024px" }
    }
  },
  "customColors": []
}
```

El compilador emite:

```css
:root {
  --color-primary: #D94E27;
  --font-heading: "Playfair Display", Georgia, serif;
  --page-max-width: 1200px;
  --bp-tablet: 768px;
  --bp-desktop: 1024px;
}
```

Nunca `background: #D94E27` en componentes. Siempre `var(--color-primary)`.

### C.5 Componente global

Documento propio (CPT `meridian_global`):

```json
{
  "id": 88,
  "slug": "hero-corporativo",
  "name": "Hero corporativo",
  "scope": "global",
  "node": { "type": "hero", "props": {}, "styles": {}, "children": [] }
}
```

Instancia en página:

```json
{ "id": "cmp_...", "type": "hero", "source": "global", "globalId": 88, "props": { "title": "Override local opcional" } }
```

Política v1:

- **Editar global:** cambia todas las instancias.
- **Editar instancia:** override de props declaradas como `overridable: true`. Estilos de instancia permitidos.
- **Desvincular:** copia el nodo y `source: local`.

### C.6 Menú

```json
{
  "slug": "header",
  "items": [
    {
      "id": "itm_...",
      "label": "Servicios",
      "type": "internal",
      "pageId": 12,
      "url": "",
      "target": "_self",
      "visible": true,
      "children": []
    }
  ]
}
```

`internal` se resuelve a permalink en render. Si la página cambia de slug, el menú no se rompe.

### C.7 Blog

Campos extra (meta):

- `_meridian_subtitle`
- `_meridian_seo` (mismo objeto SEO)
- `_meridian_og`
- contenido en `post_content` como **HTML semántico** producido por el editor de blog (no JSON de builder).

El builder de páginas y el editor de blog **no comparten motor**. El blog puede **incrustarse** en páginas vía componentes `blog-grid`, `recent-posts`, etc.

---

## D. Flujo del sistema

### D.1 Crear y publicar una página

```
Admin → Páginas → Nueva
    → WP inserta page (draft, slug)
    → Documento vacío { sections: [] } en _meridian_draft
    → Redirect al constructor

Constructor
    → Carga draft via GET /krg/v1/pages/{id}?state=draft
    → Usuario agrega sección Hero, edita props
    → Autosave PATCH draft (debounce 2s) → estado: Guardando… / Guardado / Error
    → Preview: iframe GET /?page_id={id}&meridian_preview=1&nonce=
         Renderer usa DRAFT
    → Publicar: POST /pages/{id}/publish
         valida schema
         copia draft → _meridian_published
         post_status = publish
         regenera post_content HTML
         snapshot revision origin=publish
         purge cache CSS/documento
         flush rewrite si slug cambió

Público /servicios/
    → page.php → PageRenderer(published)
    → TokenCompiler CSS en <head>
    → DocumentCssCompiler CSS
    → Header document + sections + Footer document
```

### D.2 Cambio de color primario

```
Apariencia → Colores → primary = #B33F1C
    → PUT /krg/v1/tokens
    → TokenCompiler regenera CSS (transient + option cache)
    → Todos los componentes con background: var(--color-primary) cambian
    → No se recorre el JSON de páginas
```

### D.3 Componente global

```
Guardar sección como plantilla/global
    → POST /globals  { node }
    → Inserciones posteriores reference globalId
Editar global
    → PATCH /globals/{id}
    → Cache bust de páginas que referencian
```

### D.4 Duplicar / reordenar / ocultar / eliminar sección

Operaciones sobre el array `sections` del documento draft:

| Acción | Comportamiento |
|---|---|
| Mover ↑↓ | Swap de índices, persistir draft |
| Duplicar | Deep copy con **nuevos UUIDs** |
| Ocultar | `visible: false` (no se renderiza en público; en builder se ve atenuada) |
| Eliminar | Modal de confirmación obligatorio → splice |
| Guardar como plantilla | Copia a CPT template |

Ninguna de estas acciones es cosmética: mutan el JSON y el renderer las respeta.

### D.5 Flujo de datos del renderer

```
RenderContext
  tokens (compiled)
  document
  resolvedGlobals (batch load, no N+1)
  mediaMap (IDs → urls/alt)
  menus
  isPreview
  breakpoint (solo builder overlay)

PageRenderer
  foreach section if visible or isPreview
    Section (layout)
      foreach child
        Registry.get(type).render(resolvedProps, styles, context)
```

Assets públicos: solo se encolan `public.js` módulos que los componentes presentes declaren en `assets` del schema (form, map, slider).

---

## E. Sistema de componentes

### E.1 Registry

```php
Registry::register([
  'slug'        => 'button',
  'name'        => __('Botón', 'meridian'),
  'description' => __('Acción o enlace con estilo de botón.', 'meridian'),
  'category'    => 'buttons',
  'icon'        => 'button',
  'keywords'    => ['cta', 'link'],
  'supports'    => ['responsive', 'visibility', 'anchor'],
  'children'    => false, // o ['button'] | '*'
  'overridable' => ['text', 'url', 'target'],
  'fields'      => [ /* ver E.3 */ ],
  'defaults'    => [ 'text' => 'Acción', 'url' => '#', 'style' => 'primary' ],
  'render'      => fn (array $props, array $styles, RenderContext $ctx) => ...,
  'assets'      => [ 'js' => [], 'css' => ['button'] ],
]);
```

Autoload: cada `components/**/schema.php` se carga en `after_setup_theme`. Un desarrollador añade carpeta y listo.

### E.2 Catálogo v1 (mínimo del brief)

**Layout:** container, section, columns, spacer, divider  
**Text:** heading, paragraph, rich-text, eyebrow, quote  
**Media:** image, gallery, video  
**Buttons:** button, button-group  
**Content:** card, cards-grid, feature, feature-grid, testimonials, faq, accordion, tabs, statistics, timeline, cta  
**Navigation:** header, footer, menu, social-links  
**Blog:** blog-grid, blog-post, categories, related-posts, recent-posts  
**Forms:** contact-form, input, textarea, select, checkbox, radio  
**Other:** map, logo-grid  

Header y Footer son documentos globales con los mismos nodos, no HTML fijo.

### E.3 Field types (inspector)

El panel derecho **se genera** a partir del schema. No hay inspectores a mano por componente.

| type | UI | Sanitización |
|---|---|---|
| `text` | input | `sanitize_text_field` |
| `textarea` | textarea | `sanitize_textarea_field` |
| `richtext` | editor semántico limitado | `wp_kses` allowlist |
| `url` | input + picker interno | validador URL (E.5) |
| `email` | input | `sanitize_email` |
| `number` | input | int/float + min/max |
| `select` | select | enum |
| `toggle` | switch | bool |
| `color` | token picker + custom | token id o hex |
| `spacing` | 4 lados + linked | unidades permitidas |
| `typography` | familia/size/weight/line/letter/transform | tokens + override |
| `image` | wp.media | attachment id |
| `video` | media o URL | attachment / oembed allowlist |
| `repeater` | lista (cards, buttons, faqs) | array schema hijo |
| `icon` | set limitado | slug |
| `map` | URL / coords / zoom | validador Maps |
| `htmlTag` | H1–H6, p | enum |
| `alignment` | left/center/right/justify | enum |
| `link` | url + target + rel | URL validator |

Grupos de acordeón fijos del inspector: Contenido · Diseño · Tipografía · Colores · Espaciado · Responsive · Avanzado.  
**Solo se muestran grupos con campos.** Un botón no muestra “columnas”.

### E.4 Ejemplo Button schema (contrato)

```php
'fields' => [
  [ 'key' => 'text', 'type' => 'text', 'group' => 'content', 'label' => 'Texto' ],
  [ 'key' => 'url', 'type' => 'url', 'group' => 'content', 'label' => 'URL' ],
  [ 'key' => 'target', 'type' => 'select', 'group' => 'content', 'options' => ['_self','_blank'] ],
  [ 'key' => 'variant', 'type' => 'select', 'group' => 'design',
    'options' => ['primary','secondary','outline','ghost'] ],
  [ 'key' => 'background', 'type' => 'color', 'group' => 'colors', 'states' => ['default','hover'] ],
  [ 'key' => 'textColor', 'type' => 'color', 'group' => 'colors', 'states' => ['default','hover'] ],
  [ 'key' => 'radius', 'type' => 'select', 'group' => 'design', 'tokenGroup' => 'radius' ],
  [ 'key' => 'shadow', 'type' => 'select', 'group' => 'design', 'tokenGroup' => 'shadow' ],
  [ 'key' => 'fontSize', 'type' => 'typography', 'group' => 'typography', 'responsive' => true ],
  [ 'key' => 'padding', 'type' => 'spacing', 'group' => 'spacing', 'responsive' => true ],
  [ 'key' => 'margin', 'type' => 'spacing', 'group' => 'spacing', 'responsive' => true ],
  [ 'key' => 'fullWidth', 'type' => 'toggle', 'group' => 'design' ],
  [ 'key' => 'relNofollow', 'type' => 'toggle', 'group' => 'advanced' ],
]
```

Estados soportados donde aplique: `default`, `hover`, `focus`, `active`, `disabled`.

### E.5 Map / URLs

Validador:

- Permite `https://www.google.com/maps/...`, `https://maps.google.com/...`, `https://www.google.com/maps/embed?...`
- Coordenadas `lat/lng` numéricas + zoom 1–21
- Si falla: **“La URL introducida no es válida.”** Sin warnings PHP.

El render usa iframe sandbox `allow-scripts allow-popups allow-same-origin` solo para Maps, height/width/radius desde props.

### E.6 Columnas / responsive de layout

`columns` declara:

```
desktop: 4
tablet: 2
mobile: 1
gap: token spacing
```

El compilador genera:

```css
.n-abc { display: grid; grid-template-columns: repeat(4, 1fr); }
@media (max-width: 1023px) { .n-abc { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 767px) { .n-abc { grid-template-columns: 1fr; } }
```

No se escriben media queries a mano por componente.

---

## F. Sistema de Design Tokens

### F.1 Capas

```
1. Primitive tokens     valores crudos (#D94E27, 16px, 24px)
2. Semantic tokens      --color-primary → primitive
3. Component tokens     --button-bg: var(--color-primary)
4. Document CSS         overrides de nodo / breakpoint
```

El admin edita **semánticos** (y custom extras). Los componentes consumen **semánticos y de componente**. Nunca primitivos sueltos.

### F.2 Escala inicial (adaptada de Swap, no copiada ciega)

De Swap se toman magnitudes útiles:

- `--page-max-width: 1200px`
- `--spacing-section: 96px` (rango 80–120, valor medio editable)
- `--card-padding: 30px`
- `--radius-cards: 24px`
- `--radius-buttons: 200px` en preset Mint; en preset Marca se inicia en `8px` (corporativo). **El token existe; el valor lo define el preset.**
- Sombra suave `0 0 28px rgba(0,0,0,.09)` como `--shadow-md`
- Escala type: caption 12 / body 16 / sub 18 / h 24–30 / display 48–72 (display 120px es del preset Mint; Marca arranca más contenido)

Tipografía inicial Marca (editable, con fallbacks web seguros):

- Headings: Playfair Display (análogo editorial, no la custom Swap)
- Body: Inter

No se embeben las fuentes proprietary “swap-serif / swap-sans”.

### F.3 Tipografía administrable

Roles globales: `display`, `h1`–`h6`, `p`, `small`, `button`, `label`, `caption`.

Cada rol:

- familia (heading/body/special/custom)
- peso, tamaño, line-height, letter-spacing, transform
- overrides responsive

Un heading de página puede overridear el rol. El inspector muestra “usar estilo global” vs “personalizar”.

### F.4 Generación dinámica

`TokenCompiler::css(): string` se imprime con `wp_add_inline_style` en público y en preview. Cache: transient invalidado al guardar tokens.

Arquitectura dark mode (sin implementar):

```css
:root { ...light... }
[data-theme="dark"] { /* mismo set semántico, otros primitivos */ }
```

Los componentes ya usan semánticos, así que dark mode futuro no requiere reescritura.

### F.5 Presets

| Preset | Uso |
|---|---|
| `marca` | Default. Paleta del brief. |
| `editorial-mint` | Swap. Demuestra cambio total de identidad. |

El admin puede duplicar un preset (“Tema A/B/C”), editarlo y activarlo. Export JSON de tokens = backup de identidad.

### F.6 Color extra

Además de la paleta fija semántica, `customColors[]`: nombre + HEX/RGB/HSL + alpha. Disponibles en el color picker. No rompen el schema.

El color picker muestra HEX, RGB, HSL y alpha cuando el campo lo permite.

---

## G. Panel administrativo

### G.1 Relación con wp-admin

KRG CMS registra un menú de nivel superior y **reemplaza el flujo de “Páginas”** para usuarios con cap `meridian_manage`. Gutenberg se desactiva en `page`. La biblioteca multimedia de WP se reutiliza. Usuarios y roles siguen siendo WP.

No se clona todo wp-admin. Se construye un shell propio (sidebar + topbar) dentro de `admin.php?page=krg-*`.

### G.2 IA de navegación (IA = información)

```
Dashboard
├── Inicio                         métricas: páginas, borradores, posts, último publish
├── Páginas
│   ├── Todas                      listado real (crear, editar, duplicar, estado, slug)
│   ├── Nueva página
│   └── Plantillas
├── Componentes
│   ├── Biblioteca                 plantillas de sección
│   └── Componentes globales
├── Blog
│   ├── Entradas
│   ├── Categorías
│   ├── Etiquetas
│   └── Autores                    users con rol autor+
├── Multimedia                     abre wp.media / grid propio sobre attachments
├── Apariencia
│   ├── Identidad                  logo, logo mobile, favicon, nombre
│   ├── Colores
│   ├── Tipografía
│   ├── Botones                    tokens de componente botón
│   ├── Espaciado
│   └── Responsive                 breakpoints
├── Navegación
├── Header
├── Footer
├── SEO                            global + sitemap/robots
└── Configuración                  debug, permisos, maps, email de formularios
```

### G.3 Permisos v1

| Cap | Admin | Editor | Autor |
|---|---|---|---|
| `meridian_manage` (tokens, header/footer, settings) | sí | no | no |
| `meridian_edit_pages` | sí | sí | no |
| `meridian_publish_pages` | sí | sí | no |
| `meridian_manage_templates` | sí | sí | no |
| `edit_posts` (blog) | sí | sí | propios |

Arquitectura lista para caps extra. Las rutas REST usan `permission_callback` por cap, no “is_user_logged_in”.

### G.4 Dashboard Inicio

No es un widget vacío: cuenta páginas publicadas/borrador, posts, muestra actividad reciente (revisiones) y atajos reales (Nueva página, Nueva entrada, Colores).

---

## H. Constructor visual

### H.1 Layout de UI

```
┌─────────────────────────────────────────────────────────────┐
│ Logo  Página▾   [D] [T] [M]    Preview   Guardando…  Publicar│
├──────────┬──────────────────────────────────┬────────────────┤
│ AGREGAR  │                                  │ PROPIEDADES    │
│ + Sección│         CANVAS (iframe)          │ Contenido      │
│ + Texto  │         sitio real               │ Diseño         │
│ + Imagen │                                  │ Tipografía     │
│ + Botón  │                                  │ Colores        │
│ + Hero   │                                  │ Espaciado      │
│ …        │                                  │ Responsive     │
│          │                                  │ Avanzado       │
│ ESTRUCTURA (árbol de nodos)                 │                │
└──────────┴──────────────────────────────────┴────────────────┘
```

- **No** es un mini-Word por cada texto. Click en el canvas → selección (postMessage iframe ↔ parent) → inspector.
- Edición de texto corta: contenteditable opcional en el canvas **sincronizado** al documento (un solo write path). Textos largos: inspector.
- Breakpoints: el iframe se redimensiona (desktop 100 %, tablet 768, mobile 390). Los mismos componentes, distinto CSS compilado.

### H.2 Comunicación canvas

```
Parent → iframe: { type: 'select', id }
         { type: 'hover', id }
         { type: 'setBreakpoint', bp }
iframe → parent: { type: 'clicked', id, path }
         { type: 'ready' }
```

En preview, el renderer añade `data-krg-id` en nodos. Ese atributo **no** se imprime en publicado.

### H.3 Overlay de sección (sobre el canvas)

Controles reales: Editar · Duplicar · Subir · Bajar · Ocultar/Mostrar · Guardar plantilla · Eliminar (confirmación modal: nombre de la sección + “Esta acción no se puede deshacer desde aquí, solo desde Historial”).

### H.4 Autosave y conflicto

- Debounce 2 s tras mutación.
- `If-Match` checksum del servidor. Si otro usuario publicó, se muestra “El contenido cambió en el servidor” + diff simple / forzar.
- Beacon `visibilitychange` para no perder el último patch.
- Estados UI: `Guardando…` · `Guardado` · `Error al guardar` (reintento).

### H.5 Undo local

Stack de documentos en memoria (50). Undo/redo no pisa revisiones de servidor. Ctrl+Z.

### H.6 Historial servidor

Vista: lista de snapshots (fecha, autor, origin). Restaurar escribe sobre **draft** (no publica solo). Comparación v1: JSON estructural (secciones añadidas/eliminadas/props).

---

## I. Blog

### I.1 Independiente del builder

Motor distinto. Produce HTML semántico:

`h2–h3, p, ul/ol, blockquote, figure>img, a, hr, pre/code`

Toolbar: título (ya en campo), subtítulo, destacada, párrafos, headings, listas, citas, enlaces, imágenes, videos (oembed allowlist), galerías, separadores.

**No** Gutenberg. **No** JSON de secciones (salvo que una “página de artículo” use el builder alrededor del post).

### I.2 Rutas

Usar rewrites WP estándar, configurables:

- `/blog`
- `/blog/{slug}`
- `/blog/category/{cat}`
- `/blog/tag/{tag}`
- `/blog/author/{author}`

Plantillas: `home.php` / `archive.php` / `single.php` renderizan componentes de blog (grid, related, etc.) con **documentos de archivo** opcionales (un “page document” para el index del blog) o un template PHP que ensambla componentes de registry — misma familia visual.

### I.3 Funciones

CRUD real, draft, publish, schedule (`post_date` futuro), categorías, tags, autor, destacada, extracto, SEO, slug, fecha, OG.

Front: buscador (`search.php` limitado a posts), related (misma category), recent, paginación `the_posts_pagination`.

---

## J. Seguridad

### J.1 Controles

| Amenaza | Control |
|---|---|
| CSRF | Nonce REST `X-WP-Nonce` + `wp_rest` |
| XSS | Escape en render (`esc_html`, `esc_url`, `esc_attr`); richtext `wp_kses`; no `innerHTML` con props crudas en admin |
| Inyección | `$wpdb->prepare`; no SQL dinámico con input |
| Privilegios | `current_user_can` en cada ruta y en cada vista admin |
| URL abierta | Allowlist de protocolos `http/https/mailto/tel/#`; Maps con host allowlist |
| Upload | Solo media WP (caps nativas) |
| JSON | Validación schema; tamaño máximo de documento; `json_decode` assoc + version |
| Preview leak | Token nonce + cap; drafts no indexables (`noindex` + `X-Robots-Tag`) |
| Debug | `meridian_settings.debug` off por defecto; logs sin passwords/nonces |

### J.2 Sanitización por schema

`Sanitizer::document($json, Registry)` recorre nodos, elimina keys desconocidas, casteaa tipos, recorta repeaters (max 50 items v1). Si el JSON es ilegible: no se guarda, mensaje “El contenido no pudo guardarse.”, log técnico.

### J.3 Errores humanos

| Interno | Usuario |
|---|---|
| excepción al guardar | El contenido no pudo guardarse. |
| URL inválida | El enlace introducido no es válido. |
| attachment fallido | La imagen no pudo cargarse. |
| publish fail | Se produjo un error al publicar. |
| Maps | La URL introducida no es válida. |

`WP_DEBUG_DISPLAY` se fuerza off en rutas KRG CMS. El modo DEBUG del CMS escribe en `wp_meridian_logs` o `debug.log`, nunca en el HTML público.

---

## K. Responsive

### K.1 Breakpoints (tokens)

| Nombre | Default | Token |
|---|---|---|
| Mobile | 0–767 | base |
| Tablet | 768–1023 | `--bp-tablet` |
| Desktop | 1024+ | `--bp-desktop` |

Editables en Apariencia → Responsive. El compilador no asume magia.

### K.2 Modelo de estilos

Desktop-first:

```
styles.desktop = base
styles.tablet  = overrides
styles.mobile  = overrides
```

Propiedades responsive por nodo (cuando el schema marca `responsive: true`):

tamaño de tipo, padding, margin, gap, columnas, alineación, orden (`order`), visibilidad por breakpoint.

Visibilidad:

```
hiddenOn: ['mobile']
```

→ CSS `display: none` en ese media, no se elimina el HTML (a11y: si es nav, se usa patrón de menú).

### K.3 Preview

El builder no simula con otro markup. Cambia el ancho del iframe y aplica el mismo CSS público. Tablet/mobile usan exactamente `DocumentCssCompiler`.

---

## L. Plan de desarrollo por fases

Regla: **no se avanza de fase si la anterior no pasa su checklist.**  
Cada fase termina con algo **usable y persistente**, no con mocks.

### Fase 1 — Arquitectura base
Tema instalable, autoload, constants, installer dbDelta, caps, disable Gutenberg en pages, enqueue vacío, README esqueleto.  
**Criterio:** activar tema sin fatales; tablas creadas.

### Fase 2 — Design Tokens
Modelo JSON, preset Marca + Editorial Mint, TokenCompiler, pantalla admin Colores/Tipografía/Espaciado **funcional**, CSS `:root` en público.  
**Criterio:** cambiar primario y ver el cambio en una página PHP de prueba que use `var(--color-primary)`.

### Fase 3 — Modelo de contenido
PageRepository, documento vacío al crear page, draft/published meta, REST GET/PATCH pages, checksum, revisiones tabla.  
**Criterio:** crear página, guardar JSON, recargar y ver lo mismo.

### Fase 4 — Sistema de componentes
Registry, 5 componentes piloto: section, heading, paragraph, image, button. Schema + render + sanitizer.  
**Criterio:** un documento JSON escrito a mano se renderiza en `/pagina/`.

### Fase 5 — Renderer
PageRenderer, resolución de globales (stub), mediaMap, visibilidad, HTML semántico, CSS de documento, no imprimir data-ids en publish.  
**Criterio:** página publicada = HTML limpio.

### Fase 6 — Constructor (núcleo)
UI builder: paleta, canvas iframe, selección, inspector generado, add/duplicate/move/hide/delete sección con confirmación, autosave real, preview breakpoints.  
**Criterio:** el flujo del brief §51 funciona con Hero + textos + botón.

### Fase 7 — Panel administrativo
Shell dashboard, listado páginas, plantillas seed, identidad (logo/favicon), tokens UI completa, settings/debug.  
**Criterio:** se navega todo el menú §24; cada ítem hace algo real (aunque algún módulo aún sea “listado + CRUD mínimo”).

### Fase 8 — Blog
Editor semántico, categorías, tags, autores, single/archive/search, componentes blog-grid/related/recent, SEO de post.  
**Criterio:** crear, programar, publicar, ver `/blog/post-slug`.

### Fase 9 — Header / Footer / Menús
Documentos header/footer en builder reducido, menús anidados, sticky/logo/CTA, footer columnas.  
**Criterio:** cambiar logo y un enlace y verlo en todo el sitio.

### Fase 10 — SEO
Meta por página/post, OG, canonical, robots, sitemap.xml generado, schema.org básico (Organization, Article, Breadcrumb).  
**Criterio:** ver meta en el HTML; sitemap responde.

### Fase 11 — Responsive completo
Overrides por breakpoint en inspector, columns 4/2/1, visibilidad, preview D/T/M fiel.  
**Criterio:** una grid de cards es 4/2/1 sin CSS a mano.

### Fase 12 — Seguridad
Auditoría de caps, kses, URL validator, maps, nonces, pruebas de usuario editor/autor.  
**Criterio:** autor no edita tokens; XSS de richtext no ejecuta.

### Fase 13 — Optimización
Cache documento/CSS, enqueue condicional, lazy images (`loading="lazy"` + sizes), evitar N+1 de attachments y globales.  
**Criterio:** página con 8 secciones < queries razonables; CSS tokens una sola vez.

### Fase 14 — Testing + catálogo restante
Resto de componentes del catálogo v1 (faq, tabs, map, forms, timeline…), import/export JSON, plantillas, checklist §M.  
**Criterio:** aceptación §60.

**Componentes restantes se implementan por oleadas dentro de 4, 6, 8, 9, 14**, no todos en la fase 4. Fase 4 es el **contrato** + piloto. Sin contrato sólido, el catálogo explota.

Orden de construcción inmediata tras aprobación:

1. Tema + core bootstrap  
2. Tokens + compilador  
3. Documento + REST  
4. 5 componentes + renderer  
5. Builder mínimo viable  
6. Luego se ensancha.

---

## M. Checklist de pruebas

### M.1 Páginas / builder

- [ ] Crear página (nombre, slug únicos)
- [ ] Slug inválido se sanitiza
- [ ] Agregar sección (Hero y Section vacía)
- [ ] Agregar heading, paragraph, image, button
- [ ] Editar texto y persistir recargando
- [ ] Cambiar tag H1–H6
- [ ] Cambiar alineación
- [ ] Cambiar tipografía (familia, size, weight)
- [ ] Cambiar color **por token** y **custom**
- [ ] Cambiar padding/margin
- [ ] Cambiar imagen vía media library (no URL a mano)
- [ ] Alt text se imprime
- [ ] Botón: texto, URL interna, URL externa, target
- [ ] URL inválida → mensaje humano
- [ ] Reordenar secciones ↑↓
- [ ] Duplicar sección (nuevos IDs, no clona UUID)
- [ ] Ocultar sección: no sale en público, sí en builder
- [ ] Eliminar pide confirmación; cancelar no borra
- [ ] Eliminar confirma y borra de verdad
- [ ] Guardar draft no publica
- [ ] Preview muestra draft no publicado
- [ ] Publicar refleja en permalink
- [ ] Autosave sobrevive F5
- [ ] Restaurar revisión
- [ ] Duplicar página
- [ ] Subpágina (parent) y permalink anidado
- [ ] Guardar sección como plantilla e insertarla en otra página
- [ ] Componente global: editar global afecta dos páginas
- [ ] Override de instancia no altera el global
- [ ] Desvincular

### M.2 Design system

- [ ] Cambiar `--color-primary` actualiza botones/links
- [ ] No hay hex de marca en CSS de componentes (`rg` de `#D94E27` = 0 en `/components`)
- [ ] Cambiar fuente heading
- [ ] Cambiar radius de botones
- [ ] Cambiar max-width
- [ ] Activar preset Editorial Mint y volver a Marca
- [ ] Exportar / importar tokens JSON
- [ ] Logo y favicon

### M.3 Responsive

- [ ] Preview D/T/M usa el mismo HTML
- [ ] Columns 4/2/1
- [ ] Padding distinto en mobile
- [ ] Ocultar en mobile
- [ ] Breakpoints editables se respetan

### M.4 Blog

- [ ] Crear, draft, publish, schedule
- [ ] Categoría, tag, autor, destacada, extracto
- [ ] HTML limpio (sin divs basura de Gutenberg)
- [ ] `/blog`, single, category, tag, author, search, related, paginación
- [ ] SEO title/description/OG en `<head>`

### M.5 Nav / chrome

- [ ] Menú header con submenú
- [ ] Enlace interno sobrevive cambio de slug
- [ ] Header sticky, logo width, CTA
- [ ] Footer columnas, copyright, sociales
- [ ] Mobile nav operable por teclado

### M.6 Formularios / maps

- [ ] Contacto envía (mailer WP)
- [ ] required y mensajes
- [ ] Map URL mala → “La URL introducida no es válida.”
- [ ] Map URL buena renderiza iframe

### M.7 Seguridad / permisos

- [ ] Editor no entra a tokens
- [ ] Autor no publica páginas KRG CMS
- [ ] REST sin nonce → 401/403
- [ ] Script en heading se escapa
- [ ] Preview de draft no es público anónimo

### M.8 Calidad

- [ ] Cero fatales en UI
- [ ] Lighthouse a11y razonable (labels, contraste inicial Marca)
- [ ] Focus visible
- [ ] No se cargan JS de map en páginas sin map
- [ ] Import/export de una página JSON redondo

---

## Riesgos técnicos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Documento JSON gigante | Autosave lento, meta size | Límite de nodos; revisiones en tabla; checksum; no duplicar media binaria |
| Preview ≠ público | Desconfianza | Un solo renderer; iframe; cero CSS “de builder” en nodos |
| Gutenberg / editores rivales | Corrupción de `post_content` | Disable Gutenberg en pages; `post_content` se regenera solo al publicar |
| N+1 queries | Render lento | `mediaMap` y `globalMap` precargados |
| CSS infinito por nodo | Peso | Omitir bloques `styles` vacíos; agrupar breakpoints |
| Conflictos de temas hijo / plugins que imprimen CSS | Identidad rota | Prefijo `.krg-root`; tokens en `:root` con especificidad controlada |
| wp_options autoload enorme | Memoria WP | Tokens compactos; presets no autoload |
| Multi-usuario en el mismo draft | Pérdida de trabajo | checksum `If-Match` |
| Maps / oEmbed XSS | Seguridad | host allowlist |
| i18n de contenido futuro | Rehacer modelo | IDs estables; strings en `props` planos (no concatenados); no copiar layouts por idioma en v1, pero no fusionar idiomas en un string |
| Dark mode futuro | Reescritura | Solo semánticos |
| Admin vanilla JS se vuelve ingobernable | Deuda | Módulos por vista; si supera umbral, extraer build **solo admin** |
| Theme review wp.org | Rechazo | Este producto es **tema a medida / cliente**, no se diseña para el directorio |
| Paleta Swap vs Marca | Confusión de marca | Presets separados; Marca es default |
| Imagen de colorimetría ausente | Desvío visual | Usar HEX del brief; ajustar cuando llegue la imagen |
| Alcance (40+ componentes + builder + blog) | No terminar | Piloto 5 componentes → builder real → oleadas. No catálogo completo antes del builder. |
| `page` nativo vs CPT propio | Choque con páginas WP previas | Onboarding: “Las páginas se editan con KRG CMS”; migrar `post_content` clásico a una sección Rich Text si se detecta HTML legacy |

### Escalabilidad

- **Horizontal de contenido:** el renderer es O(nodos). Aceptable hasta cientos de nodos por página. Advertir en UI > 80 nodos.
- **Globales:** invalidación por índice `globalId → post_ids` (option o table) para no escanear todas las páginas.
- **Cache:** fragment cache de header/footer; page cache compatible (no nonce en público).
- **API:** la misma REST habilita app móvil / editor externo después, sin segundo backend.
- **Extensión:** `meridian_register_component` hook. Documentado en `docs/COMPONENTS.md`.

---

## API interna (contrato v1)

Base: `/wp-json/krg/v1`

| Método | Ruta | Cap |
|---|---|---|
| GET | `/pages` | edit_pages |
| POST | `/pages` | edit_pages |
| GET | `/pages/{id}` | edit |
| PATCH | `/pages/{id}` | edit |
| POST | `/pages/{id}/publish` | publish |
| POST | `/pages/{id}/duplicate` | edit |
| GET | `/pages/{id}/revisions` | edit |
| POST | `/pages/{id}/revisions/{rid}/restore` | edit |
| GET/PUT | `/tokens` | meridian_manage |
| POST | `/tokens/presets/{slug}/activate` | meridian_manage |
| GET/PUT | `/header` `/footer` | meridian_manage |
| GET/POST/PUT | `/menus` | meridian_manage |
| GET | `/registry` | edit_pages |
| CRUD | `/globals` `/templates` | templates |
| GET/PUT | `/settings` | meridian_manage |
| GET/PUT | `/seo` | meridian_manage |
| POST | `/export` `/import` | meridian_manage |
| CRUD | `/blog` (wrapper posts) | edit_posts |

Errores: `{ "code": "meridian_invalid_url", "message": "El enlace introducido no es válido." }`

---

## SEO técnico (v1)

- HTML5 semántico: `header`, `nav`, `main`, `section`, `article`, `footer`.
- Un H1 por página (el schema de heading avisa si hay dos).
- Canonical, robots, OG, Twitter cards.
- `sitemap.xml` (páginas publicadas + posts).
- `robots.txt` vía filtro WP.
- JSON-LD: WebSite, Organization (identidad), Article en single, BreadcrumbList si hay jerarquía.
- URLs limpias (permalinks WP).
- Imágenes: `alt`, `width/height`, lazy.

---

## Accesibilidad (v1)

- Focus visible global (`:focus-visible` con token).
- Skip link.
- Botones son `a` o `button` reales, no `div`.
- Labels en forms.
- Contraste inicial Marca: naranja `#D94E27` sobre blanco se valida; si un par falla WCAG AA, el admin de colores muestra aviso (no bloquea).
- Menú mobile: teclado y `aria-expanded`.
- Iframe maps: `title` obligatorio.

---

## Import / export

Paquete JSON:

```json
{
  "krg": 1,
  "exportedAt": "2026-09-28T12:00:00Z",
  "tokens": {},
  "pages": [ { "title": "", "slug": "", "sections": [] } ],
  "globals": [],
  "templates": [],
  "menus": [],
  "header": {},
  "footer": {},
  "settings": {}
}
```

Media: se exportan IDs + URLs; import intenta mapear por archivo o pide re-asociar. v1 no embebe binarios.

---

## Documentación que se escribirá en implementación (no ahora)

- `README.md` — instalación (subir tema, activar, permalinks, crear Home).
- `docs/COMPONENTS.md` — receta `registerComponent`.
- `docs/API.md` — tablas de rutas.
- `docs/TOKENS.md` — capas y presets.
- `docs/TESTING.md` — este checklist vivo.

---

## Criterio de “listo para implementar”

Este documento cubre A–M pedidos. La implementación **no empieza** hasta aprobación explícita, porque hay tres decisiones que deben quedar cerradas:

1. **Nombre del tema** (propuesto: `meridian`) y **preset por defecto** (propuesto: `marca` con HEX del brief, no Swap).
2. **Admin en vanilla JS** (propuesto) vs React solo-admin.
3. **Páginas = CPT `page` nativo** (propuesto) vs CPT `meridian_page` con rewrite.

Cuando apruebes (con o sin ajustes), la Fase 1 es únicamente bootstrap + installer + estructura de carpetas vacía con contratos, no el builder completo.

---

## Qué se construye primero (post-aprobación)

```
Fase 1  tema instalable
Fase 2  tokens vivos en el front
Fase 3  documento persistente
Fase 4  5 componentes reales
Fase 5  renderer público = preview
Fase 6  builder que muta de verdad
…resto
```

Nada de catálogo masivo ni UI falsa antes de que **guardar → recargar → publicar** funcione con una sección real.
