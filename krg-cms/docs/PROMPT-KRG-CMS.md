# Prompt para replicar KRG CMS (v1.12.4)

Copia todo lo que está entre las líneas `---` y pégalo al agente cuando instales o cambies de WordPress. El objetivo es **el mismo CMS ya funcional**, no un tema nuevo desde cero.

---

Eres un agente que instala y mantiene **KRG CMS**, un tema WordPress autosuficiente: CMS + constructor visual + design system. El administrador construye páginas, blog, identidad y navegación **sin tocar PHP, HTML, CSS ni JS**.

## Cómo entregar (prioridad)

1. **No reinventes el producto.** Si existe la carpeta del tema (slug técnico `krg-cms`, Theme Name **KRG CMS**, versión **1.13.9 o superior**), cópiala a `wp-content/themes/krg-cms/`, actívala, guarda enlaces permanentes (Nombre de la entrada) y abre el menú **KRG CMS**.
2. Solo implementa o parchea código si esa carpeta no está o falta una función de esta lista.
3. El nombre **visible** es **KRG CMS**. Lo interno puede seguir siendo `Meridian\`, opciones `meridian_*`, caps `meridian_*`, carpeta `meridian`. Lo que el usuario ve (menú, URLs de admin `?page=krg*`, REST `krg/v1`, preview `krgcms_preview`, HTML `krg-admin`) debe decir KRG / krg / krgcms, nunca “Meridian”.

## Prohibido

- Elementor, Divi, WPBakery, Beaver, Bricks, Visual Composer, builders comerciales o SaaS obligatorio.
- Gutenberg/bloques como motor de páginas. Motor propio: página → secciones → componentes (JSON). Gutenberg off en `page`.
- Hardcodear marca (`#D94E27` u otros hex de marca) en CSS de componentes. Todo visual por **tokens** `var(--color-*)` / `var(--font-*)`, editables en admin.
- Copy hardcodeado dentro de archivos de componente: el contenido vive en props/JSON.
- UI fake: add/delete/save/publish/color/blog deben ser reales.
- Fatals/stack traces en la UI. Errores al admin en **español humano**.
- Implementar “todo de una vez” en fases nuevas: no abras fase siguiente hasta que la anterior funcione.

## Qué tiene que funcionar al 100%

### Panel
- Menú WP nivel 2, icono layout, título **KRG CMS**. SPA propia (esconde barra WP).
- Sidebar: Inicio, Asistente de identidad, Páginas, Blog, Plantillas, Componentes globales, Identidad y tokens, Navegación, Header/Footer visual, SEO, Usuarios, Configuración, Ver sitio.
- **Flecha ← a la izquierda del logo** que vuelve a `wp-admin` (escritorio). También en el constructor.
- El ítem activo del menú es el correcto: Plantillas ≠ Páginas; Globales ≠ Páginas; Asistente ≠ Inicio.
- Admin slugs: `krg`, `krg-pages`, `krg-builder`, `krg-blog`, `krg-design`, `krg-nav`, `krg-seo`, `krg-users`, `krg-settings`. Redirigir `page=meridian*` → `page=krg*`.

### Constructor de páginas (real)
- Canvas iframe (preview autenticada). Desktop / Tablet / Mobile.
- Árbol + paleta: sección, contenedor, columnas, hero, cards, FAQ, CTA, form, mapa, blog, etc.
- Autosave PATCH con nonce WP **y** checksum juntos (el `...opts` del fetch **no** puede pisar `headers`; si no, 403 “no tienes permisos”).
- Publicar escribe HTML público. Draft no se ve anónimo.
- Deshacer / Rehacer / Historial (Ctrl+Z/Y). Preview y Publicar.
- Botones ghost de la barra marrón: **texto claro**, no negro.
- Duplicar/eliminar página, padre, plantillas, globales, desvincular.

### Color y tipografía del inspector (crítico)
- Color texto / Fondo del **elemento seleccionado**: solo **selector nativo + hex**. No obligar a elegir token. **No mutar tokens globales.**
- El color se aplica **ya** en el canvas (inyección CSS live) y al guardar. Compilar con `!important` sobre el nodo **y** títulos internos (`.m-hero-title`, `.m-heading`, `h1–h6`, etc.). Si no, el título sigue `var(--color-text)` y “no cambia el color”.
- Tamaño: estilos (Título 1…) **o** px. Familia: Títulos/Cuerpo/Especial. Peso: 300–800.
- Campos `type=color` de componente (fondo de sección, etc.): mismo picker; guardar `{ mode: "custom", value: "#hex" }` en **ese** nodo.

### Header / Footer visual
- Mismos Deshacer / Rehacer / Historial.
- Mismos pickers de color (solo ese header/footer, no la paleta).
- Guardar escribe chrome público.

### Preview
- Query **`?krgcms_preview=1&_wpnonce=...`** (nonce `krgcms_preview`). Aceptar legacy `krg_preview` y `meridian_preview`.
- Nunca mostrar `meridian_preview` en URLs nuevas.

### Identidad / tokens / nav / blog / SEO
- Asistente: nombre, logo, favicon, paleta → aplica de verdad.
- Apariencia: tokens, presets Marca / Editorial Mint, export/import JSON.
- Menús header/footer, CTA, sticky, logo.
- Blog real (crear, draft, publish, cats/tags, HTML semántico).
- SEO por página + global, `/sitemap.xml`.

### Usuarios
- CRUD de cuentas WP desde KRG CMS (login, nombre, email, rol, contraseña).
- Matriz permisos por rol. Admin no pierde `meridian_manage`. No borrar la propia cuenta ni el último admin.
- REST `/users`, `/roles`. Caps: `meridian_manage`, `meridian_edit_pages`, `meridian_publish_pages`, `meridian_manage_templates`.

### Técnico
- REST `krg/v1`. Fetch admin: `credentials: same-origin`, `X-WP-Nonce`, y extras (checksum) **sin** sobrescribir headers.
- Formularios contacto: clase `js-krg-form`, action `krg_contact` (aceptar legacy meridian).
- WCAG-oriented, HTML semántico, nonces/caps/sanitización.
- i18n y dark mode preparados, no hace falta implementarlos en v1.
- PHP 8.1+, WP 6.4+.

## Criterio de aceptación (humo)

1. Activar tema → menú **KRG CMS** → flecha vuelve a wp-admin.
2. Páginas: editar Hero, cambiar **solo** el color del título con el picker → se ve en el canvas al instante → Publicar → el visitante lo ve. Los demás componentes no cambian de paleta.
3. Guardar no muestra “Lo siento, no tienes permisos”.
4. Preview URL contiene `krgcms_preview`, no `meridian`.
5. Plantillas / Globales / Asistente marcan su propio ítem del menú.
6. Header visual: Deshacer funciona.
7. Crear usuario Editor: entra, no ve tokens.
8. Home pública 200, `/sitemap.xml` 200.

Si algo de esa lista falla, arréglalo antes de añadir features nuevas.

---
