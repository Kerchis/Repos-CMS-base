# Catálogo de lo añadido

Inventario de todo lo nuevo: componentes, herramientas, contenido de arranque y
mejoras del editor. Para la arquitectura y cómo reapuntar el sistema a otra
marca, ver [`REFERENCE-SYSTEM.md`](REFERENCE-SYSTEM.md).

---

## 1. Componentes nuevos (18)

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
| Carta / Menú | Contenido | Carta de restaurante por categorías, con foto y precio |
| Pie partido | Contenido | Pie a dos mitades: imagen + contacto, enlaces y línea legal |

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

#### Carta / Menú
Carta de restaurante editable por categorías. Los platos son una lista y cada
plato elige su categoría de un desplegable que se alimenta de la lista de
categorías: cambiar un plato de grupo es cambiar ese desplegable, y reordenar
es usar las flechas del ítem.
- **Agrupación**: `tabs` (pestañas, una categoría a la vez, filtrado sin
  recargar) o `stacked` (todas las categorías seguidas, cada una con su título).
- **Pestaña «Todo»** opcional, con texto configurable.
- **Categorías** (repeater, hasta 60): nombre y descripción opcional. El orden
  de la lista es el orden de las pestañas y de los bloques.
- **Platos** (repeater, hasta 200): nombre, descripción, precio (texto libre,
  así vale cualquier moneda), categoría, etiqueta («nuevo», «picante»…), foto,
  texto alternativo y enlace opcional.
- **Fotos**: se pueden ocultar, y se eligen tamaño (48–320 px) y forma
  (cuadrada, redondeada o círculo).
- **Guía al precio**: ninguna, puntos o línea fina, como en una carta impresa.
- Color de acento propio (precios y pestaña activa), tema, columnas por
  dispositivo, icono o logo sobre el título y botón final opcional.
- **Color por tipo de texto**: título de la carta, categorías y pestañas,
  nombre del plato, descripción, precio y etiqueta, cada uno con su campo.
  En blanco manda el tema; en cuanto eliges un color, manda el color. Así la
  carta se lee bien sobre cualquier fondo sin depender del desplegable «Tema».
- Si un plato lleva una categoría que no está en la lista, se añade al final en
  vez de desaparecer.

#### Pie partido
Pie a dos mitades, en la línea del Panel partido: una imagen a sangre y, al
lado, el bloque de contacto, las columnas de enlaces y la línea legal. Sirve
como sección de página y también dentro de la región **Pie** del editor de
cabecera/pie.
- **Lado de la imagen**: izquierda o derecha. En tablet y móvil se apila con la
  imagen arriba.
- **Proporción**: 50/50 · imagen ancha · contenido ancho. **Altura**: la del
  contenido, media, alta, pantalla completa o a medida (px o % de pantalla).
- **Contacto**: logo con ancho propio, antetítulo, dato destacado (teléfono,
  que se enlaza solo como llamada si no pones URL) y líneas libres de horario
  o dirección.
- **Redes** (repeater): 13 iconos SVG en línea (sin peticiones externas) y
  nombre accesible por enlace.
- **Columnas de enlaces**: las columnas son una lista de títulos y cada enlace
  elige su columna en un desplegable. Reordenar enlaces o moverlos de columna
  no obliga a rehacer nada.
