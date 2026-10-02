# Catálogo de lo añadido

Inventario de todo lo nuevo: componentes, herramientas, contenido de arranque y
mejoras del editor. Para la arquitectura y cómo reapuntar el sistema a otra
marca, ver [`REFERENCE-SYSTEM.md`](REFERENCE-SYSTEM.md).

---

## 1. Componentes nuevos (16)

Todos aparecen en el panel «Añadir componente» del constructor, agrupados por
categoría. Todos tienen variantes, son reutilizables y reciben el contenido por
campos: **ninguno trae texto fijo en el código**.

### Resumen

| Componente | Categoría | Para qué sirve |
| --- | --- | --- |
| Título display | Texto | Titular grande en mayúsculas que se revela letra a letra |
| Texto revelado | Texto | Párrafo que aparece palabra a palabra con el scroll |
| Marquesina | Otros | Banda de texto en bucle infinito |
| Pantalla de carga | Otros | Overlay de bienvenida con contador de porcentaje |
| Hero de marca | Contenido | Portada de página |
| Bloque partido | Contenido | Imagen + texto editorial con CTA |
| CTA display | Contenido | Cierre de página a toda anchura |
| Carril de productos | Contenido | Carrusel horizontal de fichas |
| Rejilla de colección | Contenido | Cuadrícula de tarjetas |
| Colección filtrable | Contenido | Biblioteca con filtros, búsqueda y «cargar más» |
| Carrusel de reseñas | Contenido | Opiniones con autor y estrellas |
| Lista numerada | Contenido | Bloques 01, 02, 03… también como acordeón/FAQ |
| Lista de hitos | Contenido | Filas de etiqueta + frase grande |
| Módulo de trazabilidad | Otros | Consulta por código que revela un recorrido |
| Banda de distribuidores | Otros | Franja de logotipos de puntos de venta |
| Tabla de datos | Contenido | Tabla de dos columnas |
| Panel partido | Contenido | Dos mitades a sangre: texto + imagen (con carrusel) |
| Logotipo tipográfico | Texto | Texto monumental con sombra desplazada |

### Detalle

#### Título display
Titular en mayúsculas con el tracking amplio característico del sistema. Es la
pieza tipográfica base para abrir secciones.
- **Tamaño**: `display` · `xl` · `lg` · `md` · `sm`
- **Revelado**: `letters` (letra a letra) · `fade` · `none`
- **Tracking**: `tight` · `normal` · `wide` · `wider`
- **Color**: heredado · primario · secundario · fondo · personalizado
- Antetítulo opcional, etiqueta HTML configurable (h1–h4/p) y ancho máximo.

#### Texto revelado
Párrafo grande que se descubre palabra a palabra al entrar en pantalla. Pensado
para intros editoriales. Tres tamaños, alineación, ancho máximo y tema.

#### Marquesina
Banda horizontal con texto repetido en bucle. El JS duplica la pista para que
no se vean cortes a ninguna anchura.
- **Estilo**: `solid` (verde) · `outline` · `plain` · `dark`
- **Separador**: punto · estrella · barra · icono propio · ninguno
- Velocidad, dirección (izquierda/derecha), 4 tamaños, pausa al pasar el ratón.
- Cada ítem puede llevar enlace.

#### Pantalla de carga
Overlay de bienvenida con etiqueta, claim, contador de porcentaje y barra de
progreso. Duración configurable, imagen opcional y opción de **mostrarlo solo
una vez por sesión**. No aparece dentro del constructor.

#### Hero de marca
La portada de cada página. Titular display + antetítulo + dos subtítulos +
texto + botones.
- **Variante**: `center` · `left` · `split` (imagen al lado) · `compact`
- **Altura**: `full` · `tall` · `medium` · `short`
- **Tema**: `light` · `cream` · `forest` · `dark`
- Imagen de fondo con imagen alternativa para móvil, velo de opacidad
  regulable e indicador de scroll.

#### Bloque partido
Imagen a un lado, contenido editorial al otro, con texto enriquecido y botón.
- **Lado de la imagen**: izquierda / derecha
- **Forma**: `rounded` · `arch` (arco) · `square` · `circle`
- **Proporción**: equilibrada · imagen ancha · texto ancho

#### CTA display
Cierre de página a toda anchura con titular display, texto y botón. Admite un
icono repetido intercalado en el titular (hasta 6), imagen de fondo con velo y
4 temas.

