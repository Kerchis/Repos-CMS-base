# Sistema visual de referencia

Cómo KRG CMS reproduce el lenguaje visual de una marca de referencia sin dejar
de ser un CMS genérico. Este documento describe la tubería
**Design System → Componentes → Secciones → Páginas** y, sobre todo, **qué hay
que tocar para apuntar el sistema a otra referencia** (otras URLs, otra paleta)
sin reconstruir el núcleo.

---

## 1. Principio de diseño

Nada de lo que se ve en el frontend está escrito en el código de render. El
pipeline es siempre el mismo:

```
presets/*.json          → tokens (color, tipografía, espaciado, radios, sombras)
TokenCompiler           → variables CSS en :root
assets/css/modules.css  → sistema visual (primitivas + temas + componentes)
BrandCatalog.php        → esquema editable de cada componente
BrandRenders.php        → HTML semántico de cada componente
ReferenceSeeder.php     → contenido inicial (editable, borrable)
```

Consecuencia práctica: **cambiar la marca = cambiar el preset**. Cambiar la
estructura de una página = arrastrar secciones en el constructor. Ninguna de
las dos cosas requiere tocar PHP.

---

## 2. Design System

### 2.1 Preset

`presets/honeycomb.json` es el preset por defecto. Se selecciona desde
`core/constants.php`:

```php
define( 'MERIDIAN_DEFAULT_PRESET', 'honeycomb' );
```

y se puede sobrescribir sin editar el tema:

```php
add_filter( 'meridian_default_preset', fn() => 'mi-marca' );
```

Los presets se autodescubren con `glob( presets/*.json )`, así que basta con
dejar un JSON nuevo en esa carpeta para que aparezca en el panel de diseño.

### 2.2 Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-primary` | `#3F5E58` | verde profundo: bloques oscuros, botones, acentos |
| `--color-secondary` | `#2B413D` | hover y profundidad |
| `--color-tertiary` | `#5C7D76` | detalles y estados suaves |
| `--color-background` | `#FEF6E7` | crema: fondo general |
| `--color-surface` | `#F7EAD1` | tarjetas y bandas alternas |
| `--color-text` | `#000000` | negro: texto |
| `--color-border` | `#E1D3B6` | líneas sobre crema |
| `--color-on-primary` | `#FEF6E7` | texto sobre verde |

### 2.3 Tipografía

Dos familias: `Archivo` (display/heading, peso 800) e `Inter` (cuerpo).
Lo característico de la referencia no es la familia sino **el tracking**: los
titulares van en mayúsculas con `letter-spacing` entre `0.05em` y `0.1em`, y
tamaños fluidos con `clamp()`.

| Rol | Tamaño | Tracking |
| --- | --- | --- |
| display | `clamp(40px, 7.4vw, 112px)` | `.1em` |
| h1 | `clamp(32px, 5.4vw, 76px)` | `.09em` |
| h2 | `clamp(26px, 3.6vw, 48px)` | `.07em` |
| h3 | `clamp(19px, 2.1vw, 28px)` | `.05em` |
| eyebrow (h6) | `13px` | `.18em` |
| botón | `13px` | `.16em` |

Las utilidades `.m-track-{tight|normal|wide|wider}` permiten ajustar el tracking
por bloque desde el inspector, sin tocar los tokens globales.

### 2.4 Formas

Botones y chips son **píldoras** (`--radius-buttons: 999px`), las tarjetas usan
`20px` y los campos de formulario `0` porque el estilo `underline` del
formulario de contacto es una línea inferior, no una caja.

---

## 3. Componentes

16 componentes nuevos, declarados en `core/components/BrandCatalog.php` y
renderizados en `core/render/BrandRenders.php`. Todos son reutilizables, todos
tienen variantes y todos reciben su contenido por props.

| Slug | Qué resuelve | Variantes principales |
| --- | --- | --- |
| `display-type` | Titular display con revelado por letra | `size`, `tracking`, `reveal`, `colorMode` |
| `marquee` | Banda de texto en bucle | `solid` · `outline` · `plain` · `dark`, velocidad, dirección |
| `preloader` | Overlay de carga con contador | duración, una vez por sesión |
| `brand-hero` | Portada de página | `center` · `left` · `split` · `compact` × 4 alturas × 5 temas |
| `split-feature` | Bloque imagen + texto | lado, forma (`rounded`/`arch`/`square`/`circle`), proporción |
| `statement-cta` | Cierre a toda anchura | 5 temas, icono repetido, imagen de fondo |
| `product-rail` | Carrusel/rejilla de producto | `rail` · `grid`, 3 estilos de tarjeta, flechas |
| `collection-grid` | Rejilla editorial | `overlay` · `stacked` · `outline` × 3 proporciones |
| `filter-collection` | Librería con filtros, búsqueda y «cargar más» | columnas, nº por página |
| `review-slider` | Carrusel de reseñas | 1–3 por vista, autoplay |
| `numbered-list` | Lista numerada | `stack` · `accordion` · `grid` |
| `statement-list` | Hitos: etiqueta + frase grande | con o sin enlace |
| `scroll-text` | Párrafo que se revela palabra a palabra | 3 tamaños |
| `trace-module` | Buscador de lote + recorrido por pasos | tema, alineación, nº de pasos |
| `retail-strip` | Banda de distribuidores | logos o nombres, escala de grises |
| `info-table` | Tabla de equivalencias | 5 temas |

