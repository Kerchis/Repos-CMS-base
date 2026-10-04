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

    return { nodo, columna, fila, seccion, relleno };
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
  ];

  window.KrgV2 = {
    /** Lo que se pinta en la paleta. */
    list() {
      return SECCIONES.map((s) => ({ slug: s.slug, name: s.name, desde: s.desde, nota: s.nota }));
    },
    /** Monta la sección: devuelve un nodo `section` con todos sus hijos. */
    build(slug, makeNode) {
      const def = SECCIONES.find((s) => s.slug === slug);
      if (!def || typeof makeNode !== "function") return null;
      return def.build(taller(makeNode));
    },
  };
})();
