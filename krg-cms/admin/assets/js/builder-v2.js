/* global window */
/**
 * Secciones V.2 — las mismas secciones, pero por piezas.
 * ---------------------------------------------------------------------
 * Una sección V.1 es un módulo: un bloque que trae su diseño hecho y se
 * configura desde su inspector. Una sección V.2 es ese mismo diseño
 * montado con bloques sueltos —título, párrafo, foto, botón…— colgando
 * de la sección como hijos. Se seleccionan uno a uno en el árbol, se
 * mueven, se duplican y se borran por separado.
 *
 * Reglas de esta casa:
 *
 *   1. Aquí NO se inventan bloques. Todo lo que se usa existe ya en el
 *      registro: `section`, `row`, `column`, `heading`, `paragraph`,
 *      `eyebrow`, `image`, `button`, `quote`, `divider`, `rich-text`,
 *      `social-links`. Si un día se quita uno del registro, el banco
 *      `tools/prueba-v2.mjs` lo canta.
 *   2. Las secciones V.1 no se tocan, ni se renombran, ni se esconden.
 *      Siguen en la paleta, en su grupo, y las páginas que las usan
 *      siguen exactamente igual.
 *   3. Nada se transforma solo. Una sección V.2 aparece porque alguien
 *      la añade desde la paleta.
 *
 * Quien pinta la paleta y quien inserta es `builder-fields.js`, así que
 * esto vale igual para la pantalla de páginas y para la de navegación.
 */
