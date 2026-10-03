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
- **un tema son dos variables, no dos colores fijos**: cada clase declara
  `--m-th-bg` y `--m-th-fg`, y una sola regla (`[class*="is-theme-"]`) las
  pinta. Un bloque puede pisar una de las dos en línea sin `!important` y sin
  renunciar al tema; es lo que usan los campos «Color de fondo» y «Color del
  texto» del panel. Las variables se heredan, pero un bloque anidado con su
  propia clase de tema las vuelve a declarar sobre sí mismo, así que no se
  contaminan;
- cada componente emite `m-c-{tipo} m-n-{id}` (de `RenderContext::node_class()`),
  que es el enganche de los estilos por nodo del inspector;
- esos estilos salen **una sola vez**, en la hoja del documento, sin
  `!important` y en los tres tamaños. Antes salían dos veces —el tamaño base
  también en el atributo `style`— y como el atributo gana siempre, las reglas
  de tablet y móvil necesitaban `!important` para poder corregir a su propia
  pareja. Lo que garantiza que esa hoja mande no es el orden de carga ni la
  especificidad, sino la capa: las tres hojas del tema viven en `@layer krg` y
  la del documento no vive en ninguna, y en CSS lo que no está en una capa gana
  a lo que sí lo está. Por eso el atributo `style` de un bloque solo lleva lo
  suyo (`--m-sec-h`, parallax) y nunca relleno, margen ni fondo;
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
| `data-sp-carousel` | split-panel | carrusel del panel de imagen |
| `data-carta` | menu-list | pestañas de categoría, filtrado y estado vacío |
| `data-header-skin` | secciones y bloques | declara si la cabecera necesita texto claro u oscuro |
| `data-adaptive` | cabecera | `text` o `full`: qué adapta la cabecera al pasar sobre cada sección |

Todo respeta `prefers-reduced-motion` (los estados finales se aplican de golpe)
y se salta en el preview del constructor cuando mostraría un overlay.

### 3.2 Tres contextos de render

El mismo render sirve tres situaciones y la diferencia está en dos marcas de
`RenderContext`:

| Contexto | URL | `isPreview` | `isCanvas` | Qué cambia |
| --- | --- | --- | --- | --- |
| Web pública | la normal | `false` | `false` | lo publicado |
| Pestaña «Preview» | `?krgcms_preview=1` | `true` | `false` | **idéntica a la pública**, solo que lee el borrador y lleva `noindex` |
| Lienzo del constructor | `…&krgcms_canvas=1` | `true` | `true` | andamiaje de edición |

Todo el andamiaje —secciones vacías impresas con su banda de 120 px, avisos
de «añade contenido», contornos de las columnas, bloques apagados con el
interruptor, atributos `data-krg-id`/`data-krg-chrome`, el guion `preview.js`
que captura los clics para seleccionar y la clase `krg-canvas` del body—
depende de `isCanvas`. Nada de eso puede colgar de `isPreview`: «Preview» es
la web pública y sus enlaces tienen que funcionar.

El lienzo, además, no es un render puro: `paintLiveCss()` del constructor
vuelve a aplicar encima las clases de alto, ancho y alineación de cada
sección y los estilos por nodo, para que editar se vea al instante sin ir al
servidor. Por eso el lienzo nunca debe ser la referencia de qué se publicó:
si lienzo y «Preview» no coinciden, manda «Preview».

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

## 5.1 Cabecera adaptativa

Reproduce el cambio de color de la cabecera según la sección sobre la que
pasa, sin que el editor tenga que calcular nada:

1. Cada sección emite `data-header-skin="light|dark"`. Con el valor `auto`
   (por defecto) lo deduce `core/design/Contrast.php`, que resuelve el token
   de fondo contra el preset activo y calcula su **luminancia relativa WCAG**.
   Cambiar de paleta recalcula el contraste solo.
2. Los bloques del sistema visual lo declaran desde su propio tema
   (`forest` y `dark` piden texto claro; `cream`, `light` y `surface`, oscuro).
   Un hero con imagen de fondo siempre pide texto claro, porque lleva velo.
3. `modules.js` muestrea en cada scroll qué zona cruza el borde inferior de la
   cabecera y aplica `.is-skin-light` / `.is-skin-dark`. En modo `full` copia
   además el color de fondo calculado de esa zona.
4. Se activa en Chrome → Cabecera → Color adaptativo. El editor puede forzar
   claro u oscuro por sección, o desactivarlo con `none`.

---

## 5.2 Pie cortina