- **Línea legal**: enlaces legales + copyright, con línea separadora opcional.
- Tema, alineación y tracking propios.

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
| **Secciones vacías** | Una sección sin contenido real **no se imprime** en la web pública: no existe en el HTML, así que no puede ocupar nada — ni altura de pantalla, ni altura a medida, ni relleno, ni margen. Se decide en el servidor bajando por filas y columnas: filas y columnas son andamiaje, no contenido, así que una fila con columnas vacías sigue contando como vacía. Tampoco cuenta lo apagado con el interruptor de visibilidad ni lo escondido a la vez en escritorio, tableta y móvil. **En el constructor sí se ve**, con 120 px de alto, para poder seleccionarla y soltarle contenido; en cuanto le pones algo vuelve a comportarse con su altura configurada, y si lo quitas vuelve a desaparecer. Para dejar un hueco a propósito, usa el módulo **Espaciador**: eso sí es contenido. |
| **¿Quién manda en el alto?** | Con la altura «A medida» aparece este selector. **La sección** (por defecto): la sección impone su alto y los módulos de dentro (panel partido, portada, mapa) se encogen para caber; lo que aun así no quepa se recorta dentro de la sección y el constructor te avisa con los píxeles exactos. **El contenido**: el alto es sólo un mínimo y manda el módulo. En móvil siempre se comporta como mínimo, para no recortar texto. |
| **Sin franjas vacías** | Cuando una sección con altura lleva dentro **un solo** módulo de los que traen alto propio (panel partido, portada o mapa), ese módulo crece hasta llenarla. Antes la diferencia entre las dos alturas quedaba como una franja de fondo vacía debajo del contenido. Crecer nunca recorta: el alto propio del módulo sigue siendo su mínimo, así que si él es más alto, la sección se estira como siempre. |
| **Alineación vertical: Estirar** | Cuarta opción del selector, junto a Arriba / Centro / Abajo. Hace lo mismo a mano y para cualquier contenido: filas y columnas llenan el alto de la sección. Los textos y botones no se separan; sólo crecen los bloques que tienen alto propio. |
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

- **Cada archivo lleva su propia versión.** El CSS y el JavaScript se
  encolaban con una constante escrita a mano (`MERIDIAN_VERSION`), así que
  subir archivos nuevos sin tocarla dejaba al navegador —y a cualquier CDN o
  plugin de caché— sirviendo los viejos desde la misma URL: el PHP era nuevo
  y la interfaz que se ejecutaba era la de antes. Ahora `meridian_ver()`
  añade la fecha del propio archivo y cada subida invalida su caché sola.
- **Si el guardado pierde un estilo, el panel lo dice.** Al guardar, el
  constructor compara lo que envió con lo que el servidor devolvió; si falta
  alguna propiedad, la nombra en un aviso junto al estado. Un ajuste que se
  escribe, se guarda sin error y al recargar aparece vacío ya no es
  invisible.
- **Lo que escribes en el panel viaja con el HTML.** Relleno, margen, fondo
  y demás estilos del tamaño base se emiten además en el atributo `style`
  del propio elemento, no sólo en la hoja de estilos del documento. Esa hoja
  se añade con `wp_add_inline_style`, así que cualquier capa intermedia que
  agrupe, minifique o cachee CSS podía dejarla vieja o fuera: el ajuste se
  guardaba bien y no se veía. Los tamaños tablet y móvil siguen siendo
  reglas con `@media` (en línea no caben) y mandan sobre el base.
- **Aviso cuando el fondo de la sección queda tapado.** El fondo de una
  sección sólo se ve por donde el contenido no llega. Si dentro hay un
  bloque con tema propio (que ocupa la sección entera), lo tapa y parece que
  el campo no hace nada. El panel lo dice y ofrece un botón para saltar al
  bloque, que es donde está el color que se ve.
- **Colores propios en cada bloque de marca, por encima del «Tema»**. Los
  veinte bloques traen «Color de fondo» y «Color del texto» en el grupo
  *Colores*. El tema sigue siendo el atajo (cinco juegos coherentes) pero deja
  de ser la única vía: en blanco manda el tema y, en cuanto hay color elegido,
  manda el color. Se emite como variable en línea (`--m-th-bg` / `--m-th-fg`)
  sobre el mismo elemento que lleva la clase del tema —en el panel partido y
  en el pie partido, sobre el panel de texto—, así que no hace falta ningún
  `!important` ni CSS a mano. La ✕ del campo devuelve el bloque al tema.
- **Los campos de color aceptan tokens del sistema** (`var(--color-primary)`),
  que es justo lo que el panel enseña cuando el color viene del diseño. Antes
  el saneador solo admitía hexadecimal y tiraba el valor sin avisar: el color
  «no se guardaba».
- **Un número en blanco ya no es un cero.** En los espacios en píxeles,
  «en blanco» significa «deja el ritmo del bloque» y un 0 escrito a mano
  significa cero. Antes el saneador convertía el vacío en 0 en cada guardado,
  así que bloques como la carta salían pegados al de arriba y el relleno por
  defecto no se recuperaba nunca.
- **Espacio superior/inferior en todos los bloques que ya lo entendían.**
  Once bloques (carrusel de productos, rejilla, colección filtrable, reseñas,
  lista numerada, lista de frases, bloque partido, llamada a la acción,
  texto al scroll, trazabilidad y tira de tiendas) leían el ajuste en el CSS
  pero no lo ofrecían en el panel, así que el valor se descartaba al guardar.
