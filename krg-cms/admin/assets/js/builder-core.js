/**
 * KRG Visual Builder Core — registro de controles e inspector.
 *
 * Por que existe: hasta ahora cada tipo de elemento tenia su propia
 * funcion `inspector()` que decidia a mano que grupos enseñaba. Siete
 * funciones distintas para la misma idea, asi que la galeria no tenia
 * sombra, el video no tenia borde y un bloque de marca no tenia
 * tipografia: no porque el motor no supiera, sino porque nadie habia
 * escrito esa linea en esa variante.
 *
 * Aqui vive una sola vez la parte que se repetia:
 *
 *   1. UN REGISTRO DE CONTROLES. Cada grupo de ajustes («Separacion»,
 *      «Borde», «Fondo»…) se registra una vez con su etiqueta y su
 *      cuerpo. Quien lo pinta no sabe para que elemento es.
 *   2. UN ESQUEMA POR TIPO. Cada clase de elemento declara que controles
 *      quiere en cada pestaña. Añadir «sombra» a la galeria es escribir
 *      su nombre en una lista.
 *   3. UN INSPECTOR. Cabecera del elemento seleccionado, pestañas
 *      Contenido / Diseño / Avanzado y grupos que se abren y se cierran.
 *
 * Lo que NO hace, a proposito: no toca el estado, no guarda, no conoce
 * el documento. Recibe un contexto, devuelve HTML y avisa cuando se
 * abre o se cierra un grupo. Asi el mismo nucleo sirve para el
 * constructor de paginas y para el de cabecera y pie, que son dos
 * contextos distintos del mismo motor.
 *
 * @package Meridian
 */