#### Carril de productos
Fichas en carrusel horizontal con cabecera (antetítulo + título + enlace
«ver más»).
- **Disposición**: `rail` (carrusel con flechas) · `grid` (rejilla)
- **Estilo de tarjeta**: `soft` · `outline` · `bare`
- Columnas independientes para escritorio / tablet / móvil.
- Cada tarjeta: título, categoría, descripción, imagen, texto alternativo,
  texto de enlace, URL y badge.

#### Rejilla de colección
La misma tarjeta en cuadrícula. Sirve para recetas, artículos o fichas.
- **Estilo**: `overlay` (texto sobre la imagen) · `stacked` · `outline`
- **Proporción**: vertical · cuadrada · horizontal

#### Colección filtrable
Biblioteca completa: chips de filtro generados automáticamente a partir de las
categorías de los ítems, buscador en vivo y botón «cargar más».
- Número de elementos por página, textos de «Todo», «Cargar más» y del estado
  vacío, todos editables.
- Los filtros y la búsqueda se pueden desactivar por separado.

#### Carrusel de reseñas
Opiniones con texto, autor, origen y puntuación en estrellas.
- 1 a 3 reseñas por vista, autoplay con intervalo configurable.
- Flechas, puntos de navegación, arrastre táctil y pausa al pasar el ratón.

#### Lista numerada
Bloques editoriales numerados. Es el mismo componente para tres usos distintos:
- **`stack`**: lista editorial en una o dos columnas
- **`accordion`**: FAQ desplegable (con opción de abrir el primero)
- **`grid`**: rejilla de tarjetas numeradas
- Formato del número: `01` · `1` · sin número. Número de inicio configurable.

#### Lista de hitos
Filas separadas por línea con una etiqueta pequeña arriba y una afirmación
grande debajo. Cada fila puede enlazar.

#### Módulo de trazabilidad
Herramienta interactiva: el visitante introduce un código y se revelan las
etapas del recorrido del producto.
- Pasos ilimitados, cada uno con título, dato breve, descripción e imagen.
- Textos de marcador, botón, ayuda y error editables.
- **Código de demostración** configurable: si se deja vacío, cualquier valor
  revela el recorrido (útil mientras no hay base de datos de lotes detrás).

#### Banda de distribuidores
Franja con titular y logotipos de puntos de venta. Si un ítem no tiene imagen,
muestra el nombre en tipografía display. Opción de escala de grises que se
quita al pasar el ratón. Cada logo puede enlazar.

#### Tabla de datos
Tabla de dos columnas con encabezados y pie de tabla, para equivalencias,
medidas o información nutricional. Con desplazamiento horizontal en móvil.

#### Panel partido
Dos mitades a sangre, cada una con su propio fondo: un panel de contenido y
otro de imagen. Si cargas varias imágenes, el panel se convierte en carrusel
con flechas y puntos.
- **Altura**: `screen` (pantalla completa) · `tall` · `medium` · `auto`
- **Proporción**: 50/50 · imagen ancha · texto ancho. Imagen a izquierda o derecha.
- **Ajuste de la imagen**: `cover` (sangra) o `contain` (producto recortado sobre fondo)
- **Sello / insignia**: imagen que se superpone sobre el titular, encima del
  texto o en la esquina.
- Botón con **flecha animada** opcional, en 3 estilos.
- Tema independiente para cada mitad.
- En tablet y móvil pasa a una columna con la imagen siempre debajo del texto.

#### Logotipo tipográfico
Texto monumental que ocupa todo el ancho, con sombra desplazada en color
(efecto de relieve) o contorno.
- **Ajuste**: `fill` (se escala solo al ancho de la pantalla, sin JS) o `contain`
- Color del texto y de la sombra por token o personalizado, desplazamiento
  X/Y regulable, enlace opcional.

---

## 2. Componente ampliado

**Formulario de contacto** — se mantiene el que ya existía y se le añade:
- **Estilo de campos**: `boxed` (caja) o `underline` (solo línea inferior).
- **Casillas de suscripción** (repeater): tantas como quieras, cada una con su
  texto y la opción de marcarla como obligatoria. Llegan en el correo.
- **Nota de consentimiento** bajo el botón de envío.
- Campo de mensaje ahora se puede ocultar.

---

## 3. Herramientas del sistema

