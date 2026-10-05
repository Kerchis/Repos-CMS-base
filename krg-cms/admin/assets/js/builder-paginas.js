/* global window */
/**
 * Plantillas de página completas.
 * ---------------------------------------------------------------------
 * Una sección V.2 resuelve un trozo de página. Una plantilla de página
 * resuelve la página entera: el orden en el que esas secciones cuentan
 * algo de principio a fin —qué va arriba, qué va después y con qué se
 * cierra— que es justo la parte que cuesta decidir delante de un lienzo
 * en blanco.
 *
 * Aquí no se inventa nada nuevo: una plantilla es una lista de fichas
 * del catálogo V.2, en orden. Se montan con el mismo `KrgV2.build()`
 * que usa la paleta, así que lo que entra en la página son bloques
 * normales —sección, fila, columna, título, foto— que se editan, se
 * mueven y se borran uno a uno. No queda ningún vínculo con la
 * plantilla: en cuanto está puesta, es una página corriente.
 *
 *   window.KrgPaginas.list()               → las fichas
 *   window.KrgPaginas.build(slug, makeNode) → array de secciones
 *
 * El archivo se carga en todas las pantallas del panel, igual que
 * `builder-v2.js`: el constructor lo usa para montar, y la pantalla de
 * «Nueva página» sólo para enseñar los nombres en un desplegable.
 */
(() => {
  /**
   * El catálogo.
   *
   * `secciones` son slugs del catálogo V.2. Si un día se renombra uno,
   * el banco `tools/prueba-plantillas.mjs` lo canta antes de que nadie
   * se encuentre media plantilla.
   */
  const PAGINAS = [
    {
      slug: "portada",
      name: "Portada",
      nota: "La página de inicio completa: entrada grande, qué hacéis, producto, historia, reseñas y una llamada final.",
      secciones: [
        "portada-v2",
        "marquesina-v2",
        "features-v2",
        "coleccion-v2",
        "partido-v2",
        "resenas-v2",
        "cta-v2",
      ],
    },
    {
      slug: "sobre-nosotros",
      name: "Sobre nosotros",
      nota: "Quiénes sois: entrada, la historia en dos columnas, cifras, los hitos por años y con quién trabajáis.",
      secciones: [
        "hero-v2",
        "partido-v2",
        "cifras-v2",
        "hitos-v2",
        "logos-v2",
        "cta-v2",
      ],
    },
    {
      slug: "productos",
      name: "Productos",
      nota: "El catálogo: carril destacado, la rejilla entera, lo que diferencia al producto, reseñas y dudas.",
      secciones: [
        "hero-v2",
        "carril-v2",
        "coleccion-v2",
        "paneles-v2",
        "resenas-v2",
        "preguntas-v2",
        "cta-v2",
      ],
    },
    {
      slug: "servicios",
      name: "Servicios",
      nota: "Qué ofrecéis: entrada, los servicios en tarjetas, el detalle en pestañas, cómo se trabaja y testimonios.",
      secciones: [
        "hero-v2",
        "tarjetas-v2",
        "pestanas-v2",
        "pasos-v2",
        "testimonios-v2",
        "cta-v2",
      ],
    },
    {
      slug: "contacto",
      name: "Contacto",
      nota: "Hablar con vosotros: formulario y datos, horario, el mapa y las dudas de siempre.",
      secciones: [
        "contacto-v2",
        "horario-v2",
        "mapa-v2",
        "preguntas-v2",
      ],
    },
    {
      slug: "restaurante",
      name: "Carta y reservas",
      nota: "Para un sitio con mesas: portada, la carta por secciones, horario, reserva y cómo llegar.",
      secciones: [
        "portada-v2",
        "carta-v2",
        "horario-v2",
        "reserva-v2",
        "mapa-v2",
      ],
    },
    {
      slug: "blog",
      name: "Índice del blog",
      nota: "La portada del blog: entrada, las categorías, la rejilla de entradas y una llamada al final.",
      secciones: [
        "hero-v2",
        "categorias-v2",
        "blog-v2",
        "cta-v2",
      ],
    },
    {
      slug: "entrada",
      name: "Final de entrada",
      nota: "Lo que va debajo de un artículo: la firma, la letra pequeña desplegable y otras entradas.",
      secciones: [
        "cita-v2",
        "acordeon-v2",
        "relacionadas-v2",
        "cta-v2",
      ],
    },
    {
      slug: "aterrizaje",
      name: "Página de campaña",
      nota: "Una sola idea de arriba abajo: declaración, cómo funciona, prueba social, dudas y cierre.",
      secciones: [
        "declaracion-v2",
        "pasos-v2",
        "cifras-v2",
        "testimonios-v2",
        "preguntas-v2",
        "cta-v2",
      ],
    },
    {
      slug: "en-blanco",
      name: "En blanco",
      nota: "Una sección vacía y nada más, para empezar desde cero sin montar el andamiaje a mano.",
      secciones: ["seccion-v2"],
    },
  ];

  const porSlug = (slug) => PAGINAS.find((p) => p.slug === slug) || null;

  /**
   * Monta la plantilla entera y devuelve las secciones.
   *
   * Si una ficha V.2 no existiera —porque se ha renombrado—, se salta
   * esa y se montan las demás: más vale media plantilla que un error
   * en la cara. Quien llama puede comparar `length` con el de la ficha
   * si le importa.
   */
  function build(slug, makeNode) {
    const ficha = porSlug(slug);
    if (!ficha || !window.KrgV2) return [];
    const out = [];
    ficha.secciones.forEach((s) => {
      let sec = null;
      try {
        sec = window.KrgV2.build(s, makeNode);
      } catch (e) {
        sec = null;
      }
      if (sec) out.push(sec);
    });
    return out;
  }

  window.KrgPaginas = {
    list: () => PAGINAS.map((p) => ({
      slug: p.slug,
      name: p.name,
      nota: p.nota,
      secciones: p.secciones.slice(),
    })),
    get: (slug) => {
      const f = porSlug(slug);
      return f ? { slug: f.slug, name: f.name, nota: f.nota, secciones: f.secciones.slice() } : null;
    },
    build,
  };
})();