(function () {
  "use strict";

  /** Controles registrados: id → { label, body, when, hint }. */
  const CONTROLS = new Map();

  /** Esquemas por clase de elemento: kind → { content, design, advanced }. */
  const SCHEMAS = new Map();

  /** Grupos que el usuario ha abierto o cerrado a mano. */
  const MEM_KEY = "krg.insp.groups";
  let memoria = {};
  try {
    memoria = JSON.parse(window.localStorage.getItem(MEM_KEY) || "{}") || {};
  } catch (e) {
    memoria = {};
  }

  function recuerda() {
    try {
      window.localStorage.setItem(MEM_KEY, JSON.stringify(memoria));
    } catch (e) {
      /* sin memoria, el panel sigue funcionando */
    }
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Registra un grupo de ajustes.
   *
   * @param {string} id    Nombre interno, unico. Es el que recuerda si el
   *                       grupo queda abierto o cerrado.
   * @param {object} def   { label, body(ctx), when(ctx), hint }.
   *                       `body` devuelve el HTML de dentro, sin
   *                       envoltorio. Si devuelve vacio, el grupo no se
   *                       pinta: asi un control puede decidir que no
   *                       tiene nada que decir para este elemento.
   */
  function registerControl(id, def) {
    CONTROLS.set(id, Object.assign({ id: id, label: id, body: () => "" }, def));
  }

  /**
   * Declara que controles ve cada clase de elemento.
   *
   * @param {string} kind  'page' | 'section' | 'row' | 'column' | tipo de bloque.
   * @param {object} tabs  { content: [ids], design: [ids], advanced: [ids] }.
   */
  function setSchema(kind, tabs) {
    SCHEMAS.set(kind, tabs);
  }

  /** El esquema de un elemento, con un respaldo por clase general. */
  function schemaFor(ctx) {
    const base = SCHEMAS.get(ctx.type) || SCHEMAS.get(ctx.kind) || { content: [], design: [], advanced: [] };
    if (!ctx.schema) return base;
    // Un bloque puede traer su propia lista en el catalogo
    // (`def.inspector`). Lo que declare manda; lo que no declare, lo
    // hereda de su clase.
    return {
      content: ctx.schema.content || base.content,
      design: ctx.schema.design || base.design,
      advanced: ctx.schema.advanced || base.advanced,
    };
  }

  /** ¿Este grupo se ve abierto? Manda lo que haya tocado el usuario. */
  function isOpen(id, porDefecto) {
    if (Object.prototype.hasOwnProperty.call(memoria, id)) return !!memoria[id];
    return !!porDefecto;
  }

  function setOpen(id, abierto) {
    memoria[id] = !!abierto;
    recuerda();
  }

  /**
   * Qué dibujo le toca a cada grupo del inspector.
   *
   * Un panel con veinte cabeceras de texto en versalitas se lee igual de
   * mal que una lista de la compra. El icono no sustituye al rótulo:
   * sirve para volver al grupo que ya habías visitado sin leerlo todo.
   * Por familias, no uno distinto para cada uno: la idea es reconocer
   * «esto es color» o «esto es medida» de un vistazo.
   */
  const ICONO_GRUPO = {
    pagina: "pagina",
    sectionBasics: "rejilla", sectionRows: "rejilla", rowBasics: "rejilla", columnBasics: "rejilla",
    catLayout: "rejilla", galColumns: "rejilla",
    textContent: "texto", moduleContent: "texto", globalNote: "texto",
    imageContent: "imagen", galleryItems: "imagen", imgFill: "imagen", imgRadius: "imagen",
    imgScale: "imagen", galPresentation: "imagen", galNav: "imagen",
    videoSource: "video", vidSize: "video", vidPlayback: "video",
    everestForm: "forma",
    imageLink: "enlace",
    align: "alinear",
    sectionWidth: "medida", sectionHeight: "medida", size: "medida", position: "medida",
    catResponsive: "ojo", visibility: "ojo",
    sectionCurtain: "movimiento", imgParallax: "movimiento", galParallax: "movimiento",
    animation: "movimiento", transitions: "movimiento", transform: "movimiento",
    sectionHeader: "ajustes", menuModes: "ajustes", catDesign: "ajustes",
    catColors: "gota", background: "gota", filters: "gota",
    catSpacing: "espacio", spacing: "espacio",
    catTypography: "tipo", typography: "tipo", textSize: "tipo", headingTag: "tipo",
    border: "borde",
    shadow: "sombra",
    cssId: "codigo", customCss: "codigo", attributes: "codigo", diag: "codigo",
  };
  function iconoDe(id) {
    const set = (typeof window !== "undefined" && window.KrgIco) || {};
    return set[ICONO_GRUPO[id] || "ajustes"] || "";
  }

  /**
   * Guarda los parrafones de ayuda detrás de un desplegable.
   *
   * El inspector explicaba cada ajuste con tres o cuatro líneas de
   * prosa debajo del control. Junto todo era un prospecto: el usuario
   * que ya sabe lo que hace tenía que desplazar el panel entero para
   * llegar al siguiente ajuste. Ahora las explicaciones largas quedan
   * tras un «Qué significa» que ocupa una línea; las cortas, que caben
   * de un vistazo, se quedan donde estaban.
   *
   * No se mueven de sitio: cada una sigue justo debajo del control que
   * explica.
   */
  const LARGO_AYUDA = 90;
  function plegarAyudas(html) {
    return String(html).replace(/<p class="m-muted">([\s\S]*?)<\/p>/g, (todo, dentro) => {
      // Sólo se pliega la prosa de manual: texto llano y largo. Si el
      // párrafo trae marcas dentro —un nombre en negrita, un color en
      // <code>, un enlace— es un aviso de lo que está pasando ahora
      // mismo en esta página, y eso tiene que verse sin pulsar nada.
      if (dentro.indexOf("<") !== -1) return todo;
      if (dentro.trim().length < LARGO_AYUDA) return todo;
      return `<details class="b-ayuda"><summary>Qué significa</summary><p class="m-muted">${dentro}</p></details>`;
    });
  }

  /** Un grupo: cabecera pulsable y cuerpo que se pliega. */
  function grupo(id, label, html, abierto, hint) {
    if (!html) return "";
    // La explicación del grupo entero, si la hay, va detrás de un «?».
    const ayuda = hint
      ? `<button type="button" class="acc-ayuda-t" data-ayuda="${esc(id)}" aria-expanded="false"
           aria-label="Qué es ${esc(label)}" title="Qué es esto">${(typeof window !== "undefined" && window.KrgIco ? window.KrgIco.ayuda : "") || "?"}</button>`
      : "";
    // El «?» es hermano de la cabecera, no hijo: un botón no puede ir
    // dentro de otro, y además hay bancos y atajos que buscan `.acc-h`
    // como hijo directo del grupo. La fila la arma el CSS con flex.
    return `<section class="acc b-group${abierto ? " is-open" : ""}" data-acc="${esc(id)}">
      <button type="button" class="acc-h" data-acc-t="${esc(id)}" aria-expanded="${abierto ? "true" : "false"}">
        <span class="acc-i" aria-hidden="true">${iconoDe(id)}</span>
        <span class="acc-t">${esc(label)}</span>
        <span class="acc-x" aria-hidden="true"></span>
      </button>
      ${ayuda}
      <div class="acc-b"${abierto ? "" : " hidden"}>
        ${hint ? `<p class="m-muted acc-ayuda" id="ayuda-${esc(id)}" hidden>${esc(hint)}</p>` : ""}
        ${plegarAyudas(html)}
      </div>
    </section>`;
  }

  /** Los grupos de una pestaña, en el orden del esquema. */
  function grupos(ids, ctx) {
    let primero = true;
    return (ids || []).map((id) => {
      const c = CONTROLS.get(id);
      if (!c) return "";
      if (typeof c.when === "function" && !c.when(ctx)) return "";
      let html = "";
      try {
        html = c.body(ctx) || "";
      } catch (e) {
        html = `<p class="b-warn">Este grupo no se ha podido pintar (${esc(e.message)}).</p>`;
      }
      if (!html) return "";
      const label = typeof c.label === "function" ? c.label(ctx) : c.label;
      // El primero de cada pestaña nace abierto: entrar y no ver nada
      // tampoco ayuda. Los demas, cerrados, y lo que el usuario toque se
      // recuerda para la proxima vez.
      const out = grupo(id, label, html, isOpen(id, primero), typeof c.hint === "function" ? c.hint(ctx) : c.hint);
      primero = false;
      return out;
    }).join("");
  }

  const TABS = [
    ["content", "Contenido"],
    ["design", "Diseño"],
    ["advanced", "Avanzado"],
  ];

  /**
   * El inspector entero.
   *
   * @param {object} ctx Contexto del elemento seleccionado:
   *   { kind, type, title, subtitle, tab, page: {label, html}, ...lo que
   *   necesiten los controles }.
   */
  function render(ctx) {
    const tab = ctx.tab || "content";
    const esquema = schemaFor(ctx);
    const paginaHtml = ctx.page
      ? grupo("pagina", ctx.page.label || "Configuración de página", ctx.page.html, isOpen("pagina", false))
      : "";

    if (!ctx.type && !ctx.kind) {
      return `${paginaHtml}<div class="b-empty">Selecciona un elemento en el árbol o en el lienzo.</div>`;
    }

    const cabecera = `<div class="b-sel">
      <span class="b-sel-kind">${esc(ctx.kindLabel || ctx.kind || "")}</span>
      <strong class="b-sel-name">${esc(ctx.title || ctx.type || "")}</strong>
      ${ctx.subtitle ? `<span class="b-sel-sub">${esc(ctx.subtitle)}</span>` : ""}
      ${ctx.actions || ""}
    </div>`;

    /* Si el bloque es de la hornada vieja, se dice —una línea, sin
       estorbar— y se deja claro que puede quedarse como está. */
    const recambio = (window.KrgV2 && ctx.type) ? window.KrgV2.jubilado(ctx.type) : null;
    const aviso = recambio
      ? `<p class="b-vieja-aviso" data-vieja-aviso>Este bloque es de la versión anterior: toda la sección
         va dentro de uno solo. Sigue funcionando igual y puede quedarse así. Si alguna vez quieres
         editarlo pieza a pieza, su equivalente en la paleta es <strong>${esc(recambio.name)}</strong>.</p>`
      : "";

    const tabsHtml = `<div class="b-tabs" role="tablist">${TABS.map(([v, l]) => {
      const vacia = !(esquema[v] || []).length;
      return `<button type="button" role="tab" data-insp-tab="${v}" class="${tab === v ? "is-on" : ""}"${vacia ? " disabled" : ""}>${l}</button>`;
    }).join("")}</div>`;

    const cuerpo = grupos(esquema[tab], ctx)
      || `<div class="b-empty">Este elemento no tiene ajustes de ${esc((TABS.find((t) => t[0] === tab) || [])[1] || tab).toLowerCase()}.</div>`;

    // La cabecera y las pestañas se quedan pegadas arriba: en un panel
    // de treinta controles, al bajar ya no sabías qué estabas editando
    // ni podías cambiar de pestaña sin volver al principio.
    return `${paginaHtml}<div class="b-insp-fija">${cabecera}${tabsHtml}</div>${aviso}<div class="b-groups">${cuerpo}</div>`;
  }

  /**
   * Abrir y cerrar grupos.
   *
   * No repinta nada: cambia el atributo `hidden` y lo apunta. Repintar
   * desde aqui mataria el control en el que el usuario acaba de pulsar.
   */
  function bindGroups(root) {
    root.querySelectorAll("[data-ayuda]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sec = btn.closest("[data-acc]");
        const p = sec && sec.querySelector(".acc-ayuda");
        if (!p) return;
        // Si el grupo estaba plegado, enseñar la ayuda lo abre: si no,
        // se pulsa el «?» y no pasa nada visible.
        if (!sec.classList.contains("is-open")) {
          const cab = sec.querySelector("[data-acc-t]");
          if (cab) cab.click();
          p.hidden = false;
        } else {
          p.hidden = !p.hidden;
        }
        btn.setAttribute("aria-expanded", p.hidden ? "false" : "true");
      });
    });
    root.querySelectorAll("[data-acc-t]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = btn.closest("[data-acc]");
        if (!sec) return;
        const abierto = !sec.classList.contains("is-open");
        sec.classList.toggle("is-open", abierto);
        btn.setAttribute("aria-expanded", abierto ? "true" : "false");
        const cuerpo = sec.querySelector(".acc-b");
        if (cuerpo) cuerpo.hidden = !abierto;
        setOpen(sec.dataset.acc, abierto);
      });
    });
  }

  /** Abre un grupo por su nombre (lo usan los bancos y los atajos). */
  function openGroup(root, id) {
    const sec = root.querySelector(`[data-acc="${id}"]`);
    if (!sec || sec.classList.contains("is-open")) return;
    const btn = sec.querySelector("[data-acc-t]");
    if (btn) btn.click();
  }

  /* ------------------------------------------------------------------ */
  /* Diccionarios que llegan como lista vacia                            */
  /*                                                                      */
  /* PHP no distingue «lista vacia» de «diccionario vacio»: las dos son   */
  /* `[]`, y `wp_json_encode` las escribe igual. Asi que un nodo sin      */
  /* estilos llega al navegador como `"styles":{"desktop":[]}` y el       */
  /* panel recibe un ARRAY donde espera un objeto.                        */
  /*                                                                      */
  /* En memoria no se nota —`a["background-color"]="#3f5e58"` funciona    */
  /* sobre un array, y `Object.keys` lo devuelve, asi que el lienzo pinta */
  /* el color— pero al guardar:                                          */
  /*                                                                      */
  /*   JSON.stringify(a)  →  "[]"                                        */
  /*                                                                      */
  /* `JSON.stringify` descarta las propiedades con nombre de un array.   */
  /* El valor se perdia entre el panel y el servidor sin un solo error:   */
  /* se veia en el lienzo, seguia en el campo, y no llegaba a la base de  */
  /* datos. Lo mismo le pasaba a `props`, al historial de deshacer y a    */
  /* cualquier cosa que viajara en un bucket vacio.                       */
  /*                                                                      */
  /* `dict()` convierte ese array en un objeto de verdad, conservando lo  */
  /* que ya le hubieran colgado. `adoptDoc()` lo hace de una pasada en    */
  /* cuanto un documento entra en el editor, que es el unico sitio por el */
  /* que pasan la carga inicial, el guardado adoptado y una revision      */
  /* restaurada.                                                          */
  /* ------------------------------------------------------------------ */

  const BUCKETS = ["desktop", "tablet", "mobile"];

  /** Devuelve `obj[key]` como objeto, convirtiendolo en el sitio si hace falta. */
  function dict(obj, key) {
    if (!obj || typeof obj !== "object") return {};
    const v = obj[key];
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
    const out = {};
    if (Array.isArray(v)) {
      // Si alguien ya le habia colgado propiedades antes de normalizar,
      // se rescatan: son justo las que `JSON.stringify` iba a tirar.
      Object.keys(v).forEach((k) => {
        if (!/^\d+$/.test(k)) out[k] = v[k];
      });
    }
    obj[key] = out;
    return out;
  }

  /** Estilos de un nodo en un tamaño, siempre como objeto escribible. */
  function styleBucket(node, bp) {
    return dict(dict(node, "styles"), bp);
  }

  function normalizeNode(node) {
    if (!node || typeof node !== "object") return node;
    if (node.styles !== undefined) {
      const st = dict(node, "styles");
      BUCKETS.forEach((bp) => {
        if (st[bp] !== undefined) dict(st, bp);
      });
    }
    if (node.props !== undefined) dict(node, "props");
    if (Array.isArray(node.children)) node.children.forEach(normalizeNode);
    return node;
  }

  /** Normaliza un documento entero recien llegado del servidor. */
  function adoptDoc(doc) {
    if (!doc || typeof doc !== "object") return doc;
    ["seo", "settings", "theme"].forEach((k) => {
      if (doc[k] !== undefined) dict(doc, k);
    });
    if (Array.isArray(doc.sections)) doc.sections.forEach(normalizeNode);
    if (Array.isArray(doc.children)) doc.children.forEach(normalizeNode);
    return doc;
  }

  /* ------------------------------------------------------------------ */
  /* Guardar el sitio donde estabas                                       */
  /*                                                                      */
  /* Los dos paneles se rehacen enteros con innerHTML, y dentro hay cajas */
  /* con su PROPIA barra de desplazamiento (el arbol de la carta lleva    */
  /* `max-height`). Al repintar, esas cajas volvian al principio: el      */
  /* panel no se movia, pero la lista de dentro si, que es lo que se      */
  /* nota. Vive aqui porque le pasa igual a la pantalla de paginas y a la */
  /* de cabecera y pie: un solo sitio, no dos copias.                     */
  /* ------------------------------------------------------------------ */
  function caminoDe(el, raiz) {
    const partes = [];
    let n = el;
    while (n && n !== raiz) {
      const p = n.parentElement;
      if (!p) return null;
      partes.unshift(":nth-child(" + (Array.prototype.indexOf.call(p.children, n) + 1) + ")");
      n = p;
    }
    return n === raiz && partes.length ? ":scope > " + partes.join(" > ") : null;
  }

  function scrollSnap(raiz) {
    if (!raiz) return [];
    const out = [];
    raiz.querySelectorAll("*").forEach((el) => {
      if (!el.scrollTop && !el.scrollLeft) return;
      // Una referencia estable gana a la posicion: si al repintar sobra o
      // falta un hijo, `data-tree` sigue apuntando a la misma caja.
      const sel = el.dataset.tree
        ? `[data-tree="${CSS.escape(el.dataset.tree)}"]`
        : caminoDe(el, raiz);
      if (sel) out.push({ sel: sel, top: el.scrollTop, left: el.scrollLeft });
    });
    return out;
  }

  function scrollRestore(raiz, lista) {
    if (!raiz || !lista) return;
    lista.forEach((s) => {
      let el = null;
      try { el = raiz.querySelector(s.sel); } catch (e) { return; }
      if (!el) return;
      el.scrollTop = s.top;
      el.scrollLeft = s.left;
    });
  }

  /**
   * Un color del inspector, escrito como CSS.
   *
   * Vive aquí porque lo necesitan las dos pantallas y el inspector
   * compartido: una sola forma de traducir {modo, token, valor}.
   */
  function cssColor(v) {
    if (!v) return "";
    if (typeof v === "string") return /^(#[0-9a-f]{3,8}|var\(--[\w-]+\))$/i.test(v.trim()) ? v.trim() : "";
    if (v.mode === "none") return "";
    if (v.mode === "token" && v.token) return `var(--${String(v.token).replace(".", "-")})`;
    return cssColor(String(v.value || ""));
  }

  /**
   * Fondo, relleno y margen: las mismas nueve claves que el servidor.
   *
   * Es el gemelo en JavaScript de `BoxStyles::declarations()` en PHP.
   * Está aquí para que las dos pantallas —páginas y navegación— pinten
   * la vista viva con las mismas reglas.
   */
  const CAJA_PROPS = [
    "background-color",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
  ];

  function cssCaja(styles) {
    const st = styles || {};
    return CAJA_PROPS
      .filter((p) => st[p] !== undefined && st[p] !== null && String(st[p]).trim() !== "")
      .map((p) => `${p}:${String(st[p]).trim()}`);
  }

  /**
   * El hueco entre columnas de una rejilla, sin que se salga de la
   * pantalla.
   *
   * Gemelo en JavaScript de `DocumentCssCompiler::grid_gap()`. Una fila
   * son doce pistas con once huecos: con el hueco en 40 px esos once
   * huecos suman 440 px y en un móvil de 390 px la fila no cabe ni
   * vacía. El tope reparte un 90 % del ancho entre todos los huecos y
   * `min()` sigue eligiendo los píxeles mientras quepan, así que lo que
   * hoy se ve bien no cambia. El hueco vertical no se toca.
   */
  function gridGap(gap, pistas) {
    const g = Math.max(0, Number(gap) || 0);
    if (!g) return "gap:0;";
    if (!(pistas > 1)) return `gap:${g}px;`;
    const tope = Math.round((90 / (pistas - 1)) * 100) / 100;
    return `row-gap:${g}px;column-gap:min(${g}px,${tope}%);`;
  }

  window.KrgBuilderCore = {
    dict: dict,
    cssColor: cssColor,
    cssCaja: cssCaja,
    gridGap: gridGap,
    CAJA_PROPS: CAJA_PROPS,
    scrollSnap: scrollSnap,
    scrollRestore: scrollRestore,
    styleBucket: styleBucket,
    normalizeNode: normalizeNode,
    adoptDoc: adoptDoc,
    registerControl: registerControl,
    setSchema: setSchema,
    schemaFor: schemaFor,
    render: render,
    bindGroups: bindGroups,
    openGroup: openGroup,
    isOpen: isOpen,
    setOpen: setOpen,
    controls: CONTROLS,
    schemas: SCHEMAS,
  };
})();