| Herramienta | Qué hace |
| --- | --- |
| **Preset `honeycomb`** | Paleta, tipografía, espaciado, radios y sombras del sistema. Se cambia desde Apariencia → Diseño y repinta el sitio entero. |
| **Presets intercambiables** | Cualquier JSON en `presets/` aparece solo en el selector. Cambiar de marca = cambiar de preset, sin tocar código. |
| **4 fuentes nuevas** | Archivo, Archivo Black, Anton y Figtree disponibles en el selector de tipografía. |
| **5 temas de bloque** | `light`, `cream`, `surface`, `forest`, `dark`. Casi todos los componentes los aceptan, así que se alternan bandas de color sin escribir CSS. |
| **Utilidades de tracking** | `tight` / `normal` / `wide` / `wider` por bloque, sin alterar los tokens globales. |
| **Columnas por breakpoint** | Campos de escritorio / tablet / móvil en todos los componentes de rejilla. |
| **Espaciado por bloque** | Campos de espacio superior e inferior en los módulos de sección. |
| **Secciones a sangre** | Las secciones marcadas `m-bleed` dejan que el módulo ocupe todo el ancho. Se detecta solo al insertar un módulo a sangre. |
| **Secciones a pantalla completa** | Cualquier sección puede tener altura mínima de pantalla completa, pantalla menos cabecera, 78 % o 50 %, con alineación vertical arriba / centro / abajo. |
| **Animaciones de scroll** | Dos nuevas en el panel Animación de cualquier nodo: «Aparecer al scroll» (el bloque sube y aparece) y «Escalonada» (los hijos entran uno detrás de otro, como el pie de la referencia). Duración, retardo y curva configurables. |
| **Cabecera adaptativa** | La cabecera cambia de color según la sección que tiene debajo, al vuelo. Cada sección declara su piel (`auto` la deduce de la luminancia real del fondo) y la cabecera puede adaptar solo el texto o también el fondo. |
| **Alto de sección a medida** | Además de los presets, la sección acepta un alto exacto en píxeles o en porcentaje de la pantalla. Es un mínimo. |
| **Ancho a sangre** | Cada sección elige hasta dónde llega su contenido: centrado y limitado, ancho completo con margen, o a sangre literal de borde a borde del dispositivo. Sección → Diseño → Ancho del contenido. «De borde a borde» es el valor por defecto. |
| **Mapa editable** | El mapa acepta el iframe pegado de Google Maps y su alto se controla en píxeles o en porcentaje de la pantalla. |
| **Altura a medida** | El panel partido acepta una altura exacta en píxeles o en porcentaje de la pantalla, además de los presets. Es un mínimo: si el texto no cabe, crece. |
| **Cortina por sección** | Cualquier sección puede quedarse quieta mientras la siguiente se desliza por encima y la tapa. Sección → pestaña **Diseño** → *Animación de entrada* → Cortina. Funciona a cualquier altura: si la sección es más alta que la pantalla se ancla por su borde inferior, así que también sirve en paneles partidos a pantalla completa. |
| **Reseñas largas** | El carrusel de reseñas recorta los textos largos al número de líneas que elijas (*Diseño → Líneas antes de recortar*) y añade un enlace **Leer completa** que abre la reseña entera en una ventana, con sus estrellas y su firma. Pon 0 para no recortar nada. |
| **Mayúsculas en reseñas** | Vienen desactivadas: el texto sale tal y como lo escribes. Si las quieres, *Tipografía → Forzar mayúsculas*. |
| **Mayúsculas en todo el sitio** | Ya no las impone ningún módulo. Las manda **Apariencia → Identidad y tokens → Tipografía**, con un selector *Mayúsculas* por cada rol (Display, H1…H6, Párrafo, Botón, Etiqueta, Pie). Por defecto «Como se escribe». Cambiar el rol **H2** afecta a todos los titulares de sección; **Pie / caption** a los antetítulos, etiquetas y metadatos; **Botón** a los botones. |
| **Secciones vacías** | Una sección sin ningún módulo dentro ya no reserva alto: ni el preajuste de pantalla, ni el ritmo vertical. Se detecta en el servidor bajando por filas y columnas, así que una fila con columnas vacías también cuenta como vacía. En el constructor conserva 120 px para que puedas seleccionarla y soltar contenido. **Excepción:** si le pusiste una altura «A medida», se respeta — esa la escribiste tú y sirve de separador. |
| **¿Quién manda en el alto?** | Con la altura «A medida» aparece este selector. **La sección** (por defecto): la sección impone su alto y los módulos de dentro (panel partido, portada, mapa) se encogen para caber; lo que aun así no quepa se recorta dentro de la sección y el constructor te avisa con los píxeles exactos. **El contenido**: el alto es sólo un mínimo y manda el módulo. En móvil siempre se comporta como mínimo, para no recortar texto. |
| **Dos sitios con altura** | La sección y el panel partido tienen cada uno su alto, y son cosas distintas: el del panel es el del módulo, el de la sección es el del bloque que lo contiene. Si quieres mandar desde la sección, pon su altura «A medida» con «La sección manda»; el alto del panel pasa a dar igual. |
| **Vista previa en vivo** | El lienzo del constructor se recarga solo en cuanto se guarda el cambio, conservando el scroll y el elemento seleccionado. El botón **Actualizar vista** de la barra superior lo fuerza a mano, y **Preview** guarda antes de abrir la pestaña, así que siempre muestra lo último. |
| **Alto y cabecera por sección** | En el mismo panel: alto mínimo (pantalla completa, etc.), alineación vertical y color de la cabecera al pasar por encima. |
| **Presets propios** | Apariencia → Presets → Crear un preset: guarda la paleta y tipografías actuales con nombre. Se pueden borrar; los que trae el tema no. |
| **Colores del CMS** | Apariencia → Colores del CMS: reskin del propio panel (12 colores), con vista previa en vivo, propuesta a partir de la paleta del sitio y restablecer. |
| **Colores a medida** | Apariencia → Colores → Añadir un color: crea tokens nuevos disponibles como `var(--color-nombre)`. Los del núcleo no se pueden quitar. |
| **Pie cortina** | El pie se queda quieto al fondo y el contenido de la página se desliza por encima descubriéndolo al llegar al final. Chrome → Pie → Diseño → Cortina. |
| **Revelado del pie** | El pie tiene su propio ajuste de revelado (escalonado / entero / ninguno) en Chrome → Pie → Diseño. |
| **Aviso de instalación incompleta** | Si falta algún archivo del sistema, el admin lo dice y lista cuáles, en vez de romper el sitio. |