Convenciones de marcado:

- prefijo `m-`, variantes `is-*`, temas de bloque `.is-theme-{light|cream|surface|forest|dark}`;
- cada componente emite `m-c-{tipo} m-n-{id}` (de `RenderContext::node_class()`),
  lo que permite estilos por nodo desde el inspector sin CSS inline;
- el contenido se escapa en el punto de salida (`esc_html`, `esc_attr`, `esc_url`);
  el richtext pasa por `Sanitizer::richtext()`.

### 3.1 Contratos de comportamiento

`assets/js/modules.js` es el único JS del sistema y se engancha por atributos de
datos, nunca por clases de estilo:

| Atributo | Componente | Comportamiento |
| --- | --- | --- |
| `data-reveal` | varios | `IntersectionObserver` → `.is-revealed` |
| `data-marquee` | marquee | duplica la pista hasta cubrir el viewport |
| `data-rail` | product-rail | flechas, scroll suave, desactivado en los extremos |
| `data-review-slider` | review-slider | arrastre táctil, puntos, autoplay, pausa al hover |
| `data-filter-collection` | filter-collection | chips, búsqueda, paginación, estado vacío |
| `data-trace` | trace-module | valida el código y revela los pasos (`.is-traced`) |
| `data-preloader` | preloader | contador, barra y `sessionStorage` |
| `data-scroll-text` | scroll-text | revelado palabra a palabra |

Todo respeta `prefers-reduced-motion` (los estados finales se aplican de golpe)
y se salta en el preview del constructor cuando mostraría un overlay.

---

## 4. Secciones y páginas

Las secciones siguen siendo las del CMS original. La única novedad es la clase
`m-bleed`: una sección marcada así renuncia a su contenedor y a su padding
porque el módulo que contiene ya gestiona ambos (necesario para heroes,
marquesinas y bandas a sangre). Existe además una regla `:has()` que lo detecta
automáticamente cuando el usuario inserta uno de estos módulos a mano.

`core/content/ReferenceSeeder.php` crea seis páginas de ejemplo (Inicio,
Productos, Nosotros, Cocina, FAQ, Contacto), los menús de header y footer y el
chrome con la paleta. **Es contenido, no plantilla**: todo se puede editar,
duplicar, ocultar o borrar desde el constructor, y la biblioteca de plantillas
(`library_items()`) deja los bloques listos para reutilizar en páginas nuevas.

El seeder solo corre una vez, protegido por la opción `meridian_seeded`.

---

## 5. Responsive

Tres saltos reales, no un encogimiento:

- **≥1024px**: rejillas a `--m-cols`, carril horizontal con flechas, hero a altura completa.
- **768–1023px**: `--m-cols-t`, el split pasa a una columna con la imagen arriba, el acordeón ocupa el ancho completo, los pasos del módulo de trazabilidad pasan a 2 columnas.
- **≤767px**: `--m-cols-m`, carril por desplazamiento táctil con `scroll-snap`, flechas ocultas, reseñas a una por vista, tipografías al extremo bajo del `clamp()`, tracking reducido para que los titulares no se rompan.

Las columnas son editables por breakpoint desde el inspector (campos
`desktop` / `tablet` / `mobile` del grupo «responsive»).

---

## 6. Cómo apuntar el sistema a otra referencia

1. **Paleta y tipografía** → duplicar `presets/honeycomb.json`, cambiar valores
   y apuntar `MERIDIAN_DEFAULT_PRESET` (o el filtro) al nuevo slug. Si la nueva
   marca usa otras fuentes de Google, añadirlas en
   `core/design/FontCatalog.php::web()`.
2. **Contenido** → editar las páginas en el constructor, o adaptar
   `ReferenceSeeder.php` si se quiere un arranque distinto.
3. **Componentes nuevos** → añadir el esquema en `BrandCatalog.php` y el método
   de render en `BrandRenders.php`. El nombre del método es el slug con los
   guiones convertidos en guiones bajos (`mi-bloque` → `mi_bloque`);
   `ComponentRenders::render()` lo encuentra solo.
4. **Estilos** → el CSS vive en `assets/css/modules.css` y consume únicamente
   variables de token, así que cambiar el preset repinta todo el sistema.

Lo que **no** hay que tocar para cambiar de marca: el núcleo del constructor, el
sanitizado, el renderizador de documentos, los menús ni las plantillas de
WordPress.

---

## 7. Notas de implementación

- Toda prop editable debe estar declarada como campo en el esquema: `Sanitizer::props()`
  descarta cualquier clave desconocida.
- Los sub-campos de repeater soportan `text`, `textarea`, `image`, `select`,
  `toggle` y `number` (ampliado en `admin/assets/js/builder.js::fieldHtml()`).
- Límites del sanitizador: 50 ítems por repeater, 80 secciones por documento,
  profundidad máxima de 8 nodos.
- `assets/css/modules.css` se encola **después** de `components.css` y
  `assets/js/modules.js` **después** de `public.js`; no hay CSS ni JS duplicado
  entre capas.
- En el frontend, un módulo sin contenido no imprime nada; dentro del
  constructor muestra un aviso `.m-muted` para que el editor sepa qué falta.