El pie de la referencia no entra animándose: se queda quieto al fondo de la
ventana y es el contenido de la página el que se desliza por encima y lo va
descubriendo de abajo hacia arriba al llegar al final del scroll.

- Se elige en Chrome → Pie → Diseño → Revelado al hacer scroll → **Cortina**.
- `footer.php` marca el pie con `is-reveal-curtain`; nada más cambia en el HTML.
- `initCurtainFooter()` mide el alto real del pie, inserta un espaciador
  equivalente (`.m-curtain-spacer`) para que el documento tenga recorrido de
  sobra, y activa `body.m-curtain-on`.
- Mientras está activo el pie es `position: fixed` al fondo con `z-index: 0`,
  y `.m-page` va por encima con fondo opaco. El fondo se copia del `body` solo
  si la página no tiene uno propio, así que no pisa diseños personalizados.
- **Si el pie no cabe en la ventana** (más del 92% del alto) el efecto se
  desactiva solo y el pie vuelve al flujo normal: si no, nunca podría
  descubrirse entero. Se vuelve a medir al redimensionar y cuando cambia el
  alto del pie.
- Sin JavaScript el pie se queda en flujo normal; el efecto es progresivo.
- Al tabular hacia un enlace del pie todavía tapado, el scroll salta al final
  para que sea visible de verdad.

---

## 5.3 Cortina por sección

El mismo gesto del pie cortina, disponible en cualquier sección:
Sección → Diseño → **Efecto cortina**.

- La sección marcada emite `is-curtain`. `initCurtainSections()` comprueba
  que **cabe en la ventana** y solo entonces añade `is-curtain-on`, que la
  vuelve `position: sticky`. Una sección más alta que la pantalla no podría
  quedarse fija entera, así que se queda normal.
- Las secciones posteriores reciben `.m-curtain-above` para pasar por
  delante. Si alguna es transparente se le da un fondo opaco heredado del
  `body`, porque si no la cortina se vería a través de ella.
- Se puede encadenar: varias secciones con cortina se van apilando.

---

## 5.4 Presets, colores propios y colores del CMS

- **Presets propios** (`core/design/PresetStore.php`): viven en la opción
  `meridian_presets`, no en `presets/*.json`, así que actualizar el tema no
  los borra. Tope de 40. Los de archivo no se pueden editar ni borrar;
  `TokenRepository::load_preset()` mira primero los del usuario.
- Al borrar el preset activo los tokens del sitio **no cambian**: solo deja
  de haber un preset marcado.
- **Colores a medida**: Apariencia → Colores → Añadir un color. El nombre se
  convierte en slug y `TokenCompiler` lo publica como `--color-{slug}`. La
  lista `CORE_COLORS` de `app.js` protege los que usan los componentes.
- **Colores por bloque**: `bgColor` / `textColor` en los veinte bloques de
  marca (y, en la carta, uno por tipo de texto: `titleColor`, `catColor`,
  `nameColor`, `descColor`, `priceColor`, `badgeColor`). Valor vacío =
  manda el tema. Se aceptan hexadecimal y tokens (`var(--color-primary)`).
  El renderizador los emite como variables en línea sobre el elemento que
  lleva la clase del tema; `BrandRenders::theme_style()` es el único punto
  donde se decide eso.
- **Fondo, relleno y margen de un bloque o una sección**: no son campos del
  bloque, son estilos del nodo. Viven en `node.styles.{desktop,tablet,
  mobile}` con nombres de CSS (`background-color`, `padding-top`,
  `margin-left`…), los valida `core/style/BoxStyles.php` y los escribe
  `DocumentCssCompiler` como una regla `.m-n-{id}` por tamaño. No se
  duplican en el atributo `style` ni en variables propias.
- **Colores del CMS** (`core/admin/Skin.php`): doce variables de `admin.css`
  guardadas en `meridian_admin_skin` e inyectadas con `wp_add_inline_style`.
  Si no hay nada personalizado no se emite ni un byte. No tocan el frontend.

---

## 5.5 Vista previa del sistema visual

`krg-cms/docs/vista-previa.html` es una página de verificación con el CSS y
el JavaScript del tema **incrustados**: se abre con doble clic, sin servidor
ni conexión, y muestra los bloques en su marcado real (incluida la anidación
sección → fila → columna que crea el constructor, que es donde se escondían
los fallos de sangrado).

Se regenera con `python3 tools/preview.py`, que además deja una copia con
los assets sueltos en `.preview/` para servirla con un servidor estático.

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