(() => {
  const CORE = () => window.KrgBuilderCore;

  /** Herramientas para montar un árbol con los bloques de siempre. */
  function taller(makeNode) {
    const dict = (n, k) => CORE().dict(n, k);
    const caja = (n) => CORE().styleBucket(n, "desktop");

    /** Un bloque suelto con su nombre propio en el árbol. */
    const nodo = (type, props, nombre, estilos) => {
      const n = makeNode(type);
      Object.assign(dict(n, "props"), props || {});
      if (nombre) n.name = nombre;
      if (estilos) Object.assign(caja(n), estilos);
      return n;
    };

    const columna = (span, hijos, estilos, nombre) => {
      const c = makeNode("column");
      Object.assign(dict(c, "props"), {
        span: span,
        spanTablet: span >= 6 ? 12 : span >= 4 ? 6 : span,
        spanMobile: 12,
      });
      c.children = hijos || [];
      if (nombre) c.name = nombre;
      if (estilos) Object.assign(caja(c), estilos);
      return c;
    };

    const fila = (columnas, gap, nombre, estilos) => {
      const r = makeNode("row");
      Object.assign(dict(r, "props"), {
        layout: columnas.map((c) => c.props.span).join("-"),
        gap: gap === undefined ? 24 : gap,
        vAlign: "start",
      });
      r.children = columnas;
      if (nombre) r.name = nombre;
      if (estilos) Object.assign(caja(r), estilos);
      return r;
    };

    const seccion = (nombre, hijos, props, estilos) => {
      const s = makeNode("section");
      s.name = nombre;
      Object.assign(dict(s, "props"), props || {});
      s.children = hijos;
      if (estilos) Object.assign(caja(s), estilos);
      return s;
    };

    /** Relleno cómodo de sección, en las cuatro esquinas. */
    const relleno = (y, x) => ({
      "padding-top": y,
      "padding-right": x,
      "padding-bottom": y,
      "padding-left": x,
    });

    /**
     * Una columna que alinea lo que lleva dentro.
     *
     * Un botón es tan ancho como su texto: aunque el título de al lado
     * esté centrado, el botón se queda pegado a la izquierda si la
     * columna no dice otra cosa.
     */
    const columnaAlineada = (span, donde, hijos, nombre, estilos) => {
      const c = columna(span, hijos, estilos, nombre);
      Object.assign(dict(c, "props"), { contentHAlign: donde });
      return c;
    };

    /**
     * El esqueleto mínimo: una sección con una fila, una columna y lo
     * que se le ponga dentro.
     *
     * Es lo que hace falta para que un bloque suelto —un título, una
     * foto, un separador— pueda vivir en la página sin que nadie tenga
     * que montar antes la sección, la fila y la columna a mano.
     */
    const pieza = (nombre, hijos, props, estilos) =>
      seccion(
        nombre,
        [fila([columna(12, hijos, null, "Columna")], 24, "Fila")],
        props || { width: "padded" },
        estilos || relleno("48px", "24px")
      );

    return { nodo, columna, columnaAlineada, fila, seccion, relleno, pieza };
  }

  /* ------------------------------------------------------------------ */
  /* El catálogo                                                         */

  const SECCIONES = [
    {
      slug: "hero-v2",
      name: "Hero V.2",
      desde: "hero",
      nota: "Antetítulo, titular, entradilla y dos botones, cada uno por su cuenta.",
      build: (t) => t.seccion("Hero V.2", [
        t.fila([
          t.columna(12, [
            t.nodo("eyebrow", { text: "BIENVENIDO" }, "Antetítulo"),
            t.nodo("heading", { text: "Un titular que se lee de lejos", tag: "h1", align: "center" }, "Titular"),
            t.nodo("paragraph", { text: "Dos líneas para explicar de qué va esto, sin pasarse.", align: "center" }, "Entradilla"),
            t.fila([
              t.columna(6, [t.nodo("button", { text: "Empezar", url: "#", variant: "primary" }, "Botón principal")], null, "Columna del botón principal"),
              t.columna(6, [t.nodo("button", { text: "Saber más", url: "#", variant: "ghost" }, "Botón secundario")], null, "Columna del botón secundario"),
            ], 12, "Fila de botones"),
          ], { "padding-top": "24px" }, "Columna del hero"),
        ], 24, "Fila del hero"),
      ], { width: "full", minHeight: "half", vAlign: "center" }, t.relleno("96px", "32px")),
    },
    {
      slug: "partido-v2",
      name: "Bloque partido V.2",
      desde: "split-feature",
      nota: "Foto a un lado, texto al otro. La foto y cada texto son bloques sueltos.",
      build: (t) => t.seccion("Bloque partido V.2", [
        t.fila([
          t.columna(6, [
            t.nodo("image", { alt: "", fillMode: "fill", objectFit: "cover" }, "Foto", { "min-height": "420px" }),
          ], null, "Columna de la foto"),
          t.columna(6, [
            t.nodo("eyebrow", { text: "NUESTRA HISTORIA" }, "Antetítulo"),
            t.nodo("heading", { text: "Lo que nos trajo hasta aquí", tag: "h2" }, "Título"),
            t.nodo("paragraph", { text: "El párrafo donde se cuenta la historia con calma." }, "Texto"),
            t.nodo("button", { text: "Seguir leyendo", url: "#", variant: "primary" }, "Botón"),
          ], t.relleno("48px", "40px"), "Columna del texto"),
        ], 0, "Fila partida"),
      ], { width: "full" }),
    },
    {
      slug: "features-v2",
      name: "Grid de features V.2",
      desde: "feature-grid",
      nota: "Tres ventajas en columnas; icono, título y texto editables uno a uno.",
      build: (t) => {
        const pieza = (n) => t.columna(4, [
          t.nodo("image", { alt: "" }, `Icono ${n}`, { "max-width": "64px", "min-height": "64px" }),
          t.nodo("heading", { text: `Ventaja ${n}`, tag: "h3" }, `Título ${n}`),
          t.nodo("paragraph", { text: "Una frase corta que explique la ventaja." }, `Texto ${n}`),
        ], null, `Ventaja ${n}`);
        return t.seccion("Grid de features V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "LO QUE HACEMOS" }, "Antetítulo"),
              t.nodo("heading", { text: "Tres motivos para quedarte", tag: "h2", align: "center" }, "Título"),
            ], null, "Columna del encabezado"),
          ], 24, "Fila del encabezado"),
          t.fila([pieza(1), pieza(2), pieza(3)], 32, "Fila de ventajas"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "tarjetas-v2",
      name: "Grid de cards V.2",
      desde: "cards-grid",
      nota: "Tres tarjetas; foto, título, texto y botón de cada una por separado.",
      build: (t) => {
        const carta = (n) => t.columna(4, [
          t.nodo("image", { alt: "", objectFit: "cover" }, `Foto ${n}`, { "min-height": "220px" }),
          t.nodo("heading", { text: `Tarjeta ${n}`, tag: "h3" }, `Título ${n}`),
          t.nodo("paragraph", { text: "Dos líneas de descripción para esta tarjeta." }, `Texto ${n}`),
          t.nodo("button", { text: "Ver más", url: "#", variant: "ghost" }, `Botón ${n}`),
        ], t.relleno("20px", "20px"), `Tarjeta ${n}`);
        return t.seccion("Grid de cards V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("heading", { text: "Nuestras propuestas", tag: "h2", align: "center" }, "Título"),
            ], null, "Columna del encabezado"),
          ], 24, "Fila del encabezado"),
          t.fila([carta(1), carta(2), carta(3)], 28, "Fila de tarjetas"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "cta-v2",
      name: "CTA V.2",
      desde: "cta",
      nota: "Llamada a la acción: título, texto y botón, cada uno suelto.",
      build: (t) => t.seccion("CTA V.2", [
        t.fila([
          t.columna(12, [
            t.nodo("heading", { text: "¿Hablamos?", tag: "h2", align: "center" }, "Título"),
            t.nodo("paragraph", { text: "Cuéntanos qué necesitas y te respondemos el mismo día.", align: "center" }, "Texto"),
            t.nodo("button", { text: "Escríbenos", url: "#", variant: "primary" }, "Botón"),
          ], null, "Columna de la llamada"),
        ], 16, "Fila de la llamada"),
      ], { width: "full", vAlign: "center" }, t.relleno("88px", "32px")),
    },
    {
      slug: "testimonios-v2",
      name: "Testimonios V.2",
      desde: "testimonials",
      nota: "Tres opiniones; la cita, el nombre y la foto de cada una son bloques.",
      build: (t) => {
        const voz = (n) => t.columna(4, [
          t.nodo("image", { alt: "", objectFit: "cover", radius: "full" }, `Foto ${n}`, { "max-width": "72px", "min-height": "72px" }),
          t.nodo("quote", { text: "Lo que dijo esta persona sobre el trabajo.", cite: `Nombre ${n}` }, `Cita ${n}`),
          t.nodo("paragraph", { text: "Cargo o empresa" }, `Firma ${n}`),
        ], t.relleno("24px", "24px"), `Opinión ${n}`);
        return t.seccion("Testimonios V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "OPINIONES" }, "Antetítulo"),
              t.nodo("heading", { text: "Lo que dicen de nosotros", tag: "h2", align: "center" }, "Título"),
            ], null, "Columna del encabezado"),
          ], 24, "Fila del encabezado"),
          t.fila([voz(1), voz(2), voz(3)], 28, "Fila de opiniones"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "cifras-v2",
      name: "Estadísticas V.2",
      desde: "statistics",
      nota: "Cuatro cifras con su etiqueta; cada número es un bloque.",
      build: (t) => {
        const cifra = (n, num, txt) => t.columna(3, [
          t.nodo("heading", { text: num, tag: "h2", align: "center" }, `Cifra ${n}`),
          t.nodo("paragraph", { text: txt, align: "center" }, `Etiqueta ${n}`),
        ], null, `Dato ${n}`);
        return t.seccion("Estadísticas V.2", [
          t.fila([
            cifra(1, "12", "Años abiertos"),
            cifra(2, "480", "Clientes"),
            cifra(3, "35", "Personas"),
            cifra(4, "99%", "Repiten"),
          ], 24, "Fila de cifras"),
        ], { width: "padded" }, t.relleno("64px", "24px"));
      },
    },
    {
      slug: "logos-v2",
      name: "Grid de logos V.2",
      desde: "logo-grid",
      nota: "Seis sellos en fila; cada sello es una imagen que se cambia sola.",
      build: (t) => {
        const sello = (n) => t.columna(2, [
          t.nodo("image", { alt: "", objectFit: "contain" }, `Sello ${n}`, { "max-width": "140px", "min-height": "72px" }),
        ], null, `Sello ${n}`);
        return t.seccion("Grid de logos V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "CONFÍAN EN NOSOTROS" }, "Antetítulo"),
            ], null, "Columna del antetítulo"),
          ], 16, "Fila del antetítulo"),
          t.fila([sello(1), sello(2), sello(3), sello(4), sello(5), sello(6)], 24, "Fila de sellos"),
        ], { width: "padded" }, t.relleno("56px", "24px"));
      },
    },
    {
      slug: "lista-v2",
      name: "Lista numerada V.2",
      desde: "numbered-list",
      nota: "Pasos numerados; el número, el título y el texto de cada paso son bloques.",
      build: (t) => {
        const paso = (n, titulo) => t.fila([
          t.columna(2, [
            t.nodo("heading", { text: "0" + n, tag: "h3" }, `Número ${n}`),
          ], null, `Número del paso ${n}`),
          t.columna(10, [
            t.nodo("heading", { text: titulo, tag: "h3" }, `Título del paso ${n}`),
            t.nodo("paragraph", { text: "Qué pasa en este paso, contado en una o dos frases." }, `Texto del paso ${n}`),
          ], null, `Texto del paso ${n}`),
        ], 20, `Paso ${n}`);
        return t.seccion("Lista numerada V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("heading", { text: "Cómo trabajamos", tag: "h2" }, "Título"),
            ], null, "Columna del título"),
          ], 24, "Fila del título"),
          paso(1, "Nos cuentas qué necesitas"),
          t.nodo("divider", {}, "Raya 1"),
          paso(2, "Preparamos una propuesta"),
          t.nodo("divider", {}, "Raya 2"),
          paso(3, "Lo ponemos en marcha"),
        ], { width: "padded" }, t.relleno("72px", "24px"));
      },
    },
    {
      slug: "pie-v2",
      name: "Pie partido V.2",
      desde: "footer-split",
      nota: "El pie del ejemplo por piezas: foto, teléfono, horarios, redes y columnas de enlaces.",
      build: (t) => {
        const enlaces = (titulo, items) => t.columna(6, [
          t.nodo("heading", { text: titulo, tag: "h3" }, titulo),
          t.nodo("rich-text", {
            html: "<ul>" + items.map((x) => `<li><a href="#">${x}</a></li>`).join("") + "</ul>",
          }, "Enlaces de " + titulo),
        ], null, "Columna de " + titulo);
        const cuerpo = t.columna(7, [
          t.nodo("eyebrow", { text: "LLÁMANOS" }, "Antetítulo"),
          t.nodo("heading", { text: "+00 000 000 000", tag: "h2" }, "Teléfono"),
          t.nodo("paragraph", { text: "De lunes a viernes: 10:00 - 17:00" }, "Horario entre semana"),
          t.nodo("paragraph", { text: "Fin de semana: 10:00 - 15:00" }, "Horario del fin de semana"),
          t.nodo("social-links", {}, "Redes sociales"),
          t.fila([
            enlaces("Servicios", ["Asesoría", "Revisión de cuentas", "Consultoría", "Posicionamiento"]),
            enlaces("Empresa", ["Quiénes somos", "Equipo", "Contacto"]),
          ], 24, "Fila de enlaces"),
          t.nodo("divider", {}, "Raya"),
          t.fila([
            t.columna(7, [
              t.nodo("rich-text", {
                html: '<p><a href="#">Términos y condiciones</a> · <a href="#">Política de privacidad</a> · <a href="#">Cookies</a></p>',
              }, "Enlaces legales"),
            ], null, "Columna de legales"),
            t.columna(5, [
              t.nodo("paragraph", {
                text: "© " + new Date().getFullYear() + ". Nombre de la empresa. Todos los derechos reservados.",
                align: "right",
              }, "Copyright"),
            ], null, "Columna del copyright"),
          ], 24, "Fila legal"),
        ], {
          "padding-top": "64px",
          "padding-right": "56px",
          "padding-bottom": "48px",
          "padding-left": "56px",
        }, "Columna del texto");
        return t.seccion("Pie partido V.2", [
          t.fila([
            t.columna(5, [
              t.nodo("image", { alt: "", fillMode: "fill", objectFit: "cover" }, "Foto del pie", { height: "100%" }),
            ], { "min-height": "460px" }, "Columna de la foto"),
            cuerpo,
          ], 0, "Fila del pie"),
        ], { width: "full", fullWidth: true });
      },
    },
    {
      slug: "preguntas-v2",
      name: "Preguntas V.2",
      desde: "faq",
      nota: "Las preguntas frecuentes abiertas: cada pregunta y cada respuesta, un bloque.",
      build: (t) => {
        const par = (n, q, a) => t.fila([
          t.columna(5, [
            t.nodo("heading", { text: q, tag: "h3" }, `Pregunta ${n}`),
          ], null, `Columna de la pregunta ${n}`),
          t.columna(7, [
            t.nodo("paragraph", { text: a }, `Respuesta ${n}`),
          ], null, `Columna de la respuesta ${n}`),
        ], 24, `Pregunta ${n}`);
        return t.seccion("Preguntas V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "DUDAS FRECUENTES" }, "Antetítulo"),
              t.nodo("heading", { text: "Preguntas que nos hacéis mucho", tag: "h2" }, "Título"),
            ], null, "Columna del encabezado"),
          ], 24, "Fila del encabezado"),
          par(1, "¿Cuánto tarda el envío?", "Entre dos y cuatro días laborables en península."),
          t.nodo("divider", {}, "Raya 1"),
          par(2, "¿Puedo cambiar el pedido?", "Sí, mientras no haya salido del almacén. Escríbenos y lo ajustamos."),
          t.nodo("divider", {}, "Raya 2"),
          par(3, "¿Hacéis factura?", "Siempre. Pídela al hacer el pedido y la mandamos por correo."),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "tiempo-v2",
      name: "Línea de tiempo V.2",
      desde: "timeline",
      nota: "Los hitos en orden: el año, el título y el relato de cada uno son bloques sueltos.",
      build: (t) => {
        const hito = (n, anio, titulo) => t.fila([
          t.columna(3, [
            t.nodo("heading", { text: anio, tag: "h3" }, `Año ${n}`),
          ], null, `Columna del año ${n}`),
          t.columna(9, [
            t.nodo("heading", { text: titulo, tag: "h4" }, `Título del hito ${n}`),
            t.nodo("paragraph", { text: "Qué pasó ese año, contado en dos frases." }, `Texto del hito ${n}`),
          ], null, `Columna del hito ${n}`),
        ], 20, `Hito ${n}`);
        return t.seccion("Línea de tiempo V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("heading", { text: "De dónde venimos", tag: "h2" }, "Título"),
            ], null, "Columna del título"),
          ], 24, "Fila del título"),
          hito(1, "2014", "Abrimos el primer local"),
          t.nodo("divider", {}, "Raya 1"),
          hito(2, "2019", "Montamos el obrador"),
          t.nodo("divider", {}, "Raya 2"),
          hito(3, "2024", "Llegamos a toda la península"),
        ], { width: "padded" }, t.relleno("76px", "24px"));
      },
    },
    {
      slug: "pasos-v2",
      name: "Pasos con foto V.2",
      desde: "trace-module",
      nota: "El recorrido del producto en cuatro pasos; foto, número y texto de cada paso por separado.",
      build: (t) => {
        const paso = (n, titulo) => t.columna(3, [
          t.nodo("image", { alt: "", objectFit: "cover" }, `Foto del paso ${n}`, { "min-height": "180px" }),
          t.nodo("eyebrow", { text: "PASO 0" + n }, `Número del paso ${n}`),
          t.nodo("heading", { text: titulo, tag: "h3" }, `Título del paso ${n}`),
          t.nodo("paragraph", { text: "Una frase sobre lo que ocurre en este punto." }, `Texto del paso ${n}`),
        ], null, `Paso ${n}`);
        return t.seccion("Pasos con foto V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "DE ORIGEN A CASA" }, "Antetítulo"),
              t.nodo("heading", { text: "Así llega hasta ti", tag: "h2", align: "center" }, "Título"),
            ], null, "Columna del encabezado"),
          ], 24, "Fila del encabezado"),
          t.fila([paso(1, "En el campo"), paso(2, "En el obrador"), paso(3, "Al tarro"), paso(4, "A tu casa")], 24, "Fila de pasos"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "carta-v2",
      name: "Carta V.2",
      desde: "menu-list",
      nota: "La carta por piezas: cada plato es un nombre, una descripción y un precio.",
      build: (t) => {
        const plato = (n, nombre, precio) => t.fila([
          t.columna(9, [
            t.nodo("heading", { text: nombre, tag: "h3" }, `Plato ${n}`),
            t.nodo("paragraph", { text: "Ingredientes del plato, cortos y claros." }, `Descripción ${n}`),
          ], null, `Columna del plato ${n}`),
          t.columna(3, [
            t.nodo("heading", { text: precio, tag: "h3", align: "right" }, `Precio ${n}`),
          ], null, `Columna del precio ${n}`),
        ], 16, `Plato ${n}`);
        return t.seccion("Carta V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "PARA COMPARTIR" }, "Antetítulo"),
              t.nodo("heading", { text: "Entrantes", tag: "h2" }, "Título de la categoría"),
            ], null, "Columna del encabezado"),
          ], 20, "Fila del encabezado"),
          plato(1, "Croquetas de la casa", "9,50 €"),
          t.nodo("divider", {}, "Raya 1"),
          plato(2, "Ensaladilla con ventresca", "12,00 €"),
          t.nodo("divider", {}, "Raya 2"),
          plato(3, "Tabla de quesos", "14,00 €"),
        ], { width: "padded" }, t.relleno("72px", "24px"));
      },
    },
    {
      slug: "fotos-v2",
      name: "Mosaico de fotos V.2",
      desde: "gallery",
      nota: "Seis fotos en rejilla; cada foto se cambia por su cuenta, sin tocar las demás.",
      build: (t) => {
        const foto = (n) => t.columna(4, [
          t.nodo("image", { alt: "", objectFit: "cover" }, `Foto ${n}`, { "min-height": "240px" }),
        ], null, `Hueco ${n}`);
        return t.seccion("Mosaico de fotos V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("heading", { text: "El sitio por dentro", tag: "h2", align: "center" }, "Título"),
            ], null, "Columna del título"),
          ], 20, "Fila del título"),
          t.fila([foto(1), foto(2), foto(3)], 16, "Primera fila de fotos"),
          t.fila([foto(4), foto(5), foto(6)], 16, "Segunda fila de fotos"),
        ], { width: "padded" }, t.relleno("72px", "24px"));
      },
    },
    {
      slug: "datos-v2",
      name: "Ficha de datos V.2",
      desde: "info-table",
      nota: "La tabla de características, fila a fila: cada dato y cada valor son un bloque.",
      build: (t) => {
        const dato = (n, clave, valor) => t.fila([
          t.columna(6, [
            t.nodo("paragraph", { text: clave }, `Dato ${n}`),
          ], null, `Columna del dato ${n}`),
          t.columna(6, [
            t.nodo("paragraph", { text: valor, align: "right" }, `Valor ${n}`),
          ], null, `Columna del valor ${n}`),
        ], 12, `Fila de datos ${n}`);
        return t.seccion("Ficha de datos V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("heading", { text: "Ficha del producto", tag: "h2" }, "Título"),
            ], null, "Columna del título"),
          ], 16, "Fila del título"),
          dato(1, "Formato", "Tarro de 500 g"),
          t.nodo("divider", {}, "Raya 1"),
          dato(2, "Origen", "Sierra de Guadarrama"),
          t.nodo("divider", {}, "Raya 2"),
          dato(3, "Conservación", "Lugar seco, sin frío"),
          t.nodo("divider", {}, "Raya 3"),
          dato(4, "Caducidad", "24 meses"),
          t.nodo("paragraph", { text: "Los valores son orientativos y pueden variar según la cosecha." }, "Pie de la ficha"),
        ], { width: "padded" }, t.relleno("72px", "24px"));
      },
    },
    {
      slug: "portada-v2",
      name: "Portada de marca V.2",
      desde: "brand-hero",
      nota: "Portada a pantalla completa: antetítulo, titular grande, dos subtítulos y botón.",
      build: (t) => t.seccion("Portada de marca V.2", [
        t.fila([
          t.columnaAlineada(12, "center", [
            t.nodo("eyebrow", { text: "DESDE 1998" }, "Antetítulo"),
            t.nodo("heading", { text: "MIEL CRUDA", tag: "h1", align: "center" }, "Titular"),
            t.nodo("heading", { text: "de la sierra", tag: "h2", align: "center" }, "Segundo titular"),
            t.nodo("paragraph", { text: "Sin filtrar, sin pasteurizar, sin prisa.", align: "center" }, "Subtítulo"),
            t.nodo("button", { text: "Ver la tienda", url: "#", variant: "primary" }, "Botón"),
          ], "Columna de la portada"),
        ], 20, "Fila de la portada"),
      ], { width: "full", minHeight: "screen-minus-header", vAlign: "center" }, t.relleno("96px", "32px")),
    },
    {
      slug: "carril-v2",
      name: "Carril de productos V.2",
      desde: "product-rail",
      nota: "Cuatro productos en fila; categoría, foto, nombre, precio y enlace, cada uno aparte.",
      build: (t) => {
        const prod = (n, nombre, precio) => t.columna(3, [
          t.nodo("image", { alt: "", objectFit: "cover" }, `Foto ${n}`, { "min-height": "260px" }),
          t.nodo("eyebrow", { text: "CATEGORÍA" }, `Categoría ${n}`),
          t.nodo("heading", { text: nombre, tag: "h3" }, `Nombre ${n}`),
          t.nodo("paragraph", { text: precio }, `Precio ${n}`),
          t.nodo("button", { text: "Ver producto", url: "#", variant: "ghost" }, `Botón ${n}`),
        ], null, `Producto ${n}`);
        return t.seccion("Carril de productos V.2", [
          t.fila([
            t.columna(8, [
              t.nodo("heading", { text: "Lo más vendido", tag: "h2" }, "Título"),
            ], null, "Columna del título"),
            t.columnaAlineada(4, "end", [
              t.nodo("button", { text: "Ver todo", url: "#", variant: "ghost" }, "Botón de la cabecera"),
            ], "Columna del botón"),
          ], 24, "Fila del encabezado"),
          t.fila([prod(1, "Tarro de 500 g", "12,00 €"), prod(2, "Tarro de 250 g", "7,50 €"), prod(3, "Pack de tres", "32,00 €"), prod(4, "Caja regalo", "45,00 €")], 24, "Fila de productos"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "cita-v2",
      name: "Cita V.2",
      desde: "quote",
      nota: "Una frase grande con su firma debajo: la cita y quien la dice son bloques distintos.",
      build: (t) => t.seccion("Cita V.2", [
        t.fila([
          t.columnaAlineada(12, "center", [
            t.nodo("eyebrow", { text: "LO QUE NOS DICEN" }, "Antetítulo"),
            t.nodo("quote", { text: "Volvimos tres veces en el mismo mes y seguimos pidiendo lo mismo." }, "Cita"),
            t.nodo("paragraph", { text: "Marta R., clienta desde 2019", align: "center" }, "Firma"),
          ], "Columna de la cita"),
        ], 16, "Fila de la cita"),
      ], { width: "padded" }, t.relleno("80px", "24px")),
    },
    {
      slug: "declaracion-v2",
      name: "Declaración V.2",
      desde: "statement-cta",
      nota: "Una frase grande a todo lo ancho con su botón; el antetítulo, el titular y el texto van sueltos.",
      build: (t) => t.seccion("Declaración V.2", [
        t.fila([
          t.columnaAlineada(12, "center", [
            t.nodo("eyebrow", { text: "NUESTRO COMPROMISO" }, "Antetítulo"),
            t.nodo("heading", { text: "Materia prima de aquí, cocinada despacio", tag: "h2", align: "center" }, "Titular"),
            t.nodo("paragraph", { text: "Sin prisa y sin atajos: así sale todo lo que servimos.", align: "center" }, "Texto"),
            t.nodo("button", { text: "Conócenos", url: "#", variant: "primary" }, "Botón"),
          ], "Columna de la declaración"),
        ], 16, "Fila de la declaración"),
      ], { width: "full", minHeight: "half", vAlign: "center" }, t.relleno("96px", "32px")),
    },
    {
      slug: "paneles-v2",
      name: "Paneles V.2",
      desde: "split-panel",
      nota: "Dos mitades que se tocan, cada una con su foto, su texto y su botón.",
      build: (t) => {
        const panel = (n, antetitulo, titulo, boton) => t.columna(6, [
          t.nodo("image", { alt: "", fillMode: "fill", objectFit: "cover" }, `Foto del panel ${n}`, { "min-height": "320px" }),
          t.nodo("eyebrow", { text: antetitulo }, `Antetítulo del panel ${n}`),
          t.nodo("heading", { text: titulo, tag: "h2" }, `Título del panel ${n}`),
          t.nodo("paragraph", { text: "Dos líneas para contar qué hay en este lado." }, `Texto del panel ${n}`),
          t.nodo("button", { text: boton, url: "#", variant: "ghost" }, `Botón del panel ${n}`),
        ], t.relleno("32px", "28px"), `Panel ${n}`);
        return t.seccion("Paneles V.2", [
          t.fila([
            panel(1, "LA COCINA", "Lo que se hace cada mañana", "Ver la carta"),
            panel(2, "LA SALA", "Dónde se sienta la gente", "Reservar mesa"),
          ], 0, "Fila de paneles"),
        ], { width: "full" });
      },
    },
    {
      slug: "coleccion-v2",
      name: "Colección V.2",
      desde: "collection-grid",
      nota: "Seis productos en rejilla; foto, nombre, precio y enlace de cada uno se editan por separado.",
      build: (t) => {
        const prod = (n, nombre, precio) => t.columna(4, [
          t.nodo("image", { alt: "", objectFit: "cover" }, `Foto ${n}`, { "min-height": "280px" }),
          t.nodo("heading", { text: nombre, tag: "h3" }, `Nombre ${n}`),
          t.nodo("paragraph", { text: precio }, `Precio ${n}`),
          t.nodo("button", { text: "Ver detalle", url: "#", variant: "ghost" }, `Botón ${n}`),
        ], null, `Producto ${n}`);
        return t.seccion("Colección V.2", [
          t.fila([
            t.columna(8, [
              t.nodo("eyebrow", { text: "LA COLECCIÓN" }, "Antetítulo"),
              t.nodo("heading", { text: "Todo lo que tenemos ahora mismo", tag: "h2" }, "Título"),
            ], null, "Columna del encabezado"),
            t.columnaAlineada(4, "end", [
              t.nodo("button", { text: "Ver todo", url: "#", variant: "ghost" }, "Botón de la cabecera"),
            ], "Columna del botón"),
          ], 24, "Fila del encabezado"),
          t.fila([prod(1, "Tarro de 500 g", "12,00 €"), prod(2, "Tarro de 250 g", "7,50 €"), prod(3, "Pack de tres", "32,00 €")], 24, "Primera fila de productos"),
          t.fila([prod(4, "Caja regalo", "45,00 €"), prod(5, "Panal entero", "18,00 €"), prod(6, "Cucharilla de madera", "3,00 €")], 24, "Segunda fila de productos"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "resenas-v2",
      name: "Reseñas V.2",
      desde: "review-slider",
      nota: "Tres reseñas una al lado de otra: estrellas, texto y firma, cada cosa por su cuenta.",
      build: (t) => {
        const resena = (n, texto, quien) => t.columna(4, [
          t.nodo("eyebrow", { text: "★★★★★" }, `Estrellas ${n}`),
          t.nodo("paragraph", { text: texto }, `Texto de la reseña ${n}`),
          t.nodo("heading", { text: quien, tag: "h4" }, `Firma ${n}`),
        ], t.relleno("28px", "24px"), `Reseña ${n}`);
        return t.seccion("Reseñas V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "OPINIONES" }, "Antetítulo"),
              t.nodo("heading", { text: "Lo que cuentan los que ya han venido", tag: "h2", align: "center" }, "Título"),
            ], null, "Columna del encabezado"),
          ], 20, "Fila del encabezado"),
          t.fila([
            resena(1, "Se come muy bien y el trato es cercano. Repetiremos seguro.", "Ana G."),
            resena(2, "Pedimos para llevar y llegó caliente y bien puesto. Un acierto.", "Luis M."),
            resena(3, "El sitio es pequeño pero muy cuidado. Reservad con tiempo.", "Carmen P."),
          ], 24, "Fila de reseñas"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "hitos-v2",
      name: "Hitos V.2",
      desde: "statement-list",
      nota: "Afirmaciones en lista, una debajo de otra, con su antetítulo y su raya.",
      build: (t) => {
        const hito = (n, etiqueta, frase) => t.fila([
          t.columna(4, [
            t.nodo("eyebrow", { text: etiqueta }, `Antetítulo del hito ${n}`),
          ], null, `Columna del antetítulo ${n}`),
          t.columna(8, [
            t.nodo("heading", { text: frase, tag: "h3" }, `Afirmación ${n}`),
          ], null, `Columna de la afirmación ${n}`),
        ], 20, `Hito ${n}`);
        return t.seccion("Hitos V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("heading", { text: "Lo primero que hicimos", tag: "h2" }, "Título"),
            ], null, "Columna del título"),
          ], 20, "Fila del título"),
          hito(1, "EL PRIMERO", "El primer obrador del barrio con horno de leña"),
          t.nodo("divider", {}, "Raya 1"),
          hito(2, "EL ÚNICO", "La única carta que cambia entera cada temporada"),
          t.nodo("divider", {}, "Raya 2"),
          hito(3, "DESDE SIEMPRE", "Veinte años con los mismos proveedores"),
        ], { width: "padded" }, t.relleno("76px", "24px"));
      },
    },
    {
      slug: "tiendas-v2",
      name: "Dónde encontrarnos V.2",
      desde: "retail-strip",
      nota: "Los sitios que te venden: el logotipo, el nombre y el enlace de cada uno son bloques sueltos.",
      build: (t) => {
        // El ancho del logotipo se fija: en una columna centrada una
        // imagen sin tamaño se encoge a lo que ocupe su contenido, y
        // los cuatro sellos salían de distinto tamaño y a distinta
        // altura. Con el ancho puesto, los cuatro quedan alineados.
        const tienda = (n, nombre) => t.columnaAlineada(3, "center", [
          t.nodo("image", { alt: nombre, objectFit: "contain" }, `Logotipo ${n}`, { "min-height": "90px", width: "100%", "max-width": "180px" }),
          t.nodo("heading", { text: nombre, tag: "h3", align: "center" }, `Nombre ${n}`),
          t.nodo("button", { text: "Ir a la tienda", url: "#", variant: "ghost" }, `Enlace ${n}`),
        ], `Punto de venta ${n}`);
        return t.seccion("Dónde encontrarnos V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "PUNTOS DE VENTA" }, "Antetítulo"),
              t.nodo("heading", { text: "También nos encuentras aquí", tag: "h2", align: "center" }, "Título"),
            ], null, "Columna del encabezado"),
          ], 20, "Fila del encabezado"),
          t.fila([tienda(1, "Mercado Central"), tienda(2, "La Despensa"), tienda(3, "Casa Pepe"), tienda(4, "Tienda online")], 24, "Fila de puntos de venta"),
        ], { width: "padded" }, t.relleno("72px", "24px"));
      },
    },
    {
      slug: "contacto-v2",
      name: "Contacto V.2",
      desde: "contact-form",
      nota: "El formulario a un lado y los datos al otro: dirección, teléfono y redes, cada cosa aparte.",
      build: (t) => t.seccion("Contacto V.2", [
        t.fila([
          t.columna(5, [
            t.nodo("eyebrow", { text: "HABLAMOS" }, "Antetítulo"),
            t.nodo("heading", { text: "Escríbenos y te contestamos", tag: "h2" }, "Título"),
            t.nodo("paragraph", { text: "Contestamos de lunes a viernes, por la mañana." }, "Texto"),
            t.nodo("paragraph", { text: "Calle Mayor 12, 28013 Madrid" }, "Dirección"),
            t.nodo("paragraph", { text: "910 000 000 · hola@ejemplo.com" }, "Teléfono y correo"),
            t.nodo("social-links", {}, "Redes"),
          ], t.relleno("8px", "0px"), "Columna de los datos"),
          t.columna(7, [
            t.nodo("contact-form", { submit: "Enviar mensaje" }, "Formulario"),
          ], null, "Columna del formulario"),
        ], 24, "Fila del contacto"),
      ], { width: "padded" }, t.relleno("80px", "24px")),
    },
    {
      slug: "mapa-v2",
      name: "Ubicación V.2",
      desde: "map",
      nota: "El mapa a un lado y cómo llegar al otro; el alto del mapa se cambia en su inspector.",
      build: (t) => t.seccion("Ubicación V.2", [
        t.fila([
          t.columna(12, [
            t.nodo("eyebrow", { text: "DÓNDE ESTAMOS" }, "Antetítulo"),
            t.nodo("heading", { text: "Cómo llegar hasta la puerta", tag: "h2" }, "Título"),
          ], null, "Columna del encabezado"),
        ], 20, "Fila del encabezado"),
        t.fila([
          t.columna(7, [
            t.nodo("map", {}, "Mapa"),
          ], null, "Columna del mapa"),
          t.columna(5, [
            t.nodo("heading", { text: "Calle Mayor 12", tag: "h3" }, "Dirección"),
            t.nodo("paragraph", { text: "A dos minutos de la parada de metro, con aparcamiento en la plaza." }, "Cómo llegar"),
            t.nodo("paragraph", { text: "De martes a domingo, de 13:00 a 16:30 y de 20:00 a 23:30." }, "Horario"),
            t.nodo("button", { text: "Abrir en Google Maps", url: "#", variant: "primary" }, "Botón"),
          ], t.relleno("8px", "24px"), "Columna de los datos"),
        ], 24, "Fila del mapa"),
      ], { width: "padded" }, t.relleno("76px", "24px")),
    },
    {
      slug: "video-v2",
      name: "Vídeo V.2",
      desde: "video",
      nota: "Un vídeo con su encabezado y su pie; el vídeo se pega en su inspector como siempre.",
      build: (t) => t.seccion("Vídeo V.2", [
        t.fila([
          t.columnaAlineada(12, "center", [
            t.nodo("eyebrow", { text: "EN MOVIMIENTO" }, "Antetítulo"),
            t.nodo("heading", { text: "Un minuto dentro de la cocina", tag: "h2", align: "center" }, "Título"),
          ], "Columna del encabezado"),
        ], 20, "Fila del encabezado"),
        t.fila([
          t.columna(12, [
            t.nodo("video", {}, "Vídeo"),
            t.nodo("paragraph", { text: "Grabado un martes cualquiera, sin ensayo.", align: "center" }, "Pie del vídeo"),
          ], null, "Columna del vídeo"),
        ], 16, "Fila del vídeo"),
      ], { width: "padded" }, t.relleno("76px", "24px")),
    },
    {
      slug: "blog-v2",
      name: "Entradas V.2",
      desde: "blog-grid",
      nota: "Las últimas entradas del blog con el encabezado por piezas y su botón de «ver todas».",
      build: (t) => t.seccion("Entradas V.2", [
        t.fila([
          t.columna(8, [
            t.nodo("eyebrow", { text: "EL CUADERNO" }, "Antetítulo"),
            t.nodo("heading", { text: "Lo último que hemos escrito", tag: "h2" }, "Título"),
          ], null, "Columna del encabezado"),
          t.columnaAlineada(4, "end", [
            t.nodo("button", { text: "Ver todas", url: "#", variant: "ghost" }, "Botón de la cabecera"),
          ], "Columna del botón"),
        ], 24, "Fila del encabezado"),
        t.fila([
          t.columna(12, [
            t.nodo("blog-grid", { count: 3, desktop: 3 }, "Rejilla de entradas"),
          ], null, "Columna de la rejilla"),
        ], 24, "Fila de la rejilla"),
      ], { width: "padded" }, t.relleno("80px", "24px")),
    },
    {
      slug: "horario-v2",
      name: "Horario y contacto V.2",
      desde: "info-table",
      nota: "Horario, dirección y teléfono en tres columnas, cada dato como un bloque que se edita solo.",
      build: (t) => {
        const dato = (n, etiqueta, titulo, linea1, linea2) => t.columna(4, [
          t.nodo("eyebrow", { text: etiqueta }, `Antetítulo ${n}`),
          t.nodo("heading", { text: titulo, tag: "h3" }, `Título ${n}`),
          t.nodo("paragraph", { text: linea1 }, `Primera línea ${n}`),
          t.nodo("paragraph", { text: linea2 }, `Segunda línea ${n}`),
        ], null, `Bloque ${n}`);
        return t.seccion("Horario y contacto V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("heading", { text: "Antes de venir", tag: "h2" }, "Título"),
            ], null, "Columna del título"),
          ], 16, "Fila del título"),
          t.fila([
            dato(1, "HORARIO", "Cuándo abrimos", "De martes a domingo, 13:00 a 16:30.", "Cenas de jueves a sábado, 20:00 a 23:30."),
            dato(2, "DIRECCIÓN", "Dónde estamos", "Calle Mayor 12, 28013 Madrid.", "Entrada por la plaza, planta baja."),
            dato(3, "RESERVAS", "Cómo avisarnos", "Por teléfono en el 910 000 000.", "O por correo en hola@ejemplo.com."),
          ], 24, "Fila de los datos"),
        ], { width: "padded" }, t.relleno("72px", "24px"));
      },
    },
    {
      slug: "reserva-v2",
      name: "Reserva V.2",
      desde: "booking-form",
      nota: "Pedir mesa: a un lado el horario y el teléfono, al otro el selector de día y hora, y cada dato suelto.",
      build: (t) => {
        const dato = (n, etiqueta, linea) => [
          t.nodo("eyebrow", { text: etiqueta }, `Etiqueta ${n}`),
          t.nodo("paragraph", { text: linea }, `Dato ${n}`),
        ];
        return t.seccion("Reserva V.2", [
          t.fila([
            t.columna(12, [
              t.nodo("eyebrow", { text: "RESERVAS" }, "Antetítulo"),
              t.nodo("heading", { text: "Guardamos tu mesa", tag: "h2" }, "Título"),
              t.nodo("paragraph", { text: "Dinos cuándo y cuántos sois y te confirmamos el mismo día." }, "Entradilla"),
            ], null, "Columna del encabezado"),
          ], 24, "Fila del encabezado"),
          t.fila([
            t.columna(5, [].concat(
              dato(1, "HORARIO", "De martes a domingo, de 13:00 a 16:30 y de 20:00 a 23:30."),
              dato(2, "TELÉFONO", "910 000 000 — también por WhatsApp."),
              dato(3, "GRUPOS", "Para más de ocho personas, llámanos y lo organizamos."),
              [t.nodo("button", { text: "Llamar ahora", url: "tel:+34910000000", variant: "ghost" }, "Botón de teléfono")]
            ), null, "Columna de los datos"),
            t.columna(7, [
              t.nodo("booking-form", {
                submit: "Pedir mesa",
                success: "Hemos recibido tu petición. Te confirmamos enseguida.",
                destino: "ambos",
                whatsapp: "",
                showMessage: true,
              }, "Formulario de reserva"),
            ], null, "Columna del formulario"),
          ], 32, "Fila de la reserva"),
        ], { width: "padded" }, t.relleno("80px", "24px"));
      },
    },
    {
      slug: "categorias-v2",
      name: "Categorías del blog V.2",
      desde: "categories",
      nota: "Las categorías del blog con su encabezado por piezas. Si están apagadas en Blog, no salen en la web.",
      build: (t) => t.seccion("Categorías del blog V.2", [
        t.fila([
          t.columna(8, [
            t.nodo("eyebrow", { text: "POR TEMAS" }, "Antetítulo"),
            t.nodo("heading", { text: "Busca por lo que te interese", tag: "h2" }, "Título"),
          ], null, "Columna del encabezado"),
          t.columnaAlineada(4, "end", [
            t.nodo("button", { text: "Ver todo el blog", url: "#", variant: "ghost" }, "Botón del encabezado"),
          ], "Columna del botón"),
        ], 24, "Fila del encabezado"),
        t.fila([
          t.columna(12, [
            t.nodo("categories", {}, "Lista de categorías"),
          ], null, "Columna de las categorías"),
        ], 24, "Fila de las categorías"),
      ], { width: "padded" }, t.relleno("64px", "24px")),
    },
    {
      slug: "relacionadas-v2",
      name: "Entradas relacionadas V.2",
      desde: "related-posts",
      nota: "Para el final de una entrada: «sigue leyendo» con el encabezado y el pie por piezas.",
      build: (t) => t.seccion("Entradas relacionadas V.2", [
        t.fila([
          t.columna(12, [
            t.nodo("divider", {}, "Raya de separación"),
            t.nodo("eyebrow", { text: "SIGUE LEYENDO" }, "Antetítulo"),
            t.nodo("heading", { text: "Otras entradas que te pueden gustar", tag: "h2" }, "Título"),
          ], null, "Columna del encabezado"),
        ], 24, "Fila del encabezado"),
        t.fila([
          t.columna(12, [
            t.nodo("related-posts", { count: 3, desktop: 3, showExcerpt: true }, "Rejilla de relacionadas"),
          ], null, "Columna de la rejilla"),
        ], 24, "Fila de la rejilla"),
        t.fila([
          t.columnaAlineada(12, "center", [
            t.nodo("button", { text: "Ver todas las entradas", url: "#", variant: "ghost" }, "Botón del pie"),
          ], "Columna del botón"),
        ], 24, "Fila del pie"),
      ], { width: "padded" }, t.relleno("64px", "24px")),
    },
    {
      slug: "marquesina-v2",
      name: "Marquesina V.2",
      desde: "marquee",
      nota: "La franja de textos que corre sola. Dos tiras en sentidos contrarios y un rótulo, cada una por su cuenta.",
      build: (t) => t.seccion("Marquesina V.2", [
        t.fila([
          t.columnaAlineada(12, "center", [
            // La franja va a sangre, sin relleno de sección, así que el
            // rótulo se pone el suyo o se queda pegado al borde.
            t.nodo("eyebrow", { text: "DESDE 1998" }, "Rótulo", {
              "padding-left": "24px",
              "padding-right": "24px",
              "padding-bottom": "16px",
            }),
          ], "Columna del rótulo"),
        ], 12, "Fila del rótulo"),
        t.fila([
          t.columna(12, [
            t.nodo("marquee", {
              items: [
                { text: "Hecho a mano", url: "" },
                { text: "Origen verificado", url: "" },
                { text: "Sin prisa", url: "" },
              ],
              direction: "left",
              speed: 40,
              variant: "solid",
            }, "Tira de ida"),
            t.nodo("marquee", {
              items: [
                { text: "De temporada", url: "" },
                { text: "En el campo", url: "" },
                { text: "Cada semana", url: "" },
              ],
              direction: "right",
              speed: 48,
              variant: "outline",
            }, "Tira de vuelta"),
          ], null, "Columna de las tiras"),
        ], 12, "Fila de las tiras"),
      ], { width: "full" }, t.relleno("40px", "0px")),
    },
    {
      slug: "acordeon-v2",
      name: "Acordeón V.2",
      desde: "accordion",
      nota: "Desplegables para lo que no son preguntas: ingredientes, condiciones, ficha técnica.",
      build: (t) => t.seccion("Acordeón V.2", [
        t.fila([
          t.columna(5, [
            t.nodo("eyebrow", { text: "LA LETRA PEQUEÑA" }, "Antetítulo"),
            t.nodo("heading", { text: "Todo lo que conviene saber", tag: "h2" }, "Título"),
            t.nodo("paragraph", { text: "Lo que no cabe en la ficha, sin llenar la página de texto." }, "Entradilla"),
          ], null, "Columna del encabezado"),
          t.columna(7, [
            t.nodo("accordion", {
              items: [
                { q: "Ingredientes", a: "Miel cruda de azahar. Nada más." },
                { q: "Conservación", a: "A temperatura ambiente y lejos del sol. Si cristaliza, al baño María." },
                { q: "Envíos y devoluciones", a: "Entre dos y cuatro días laborables. Catorce días para devolverlo." },
              ],
            }, "Desplegables"),
          ], null, "Columna de los desplegables"),
        ], 32, "Fila del acordeón"),
      ], { width: "padded" }, t.relleno("72px", "24px")),
    },
    {
      slug: "pestanas-v2",
      name: "Pestañas V.2",
      desde: "tabs",
      nota: "Varios contenidos en el mismo sitio, uno por pestaña, con el encabezado por piezas.",
      build: (t) => t.seccion("Pestañas V.2", [
        t.fila([
          t.columna(12, [
            t.nodo("eyebrow", { text: "CÓMO SE HACE" }, "Antetítulo"),
            t.nodo("heading", { text: "Del campo al tarro", tag: "h2", align: "center" }, "Título"),
            t.nodo("paragraph", { text: "Tres pasos, cada uno en su pestaña, sin alargar la página.", align: "center" }, "Entradilla"),
          ], null, "Columna del encabezado"),
        ], 24, "Fila del encabezado"),
        t.fila([
          t.columna(12, [
            t.nodo("tabs", {
              items: [
                { q: "En la colmena", a: "Se recoge sólo lo que sobra, cuando los panales están operculados." },
                { q: "En el obrador", a: "Se filtra en frío, sin pasteurizar, para que conserve el polen." },
                { q: "En tu casa", a: "Tarro de cristal, etiqueta con el lote y la fecha de recogida." },
              ],
            }, "Pestañas"),
          ], null, "Columna de las pestañas"),
        ], 24, "Fila de las pestañas"),
      ], { width: "padded" }, t.relleno("72px", "24px")),
    },
    /* ------------------------------------------------------------------ */
    /* Las piezas sueltas                                                  */
    /*                                                                     */
    /* Lo de arriba son secciones enteras. Esto es el otro extremo: la     */
    /* pieza más pequeña, ya metida en su sección, su fila y su columna.   */
    /*                                                                     */
    /* Por qué están aquí: el objetivo es que algún día no haga falta la   */
    /* paleta V.1 para empezar una página. Con esto, cualquier bloque      */
    /* —un título, una foto, un separador— se añade ya colgando de una     */
    /* sección, que es como se editan, se mueven y se guardan las cosas    */
    /* en V.2. Las que se podían desmontar en piezas más pequeñas se han   */
    /* desmontado: la tarjeta, el destacado, el grupo de botones y los     */
    /* juegos de columnas no traen su módulo dentro, sino los bloques      */
    /* sueltos con los que se construyen.                                  */

    {
      slug: "seccion-v2",
      name: "Sección en blanco V.2",
      desde: "section",
      grupo: "pieza",
      nota: "El esqueleto mínimo: una sección con su fila, su columna y un párrafo para empezar.",
      build: (t) => t.pieza("Sección en blanco V.2", [
        t.nodo("paragraph", { text: "Escribe aquí o arrastra dentro los bloques que quieras." }, "Párrafo"),
      ]),
    },
    {
      slug: "caja-v2",
      name: "Caja V.2",
      desde: "container",
      grupo: "pieza",
      nota: "Una caja con fondo y relleno para meter dentro lo que haga falta.",
      build: (t) => t.seccion("Caja V.2", [
        t.fila([
          t.columna(12, [
            t.nodo("heading", { text: "Un bloque destacado dentro de su caja", tag: "h2" }, "Título"),
            t.nodo("paragraph", { text: "La caja es la columna: su fondo, su relleno y sus esquinas se cambian en el inspector." }, "Texto"),
          ], Object.assign({ "background-color": "var(--color-surface)" }, t.relleno("40px", "32px")), "Caja"),
        ], 24, "Fila"),
      ], { width: "padded" }, t.relleno("48px", "24px")),
    },
    {
      slug: "fila-v2",
      name: "Fila de dos columnas V.2",
      desde: "row",
      grupo: "pieza",
      nota: "Una fila partida en dos mitades, cada una con su texto.",
      build: (t) => t.seccion("Fila de dos columnas V.2", [
        t.fila([
          t.columna(6, [
            t.nodo("heading", { text: "Primera mitad", tag: "h3" }, "Título de la izquierda"),
            t.nodo("paragraph", { text: "El texto de la columna de la izquierda." }, "Texto de la izquierda"),
          ], null, "Columna izquierda"),
          t.columna(6, [
            t.nodo("heading", { text: "Segunda mitad", tag: "h3" }, "Título de la derecha"),
            t.nodo("paragraph", { text: "El texto de la columna de la derecha." }, "Texto de la derecha"),
          ], null, "Columna derecha"),
        ], 24, "Fila de dos columnas"),
      ], { width: "padded" }, t.relleno("48px", "24px")),
    },
    {
      slug: "columna-v2",
      name: "Columna V.2",
      desde: "column",
      grupo: "pieza",
      nota: "Una columna sola, con su título y su texto, para ir añadiéndole bloques.",
      build: (t) => t.pieza("Columna V.2", [
        t.nodo("heading", { text: "El título de esta columna", tag: "h3" }, "Título"),
        t.nodo("paragraph", { text: "Y el texto que la acompaña. Añade debajo lo que necesites." }, "Texto"),
      ]),
    },
    {
      slug: "columnas-v2",
      name: "Tres columnas V.2",
      desde: "columns",
      grupo: "pieza",
      nota: "Tres columnas iguales; en móvil se ponen una debajo de otra solas.",
      build: (t) => {
        const col = (n, titulo) => t.columna(4, [
          t.nodo("heading", { text: titulo, tag: "h3" }, `Título ${n}`),
          t.nodo("paragraph", { text: "Dos líneas para contar lo de esta columna." }, `Texto ${n}`),
        ], null, `Columna ${n}`);
        return t.seccion("Tres columnas V.2", [
          t.fila([col(1, "Lo primero"), col(2, "Lo segundo"), col(3, "Lo tercero")], 24, "Fila de tres columnas"),
        ], { width: "padded" }, t.relleno("56px", "24px"));
      },
    },
    {
      slug: "antetitulo-v2",
      name: "Antetítulo V.2",
      desde: "eyebrow",
      grupo: "pieza",
      nota: "La línea pequeña que va encima de un titular.",
      build: (t) => t.pieza("Antetítulo V.2", [
        t.nodo("eyebrow", { text: "UNA LÍNEA PEQUEÑA" }, "Antetítulo"),
      ]),
    },
    {
      slug: "titulo-v2",
      name: "Título V.2",
      desde: "heading",
      grupo: "pieza",
      nota: "Un titular suelto, con su nivel y su alineación.",
      build: (t) => t.pieza("Título V.2", [
        t.nodo("heading", { text: "Un título para esta sección", tag: "h2" }, "Título"),
      ]),
    },
    {
      slug: "parrafo-v2",
      name: "Párrafo V.2",
      desde: "paragraph",
      grupo: "pieza",
      nota: "Un párrafo suelto para escribir sin más.",
      build: (t) => t.pieza("Párrafo V.2", [
        t.nodo("paragraph", { text: "Escribe aquí el texto de esta sección, con la calma que haga falta." }, "Párrafo"),
      ]),
    },
    {
      slug: "texto-v2",
      name: "Texto enriquecido V.2",
      desde: "rich-text",
      grupo: "pieza",
      nota: "Un bloque de texto largo con negritas, enlaces y listas.",
      build: (t) => t.pieza("Texto enriquecido V.2", [
        t.nodo("rich-text", { html: "<p>Un texto largo, con <strong>negritas</strong>, enlaces y listas, para contar algo con detalle.</p>" }, "Texto"),
      ]),
    },
    {
      slug: "imagen-v2",
      name: "Imagen V.2",
      desde: "image",
      grupo: "pieza",
      nota: "Una foto con su pie, cada cosa por su lado.",
      build: (t) => t.pieza("Imagen V.2", [
        t.nodo("image", { alt: "", objectFit: "cover" }, "Foto", { "min-height": "360px" }),
        t.nodo("paragraph", { text: "El pie de la foto, si hace falta.", align: "center" }, "Pie de foto"),
      ]),
    },
    {
      slug: "boton-v2",
      name: "Botón V.2",
      desde: "button",
      grupo: "pieza",
      nota: "Un botón suelto, centrado en su sección.",
      build: (t) => t.seccion("Botón V.2", [
        t.fila([
          t.columnaAlineada(12, "center", [
            t.nodo("button", { text: "Pulsa aquí", url: "#", variant: "primary" }, "Botón"),
          ], "Columna"),
        ], 24, "Fila"),
      ], { width: "padded" }, t.relleno("40px", "24px")),
    },
    {
      slug: "botones-v2",
      name: "Botones V.2",
      desde: "button-group",
      grupo: "pieza",
      nota: "Dos botones uno al lado del otro, cada uno con su propio inspector.",
      build: (t) => t.seccion("Botones V.2", [
        t.fila([
          t.columnaAlineada(6, "end", [
            t.nodo("button", { text: "Acción principal", url: "#", variant: "primary" }, "Botón principal"),
          ], "Columna del botón principal"),
          t.columnaAlineada(6, "start", [
            t.nodo("button", { text: "Acción secundaria", url: "#", variant: "ghost" }, "Botón secundario"),
          ], "Columna del botón secundario"),
        ], 16, "Fila de botones"),
      ], { width: "padded" }, t.relleno("40px", "24px")),
    },
    {
      slug: "tarjeta-v2",
      name: "Tarjeta V.2",
      desde: "card",
      grupo: "pieza",
      nota: "Una tarjeta desmontada: foto, título, texto y botón son cuatro bloques.",
      build: (t) => t.seccion("Tarjeta V.2", [
        t.fila([
          t.columna(6, [
            t.nodo("image", { alt: "", objectFit: "cover" }, "Foto", { "min-height": "240px" }),
            t.nodo("heading", { text: "El título de la tarjeta", tag: "h3" }, "Título"),
            t.nodo("paragraph", { text: "Dos líneas para explicar de qué va esta tarjeta." }, "Texto"),
            t.nodo("button", { text: "Ver más", url: "#", variant: "ghost" }, "Botón"),
          ], Object.assign({ "background-color": "var(--color-surface)" }, t.relleno("24px", "24px")), "Tarjeta"),
        ], 24, "Fila"),
      ], { width: "padded" }, t.relleno("48px", "24px")),
    },
    {
      slug: "destacado-v2",
      name: "Destacado V.2",
      desde: "feature",
      grupo: "pieza",
      nota: "Un destacado desmontado: el icono, el título y el texto, por separado.",
      build: (t) => t.pieza("Destacado V.2", [
        t.nodo("image", { alt: "", objectFit: "contain" }, "Icono", { "min-height": "64px", "max-width": "64px" }),
        t.nodo("heading", { text: "Lo que queremos destacar", tag: "h3" }, "Título"),
        t.nodo("paragraph", { text: "Una o dos frases explicando por qué importa." }, "Texto"),
      ]),
    },
    {
      slug: "redes-v2",
      name: "Redes sociales V.2",
      desde: "social-links",
      grupo: "pieza",
      nota: "Los enlaces a las redes, con su antetítulo encima.",
      build: (t) => t.seccion("Redes sociales V.2", [
        t.fila([
          t.columnaAlineada(12, "center", [
            t.nodo("eyebrow", { text: "SÍGUENOS" }, "Antetítulo"),
            t.nodo("social-links", {}, "Redes"),
          ], "Columna"),
        ], 16, "Fila"),
      ], { width: "padded" }, t.relleno("48px", "24px")),
    },
    {
      slug: "espacio-v2",
      name: "Espacio V.2",
      desde: "spacer",
      grupo: "pieza",
      nota: "Un hueco en blanco entre dos secciones; el alto se pone en su inspector.",
      build: (t) => t.pieza("Espacio V.2", [
        t.nodo("spacer", {}, "Espacio"),
      ], { width: "full" }, t.relleno("0px", "0px")),
    },
    {
      slug: "separador-v2",
      name: "Separador V.2",
      desde: "divider",
      grupo: "pieza",
      nota: "Una raya de lado a lado para separar dos partes de la página.",
      build: (t) => t.pieza("Separador V.2", [
        t.nodo("divider", {}, "Raya"),
      ], { width: "padded" }, t.relleno("24px", "24px")),
    },
  ];

  /**
   * Las secciones de la V.1 que ya tienen recambio.
   *
   * No se borra ninguna: las páginas que las usan siguen funcionando
   * igual, con el mismo módulo y el mismo inspector. Lo único que
   * cambia es dónde se ofrecen: estas quedan recogidas en un cajón
   * aparte de la paleta, cerrado, y la de al lado dice con qué ficha
   * V.2 se hace lo mismo por piezas.
   *
   * Aquí sólo entran los módulos **compuestos**: una sección entera
   * dentro de un solo bloque. Lo que es una pieza de verdad —un
   * título, una foto, un mapa, un formulario, una marquesina, un
   * acordeón— se queda donde estaba, porque es justo lo que usan
   * dentro las fichas V.2.
   */
  const JUBILADOS = {
    hero: 'hero-v2',
    'brand-hero': 'portada-v2',
    'split-feature': 'partido-v2',
    'split-panel': 'paneles-v2',
    'cards-grid': 'tarjetas-v2',
    card: 'tarjeta-v2',
    feature: 'destacado-v2',
    'feature-grid': 'features-v2',
    testimonials: 'testimonios-v2',
    'review-slider': 'resenas-v2',
    statistics: 'cifras-v2',
    cta: 'cta-v2',
    'statement-cta': 'declaracion-v2',
    faq: 'preguntas-v2',
    timeline: 'tiempo-v2',
    'numbered-list': 'lista-v2',
    'statement-list': 'hitos-v2',
    'info-table': 'datos-v2',
    'menu-list': 'carta-v2',
    'product-rail': 'carril-v2',
    'collection-grid': 'coleccion-v2',
    'filter-collection': 'coleccion-v2',
    'retail-strip': 'tiendas-v2',
    'trace-module': 'pasos-v2',
    'footer-split': 'pie-v2',
  };

  window.KrgV2 = {
    /**
     * Lo que se pinta en la paleta.
     *
     * `grupo` separa las dos familias: «seccion» es una sección entera
     * montada por piezas y «pieza» es un bloque suelto dentro de su
     * sección. La paleta las enseña en dos cajones distintos.
     */
    list() {
      return SECCIONES.map((s) => ({
        slug: s.slug,
        name: s.name,
        desde: s.desde,
        nota: s.nota,
        grupo: s.grupo === "pieza" ? "pieza" : "seccion",
      }));
    },
    /**
     * ¿Este bloque de la V.1 tiene ya recambio por piezas?
     *
     * Devuelve la ficha V.2 que hace lo mismo, o `null` si el bloque
     * sigue siendo la única forma de hacerlo. No cambia nada por su
     * cuenta: sólo lo dice.
     */
    jubilado(slug) {
      const destino = JUBILADOS[slug];
      if (!destino) return null;
      const ficha = SECCIONES.find((s) => s.slug === destino);
      return ficha ? { slug: ficha.slug, name: ficha.name } : null;
    },
    /** El mapa entero, para la paleta y para los bancos. */
    jubilados() {
      return { ...JUBILADOS };
    },
    /** Monta la sección: devuelve un nodo `section` con todos sus hijos. */
    build(slug, makeNode) {
      const def = SECCIONES.find((s) => s.slug === slug);
      if (!def || typeof makeNode !== "function") return null;
      return def.build(taller(makeNode));
    },
  };
})();