- **Panel de diseño agrupado**: los campos del bloque se agrupan bajo
  *Disposición*, *Diseño*, *Colores*, *Espaciado* y *Tipografía* en vez de
  salir en una lista plana.
- **El lienzo repinta colores y espacios al momento**, sin esperar al
  guardado automático.
- **Sub-campos de repeater**: los elementos repetibles ya aceptan listas
  desplegables, interruptores y campos numéricos, no solo texto. Antes, cosas
  como la puntuación de una reseña o el «obligatorio» de una casilla se
  editaban como texto plano.
- **Valores iniciales correctos** al añadir un elemento nuevo a un repeater
  (según el tipo de cada sub-campo).
- **Árbol de estructura con jerarquía real**: el panel «Estructura» pasa de
  cajas anidadas a un árbol con guías, icono por tipo de bloque, plegado por
  rama (`−` / `+`, y expandir/contraer todo) y acciones que aparecen al pasar
  por encima o al seleccionar. Se mantienen el arrastrar y soltar, el renombrar
  con doble clic y todos los botones anteriores. El plegado es estado de
  interfaz: no toca el documento ni marca la página como modificada, y al
  seleccionar un bloque se abren sus ramas para que nunca quede escondido.
- **Repeaters ordenables**: cada ítem de una lista repetible trae número,
  resumen y botones de subir, bajar, duplicar y eliminar. Antes solo se podía
  añadir al final y borrar.
- **Sub-campos con opciones dinámicas** (`optionsFrom`): un desplegable puede
  tomar sus opciones de otra lista del mismo bloque (las categorías de la carta,
  las columnas del pie). Server-side se guarda como texto, así que escribir una
  opción que ya no existe no rompe nada.
- **Tope de repeater por campo** (`maxItems`, máximo 300): el límite general
  sigue en 50, pero una carta de restaurante puede declarar 200 platos.
- **Repeaters en la región Pie**: el editor de cabecera/pie ya sabe pintar y
  guardar listas repetibles, así que bloques como «Pie partido» se editan
  enteros desde ahí.
- **«Preview» es la web, no el editor.** La pestaña abría la página con el
  andamiaje del constructor encima: contornos de puntos en cada columna,
  avisos de «añade contenido» en los bloques sin datos, los bloques apagados
  con el interruptor pintados en gris, y un guion que capturaba todos los
  clics —así que ningún enlace ni botón funcionaba—. Eso vivía en la marca
  «previsualización», que también usa el lienzo. Ahora cuelga de la marca
  «lienzo» (`krgcms_canvas=1`, clase `krg-canvas` en el body): el lienzo
  sigue igual y «Preview» sale byte a byte como la verá quien visite el
  sitio, con la única diferencia de que lee el borrador.
- **El constructor adopta lo que el servidor guardó.** La respuesta del
  guardado trae el documento ya saneado; antes solo se aprovechaba la firma,
  así que si el servidor recortaba o descartaba algo el editor seguía con su
  copia y el lienzo lo seguía pintando igual (lo repinta encima con
  `paintLiveCss`). La diferencia solo aparecía al abrir «Preview». Ahora el
  documento del editor se sustituye por el guardado, y cualquier diferencia
  se ve al instante y en el sitio donde se edita.
- **Bloques de datos sin datos no ocupan.** Una rejilla de blog sin entradas
  publicadas, un listado de categorías vacío o un carrusel sin reseñas
  imprimían un contenedor vacío que se llevaba el alto y el relleno de la
  sección: una franja de fondo sin nada. Ahora no imprimen nada, la fila y la
  columna que los sujetaban desaparecen con ellos y la sección se da por
  vacía (0 px). En el lienzo sí avisan de que les faltan datos.
- **Aviso de PHP al guardar**: cada nodo sin `animEasing` provocaba un
  `Undefined array key`. En una instalación con los avisos a la vista eso
  ensucia la respuesta de la API y tira el guardado.
- **Reskin del panel**: paleta del sistema en todo el admin y el constructor.
  Los colores que estaban escritos a mano en el CSS del constructor pasaron a
  variables, así que ahora cambian con el tema.