### Comportamientos (JS)
Todo en un único archivo, sin dependencias, y **respetando
`prefers-reduced-motion`**:
revelado al entrar en pantalla · marquesina sin cortes · flechas del carril con
desactivado en los extremos · carrusel con autoplay, puntos y arrastre táctil ·
filtros + búsqueda + paginación · validación del módulo de trazabilidad ·
pantalla de carga con memoria de sesión · header pegajoso.

---

## 4. Contenido de arranque

Se crea solo en la primera activación y **es contenido normal**: se puede
editar, duplicar, ocultar, reordenar y borrar.

**Seis páginas**, cada una montada con los componentes de arriba:

| Página | Qué contiene |
| --- | --- |
| Inicio | Pantalla de carga → hero → marquesina → trazabilidad → carril de productos → bloque partido → reseñas → distribuidores → CTA |
| Productos | Hero → marquesina → rejilla de más vendidos → rejilla regional → reseñas → CTA |
| Nosotros | Hero → historia → misión → lista numerada de prácticas → forma de trabajar → lista de hitos → carril |
| Cocina | Hero → recetas destacadas → título display + texto revelado → trucos → tabla de equivalencias → recetario filtrable → maridajes → carril |
| Preguntas frecuentes | Hero → acordeón de 12 preguntas → CTA |
| Contacto | Hero → formulario con suscripciones y consentimiento → marquesina |

Además: **menús** de header y footer, **chrome** (colores de cabecera y pie) ya
alineados con la paleta, y **10 plantillas en la biblioteca** listas para
arrastrar a páginas nuevas (hero, marquesina, trazabilidad, carril, bloque
partido, reseñas, CTA, acordeón, hitos y colección filtrable).

---

## 5. Mejoras del editor y del admin

- **Sub-campos de repeater**: los elementos repetibles ya aceptan listas
  desplegables, interruptores y campos numéricos, no solo texto. Antes, cosas
  como la puntuación de una reseña o el «obligatorio» de una casilla se
  editaban como texto plano.
- **Valores iniciales correctos** al añadir un elemento nuevo a un repeater
  (según el tipo de cada sub-campo).
- **Reskin del panel**: paleta del sistema en todo el admin y el constructor.
  Los colores que estaban escritos a mano en el CSS del constructor pasaron a
  variables, así que ahora cambian con el tema.
