/**
 * Los campos del constructor: controles del inspector, esquema de cada
 * clase de elemento, los campos que vienen del catálogo y el cableado
 * de todo lo que se toca.
 *
 * Vive aparte porque lo usan las DOS pantallas —páginas y navegación—.
 * Antes la de navegación tenía su propia versión recortada y por eso a
 * la cabecera y al pie les faltaban la mitad de las opciones: fondo,
 * relleno, margen, tamaño, borde, sombra, posición... Ahora las dos
 * montan este mismo inspector y lo único que cambia es el documento
 * con el que trabajan.
 *
 * `window.KrgFields(host)` devuelve el inspector atado a ese host. El
 * host es quien sabe de su documento y pone:
 *
 *   state        estado con doc {sections}, selected, bp, registry...
 *   root         el nodo de la pantalla (para buscar el iframe y el panel)
 *   esc, cssColor, defOf, findNode, makeNode, uid
 *   markDirty, snapshot, render, tree, paintLiveCss, pingFrame, toast
 *   unlinkNode   desvincular un componente global (puede no hacer nada)
 */
(() => {
  window.KrgFields = function (host) {
    const state = host.state;
    const root = host.root;
    const cfg = host.cfg || window.KrgAdmin || {};
    const api = host.api || window.MApi;
    const id = Number(host.id || 0);
    const esc = host.esc;
    const cssColor = host.cssColor;
    const defOf = host.defOf;
    const findNode = host.findNode;
    const makeNode = host.makeNode;
    const markDirty = host.markDirty;
    const paintLiveCss = host.paintLiveCss || (() => {});
    const pingFrame = host.pingFrame || (() => {});
    const render = host.render;
    const snapshot = host.snapshot || (() => {});
    const toast = host.toast || (() => {});
    const tree = host.tree || (() => "");
    const unlinkNode = host.unlinkNode || (() => {});


  function unitize(v, unit) {
    v = String(v ?? "").trim();
    if (!v) return "";
    if (/[a-z%]/i.test(v)) return v;
    return v + (unit || "px");
  }
  /**
   * El valor de un lado, tal cual esta guardado.
   *
   * Antes esto tambien sabia desmontar atajos («padding: 10px 20px») por
   * si el documento traia uno. Ya no hace falta: los atajos se traducen a
   * propiedades largas al leer la pagina, en el servidor, y no vuelven a
   * aparecer. Una cosa menos que pueda contradecir a otra.
   */
  function sideVal(st, kind, side) {
    const v = st[`${kind}-${side}`];
    return v === undefined || v === null ? "" : String(v).replace(/px$/i, "");
  }
  function boxControl(kind, label, st) {
    const sides = [
      ["top", "Arriba"],
      ["right", "Derecha"],
      ["bottom", "Abajo"],
      ["left", "Izquierda"],
    ];
    return `<div class="b-box">
      <div class="b-box-h"><strong>${label}</strong><span class="m-muted">px · ${state.bp}</span></div>
      <div class="b-box-grid">
        ${sides.map(([s, lab]) => `<label>${lab}<input type="number" data-side="${kind}-${s}" value="${esc(sideVal(st, kind, s))}" placeholder="auto"></label>`).join("")}
      </div>
    </div>`;
  }
  function seg(prop, value, opts, attr) {
    const a = attr || "data-style-set";
    return `<div class="b-seg">${opts.map((o) => `<button type="button" class="${String(value) === String(o.v) ? "is-on" : ""}" ${a}="${prop}" data-v="${esc(o.v)}" title="${esc(o.t || o.l)}">${o.l}</button>`).join("")}</div>`;
  }
  const ALIGN_ICONS = {
    hStart: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 3h2v18H3V3zm5 3h11v3H8V6zm0 6h8v3H8v-3zm0 6h12v3H8v-3z"/></svg>`,
    hCenter: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11 3h2v18h-2V3zM6 6h12v3H6V6zm3 6h6v3H9v-3zM5 18h14v3H5v-3z"/></svg>`,
    hEnd: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 3h2v18h-2V3zM5 6h11v3H5V6zm3 6h8v3H8v-3zM4 18h12v3H4v-3z"/></svg>`,
    vStart: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 3h18v2H3V3zm3 5h3v12H6V8zm6 0h3v8h-3V8zm6 0h3v13h-3V8z"/></svg>`,
    vCenter: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 11h18v2H3v-2zM6 5h3v14H6V5zm6 3h3v8h-3V8zm6 2h3v10h-3V10z"/></svg>`,
    vEnd: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 19h18v2H3v-2zM6 4h3v13H6V4zm6 4h3v9h-3V8zm6 2h3v11h-3V10z"/></svg>`,
    distX: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 3h2v18H3V3zm16 0h2v18h-2V3zM8 8h3v8H8V8zm5 0h3v8h-3V8z"/></svg>`,
    distY: `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 3h18v2H3V3zm0 16h18v2H3v-2zM8 8h8v3H8V8zm0 5h8v3H8v-3z"/></svg>`,
  };
  function alignBtn(key, val, current, icon, title, parent) {
    const on = String(current) === String(val) ? " is-on" : "";
    const attr = parent ? `data-parent-prop="${key}"` : `data-prop-set="${key}"`;
    return `<button type="button" class="b-align-btn${on}" ${attr} data-v="${val}" title="${esc(title)}">${ALIGN_ICONS[icon]}</button>`;
  }
  /* ================================================================
     INSPECTOR — cuerpos de los grupos
     ----------------------------------------------------------------
     Cada funcion devuelve SOLO lo de dentro de un grupo. El titulo, el
     plegado y el orden los pone el nucleo (builder-core.js) a partir
     del esquema de mas abajo. Antes cada una de estas cosas venia
     envuelta en su `<div class="acc">` dentro de siete funciones
     `inspector()` distintas, y por eso un bloque tenia sombra y otro
     no segun en cual de las siete hubiera caido.

     Regla al tocar esto: los atributos `data-*` son el contrato con
     `bindInspector()`, con el guardado y con los bancos. Se pueden
     mover de grupo, pero no renombrar.
     ================================================================ */

  function bodyAlign(node) {
    const p = node.props || {};
    const isCol = node.type === "column";
    const isRow = node.type === "row";
    const hKey = isCol ? "contentHAlign" : "alignH";
    const vKey = isRow ? "vAlign" : isCol ? "contentVAlign" : "alignV";
    const h = p[hKey] || "start";
    const v = p[vKey] || "start";
    const distSelf = isCol || isRow;
    let dist = p.distribute || "none";
    if (!distSelf) {
      const hit = findNode(state.doc.sections, node.id);
      dist = hit?.parent?.props?.distribute || "none";
    }
    return `<p class="m-muted">Alinear objetos</p>
      <div class="b-align">
        ${alignBtn(hKey, "start", h, "hStart", "Izquierda")}
        ${alignBtn(hKey, "center", h, "hCenter", "Centro horizontal")}
        ${alignBtn(hKey, "end", h, "hEnd", "Derecha")}
        ${alignBtn(vKey, "start", v, "vStart", "Arriba")}
        ${alignBtn(vKey, "center", v, "vCenter", "Centro vertical")}
        ${alignBtn(vKey, "end", v, "vEnd", "Abajo")}
      </div>
      <p class="m-muted">Distribuir objetos</p>
      <div class="b-align">
        ${alignBtn("distribute", "x", distSelf ? dist : "", "distX", "Distribuir horizontal", !distSelf)}
        ${alignBtn("distribute", "y", distSelf ? dist : "", "distY", "Distribuir vertical", !distSelf)}
      </div>`;
  }

  function bodySpacing(st) {
    const otros = { desktop: "tablet y móvil", tablet: "móvil", mobile: "" }[state.bp];
    return `${boxControl("padding", "Relleno", st)}
      ${boxControl("margin", "Margen", st)}
      <p class="m-muted">En blanco no es cero: es «lo que traiga el bloque». Escribe 0 para pegarlo del todo.${otros ? ` Lo que pongas aquí vale también en ${otros} mientras no les pongas un valor propio.` : ""}</p>`;
  }

  function bodySize(st) {
    return `${rangeControl("Ancho", "width", st, 10, 100, "%")}
      ${rangeControl("Ancho máximo", "max-width", st, 10, 100, "%")}
      ${rangeControl("Alto", "height", st, 0, 1200, "px")}
      ${rangeControl("Alto mínimo", "min-height", st, 0, 1200, "px")}
      <p class="m-muted">Vacío = lo que ocupe el contenido. Los valores son de ${state.bp}.</p>`;
  }

  function bodyBorder(st) {
    return `<div class="b-box-grid">
        <label>Sup. izq. <input type="number" data-side="border-top-left-radius" value="${esc(String(st["border-top-left-radius"] || "").replace(/px$/i, ""))}" placeholder="auto"></label>
        <label>Sup. der. <input type="number" data-side="border-top-right-radius" value="${esc(String(st["border-top-right-radius"] || "").replace(/px$/i, ""))}" placeholder="auto"></label>
        <label>Inf. izq. <input type="number" data-side="border-bottom-left-radius" value="${esc(String(st["border-bottom-left-radius"] || "").replace(/px$/i, ""))}" placeholder="auto"></label>
        <label>Inf. der. <input type="number" data-side="border-bottom-right-radius" value="${esc(String(st["border-bottom-right-radius"] || "").replace(/px$/i, ""))}" placeholder="auto"></label>
      </div>
      <p class="m-muted">Estilo</p>
      ${seg("border-style", st["border-style"] || "none", [
        { v: "none", l: "Ninguno" }, { v: "solid", l: "Sólido" }, { v: "dashed", l: "Guion" }, { v: "dotted", l: "Punto" },
      ])}
      ${rangeControl("Grosor", "border-width", st, 0, 20, "px")}
      ${window.KrgUi.colorField("Color borde", st["border-color"] || "", 'data-style="border-color"')}`;
  }

  function bodyShadow(st) {
    return seg("box-shadow", st["box-shadow"] || "", SHADOWS.map((s) => ({ v: s.v, l: s.l })));
  }

  function bodyFilters(node) {
    const f = node.filters || { hue: 0, sat: 100, brightness: 100, contrast: 100, invert: 0, sepia: 0 };
    return [["hue", "Tono", 0, 360, "deg"], ["sat", "Saturación", 0, 200, "%"], ["brightness", "Brillo", 0, 200, "%"], ["contrast", "Contraste", 0, 200, "%"], ["invert", "Invertir", 0, 100, "%"], ["sepia", "Sepia", 0, 100, "%"]].map(([k, lab, min, max, u]) => `
      <label class="m-pick-label">${lab}
        <div class="b-range">
          <input type="range" min="${min}" max="${max}" data-filter="${k}" value="${f[k] ?? min}">
          <input type="number" min="${min}" max="${max}" data-filter="${k}" value="${f[k] ?? min}">
          <span class="m-pick-unit">${u}</span>
        </div>
      </label>`).join("");
  }

  function bodyAnim(node) {
    return `<div class="b-anim">${ANIMS.map((a) => `<button type="button" class="${(node.animation || "none") === a.v ? "is-on" : ""}" data-anim="${a.v}">${a.l}</button>`).join("")}</div>
      <label>Duración (ms) <input type="number" data-node="animDuration" min="0" max="3000" value="${esc(node.animDuration ?? 600)}"></label>
      <label>Retardo (ms) <input type="number" data-node="animDelay" min="0" max="3000" value="${esc(node.animDelay ?? 0)}"></label>
      <label>Curva
        <select data-node="animEasing">
          ${["ease", "linear", "ease-in", "ease-out", "ease-in-out"].map((e) => `<option value="${e}" ${(node.animEasing || "ease") === e ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </label>`;
  }

  function bodyBg(st, node) {
    return `${window.KrgUi.colorField("Color de fondo", st["background-color"] || "", 'data-style="background-color"')}
      <div data-bg-note>${bgNoteHtml(node, st["background-color"] || "")}</div>`;
  }

  function bodyTypography(st) {
    return `<p class="m-muted">Alineación</p>
      ${seg("text-align", st["text-align"] || "", [
        { v: "left", l: "⟸", t: "Izquierda" },
        { v: "center", l: "≡", t: "Centro" },
        { v: "right", l: "⟹", t: "Derecha" },
        { v: "justify", l: "☰", t: "Justificado" },
      ])}
      ${window.KrgUi.fontFamilyField("Familia", st["font-family"] || "", 'data-style="font-family"')}
      <p class="m-muted">Peso</p>
      ${seg("font-weight", st["font-weight"] || "", [
        { v: "300", l: "Light" }, { v: "400", l: "Regular" }, { v: "600", l: "Semi" }, { v: "700", l: "Bold" },
      ])}
      <p class="m-muted">Estilo</p>
      ${seg("font-style", st["font-style"] || "", [{ v: "normal", l: "I", t: "Normal" }, { v: "italic", l: "<i>I</i>", t: "Cursiva" }])}
      <p class="m-muted">Mayúsculas</p>
      ${seg("text-transform", st["text-transform"] || "", [
        { v: "none", l: "aa" }, { v: "uppercase", l: "AA" }, { v: "capitalize", l: "Aa" },
      ])}
      <p class="m-muted">Decoración</p>
      ${seg("text-decoration", st["text-decoration"] || "", [
        { v: "none", l: "Ninguna" }, { v: "underline", l: "Subrayado" }, { v: "line-through", l: "Tachado" },
      ])}
      ${window.KrgUi.colorField("Color del texto", st.color || "", 'data-style="color"')}`;
  }

  function bodyTextSize(st) {
    return `${rangeControl("Tamaño de fuente", "font-size", st, 10, 96, "px")}
      ${rangeControl("Interlineado", "line-height", st, 80, 220, "%")}
      ${rangeControl("Espaciado de letras", "letter-spacing", st, -4, 20, "px")}`;
  }

  /** Select corto de props, el que usaban los grupos de sección. */
  function selProp(key, value, opts) {
    return `<select data-prop="${key}">${opts.map(([v, l]) =>
      `<option value="${v}" ${String(value) === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  }

  function bodySectionWidth(node) {
    const p = node.props || {};
    const width = (p.width === "bleed" ? "full" : p.width) || (p.fullWidth === false ? "boxed" : "full");
    return `<label>Hasta dónde llega el contenido
        ${selProp("width", width, [
          ["full", "Todo el ancho, de borde a borde"],
          ["padded", "Todo el ancho, con margen lateral"],
          ["boxed", "Centrado y limitado"],
        ])}
      </label>
      <p class="m-muted">De borde a borde no deja ningún margen: el contenido llega al filo de la pantalla. Es lo que necesitan los mapas, los vídeos y las fotos a pantalla completa.</p>`;
  }

  function bodySectionCurtain(node) {
    const p = node.props || {};
    return `<label>Revelado al hacer scroll
        ${selProp("curtain", p.curtain || "off", [
          ["on", "Cortina (la siguiente sección la tapa)"],
          ["off", "Sin cortina"],
        ])}
      </label>
      <p class="m-muted">Cortina: la sección se queda quieta y la siguiente se desliza por encima, tapándola. Es el mismo efecto del pie. Se desactiva sola si la sección no cabe en la pantalla, así que va mejor con alto Pantalla completa.</p>`;
  }

  function bodySectionHeight(node) {
    const p = node.props || {};
    const mh = p.minHeight || "auto";
    return `<label>Alto mínimo
        ${selProp("minHeight", mh, [
          ["auto", "El del contenido"],
          ["screen", "Pantalla completa"],
          ["screen-minus-header", "Pantalla menos la cabecera"],
          ["tall", "Alta (78 %)"],
          ["half", "Media (50 %)"],
          ["custom", "A medida…"],
        ])}
      </label>
      ${mh === "custom" ? `<div class="b-rowfields">
        <label>Valor <input type="number" data-prop="minHeightValue" min="1" max="4000" value="${esc(p.minHeightValue ?? 60)}"></label>
        <label>Unidad ${selProp("minHeightUnit", p.minHeightUnit || "vh", [
          ["vh", "% de la pantalla"],
          ["px", "Píxeles"],
        ])}</label>
      </div>
      <label>¿Quién manda en el alto?
        ${selProp("heightMode", p.heightMode || "exact", [
          ["exact", "La sección: el contenido se adapta"],
          ["min", "El contenido: el alto es sólo un mínimo"],
        ])}
      </label>
      <p class="m-muted">Si dentro tienes un panel partido o una portada a pantalla completa, ese módulo trae su propio alto. Con «La sección» se encoge para caber; con «El contenido» manda él y la sección crece. En móvil el alto siempre pasa a ser un mínimo, para no recortar texto.</p>
      ${fitWarning(node)}` : ""}
      ${mh !== "auto" ? `<label>Alineación vertical del contenido
        ${selProp("vAlign", p.vAlign || "start", [
          ["start", "Arriba"],
          ["center", "Centro"],
          ["end", "Abajo"],
          ["stretch", "Estirar: el contenido llena el alto"],
        ])}
      </label>
      <p class="m-muted">Dónde va el contenido cuando ocupa menos que el alto de la sección. Con «Estirar» no queda franja de fondo vacía: el bloque crece hasta llenarla y pinta su fondo en todo el alto.</p>
      ${(p.vAlign || "start") === "stretch" ? `<label>Contenido dentro del bloque estirado
        ${selProp("stretchAlign", p.stretchAlign || "center", [
          ["start", "Arriba"],
          ["center", "Centro"],
          ["end", "Abajo"],
        ])}
      </label>
      <p class="m-muted">El bloque ya ocupa todo el alto; esto decide dónde queda su contenido dentro de él.</p>` : ""}` : `<p class="m-muted">Con un alto fijo podrás centrar el contenido verticalmente.</p>`}`;
  }

  function bodySectionHeader(node) {
    const p = node.props || {};
    return `<label>Color del texto de la cabecera
        ${selProp("headerSkin", p.headerSkin || "auto", [
          ["auto", "Automático (según el fondo)"],
          ["dark", "Forzar texto oscuro"],
          ["light", "Forzar texto claro"],
          ["none", "No cambiar nada"],
        ])}
      </label>
      <p class="m-muted">Automático mira la luminosidad del fondo y elige el que se lee mejor. Requiere tener el color adaptativo activo en Chrome → Cabecera.</p>`;
  }

  /* ---------- Avanzado ---------- */

  function bodyCssId(node) {
    return `<label>Identificador CSS (id) <input data-node="htmlId" value="${esc(node.htmlId || node.props?.htmlId || "")}" placeholder="mi-bloque"></label>
      <label>Clase CSS <input data-node="htmlClass" value="${esc(node.htmlClass || "")}" placeholder="mi-clase otra-clase"></label>
      <p class="m-muted">Se añaden al elemento sin tocar las clases que pone el CMS.</p>`;
  }

  function bodyAttributes(node) {
    const pares = node.attrs && typeof node.attrs === "object" ? node.attrs : {};
    const texto = Object.keys(pares).map((k) => `${k}: ${pares[k]}`).join("\n");
    return `<label>Atributos del elemento
        <textarea data-attrs rows="4" placeholder="data-gtm: cta-principal&#10;aria-label: Reserva tu mesa">${esc(texto)}</textarea>
      </label>
      <p class="m-muted">Uno por línea, <code>clave: valor</code>. Se admiten <code>data-*</code>, <code>aria-*</code> y <code>title</code>, <code>role</code>, <code>lang</code>, <code>dir</code>, <code>tabindex</code>. El identificador, la clase y el estilo se ponen en sus propios campos.</p>`;
  }
  function bodyCustomCss(node) {
    const css = node.customCss || { before: "", main: "", after: "" };
    return `<label>Antes ( ::before ) <textarea data-css="before">${esc(css.before || "")}</textarea></label>
      <label>Elemento principal <textarea data-css="main">${esc(css.main || "")}</textarea></label>
      <label>Después ( ::after ) <textarea data-css="after">${esc(css.after || "")}</textarea></label>
      <p class="m-muted">Solo declaraciones (<code>color: red;</code>), sin llaves ni selectores: el CMS las encierra en el selector de este bloque.</p>`;
  }

  function bodyVisibility(node) {
    const hide = node.hiddenOn || {};
    return `<label><input type="checkbox" data-hide-bp="desktop" ${hide.desktop ? "checked" : ""}> Ocultar en escritorio</label>
      <label><input type="checkbox" data-hide-bp="tablet" ${hide.tablet ? "checked" : ""}> Ocultar en tablet</label>
      <label><input type="checkbox" data-hide-bp="mobile" ${hide.mobile ? "checked" : ""}> Ocultar en teléfono</label>
      <p class="m-muted">Oculto en los tres tamaños equivale a apagado: no se imprime en la web.</p>`;
  }

  function bodyPosition(st) {
    return `${seg("position", st.position || "", [
        { v: "static", l: "Normal" }, { v: "relative", l: "Relativa" }, { v: "absolute", l: "Absoluta" }, { v: "sticky", l: "Pegajosa" },
      ])}
      <div class="b-box-grid">
        <label>Arriba <input data-style="top" value="${esc(st.top || "")}" placeholder="auto"></label>
        <label>Derecha <input data-style="right" value="${esc(st.right || "")}" placeholder="auto"></label>
        <label>Abajo <input data-style="bottom" value="${esc(st.bottom || "")}" placeholder="auto"></label>
        <label>Izquierda <input data-style="left" value="${esc(st.left || "")}" placeholder="auto"></label>
      </div>
      <label>Orden de apilado (z-index) <input type="number" data-style="z-index" value="${esc(st["z-index"] || "")}" placeholder="auto"></label>
      <p class="m-muted">Con «Normal» el bloque va donde le toca. Las otras tres necesitan además algún valor de los cuatro lados.</p>`;
  }

  function bodyTransform(st) {
    return `<label>Transformación <input data-style="transform" value="${esc(st.transform || "")}" placeholder="rotate(-2deg) scale(1.05)"></label>
      <label>Origen <input data-style="transform-origin" value="${esc(st["transform-origin"] || "")}" placeholder="center"></label>
      <p class="m-muted">Admite las funciones de CSS: <code>rotate()</code>, <code>scale()</code>, <code>translate()</code>, <code>skew()</code>.</p>`;
  }

  function bodyTransitions(st) {
    return `${rangeControl("Duración", "transition-duration", { "transition-duration": (st["transition-duration"] || "300ms") }, 0, 2000, "ms", 50)}
      ${rangeControl("Retardo", "transition-delay", { "transition-delay": (st["transition-delay"] || "0ms") }, 0, 2000, "ms", 50)}
      <label>Curva
        <select data-style="transition-timing-function">
          ${["ease", "linear", "ease-in", "ease-out", "ease-in-out"].map((e) => `<option value="${e}" ${(st["transition-timing-function"] || "ease") === e ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </label>`;
  }

  function bodyDiag(node) {
    return `<p class="m-muted">Si pones un valor y no lo ves, esto recorre la cadena entera en esta instalación y dice en qué paso se pierde.</p>
      <button type="button" class="m-btn ghost" data-diag="${esc(node.id)}">Revisar este bloque</button>
      <textarea class="b-diag" readonly hidden></textarea>`;
  }

  /* ---------- Contenido por tipo de elemento ---------- */

  function bodySectionBasics(node) {
    const p = node.props || {};
    return `<label>Nombre interno <input data-prop="name" value="${esc(p.name || node.name || "")}"></label>
      <p class="m-muted">Solo se ve en el árbol y en este panel. El ancho, el alto y el fondo están en Diseño.</p>`;
  }

  function bodySectionRows(node) {
    const current = (node.children || []).find((c) => c.type === "row")?.props?.layout || "";
    return `<p class="m-muted">Agrupa los módulos en columnas. ‹ › en el árbol mueve un módulo a la columna vecina.</p>
      ${layoutGallery(current)}
      <button type="button" class="m-btn ghost" data-add-row>Añadir otra fila</button>`;
  }

  function bodyRowBasics(node) {
    const p = node.props || {};
    const current = p.layout || (node.children || []).map((c) => c.props?.span || 12).join("-");
    return `<p class="m-muted">Cada bloque es una columna (grupo de módulos).</p>
      ${layoutThumbs(current)}
      <label>Separación entre columnas (px) <input type="number" data-prop="gap" min="0" max="80" value="${esc(p.gap ?? 24)}"></label>`;
  }

  function bodyColumnBasics(node) {
    const p = node.props || {};
    return `<p class="m-muted">Selecciona esta columna y añade título, texto o imagen desde la paleta. Quedarán apilados aquí.</p>
      <label>Ancho desktop (1–12) <input type="number" data-prop="span" min="1" max="12" value="${esc(p.span ?? 12)}"></label>
      <label>Ancho tablet (1–12) <input type="number" data-prop="spanTablet" min="1" max="12" value="${esc(p.spanTablet ?? 12)}"></label>
      <label>Ancho móvil (1–12) <input type="number" data-prop="spanMobile" min="1" max="12" value="${esc(p.spanMobile ?? 12)}"></label>`;
  }

  function bodyImageContent(node) {
    const p = node.props || {};
    const thumb = p.imageUrl || "";
    return `<div class="b-thumb">
        ${thumb ? `<img src="${esc(thumb)}" alt="">` : `<span class="m-thumb-empty">${p.imageId ? "Imagen #" + p.imageId : "Sin imagen"}</span>`}
        <div class="b-thumb-actions">
          <button type="button" class="m-btn ghost" data-media="imageId">Cambiar</button>
          <button type="button" class="m-btn ghost" data-clear-img>Quitar</button>
        </div>
      </div>
      <label>Texto alternativo <input data-prop="alt" value="${esc(p.alt || "")}"></label>`;
  }

  function bodyImageLink(node) {
    const p = node.props || {};
    return `<label>Lightbox <input type="checkbox" data-prop="lightbox" ${p.lightbox ? "checked" : ""}></label>
      <label>URL del enlace <input data-prop="link" value="${esc(p.link || "")}" placeholder="https://"></label>
      <label>Destino
        <select data-prop="linkTarget">
          <option value="_self" ${p.linkTarget !== "_blank" ? "selected" : ""}>Misma ventana</option>
          <option value="_blank" ${p.linkTarget === "_blank" ? "selected" : ""}>Nueva ventana</option>
        </select>
      </label>`;
  }

  function bodyImageFill(node) {
    const p = node.props || {};
    const st = node.styles?.[state.bp] || {};
    return `<p class="m-muted">Propio deja la foto con su proporción. Columna la estira a la altura del resto de la fila.</p>
      ${seg("fillMode", p.fillMode || "natural", [
        { v: "natural", l: "Propio" },
        { v: "fill", l: "Columna" },
      ], "data-prop-set")}
      <p class="m-muted">Recorte dentro del marco (solo si Relleno = Columna)</p>
      ${seg("objectFit", p.objectFit || st["object-fit"] || "cover", [
        { v: "cover", l: "Cover" }, { v: "contain", l: "Contain" }, { v: "fill", l: "Fill" },
      ], "data-prop-set")}
      <p class="m-muted">Posición en el recorte</p>
      ${seg("object-position", st["object-position"] || "center", [
        { v: "left", l: "Izq" }, { v: "center", l: "Centro" }, { v: "right", l: "Der" }, { v: "top", l: "Arriba" }, { v: "bottom", l: "Abajo" },
      ])}
      <label>Centrar en móvil <input type="checkbox" data-prop="centerOnMobile" ${p.centerOnMobile ? "checked" : ""}></label>`;
  }

  function bodyImageRadius(node) {
    const p = node.props || {};
    return seg("radius", p.radius || "none", [
      { v: "none", l: "Ninguno" }, { v: "sm", l: "S" }, { v: "md", l: "M" }, { v: "lg", l: "L" }, { v: "full", l: "Círculo" },
    ], "data-prop-set");
  }

  function bodyImageScale(node) {
    const p = node.props || {};
    return `<p class="m-muted">100 % es el tamaño natural. Baja para que no ocupe todo el hueco.</p>
      ${propRange("Escala de la imagen", "scale", p.scale ?? 100, 10, 200, "%")}`;
  }

  function bodyParallax(node, texto) {
    const p = node.props || {};
    return `<label>Activar efecto <input type="checkbox" data-prop="parallax" ${p.parallax ? "checked" : ""}></label>
      ${p.parallax ? `
        <p class="m-muted">La ampliación deja margen para que al moverse no se vean bordes. Baja ambos valores para un efecto más sutil.</p>
        ${propRange("Ampliación de la imagen", "parallaxZoom", p.parallaxZoom ?? 8, 0, 40, "%")}
        ${propRange("Intensidad del movimiento", "parallaxAmount", p.parallaxAmount ?? 10, 0, 40, "%")}
        <label>Invertir dirección <input type="checkbox" data-prop="parallaxInvert" ${p.parallaxInvert ? "checked" : ""}></label>
      ` : `<p class="m-muted">${texto}</p>`}`;
  }

  function bodyGalleryItems(node) {
    const p = node.props || {};
    let items = Array.isArray(p.items) ? p.items : [];
    if (!items.length && p.ids) {
      items = String(p.ids).split(",").map((id) => ({ imageId: Number(id) || 0, imageUrl: "", alt: "" })).filter((it) => it.imageId);
    }
    return `<p class="m-muted">Añade una por una o varias a la vez.</p>
      ${items.map((it, i) => `<div class="b-gal-item">
        <div class="b-thumb">${it.imageUrl ? `<img src="${esc(it.imageUrl)}" alt="">` : `<span class="m-thumb-empty">${it.imageId ? "#" + it.imageId : "—"}</span>`}</div>
        <div class="b-gal-meta">
          <button type="button" class="m-btn ghost" data-gal-set="${i}">Cambiar</button>
          <button type="button" class="b-ico" data-gal-up="${i}" title="Subir">↑</button>
          <button type="button" class="b-ico" data-gal-down="${i}" title="Bajar">↓</button>
          <button type="button" class="b-ico" data-gal-del="${i}" title="Quitar">×</button>
          <label>Alt <input data-gal-alt="${i}" value="${esc(it.alt || "")}"></label>
        </div>
      </div>`).join("") || `<p class="m-muted">Todavía no hay fotos.</p>`}
      <div class="b-gal-actions">
        <button type="button" class="m-btn" data-gal-add>Añadir imagen</button>
        <button type="button" class="m-btn ghost" data-gal-add-many>Añadir varias</button>
      </div>`;
  }

  function bodyGalleryPresentation(node) {
    const p = node.props || {};
    return `${seg("layout", p.layout || "carousel", [
        { v: "carousel", l: "Carrusel" },
        { v: "grid", l: "Cuadrícula" },
      ], "data-prop-set")}
      <p class="m-muted">Ancho</p>
      <label>Escritorio: cubrir toda la pantalla <input type="checkbox" data-prop="fullWidth" ${p.fullWidth ? "checked" : ""}></label>
      <label>Tablet y móvil: adaptar tamaño <input type="checkbox" data-prop="adaptSmall" ${p.adaptSmall !== false ? "checked" : ""}></label>
      <p class="m-muted">En PC la foto llega de borde a borde. En tablet y móvil se mantiene el tamaño actual, más compacto. El parallax sigue activo.</p>
      ${propRange("Alto", "height", p.height ?? 420, 120, 900, "px", 10)}
      ${(p.layout === "grid") ? `
      <p class="m-muted">Recorte</p>
      ${seg("objectFit", p.objectFit || "cover", [
        { v: "cover", l: "Cubrir" },
        { v: "contain", l: "Contener" },
      ], "data-prop-set")}` : `<p class="m-muted">Las fotos se escalan solas para llenar el recuadro, aunque no tengan el mismo tamaño. No quedan franjas vacías en escritorio, tablet ni móvil.</p>`}`;
  }

  function bodyGalleryNav(node) {
    const p = node.props || {};
    return `<label>Flechas <input type="checkbox" data-prop="arrows" ${p.arrows !== false ? "checked" : ""}></label>
      <label>Teclado (← →) <input type="checkbox" data-prop="keyboard" ${p.keyboard !== false ? "checked" : ""}></label>
      <label>Reproducción automática <input type="checkbox" data-prop="autoplay" ${p.autoplay ? "checked" : ""}></label>
      ${p.autoplay ? propRange("Intervalo", "interval", p.interval ?? 5000, 1500, 12000, "ms", 500) : ""}`;
  }

  function bodyGalleryColumns(node) {
    const p = node.props || {};
    if (p.layout !== "grid") return "";
    return `<label>Desktop <input type="number" data-prop="desktop" min="1" max="6" value="${esc(p.desktop ?? 3)}"></label>
      <label>Tablet <input type="number" data-prop="tablet" min="1" max="4" value="${esc(p.tablet ?? 2)}"></label>
      <label>Móvil <input type="number" data-prop="mobile" min="1" max="2" value="${esc(p.mobile ?? 1)}"></label>`;
  }

  function bodyVideoSource(node) {
    const p = node.props || {};
    const src = p.source === "upload" ? "upload" : "link";
    return `${seg("source", src, [
        { v: "link", l: "Enlace" },
        { v: "upload", l: "Subir archivo" },
      ], "data-prop-set")}
      ${src === "upload" ? `
        <p class="m-muted">${p.videoUrl ? "Video de la biblioteca." : "Sube un MP4 o elige uno de la biblioteca."}</p>
        ${p.videoUrl ? `<p class="m-muted">${esc(p.videoUrl)}</p>` : ""}
        <button type="button" class="m-btn" data-video-media>Elegir o subir video</button>
        ${p.videoId ? `<button type="button" class="m-btn ghost" data-video-clear>Quitar</button>` : ""}
      ` : `
        <label>URL <input data-prop="url" value="${esc(p.url || "")}" placeholder="https://… mp4, YouTube o Vimeo"></label>
        <p class="m-muted">Para que el visitante no vea controles ni pueda descargar, usa un archivo subido (MP4). YouTube y Vimeo ocultan lo que permiten, pero no se puede bloquear del todo.</p>
      `}`;
  }

  function bodyVideoSize(node) {
    const p = node.props || {};
    return `${seg("sizeMode", p.sizeMode || "auto", [
        { v: "auto", l: "Del lugar" },
        { v: "full", l: "Pantalla" },
        { v: "fullWidth", l: "Ancho" },
        { v: "fullHeight", l: "Alto" },
        { v: "custom", l: "Medidas" },
      ], "data-prop-set")}
      ${p.sizeMode === "custom" ? propRange("Ancho", "width", p.width ?? 800, 120, 1600, "px", 10) : ""}
      ${p.sizeMode !== "full" ? propRange("Alto", "height", p.height ?? 420, 80, 1000, "px", 10) : ""}
      <p class="m-muted">Ajuste dentro del marco. Cubrir llena el recuadro sin bandas negras.</p>
      ${seg("fit", p.fit || "cover", [
        { v: "cover", l: "Cubrir" },
        { v: "contain", l: "Contener" },
      ], "data-prop-set")}`;
  }

  function bodyVideoPlayback(node) {
    const p = node.props || {};
    return `<p class="m-muted">El autoplay arranca en silencio (lo exigen los navegadores). El visitante puede activar sonido y el volumen con el control del video. Clic en el video para pausar. No hay descarga.</p>
      <label>Reproducción automática <input type="checkbox" data-prop="autoplay" ${p.autoplay !== false ? "checked" : ""}></label>
      <label>Repetir <input type="checkbox" data-prop="loop" ${p.loop !== false ? "checked" : ""}></label>
      ${propRange("Volumen inicial (tras activar sonido)", "volume", p.volume ?? 70, 0, 100, "%")}`;
  }

  function bodyEverest(node) {
    const p = node.props || {};
    const def = defOf("everest-form") || {};
    const field = (def.fields || []).find((f) => f.key === "formId") || {};
    const opts = def.everestForms || field.options || [];
    const forms = opts.filter((o) => String(typeof o === "object" ? (o.value ?? "") : o) !== "0");
    const val = String(Number(p.formId) || 0);
    const plugin = !!def.pluginActive;
    return `${plugin ? "" : `<p class="m-form-error">El plugin Everest Forms no está activo. Actívalo en WordPress → Plugins y recarga el constructor.</p>`}
      ${plugin && !forms.length ? `<p class="m-muted">No hay formularios. Créalos en WordPress → Everest Forms y recarga.</p>` : ""}
      ${plugin && forms.length ? `<label>Formulario <select data-prop="formId">
        ${opts.map((o) => {
          const v = typeof o === "object" ? String(o.value ?? "") : String(o);
          const l = typeof o === "object" ? (o.label || v) : o;
          return `<option value="${esc(v)}" ${val === v ? "selected" : ""}>${esc(l)}</option>`;
        }).join("")}
      </select></label>
      ${Number(val) > 0 ? `<p class="m-muted">Shortcode: [everest_form id="${esc(val)}"]</p>` : `<p class="m-muted">Elige el formulario que ya tenías en el plugin. Se muestra en esta página tal cual.</p>`}` : ""}`;
  }

  function bodyTextContent(node) {
    const p = node.props || {};
    if (node.type === "heading") {
      return `<label>Contenido <textarea data-prop="text">${esc(p.text || "")}</textarea></label>
        <label>Enlace <input data-prop="link" value="${esc(p.link || "")}" placeholder="https://"></label>`;
    }
    if (node.type === "paragraph") {
      return `<label>Contenido <textarea data-prop="text">${esc(p.text || "")}</textarea></label>`;
    }
    if (node.type === "rich-text") return richEditor(node, "html");
    if (node.type === "eyebrow") {
      return `<label>Contenido <input data-prop="text" value="${esc(p.text || "")}"></label>`;
    }
    if (node.type === "quote") {
      return `<label>Texto <textarea data-prop="text">${esc(p.text || "")}</textarea></label>
        <label>Autor <input data-prop="cite" value="${esc(p.cite || "")}"></label>`;
    }
    return "";
  }

  function bodyHeadingTag(node) {
    if (node.type !== "heading") return "";
    return `<p class="m-muted">Nivel del encabezado: manda en el peso semántico y en el estilo que hereda del sistema de diseño.</p>
      ${seg("tag", node.props?.tag || "h2", ["h1", "h2", "h3", "h4", "h5", "h6"].map((v) => ({ v, l: v.toUpperCase() })), "data-prop-set")}`;
  }

  function bodyGlobalNote(node) {
    if (node.source !== "global") return "";
    return `<p class="m-muted">Instancia de #${esc(node.globalId)}. Editar aquí es un cambio local. Editar el global afecta a todas las páginas.</p>
      <button type="button" class="m-btn ghost" data-unlink="${esc(node.id)}">Desvincular</button>`;
  }

  /** Campos del catálogo de un grupo concreto («content», «colors»…). */
  function bodyCatalogGroup(node, grupo) {
    const def = defOf(node.type) || { fields: [] };
    const campos = (def.fields || []).filter((f) => (f.group || "content") === grupo);
    if (!campos.length) return "";
    const aviso = grupo === "colors"
      ? `<p class="m-muted">El «Tema» es el atajo. Si eliges un color aquí, manda el color: deja el campo en blanco (o pulsa la ✕) para volver al tema.</p>`
      : "";
    return aviso + campos.map((f) => fieldHtml(node, f)).join("");
  }

  function bodyMenuModes(node) {
    if (node.type !== "menu") return "";
    const p = node.props || {};
    const row = (key, label, fallback) => {
      const cur = p[key] || fallback;
      return `<p class="m-muted">${label}</p>
        <div class="b-seg">
          <button type="button" class="${cur === "bar" ? "is-on" : ""}" data-prop-set="${key}" data-v="bar">Barra (escritorio)</button>
          <button type="button" class="${cur === "drawer" ? "is-on" : ""}" data-prop-set="${key}" data-v="drawer">Hamburguesa (móvil)</button>
        </div>`;
    };
    return `<p class="m-muted">En cada tamaño puedes mostrar la barra horizontal o el botón Menú.</p>
      ${row("navModeDesktop", "Escritorio", "bar")}
      ${row("navModeTablet", "Tablet", "bar")}
      ${row("navModeMobile", "Móvil", "drawer")}`;
  }

  /* ================================================================
     Registro de controles
     ================================================================ */

  const CORE = window.KrgBuilderCore;

  /** ¿Este bloque tiene texto que merezca controles de tipografía? */
  function tieneTexto(node) {
    if (TEXT_TYPES.includes(node.type)) return true;
    const def = defOf(node.type) || {};
    return (def.fields || []).some((f) => ["text", "textarea", "richtext"].includes(f.type))
      || LAYOUT_TYPES.includes(node.type);
  }

  (function registrarControles() {
    const R = (id, label, body, extra) => CORE.registerControl(id, Object.assign({ label: label, body: body }, extra || {}));
    const conBp = (label) => (ctx) => `${label} (${ctx.bp})`;

    // Contenido
    R("sectionBasics", "Sección", (c) => bodySectionBasics(c.node));
    R("sectionRows", "Disposición", (c) => bodySectionRows(c.node));
    R("rowBasics", "Fila", (c) => bodyRowBasics(c.node));
    R("columnBasics", "Columna · grupo de módulos", (c) => bodyColumnBasics(c.node));
    R("imageContent", "Imagen", (c) => bodyImageContent(c.node));
    R("imageLink", "Enlace", (c) => bodyImageLink(c.node));
    R("galleryItems", "Imágenes", (c) => bodyGalleryItems(c.node));
    R("videoSource", "Origen del vídeo", (c) => bodyVideoSource(c.node));
    R("everestForm", "Formulario de Everest Forms", (c) => bodyEverest(c.node));
    R("textContent", "Contenido", (c) => bodyTextContent(c.node));
    R("globalNote", "Componente global", (c) => bodyGlobalNote(c.node));
    R("moduleContent", "Contenido", (c) => bodyCatalogGroup(c.node, "content"));

    // Diseño
    R("align", "Alinear", (c) => bodyAlign(c.node));
    R("sectionWidth", "Ancho del contenido", (c) => bodySectionWidth(c.node));
    R("sectionHeight", "Alto de la sección", (c) => bodySectionHeight(c.node));
    R("sectionCurtain", "Animación de entrada", (c) => bodySectionCurtain(c.node));
    R("sectionHeader", "Cabecera sobre esta sección", (c) => bodySectionHeader(c.node));
    R("menuModes", "Tipo de menú", (c) => bodyMenuModes(c.node));
    R("catLayout", "Disposición", (c) => bodyCatalogGroup(c.node, "layout"));
    R("catDesign", "Opciones del bloque", (c) => bodyCatalogGroup(c.node, "design"));
    R("catColors", "Colores", (c) => bodyCatalogGroup(c.node, "colors"));
    R("catSpacing", "Espaciado del bloque", (c) => bodyCatalogGroup(c.node, "spacing"));
    R("catTypography", "Tipografía del bloque", (c) => bodyCatalogGroup(c.node, "typography"));
    R("catResponsive", "Responsive", (c) => bodyCatalogGroup(c.node, "responsive"));
    R("headingTag", "Encabezado", (c) => bodyHeadingTag(c.node));
    R("typography", "Texto", (c) => bodyTypography(c.st), { when: (c) => tieneTexto(c.node) });
    R("textSize", conBp("Tamaño del texto"), (c) => bodyTextSize(c.st), { when: (c) => tieneTexto(c.node) });
    R("imgFill", "Relleno y recorte", (c) => bodyImageFill(c.node));
    R("imgRadius", "Radio", (c) => bodyImageRadius(c.node));
    R("imgScale", "Escala", (c) => bodyImageScale(c.node));
    R("imgParallax", "Parallax", (c) => bodyParallax(c.node, "Actívalo para mover la imagen al hacer scroll."));
    R("galPresentation", "Presentación", (c) => bodyGalleryPresentation(c.node));
    R("galNav", "Navegación", (c) => bodyGalleryNav(c.node));
    R("galColumns", "Columnas (cuadrícula)", (c) => bodyGalleryColumns(c.node));
    R("galParallax", "Parallax", (c) => bodyParallax(c.node, "Actívalo para mover las fotos al hacer scroll."));
    R("vidSize", "Tamaño del vídeo", (c) => bodyVideoSize(c.node));
    R("vidPlayback", "Reproducción", (c) => bodyVideoPlayback(c.node));
    R("size", conBp("Tamaño"), (c) => bodySize(c.st));
    R("spacing", conBp("Separación"), (c) => bodySpacing(c.st));
    R("background", "Fondo", (c) => bodyBg(c.st, c.node));
    R("border", "Borde", (c) => bodyBorder(c.st));
    R("shadow", "Sombra", (c) => bodyShadow(c.st));
    R("filters", "Filtros", (c) => bodyFilters(c.node));
    R("animation", "Animación", (c) => bodyAnim(c.node));

    // Avanzado
    R("cssId", "ID y clase CSS", (c) => bodyCssId(c.node));
    R("visibility", "Visibilidad responsive", (c) => bodyVisibility(c.node));
    R("position", conBp("Posición"), (c) => bodyPosition(c.st));
    R("transform", conBp("Transformación"), (c) => bodyTransform(c.st));
    R("transitions", conBp("Transiciones"), (c) => bodyTransitions(c.st));
    R("customCss", "CSS personalizado", (c) => bodyCustomCss(c.node));
    R("attributes", "Atributos", (c) => bodyAttributes(c.node));
    R("diag", "Diagnóstico de estilos", (c) => bodyDiag(c.node));
  })();

  /* ================================================================
     Esquema: qué ve cada clase de elemento
     ----------------------------------------------------------------
     Añadir un grupo a un tipo es escribir su nombre en una lista. Un
     bloque del catálogo puede además traer su propia lista en
     `def.inspector`, y entonces manda la suya.
     ================================================================ */

  const AVANZADO = ["cssId", "visibility", "position", "transform", "transitions", "attributes", "customCss", "diag"];
  const CAJA = ["background", "spacing", "size", "border", "shadow", "animation"];

  (function registrarEsquemas() {
    CORE.setSchema("section", {
      content: ["sectionBasics", "sectionRows"],
      design: ["sectionWidth", "sectionHeight", "sectionCurtain", "sectionHeader", "align"].concat(CAJA),
      advanced: AVANZADO,
    });
    CORE.setSchema("row", {
      content: ["rowBasics"],
      design: ["align"].concat(CAJA),
      advanced: AVANZADO,
    });
    CORE.setSchema("column", {
      content: ["columnBasics"],
      design: ["align"].concat(CAJA),
      advanced: AVANZADO,
    });
    CORE.setSchema("image", {
      content: ["imageContent", "imageLink"],
      design: ["align", "imgFill", "imgRadius", "imgScale", "imgParallax"].concat(CAJA).concat(["filters"]),
      advanced: AVANZADO,
    });
    CORE.setSchema("gallery", {
      content: ["galleryItems"],
      design: ["align", "galPresentation", "galNav", "galColumns", "galParallax"].concat(CAJA).concat(["filters"]),
      advanced: AVANZADO,
    });
    CORE.setSchema("video", {
      content: ["videoSource"],
      design: ["align", "vidSize", "vidPlayback"].concat(CAJA),
      advanced: AVANZADO,
    });
    CORE.setSchema("everest-form", {
      content: ["everestForm"],
      design: ["align"].concat(CAJA),
      advanced: AVANZADO,
    });
    CORE.setSchema("text", {
      content: ["textContent"],
      design: ["align", "headingTag", "typography", "textSize"].concat(CAJA).concat(["filters"]),
      advanced: AVANZADO,
    });
    CORE.setSchema("module", {
      content: ["globalNote", "moduleContent"],
      design: ["align", "menuModes", "catLayout", "catDesign", "catColors", "catSpacing", "catTypography", "catResponsive", "typography", "textSize"].concat(CAJA).concat(["filters"]),
      advanced: AVANZADO,
    });
  })();

  /** La clase de elemento, que es lo que decide el esquema. */
  function kindOf(node) {
    if (node.type === "section" || node.type === "row" || node.type === "column") return node.type;
    if (TEXT_TYPES.includes(node.type)) return "text";
    if (["image", "gallery", "video", "everest-form"].includes(node.type)) return node.type;
    return "module";
  }

  const KIND_LABEL = {
    section: "Sección",
    row: "Fila",
    column: "Columna",
    text: "Módulo de texto",
    image: "Módulo",
    gallery: "Módulo",
    video: "Módulo",
    "everest-form": "Módulo",
    module: "Módulo",
  };
  function propRange(label, key, value, min, max, unit, step) {
    const n = Number(value);
    const val = Number.isFinite(n) ? n : min;
    return `<label class="m-pick-label">${label}
      <div class="b-range">
        <input type="range" min="${min}" max="${max}" step="${step || 1}" data-prop="${key}" value="${val}">
        <input type="number" min="${min}" max="${max}" step="${step || 1}" data-prop="${key}" value="${val}">
        <span class="m-pick-unit">${unit}</span>
      </div>
    </label>`;
  }
  function rangeControl(label, prop, st, min, max, unit, step) {
    const raw = String(st[prop] || "");
    const n = parseFloat(raw);
    const val = Number.isFinite(n) ? n : "";
    return `<label class="m-pick-label">${label}
      <div class="b-range">
        <input type="range" min="${min}" max="${max}" step="${step || 1}" data-range="${prop}" data-unit="${unit}" value="${val === "" ? min : val}">
        <input type="number" min="${min}" max="${max}" step="${step || 1}" data-style-num="${prop}" data-unit="${unit}" value="${val}">
        <span class="m-pick-unit">${unit}</span>
      </div>
    </label>`;
  }

  const TEXT_TYPES = ["heading", "paragraph", "rich-text", "eyebrow", "quote"];
  const LAYOUT_TYPES = ["section", "row", "column"];
  const SIMPLE_LAYOUTS = [
    { id: "12", spans: [12], label: "1" },
    { id: "6-6", spans: [6, 6], label: "1/2 · 1/2" },
    { id: "4-4-4", spans: [4, 4, 4], label: "1/3 · 1/3 · 1/3" },
    { id: "3-3-3-3", spans: [3, 3, 3, 3], label: "1/4 · 1/4 · 1/4 · 1/4" },
    { id: "8-4", spans: [8, 4], label: "2/3 · 1/3" },
    { id: "4-8", spans: [4, 8], label: "1/3 · 2/3" },
    { id: "9-3", spans: [9, 3], label: "3/4 · 1/4" },
    { id: "3-9", spans: [3, 9], label: "1/4 · 3/4" },
    { id: "6-3-3", spans: [6, 3, 3], label: "1/2 · 1/4 · 1/4" },
    { id: "3-3-6", spans: [3, 3, 6], label: "1/4 · 1/4 · 1/2" },
    { id: "3-6-3", spans: [3, 6, 3], label: "1/4 · 1/2 · 1/4" },
  ];
  const NESTED_LAYOUTS = [
    { id: "n-stack-media", label: "Pila + destacado", schema: [{ span: 6, inner: [[12], [6, 6]] }, { span: 6, feat: true }] },
    { id: "n-media-stack", label: "Destacado + pila", schema: [{ span: 6, feat: true }, { span: 6, inner: [[12], [6, 6]] }] },
    { id: "n-rail-left", label: "Barra izq. + filas", schema: [{ span: 3, feat: true }, { span: 9, inner: [[12], [6, 6], [4, 4, 4]] }] },
    { id: "n-rail-right", label: "Filas + barra der.", schema: [{ span: 9, inner: [[12], [6, 6], [4, 4, 4]] }, { span: 3, feat: true }] },
    { id: "n-rails", label: "Barras laterales", schema: [{ span: 3, feat: true }, { span: 6, inner: [[12], [6, 6]] }, { span: 3, feat: true }] },
    { id: "n-stack-twin", label: "Pila + dos destacados", schema: [{ span: 6, inner: [[12], [6, 6]] }, { span: 3, feat: true }, { span: 3, feat: true }] },
    { id: "n-twin-stack", label: "Dos destacados + pila", schema: [{ span: 3, feat: true }, { span: 3, feat: true }, { span: 6, inner: [[12], [6, 6]] }] },
    { id: "n-media-rows", label: "Destacado 1/3 + filas", schema: [{ span: 4, feat: true }, { span: 8, inner: [[12], [6, 6]] }] },
    { id: "n-rows-media", label: "Filas + destacado 1/3", schema: [{ span: 8, inner: [[12], [6, 6]] }, { span: 4, feat: true }] },
    { id: "n-two-media", label: "Dos filas + destacado", schema: [{ span: 6, inner: [[12], [12]] }, { span: 6, feat: true }] },
    { id: "n-media-two", label: "Destacado + dos filas", schema: [{ span: 6, feat: true }, { span: 6, inner: [[12], [12]] }] },
    { id: "n-rails-two", label: "Barras + dos filas", schema: [{ span: 3, feat: true }, { span: 6, inner: [[12], [12]] }, { span: 3, feat: true }] },
    { id: "n-two-twin", label: "Dos filas + dos destacados", schema: [{ span: 6, inner: [[12], [12]] }, { span: 3, feat: true }, { span: 3, feat: true }] },
    { id: "n-twin-two", label: "Dos destacados + dos filas", schema: [{ span: 3, feat: true }, { span: 3, feat: true }, { span: 6, inner: [[12], [12]] }] },
    { id: "n-media-two-wide", label: "Destacado 1/3 + dos filas", schema: [{ span: 4, feat: true }, { span: 8, inner: [[12], [12]] }] },
    { id: "n-two-media-wide", label: "Dos filas + destacado 1/3", schema: [{ span: 8, inner: [[12], [12]] }, { span: 4, feat: true }] },
  ];
  const ALL_LAYOUTS = SIMPLE_LAYOUTS.concat(NESTED_LAYOUTS);

  function extractMapsUrl(s) {
    s = String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const src = s.match(/src\s*=\s*['"]([^'"]+)['"]/i);
    if (src) return src[1].trim();
    const short = s.match(/https:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9_-]+/);
    if (short) return short[0];
    const g = s.match(/https:\/\/(?:www\.)?(?:maps\.)?google\.[^\s"'<>]+/i);
    if (g) return g[0];
    return s.trim();
  }
  function fracLabel(span) {
    const map = { 12: "1", 9: "3/4", 8: "2/3", 6: "1/2", 4: "1/3", 3: "1/4" };
    return map[span] || `${span}/12`;
  }
  function tabletSpan(span) {
    if (span >= 8) return 12;
    if (span <= 3) return 6;
    return span;
  }
  function makeColumn(span) {
    span = Math.max(1, Math.min(12, Number(span) || 12));
    const col = makeNode("column");
    col.props.span = span;
    col.props.spanTablet = tabletSpan(span);
    col.props.spanMobile = 12;
    col.name = "Columna " + fracLabel(span);
    return col;
  }
  function makeRow(spans) {
    spans = (spans || [12]).map((s) => Math.max(1, Math.min(12, Number(s) || 12)));
    const row = makeNode("row");
    row.props.layout = spans.join("-");
    row.props.gap = 24;
    row.name = "Fila " + spans.map(fracLabel).join(" · ");
    row.children = spans.map((s) => makeColumn(s));
    return row;
  }
  function buildFromSchema(schema) {
    const row = makeRow(schema.map((c) => c.span));
    schema.forEach((c, i) => {
      const col = row.children[i];
      if (!col) return;
      if (c.feat) col.name = "Destacado " + fracLabel(c.span);
      if (c.inner && c.inner.length) {
        col.children = c.inner.map((spans) => makeRow(spans));
      }
    });
    return row;
  }
  function findLayout(id) {
    return ALL_LAYOUTS.find((l) => l.id === id) || SIMPLE_LAYOUTS[0];
  }
  function instantiateLayout(layout) {
    if (!layout) return makeRow([12]);
    if (Array.isArray(layout)) return makeRow(layout);
    if (layout.schema) return buildFromSchema(layout.schema);
    return makeRow(layout.spans || [12]);
  }
  function firstLeafColumn(node) {
    if (!node) return null;
    if (node.type === "column") {
      const inner = (node.children || []).find((c) => c.type === "row");
      if (inner && inner.children && inner.children[0]) return firstLeafColumn(inner.children[0]);
      return node;
    }
    if (node.type === "row" && node.children && node.children[0]) return firstLeafColumn(node.children[0]);
    if (node.type === "section" && node.children && node.children[0]) return firstLeafColumn(node.children[0]);
    return node;
  }
  function flattenModules(nodes, out = []) {
    (nodes || []).forEach((n) => {
      if (n.type === "row" || n.type === "column") flattenModules(n.children, out);
      else out.push(n);
    });
    return out;
  }
  function layoutPreview(l) {
    if (l.schema) {
      return `<span class="b-lay-nest">${l.schema.map((col) => `
        <span class="b-lay-col" style="flex:${col.span} 1 0">
          ${(col.inner && col.inner.length ? col.inner : [[12]]).map((spans) => `
            <span class="b-lay-track">${spans.map((s) => `<i class="${col.feat ? "is-feat" : ""}" style="flex:${s} 1 0"></i>`).join("")}</span>
          `).join("")}
        </span>`).join("")}</span>`;
    }
    const spans = l.spans || [12];
    return `<span class="b-lay-track">${spans.map((s) => `<i style="flex:${s} 1 0"></i>`).join("")}</span>`;
  }
  function layoutThumbs(current, list) {
    const cur = Array.isArray(current) ? current.join("-") : String(current || "");
    const items = list || SIMPLE_LAYOUTS;
    return `<div class="b-lay-grid">${items.map((l) => `
      <button type="button" class="b-lay ${cur === l.id ? "is-on" : ""}" data-layout="${l.id}" title="${esc(l.label || l.id)}">
        ${layoutPreview(l)}
        <small>${esc(l.label || l.id)}</small>
      </button>`).join("")}</div>`;
  }
  function layoutGallery(current) {
    return `<p class="m-muted">Columnas</p>
      ${layoutThumbs(current, SIMPLE_LAYOUTS)}
      <p class="m-muted">Filas y columnas</p>
      ${layoutThumbs(current, NESTED_LAYOUTS)}`;
  }
  function applyToRow(row, spans) {
    const old = (row.children || []).filter((c) => c.type === "column");
    const cols = spans.map((s, i) => {
      const col = old[i] || makeColumn(s);
      col.props.span = s;
      col.props.spanTablet = tabletSpan(s);
      col.props.spanMobile = 12;
      col.name = "Columna " + fracLabel(s);
      col.children = col.children || [];
      return col;
    });
    if (old.length > spans.length) {
      old.slice(spans.length).forEach((c) => {
        cols[cols.length - 1].children.push(...(c.children || []));
      });
    }
    row.children = cols;
    row.props.layout = spans.join("-");
    row.name = "Fila " + spans.map(fracLabel).join(" · ");
  }
  function applyLayout(node, layout) {
    if (!node) return;
    if (typeof layout === "string") layout = findLayout(layout);
    if (Array.isArray(layout)) layout = { id: layout.join("-"), spans: layout };
    if (!layout) return;
    snapshot();
    const modules = flattenModules(node.type === "section" ? node.children : node.type === "row" ? node.children : []);
    const built = instantiateLayout(layout);
    const leaf = firstLeafColumn(built);
    if (leaf && modules.length) leaf.children = (leaf.children || []).concat(modules);
    if (node.type === "row") {
      node.props = built.props;
      node.name = built.name;
      node.children = built.children;
      return;
    }
    if (node.type === "section") {
      node.children = [built];
    }
  }
  function openLayoutPicker(onPick) {
    document.querySelectorAll(".b-lay-modal").forEach((el) => el.remove());
    const wrap = document.createElement("div");
    wrap.className = "confirm b-lay-modal";
    wrap.innerHTML = `<div class="box b-lay-box">
      <h3>Disposición de la sección</h3>
      <p class="m-muted">Elige columnas, o una combinación de filas dentro de columnas. Cada recuadro es un grupo de módulos.</p>
      ${layoutGallery("")}
      <div class="m-row"><button type="button" class="m-btn ghost" id="lay-cancel">Cancelar</button></div>
    </div>`;
    const pick = (id) => {
      const layout = findLayout(id);
      wrap.remove();
      try {
        onPick(layout);
      } catch (err) {
        toast(err.message || "No se pudo crear la sección");
      }
    };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) {
        wrap.remove();
        return;
      }
      const b = e.target.closest("[data-layout]");
      if (b && wrap.contains(b)) {
        e.preventDefault();
        e.stopPropagation();
        pick(b.getAttribute("data-layout"));
      }
    });
    wrap.querySelector("#lay-cancel").onclick = (e) => {
      e.preventDefault();
      wrap.remove();
    };
    document.body.appendChild(wrap);
  }

  const SHADOWS = [
    { v: "", l: "Ninguna" },
    { v: "0 1px 3px rgba(0,0,0,0.12)", l: "Sutil" },
    { v: "0 4px 12px rgba(0,0,0,0.16)", l: "Media" },
    { v: "0 10px 24px rgba(0,0,0,0.2)", l: "Fuerte" },
    { v: "0 18px 40px rgba(0,0,0,0.28)", l: "Profunda" },
  ];
  const ANIMS = [
    { v: "none", l: "Ninguna" },
    { v: "rise", l: "Aparecer al scroll" },
    { v: "stagger", l: "Escalonada" },
    { v: "fade", l: "Desvanecer" },
    { v: "slide", l: "Diapositiva" },
    { v: "zoom", l: "Zoom" },
    { v: "bounce", l: "Bounce" },
    { v: "flip", l: "Girar" },
  ];

  // Opciones propias de la sección: alto, cortina y color de la cabecera.
  // Hasta ahora existían en el renderizador pero no había dónde tocarlas.

  /** Id tal cual se usa en las clases del marcado. */
  function idClase(id) {
    return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Bloques de dentro que estan tapando el fondo de esta seccion.
   *
   * Dos intentos anteriores fallaban por el mismo sitio: suponer. El
   * primero preguntaba al catalogo —si el modulo tiene campo de tema, se
   * daba por hecho que tapa—, y avisaba de problemas que no existian. El
   * segundo comparaba cajas: el bloque tenia que ser tan grande como la
   * seccion entera, asi que con que la seccion tuviera un poco de relleno
   * ya no contaba como tapado, aunque en pantalla no se viera ni un pixel
   * del color. Los dos median algo parecido a lo que importa, pero no lo
   * que importa.
   *
   * Lo que importa es el pixel: en el centro de la seccion, que color se
   * ve. Eso se pregunta igual que lo haria un ojo —`elementFromPoint` y
   * hacia arriba hasta el primer fondo opaco— y si quien lo pinta no es la
   * seccion, ese es el que tapa.
   */
  function blockingBg(node) {
    const doc = root.querySelector("iframe")?.contentDocument;
    const win = doc?.defaultView;
    const sec = doc ? doc.querySelector(`.m-n-${idClase(node?.id)}`) : null;
    if (!sec || !win) return declaredBg(node);
    const caja = sec.getBoundingClientRect();
    const x = Math.min(Math.max(caja.left + caja.width / 2, 1), win.innerWidth - 1);
    const y = Math.min(Math.max(caja.top + caja.height / 2, 1), win.innerHeight - 1);
    if (y < 0 || y > win.innerHeight) return declaredBg(node);
    let el = doc.elementFromPoint(x, y);
    let pinta = null;
    while (el) {
      const bg = win.getComputedStyle(el).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") { pinta = { el, bg }; break; }
      el = el.parentElement;
    }
    if (!pinta || pinta.el === sec || !sec.contains(pinta.el)) return [];
    // Del elemento que pinta al nodo del documento: puede ser un envoltorio
    // de dentro del modulo, asi que se sube hasta encontrar un id conocido.
    let cur = pinta.el;
    while (cur && cur !== sec) {
      const cls = [...cur.classList].find((c) => c.startsWith("m-n-"));
      const hit = cls ? findNode(node.children || [], cls.slice(4)) : null;
      if (hit) {
        const def = defOf(hit.node.type);
        return [{ id: hit.node.id, name: hit.node.name || def?.name || hit.node.type, color: pinta.bg }];
      }
      cur = cur.parentElement;
    }
    return [];
  }

  /**
   * Sin lienzo que mirar, lo unico honesto es lo que diga el documento.
   *
   * `bgColor` no siempre es una cadena: el selector de color guarda
   * `{mode,token,value}`. Pasarlo tal cual acababa escribiendo
   * «[object Object]» en el aviso, asi que se traduce a CSS como hace el
   * resto del constructor.
   */
  function declaredBg(node) {
    const out = [];
    const walk = (n) => {
      (n.children || []).forEach((c) => {
        const color = cssColor(c.props?.bgColor);
        if (color) {
          out.push({ id: c.id, name: c.name || defOf(c.type)?.name || c.type, color });
        }
        walk(c);
      });
    };
    walk(node || {});
    return out;
  }


  /**
   * El aviso de «este color lo tapa un bloque».
   *
   * El fondo de una seccion se ve por donde el contenido no llega. Si
   * dentro hay un bloque que pinta el suyo encima, el campo parece roto:
   * pones un color y la pantalla no cambia. Eso hay que contarlo, pero
   * solo cuando pasa de verdad y cuando hay algo que hacer al respecto.
   *
   * Antes salia siempre, incluso sin color elegido, asi que se podia
   * pulsar «Pintar tambien el bloque» sin tener color que copiar; el boton
   * contestaba con una barra roja arriba, identica a un error de guardado,
   * y ademas se quedaba pegada hasta el siguiente guardado. Se ofrecia un
   * atajo que no podia funcionar y se avisaba del fallo en el sitio
   * equivocado.
   */
  function bgNoteHtml(node, background) {
    const color = (background || "").trim();
    const tapan = color && node ? blockingBg(node) : [];
    if (!tapan.length) return "";
    const t = tapan[0];
    if (mismoColor(t.color, color)) {
      return `<p class="m-muted"><strong>${esc(t.name)}</strong> ocupa toda la sección y ya usa este mismo color.</p>`;
    }
    return `<p class="m-muted"><strong>${esc(t.name)}</strong> está pintado de
        <code>${esc(hexDe(t.color))}</code> por encima y ocupa toda la sección, así que tapa
        este color: sólo asomará por el relleno o el margen que dejes.</p>
      <div class="b-row">
        <button type="button" class="m-btn" data-paint-child="${esc(t.id)}">Pintar ${esc(t.name)} de ${esc(color)}</button>
        <button type="button" class="m-btn ghost" data-sel="${esc(t.id)}">Ir a ${esc(t.name)}</button>
      </div>`;
  }

  /**
   * Repinta solo el aviso del fondo.
   *
   * Tentacion evidente: redibujar el inspector entero al cambiar el color.
   * No se puede. El `change` de un campo salta cuando el foco se va al
   * siguiente, asi que redibujar ahi arranca de debajo del cursor el campo
   * al que la persona acaba de saltar, y lo que escriba se pierde. Esto
   * cambia un trozo que nadie esta tocando, y deja los campos en paz.
   */
  function repaintBgNote() {
    const caja = root.querySelector(".b-insp [data-bg-note]");
    const h = state.selected ? findNode(state.doc.sections, state.selected) : null;
    if (!caja || !h) return;
    const nuevo = bgNoteHtml(h.node, h.node.styles?.[state.bp]?.["background-color"] || "");
    // Si no ha cambiado, no se toca el DOM. No es por ahorrar: al pulsar
    // «Pintar el bloque» el campo de color pierde el foco, eso dispara su
    // `change`, y repintar ahi borraba el boton justo entre el mousedown y
    // el click. El boton existia, estaba enlazado, y aun asi no hacia
    // nada. Reescribir solo cuando hay algo distinto que escribir.
    if (caja._html === nuevo) return;
    caja._html = nuevo;
    caja.innerHTML = nuevo;
    bindBgNote(caja);
  }

  /** Los dos botones del aviso, que nacen y mueren con el. */
  function bindBgNote(caja) {
    caja.querySelectorAll("[data-sel]").forEach((b) => {
      b.onclick = () => { state.selected = b.dataset.sel; render(); pingFrame(); };
    });
    caja.querySelectorAll("[data-paint-child]").forEach((b) => {
      b.onclick = () => {
        const h = state.selected ? findNode(state.doc.sections, state.selected) : null;
        const hijo = findNode(state.doc.sections, b.dataset.paintChild);
        const color = h?.node?.styles?.[state.bp]?.["background-color"] || "";
        if (!h || !hijo || !color) return;
        snapshot();
        hijo.node.props = window.KrgBuilderCore.dict(hijo.node, "props");
        hijo.node.props.bgColor = color;
        if (hijo.node.type === "review-slider") hijo.node.props.cardColor = color;
        state.selected = hijo.node.id;
        markDirty();
        render();
      };
    });
  }

  /**
   * Recorre la cadena de un estilo y cuenta donde se rompe.
   *
   * Un ajuste que no se ve puede fallar en seis sitios distintos y desde
   * fuera todos se parecen: el panel ensena el valor y la pagina no cambia.
   * Esto mira, para el bloque seleccionado y en esta misma instalacion, que
   * hay en el estado, que dijo el ultimo guardado, si el elemento existe en
   * el lienzo, que lleva su atributo `style`, que devuelve getComputedStyle
   * y —cuando no coinciden— que regla de que hoja esta ganando. Es lo unico
   * que contesta «donde se pierde» sin tener delante la instalacion.
   */
  function diagnosticar(node) {
    const id = idClase(node.id);
    const st = node.styles?.[state.bp] || {};
    const L = [];
    L.push(`Bloque: ${node.name || node.type} (${node.type})`);
    L.push(`Id: ${id}   ·   Tamaño: ${state.bp}`);
    L.push(`1. Estado del editor: ${JSON.stringify(st)}`);
    L.push(`2. Último guardado: ${state.save}${state.styleWarn ? " — " + state.styleWarn : " — sin descartes del servidor"}`);

    const iframe = root.querySelector("iframe");
    const doc = iframe?.contentDocument;
    if (!doc) {
      L.push("3. Lienzo: no se puede leer (¿aún cargando, o servido desde otro dominio?)");
      return L.join("\n");
    }
    const els = [...doc.querySelectorAll(`.m-n-${id}`)];
    L.push(`3. Elementos con .m-n-${id} en el lienzo: ${els.length}`);
    if (!els.length) {
      L.push("   El bloque no está pintado: una sección vacía no se imprime, y lo oculto tampoco.");
      return L.join("\n");
    }
    const el = els[0];
    L.push(`4. Etiqueta: <${el.tagName.toLowerCase()} class="${el.className}">`);
    L.push(`5. Atributo style: ${el.getAttribute("style") || "(vacío)"}`);

    const cs = doc.defaultView.getComputedStyle(el);
    const props = Object.keys(st).filter((p) => st[p] !== "" && st[p] != null);
    if (!props.length) {
      L.push("6. No hay ningún estilo puesto en este tamaño: no hay nada que comprobar.");
      return L.join("\n");
    }
    props.forEach((prop) => {
      // `background` calculado devuelve el atajo entero («rgb(…) none repeat
      // scroll 0% 0% / auto padding-box border-box»), que nunca va a coincidir
      // con lo que escribió el usuario. Se mide y se busca por la propiedad
      // larga que de verdad lleva el valor.
      const medir = LARGAS[prop] || prop;
      const quiero = String(st[prop]);
      const hay = cs.getPropertyValue(medir).trim();
      const mismo = normColor(hay) === normColor(quiero);
      const nombre = medir === prop ? prop : `${prop} (${medir})`;
      L.push(`6. ${nombre}: pedido ${quiero} · calculado ${hay} ${mismo ? "✔" : "✖"}`);
      if (mismo) {
        // Fondo, relleno y margen ya no se escriben en el atributo style:
        // viven en la hoja del documento. Decir que regla los pinta evita
        // tener que buscarla a mano cuando algo cambie en el tema.
        const manda = reglasQueTocan(doc, el, medir);
        if (manda.length) L.push(`   Lo pinta: ${manda[manda.length - 1]}`);
      }
      if (!mismo) {
        const manda = reglasQueTocan(doc, el, medir);
        L.push(manda.length
          ? `   Reglas que declaran ${medir} sobre este elemento:\n     ${manda.join("\n     ")}`
          : `   Ninguna regla CSS declara ${medir} sobre este elemento: el valor no llegó al navegador.`);
      }
    });

    const caja = el.getBoundingClientRect();
    const tapan = [...el.querySelectorAll("*")].filter((h) => {
      const f = doc.defaultView.getComputedStyle(h).backgroundColor;
      if (!f || f === "rgba(0, 0, 0, 0)" || f === "transparent") return false;
      const r = h.getBoundingClientRect();
      return r.width >= caja.width - 1 && r.height >= caja.height - 1;
    }).map((h) => `${String(h.className).split(" ")[0]} (${doc.defaultView.getComputedStyle(h).backgroundColor})`);
    L.push(`7. Capas de dentro que cubren el bloque entero: ${tapan.length ? tapan.join(", ") : "ninguna"}`);
    return L.join("\n");
  }

  /** Atajos cuyo valor calculado hay que leer en una propiedad larga. */
  const LARGAS = {
    font: "font-size",
    border: "border-top-width",
    "border-radius": "border-top-left-radius",
    flex: "flex-grow",
  };

  /** Para enseñarlo: del rgb() del navegador al hex que escribe la gente. */
  function hexDe(v) {
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(v || "").trim());
    if (!m) return String(v || "");
    const h = (n) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }

  /** Compara colores escritos de cualquier manera (#hex, rgb(), token). */
  function mismoColor(a, b) {
    return normColor(a) === normColor(b);
  }

  /** El mismo color escrito de dos maneras es el mismo color. */
  function normColor(v) {
    const t = String(v == null ? "" : v).trim().toLowerCase();
    const m = /^#([0-9a-f]{6})$/.exec(t);
    if (!m) return t;
    const n = parseInt(m[1], 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  }

  /** Todas las reglas, de todas las hojas, que tocan esa propiedad aquí. */
  function reglasQueTocan(doc, el, prop) {
    const out = [];
    const mira = (reglas, media) => {
      [...(reglas || [])].forEach((r) => {
        if (r.media) return mira(r.cssRules, r.conditionText || r.media.mediaText);
        if (!r.selectorText || !r.style) return;
        const valor = r.style.getPropertyValue(prop);
        if (!valor) return;
        let encaja = false;
        try { encaja = el.matches(r.selectorText); } catch (e) { encaja = false; }
        if (!encaja) return;
        const imp = r.style.getPropertyPriority(prop) ? " !important" : "";
        out.push(`${r.selectorText} { ${prop}: ${valor}${imp} }${media ? "  @media " + media : ""}`);
      });
    };
    [...doc.styleSheets].forEach((hoja) => {
      let reglas = null;
      try { reglas = hoja.cssRules; } catch (e) {
        out.push(`(hoja no legible: ${hoja.href || "sin nombre"})`);
        return;
      }
      mira(reglas, "");
    });
    return out;
  }

  function richEditor(node, key) {
    const mode = state.rtMode || "visual";
    const val = node.props?.[key] || "";
    return `<div class="b-rt">
      <div class="b-rt-bar">
        <button type="button" data-rt-mode="visual" class="${mode === "visual" ? "is-on" : ""}">Visual</button>
        <button type="button" data-rt-mode="code" class="${mode === "code" ? "is-on" : ""}">Texto</button>
        <button type="button" data-rt-media="${key}">Añadir media</button>
        <button type="button" data-rt="b" data-rt-key="${key}"><b>B</b></button>
        <button type="button" data-rt="i" data-rt-key="${key}"><i>I</i></button>
        <button type="button" data-rt="u" data-rt-key="${key}"><u>U</u></button>
        <button type="button" data-rt="ul" data-rt-key="${key}">Lista</button>
        <button type="button" data-rt="a" data-rt-key="${key}">Enlace</button>
      </div>
      ${mode === "code"
        ? `<textarea data-prop="${key}" class="b-rt-area">${esc(val)}</textarea>`
        : `<div class="b-rt-visual" contenteditable="true" data-rt-html="${key}"></div>`}
    </div>`;
  }







  // Con alto exacto lo que no cabe se recorta. Callarlo seria peor que el
  // problema: aqui se dice, con los numeros y la salida a mano.
  function fitWarning(node) {
    const f = (state.fitWarn || {})[node.id];
    if (!f) return "";
    return `<p class="b-warn">El contenido necesita ${f.need} px y la sección mide ${f.have} px,
      así que se está recortando ${f.need - f.have} px. Sube el alto, baja el contenido
      o pasa a «El contenido manda».</p>`;
  }


  function navModeFields(p, attr) {
    const row = (key, label, fallback) => {
      const cur = p[key] || fallback;
      return `<p class="m-muted">${label}</p>
        <div class="b-seg">
          <button type="button" class="${cur === "bar" ? "is-on" : ""}" ${attr}="${key}" data-v="bar">Barra (escritorio)</button>
          <button type="button" class="${cur === "drawer" ? "is-on" : ""}" ${attr}="${key}" data-v="drawer">Hamburguesa (móvil)</button>
        </div>`;
    };
    return `<div class="acc"><h5>Tipo de menú</h5>
      <p class="m-muted">En cada tamaño puedes mostrar la barra horizontal o el botón Menú.</p>
      ${row("navModeDesktop", "Escritorio", "bar")}
      ${row("navModeTablet", "Tablet", "bar")}
      ${row("navModeMobile", "Móvil", "drawer")}
    </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Repetidores: un sub-campo, y listas dentro de listas                */
  /*                                                                      */
  /* Estaban escritos dentro del propio repetidor. Se sacan aqui porque   */
  /* ahora los usan dos vistas distintas de los mismos datos: la lista de */
  /* siempre y el arbol de la carta. Dos vistas, un solo sitio donde se   */
  /* decide como se pinta y se escribe cada campo.                        */
  /* ------------------------------------------------------------------ */

  function repSubField(node, f, sf, it, i) {
    if (sf.key === "imageUrl") return "";
    if (sf.type === "repeater") return subListHtml(node, f, sf, it, i);
    if (sf.type === "image") {
      const url = it.imageUrl || "";
      const id = Number(it[sf.key] || 0);
      return `<div class="m-pick-label">${esc(sf.label)}
        <div class="b-gal-item">
          <div class="b-thumb">${url ? `<img src="${esc(url)}" alt="">` : `<span class="m-thumb-empty">${id ? "#" + id : "Sin foto"}</span>`}</div>
          <div class="b-gal-meta">
            <button type="button" class="m-btn" data-rep-media="${f.key}" data-i="${i}" data-k="${sf.key}">${id ? "Cambiar imagen" : "Añadir imagen"}</button>
            ${id ? `<button type="button" class="m-btn ghost" data-rep-media-clear="${f.key}" data-i="${i}" data-k="${sf.key}">Quitar</button>` : ""}
          </div>
        </div>
      </div>`;
    }
    // Opciones tomadas de otro repetidor del mismo bloque: así las
    // categorías de la carta o las columnas del pie se eligen de una
    // lista en vez de reescribirse a mano en cada ítem.
    if (sf.optionsFrom) {
      const src = Array.isArray(node.props?.[sf.optionsFrom]) ? node.props[sf.optionsFrom] : [];
      const lk = sf.labelKey || "label";
      const cur = String(it[sf.key] ?? "");
      const opts = src.map((o) => String(o?.[lk] ?? "").trim()).filter(Boolean);
      if (cur && !opts.includes(cur)) opts.push(cur);
      return `<label>${esc(sf.label)} <select data-rep="${f.key}" data-i="${i}" data-k="${sf.key}">
        <option value="">— Sin asignar —</option>
        ${opts.map((o) => `<option value="${esc(o)}" ${cur === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
      </select></label>`;
    }
    if (sf.type === "textarea") {
      return `<label>${esc(sf.label)} <textarea data-rep="${f.key}" data-i="${i}" data-k="${sf.key}">${esc(it[sf.key] ?? "")}</textarea></label>`;
    }
    if (sf.type === "toggle") {
      return `<label class="rep-toggle">${esc(sf.label)} <input type="checkbox" data-rep-bool="${f.key}" data-i="${i}" data-k="${sf.key}" ${it[sf.key] ? "checked" : ""}></label>`;
    }
    if (sf.type === "number") {
      return `<label>${esc(sf.label)} <input type="number" data-rep="${f.key}" data-i="${i}" data-k="${sf.key}" value="${esc(it[sf.key] ?? "")}" min="${sf.min ?? ""}" max="${sf.max ?? ""}"></label>`;
    }
    if (sf.type === "select") {
      const opts = sf.options || [];
      return `<label>${esc(sf.label)} <select data-rep="${f.key}" data-i="${i}" data-k="${sf.key}">${opts.map((o) => {
        const v = typeof o === "object" ? (o.value ?? o.id ?? "") : o;
        const l = typeof o === "object" ? (o.label ?? o.name ?? v) : o;
        return `<option value="${esc(v)}" ${String(it[sf.key] ?? "") === String(v) ? "selected" : ""}>${esc(l)}</option>`;
      }).join("")}</select></label>`;
    }
    return `<label>${esc(sf.label)} <input data-rep="${f.key}" data-i="${i}" data-k="${sf.key}" value="${esc(it[sf.key] ?? "")}"></label>`;
  }

  /* ------------------------------------------------------------------ */
  /* Una lista de items, en fichas plegables y arrastrables.              */
  /*                                                                      */
  /* Antes toda lista pintaba TODOS los campos de TODOS los items, uno    */
  /* detrás de otro: cuatro productos con ocho campos eran treinta y dos  */
  /* controles en una columna de 320 px y había que contar para saber     */
  /* dónde empezaba el tercero. Ahora cada item es una ficha con su       */
  /* nombre, su miniatura y su pliegue, igual que los platos de la carta. */
  /*                                                                      */
  /* No es otro sistema: son las mismas clases `tree-*`, el mismo         */
  /* `data-tree-t` para recordar qué está abierto y los mismos            */
  /* `data-rep-move|dup|del` de siempre. Los datos no cambian ni una      */
  /* coma, así que ninguna página necesita migrarse.                      */
  /* ------------------------------------------------------------------ */

  /** El nombre con el que se reconoce un item cerrado. */
  function repTitulo(f, it, i) {
    for (const k of ["title", "label", "name", "heading", "question", "text"]) {
      const v = String(it?.[k] ?? "").trim();
      if (v) return v.length > 46 ? v.slice(0, 46) + "…" : v;
    }
    const r = repResumen(f, it);
    return r || `Elemento ${i + 1}`;
  }

  function repFicha(node, f, it, i) {
    const id = `rep.${node.id}.${f.key}.${i}`;
    const abierto = CORE.isOpen(id, false);
    const foto = String(it?.imageUrl || "");
    return `<div class="tree-n is-rep ${abierto ? "is-open" : ""}" data-rep-row="${f.key}" data-i="${i}">
      <div class="tree-h">
        <span class="tree-grip" draggable="true" data-rep-drag="${f.key}" data-i="${i}" title="Arrastrar para ordenar">⋮⋮</span>
        <button type="button" class="tree-t" data-tree-t="${id}" aria-expanded="${abierto}">${abierto ? "−" : "+"}</button>
        ${foto ? `<span class="tree-mini"><img src="${esc(foto)}" alt=""></span>` : ""}
        <span class="tree-lbl">${esc(repTitulo(f, it, i))}</span>
        <span class="tree-acts">
          <button type="button" class="b-ico" data-rep-move="${f.key}" data-i="${i}" data-dir="-1" title="Subir">↑</button>
          <button type="button" class="b-ico" data-rep-move="${f.key}" data-i="${i}" data-dir="1" title="Bajar">↓</button>
          <button type="button" class="b-ico" data-rep-dup="${f.key}" data-i="${i}" title="Duplicar">⧉</button>
          <button type="button" class="b-ico" data-rep-del="${f.key}" data-i="${i}" title="Eliminar">✕</button>
        </span>
      </div>
      <div class="tree-b" ${abierto ? "" : "hidden"}>
        ${(f.itemFields || []).map((sf) => repSubField(node, f, sf, it, i)).join("")}
      </div>
    </div>`;
  }

  function repResumen(f, it) {
    for (const sf of f.itemFields || []) {
      if (["text", "textarea", "url"].includes(sf.type) && String(it[sf.key] ?? "").trim()) {
        return String(it[sf.key]).trim().slice(0, 42);
      }
    }
    return "";
  }

  /**
   * Una lista dentro de un item de otra lista. Las adiciones de un plato.
   *
   * Los datos ya lo soportaban —`Sanitizer::field()` se llama a si mismo
   * cuando un sub-campo es un repetidor—; lo que no existia era la forma
   * de escribirlo. Va en dos columnas (nombre y precio) porque una
   * adicion no es un item con ficha: es una linea.
   */
  /* Una sublista de imagenes no se edita escribiendo: se ve. Misma
     forma de datos que la galeria del tema (`imageId/imageUrl/alt`) y
     mismos manejadores (`data-sub-move|del` y `data-sub` para el alt),
     asi que esto es solo otra pintura, no otro sistema. */
  function subFotosHtml(node, f, sf, it, i) {
    const lista = Array.isArray(it[sf.key]) ? it[sf.key] : [];
    const abierto = CORE.isOpen(`tree.${node.id}.sub.${f.key}.${i}.${sf.key}`, lista.length > 0);
    const com = (j) => `data-sub-move="${f.key}" data-i="${i}" data-k="${sf.key}" data-j="${j}"`;
    const fotos = lista.map((sub, j) => {
      const url = String(sub?.imageUrl ?? "");
      const id = Number(sub?.imageId ?? 0);
      return `<figure class="tree-foto">
        ${url ? `<img src="${esc(url)}" alt="">` : `<span class="tree-foto-vacia">${id ? "#" + id : "?"}</span>`}
        <span class="tree-foto-acts">
          <button type="button" class="b-ico" ${com(j)} data-dir="-1" title="Antes">←</button>
          <button type="button" class="b-ico" ${com(j)} data-dir="1" title="Después">→</button>
          <button type="button" class="b-ico" data-sub-del="${f.key}" data-i="${i}" data-k="${sf.key}" data-j="${j}" title="Quitar">✕</button>
        </span>
        <input class="tree-foto-alt" data-sub="${f.key}" data-i="${i}" data-k="${sf.key}" data-j="${j}" data-sk="alt"
          value="${esc(sub?.alt ?? "")}" placeholder="Texto alternativo" aria-label="Texto alternativo de la foto ${j + 1}">
      </figure>`;
    }).join("");
    return `<div class="tree-n is-sub ${abierto ? "is-open" : ""}">
      <div class="tree-h">
        <button type="button" class="tree-t" data-tree-t="tree.${node.id}.sub.${f.key}.${i}.${sf.key}" aria-expanded="${abierto}">${abierto ? "−" : "+"}</button>
        <span class="tree-lbl">${esc(sf.label)}</span>
        <span class="tree-c">${lista.length}</span>
      </div>
      <div class="tree-b" ${abierto ? "" : "hidden"}>
        ${sf.help ? `<p class="m-muted">${esc(sf.help)}</p>` : ""}
        ${fotos ? `<div class="tree-fotos">${fotos}</div>` : ""}
        <button type="button" class="m-btn ghost tree-add" data-sub-fotos="${f.key}" data-i="${i}" data-k="${sf.key}">${esc(sf.addLabel || "Añadir fotos")}</button>
      </div>
    </div>`;
  }

  function subListHtml(node, f, sf, it, i) {
    if (sf.ui === "photos") return subFotosHtml(node, f, sf, it, i);
    const lista = Array.isArray(it[sf.key]) ? it[sf.key] : [];
    const campos = sf.itemFields || [];
    const abierto = CORE.isOpen(`tree.${node.id}.sub.${f.key}.${i}.${sf.key}`, lista.length > 0);
    const filas = lista.map((sub, j) => `<div class="tree-row">
      ${campos.map((cf) => `<input class="${cf.key === campos[0]?.key ? "is-wide" : ""}" data-sub="${f.key}" data-i="${i}" data-k="${sf.key}" data-j="${j}" data-sk="${cf.key}"
        value="${esc(sub?.[cf.key] ?? "")}" placeholder="${esc(cf.label)}" aria-label="${esc(cf.label)}">`).join("")}
      <button type="button" class="b-ico" data-sub-move="${f.key}" data-i="${i}" data-k="${sf.key}" data-j="${j}" data-dir="-1" title="Subir">↑</button>
      <button type="button" class="b-ico" data-sub-move="${f.key}" data-i="${i}" data-k="${sf.key}" data-j="${j}" data-dir="1" title="Bajar">↓</button>
      <button type="button" class="b-ico" data-sub-del="${f.key}" data-i="${i}" data-k="${sf.key}" data-j="${j}" title="Eliminar">✕</button>
    </div>`).join("");
    return `<div class="tree-n is-sub ${abierto ? "is-open" : ""}">
      <div class="tree-h">
        <button type="button" class="tree-t" data-tree-t="tree.${node.id}.sub.${f.key}.${i}.${sf.key}" aria-expanded="${abierto}">${abierto ? "−" : "+"}</button>
        <span class="tree-lbl">${esc(sf.label)}</span>
        <span class="tree-c">${lista.length}</span>
      </div>
      <div class="tree-b" ${abierto ? "" : "hidden"}>
        ${filas}
        <button type="button" class="m-btn ghost tree-add" data-sub-add="${f.key}" data-i="${i}" data-k="${sf.key}">${esc(sf.addLabel || "Añadir")}</button>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* La carta como arbol: categoria → platos → adiciones                 */
  /*                                                                      */
  /* Los datos NO cambian: `categories` sigue siendo una lista plana y    */
  /* cada plato sigue llevando su campo `category`. Esto es solo otra     */
  /* forma de enseñarlos, asi que ninguna carta existente necesita        */
  /* migrarse y el frontend no se entera. El `data-i` de cada control es  */
  /* el indice real en la lista plana, de modo que los manejadores de     */
  /* siempre (`data-rep`, `data-rep-move`…) siguen valiendo tal cual.     */
  /*                                                                      */
  /* Los platos sin categoria, o con una categoria que ya no existe, no   */
  /* se pierden: caen en un grupo final «Sin categoria». Antes quedaban   */
  /* invisibles en la lista larga y nadie los encontraba.                 */
  /* ------------------------------------------------------------------ */
  function menuTreeHtml(node, f) {
    const cats = Array.isArray(node.props?.categories) ? node.props.categories : [];
    const items = Array.isArray(node.props?.[f.key]) ? node.props[f.key] : [];
    const catDef = (defOf(node.type)?.fields || []).find((x) => x.key === "categories") || { itemFields: [] };
    const norm = (s) => String(s ?? "").trim().toLowerCase();
    const conocidas = cats.map((c) => norm(c?.label));

    const plato = (it, i) => {
      const id = `tree.${node.id}.plato.${i}`;
      const abierto = CORE.isOpen(id, false);
      const nombre = String(it?.title ?? "").trim() || "Plato sin nombre";
      const precio = String(it?.price ?? "").trim();
      const nAd = Array.isArray(it?.addons) ? it.addons.length : 0;
      return `<div class="tree-n is-plato ${abierto ? "is-open" : ""}">
        <div class="tree-h">
          <button type="button" class="tree-t" data-tree-t="${id}" aria-expanded="${abierto}">${abierto ? "−" : "+"}</button>
          <span class="tree-lbl">${esc(nombre)}</span>
          ${precio ? `<span class="tree-price">${esc(precio)}</span>` : ""}
          ${nAd ? `<span class="tree-c" title="Adiciones">+${nAd}</span>` : ""}
          <span class="tree-acts">
            <button type="button" class="b-ico" data-rep-move="${f.key}" data-i="${i}" data-dir="-1" title="Subir">↑</button>
            <button type="button" class="b-ico" data-rep-move="${f.key}" data-i="${i}" data-dir="1" title="Bajar">↓</button>
            <button type="button" class="b-ico" data-rep-dup="${f.key}" data-i="${i}" title="Duplicar">⧉</button>
            <button type="button" class="b-ico" data-rep-del="${f.key}" data-i="${i}" title="Eliminar">✕</button>
          </span>
        </div>
        <div class="tree-b" ${abierto ? "" : "hidden"}>
          ${(f.itemFields || []).map((sf) => repSubField(node, f, sf, it, i)).join("")}
        </div>
      </div>`;
    };

    const grupo = (titulo, idGrupo, dentro, cabecera, acciones, nPlatos) => {
      const abierto = CORE.isOpen(idGrupo, true);
      return `<div class="tree-n is-cat ${abierto ? "is-open" : ""}">
        <div class="tree-h">
          <button type="button" class="tree-t" data-tree-t="${idGrupo}" aria-expanded="${abierto}">${abierto ? "−" : "+"}</button>
          <span class="tree-lbl is-cat">${esc(titulo)}</span>
          <span class="tree-c">${nPlatos}</span>
          <span class="tree-acts">${acciones}</span>
        </div>
        <div class="tree-b" ${abierto ? "" : "hidden"}>${cabecera}${dentro}</div>
      </div>`;
    };

    let html = "";
    cats.forEach((c, ci) => {
      const etiqueta = String(c?.label ?? "").trim();
      const mios = items.map((it, i) => [it, i]).filter(([it]) => norm(it?.category) === norm(etiqueta));
      // Las adiciones de la categoría se pintan DESPUÉS de los platos,
      // igual que salen en la página: cierran el bloque, no lo abren.
      const subCampos = (catDef.itemFields || []).filter((sf) => sf.type !== "repeater");
      const subListas = (catDef.itemFields || []).filter((sf) => sf.type === "repeater");
      const campos = subCampos.map((sf) => repSubField(node, catDef, sf, c, ci)).join("");
      const cierre = subListas.map((sf) => repSubField(node, catDef, sf, c, ci)).join("");
      const acciones = `
        <button type="button" class="b-ico" data-rep-move="categories" data-i="${ci}" data-dir="-1" title="Subir">↑</button>
        <button type="button" class="b-ico" data-rep-move="categories" data-i="${ci}" data-dir="1" title="Bajar">↓</button>
        <button type="button" class="b-ico" data-rep-dup="categories" data-i="${ci}" title="Duplicar">⧉</button>
        <button type="button" class="b-ico" data-rep-del="categories" data-i="${ci}" title="Eliminar">✕</button>`;
      const dentro = mios.map(([it, i]) => plato(it, i)).join("")
        + `<button type="button" class="m-btn ghost tree-add" data-rep-add="${f.key}" data-preset-k="category" data-preset-v="${esc(etiqueta)}">Añadir plato a «${esc(etiqueta || "esta categoría")}»</button>`
        + cierre;
      html += grupo(etiqueta || `Categoría ${ci + 1}`, `tree.${node.id}.cat.${ci}`, dentro, `<div class="tree-cat-fields">${campos}</div>`, acciones, mios.length);
    });

    const sueltos = items.map((it, i) => [it, i]).filter(([it]) => !conocidas.includes(norm(it?.category)));
    if (sueltos.length) {
      html += grupo(
        "Sin categoría",
        `tree.${node.id}.cat.sueltos`,
        sueltos.map(([it, i]) => plato(it, i)).join(""),
        `<p class="m-muted">Estos platos no están en ninguna categoría de la lista. Asígnales una desde «Categoría», dentro de cada plato.</p>`,
        "",
        sueltos.length
      );
    }

    return `<div class="b-tree" data-tree="${f.key}">
      ${html}
      <button type="button" class="m-btn ghost" data-rep-add="categories">Añadir categoría</button>
    </div>`;
  }

  function fieldHtml(node, f) {
    const html = fieldControl(node, f);
    return f.help ? `${html}<p class="m-muted">${esc(f.help)}</p>` : html;
  }

  function fieldControl(node, f) {
    const val = node.props?.[f.key];
    if (f.type === "toggle") {
      return `<label>${esc(f.label)} <input type="checkbox" data-prop="${f.key}" ${val ? "checked" : ""}></label>`;
    }
    if (f.type === "richtext") {
      return `<label class="m-pick-label">${esc(f.label)}
        <div class="b-rt">
          <div class="b-rt-bar">
            <button type="button" data-rt="b" data-rt-key="${f.key}"><b>B</b></button>
            <button type="button" data-rt="i" data-rt-key="${f.key}"><i>I</i></button>
            <button type="button" data-rt="u" data-rt-key="${f.key}"><u>U</u></button>
            <button type="button" data-rt="ul" data-rt-key="${f.key}">• Lista</button>
            <button type="button" data-rt="a" data-rt-key="${f.key}">Enlace</button>
            <button type="button" data-rt="p" data-rt-key="${f.key}">P</button>
          </div>
          <textarea data-prop="${f.key}" class="b-rt-area">${esc(val || "")}</textarea>
        </div>
      </label>`;
    }
    if (f.type === "textarea") {
      return `<label>${esc(f.label)} <textarea data-prop="${f.key}">${esc(val || "")}</textarea></label>`;
    }
    if (f.type === "mapsUrl") {
      return `<label class="m-pick-label">${esc(f.label)}
        <textarea data-prop="${f.key}" class="b-rt-area" placeholder="Pega la URL o el iframe de Google Maps">${esc(val || "")}</textarea>
        <span class="m-muted">Acepta el enlace para compartir o el código iframe de Insertar mapa.</span>
      </label>`;
    }
    if (f.type === "htmlTag") {
      const opts = (f.options || ["h1", "h2", "h3", "h4", "h5", "h6"]).map((o) => (typeof o === "object" ? o.value : o));
      return `<div class="m-pick-label">${esc(f.label)}
        ${seg(f.key, val, opts.map((v) => ({ v, l: String(v).toUpperCase() })), "data-prop-set")}
      </div>`;
    }
    if (f.type === "alignment") {
      return `<div class="m-pick-label">${esc(f.label)}
        ${seg(f.key, val || "left", [
          { v: "left", l: "⟸", t: "Izquierda" },
          { v: "center", l: "≡", t: "Centro" },
          { v: "right", l: "⟹", t: "Derecha" },
        ], "data-prop-set")}
      </div>`;
    }
    if (f.type === "select") {
      const opts = f.options || [];
      return `<label>${esc(f.label)} <select data-prop="${f.key}">${opts.map((o) => {
        const v = typeof o === "object" ? (o.value ?? o.id ?? "") : o;
        const l = typeof o === "object" ? (o.label ?? o.name ?? v) : o;
        return `<option value="${esc(v)}" ${String(val) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
      }).join("")}</select></label>`;
    }
    if (f.type === "number") {
      return `<label>${esc(f.label)} <input type="number" data-prop="${f.key}" value="${esc(val ?? "")}" min="${f.min ?? ""}" max="${f.max ?? ""}"></label>`;
    }
    if (f.type === "image") {
      const url = node.props?.imageUrl || "";
      const has = Number(val) > 0;
      return `<div class="m-pick-label">${esc(f.label)}
        <div class="b-gal-item">
          <div class="b-thumb">${url ? `<img src="${esc(url)}" alt="">` : `<span class="m-thumb-empty">${has ? "#" + val : "Sin foto"}</span>`}</div>
          <div class="b-gal-meta">
            <button type="button" class="m-btn" data-media="${f.key}">${has ? "Cambiar imagen" : "Añadir imagen"}</button>
            ${has ? `<button type="button" class="m-btn ghost" data-clear-img>Quitar</button>` : ""}
          </div>
        </div>
      </div>`;
    }
    if (f.type === "color") {
      // Sin color elegido el campo se queda vacio: asi se ve de un vistazo
      // que manda el tema. Antes se rellenaba con un color de ejemplo y
      // parecia que el bloque ya tenia color propio.
      const cssVar = val?.mode === "token" && val?.token ? `var(--${String(val.token).replace(".", "-")})` : "";
      const shown = (val?.mode === "custom" && val?.value) ? val.value : cssVar;
      const hex = window.KrgUi ? window.KrgUi.hex(shown || "#D94E27") : "#D94E27";
      return `<label class="m-pick-label">${esc(f.label)}
        <div class="m-pick m-pick-color">
          <input type="color" data-color-picker="${f.key}" value="${esc(hex)}" title="Selector de color">
          <input data-color-custom="${f.key}" value="${esc(shown)}" placeholder="Sin color: manda el tema" class="m-pick-val">
          ${shown ? `<button type="button" class="b-ico" data-color-clear="${f.key}" title="Quitar el color">✕</button>` : ""}
        </div>
      </label>`;
    }
    if (f.ui === "inTree") return "";
    if (f.ui === "menuTree") return menuTreeHtml(node, f);
    if (f.type === "repeater") {
      const items = Array.isArray(val) ? val : [];
      return `<div class="b-rep" data-tree="${f.key}">
        <strong>${esc(f.label)} <span class="rep-n">${items.length}</span></strong>
        ${items.map((it, i) => repFicha(node, f, it, i)).join("")}
        <button type="button" class="m-btn ghost" data-rep-add="${f.key}">Añadir</button>
      </div>`;
    }
    return `<label>${esc(f.label)} <input data-prop="${f.key}" value="${esc(val ?? "")}"></label>`;
  }

  function bindInspector() {
    const box = root.querySelector(".b-insp");

    // Los acordeones del nuevo inspector. No repintan nada al abrirse:
    // cambian `hidden` y apuntan la preferencia, asi que el control que
    // el usuario tiene debajo del dedo no desaparece.
    window.KrgBuilderCore.bindGroups(box);
    if (!box) return;
    const hit = () => findNode(state.doc.sections, state.selected);
    box.querySelectorAll("[data-prop]").forEach((inp) => {
      const apply = (ev) => {
        const h = hit();
        if (!h) return;
        let v = inp.type === "checkbox" ? inp.checked : inp.value;
        // Un campo numerico en blanco vale «sin valor», no cero: en los
        // espacios en px eso es la diferencia entre «deja el ritmo del
        // bloque» y «pegalo al de arriba».
        if (inp.type === "number" || inp.type === "range") v = inp.value === "" ? "" : Number(v);
        if (inp.dataset.prop === "formId") v = Number(v) || 0;
        if (h.node.type === "map" && inp.dataset.prop === "url") v = extractMapsUrl(String(v || ""));
        h.node.props[inp.dataset.prop] = v;
        if (inp.dataset.prop === "name") h.node.name = String(v);
        if (inp.dataset.prop === "span") h.node.name = "Columna " + fracLabel(Number(v) || 12);
        if (inp.type === "range" || inp.type === "number") {
          box.querySelectorAll(`[data-prop="${inp.dataset.prop}"]`).forEach((o) => {
            if (o !== inp) o.value = inp.value;
          });
        }
        markDirty();
        // Repintar el inspector solo cuando cambia QUE campos se muestran.
        // Antes tambien estaban aqui los valores numericos y las unidades,
        // y como esto corria en cada pulsacion, el panel se reconstruia
        // letra a letra: perdias el foco y la barra saltaba arriba. Los
        // valores ya se reflejan solos en el lienzo.
        const REDRAW = ["parallax", "autoplay", "minHeight", "heightMode",
          "vAlign", "curtain", "headerSkin", "width"];
        if (REDRAW.includes(inp.dataset.prop) && ev === "change") render();
      };
      inp.addEventListener("change", () => apply("change"));
      inp.addEventListener("input", () => apply("input"));
    });
    box.querySelectorAll("[data-page]").forEach((inp) => {
      inp.addEventListener("input", () => {
        state.doc[inp.dataset.page] = inp.value;
        const t = root.querySelector(".b-pagetitle");
        if (t && inp.dataset.page === "title") t.textContent = inp.value;
        markDirty();
      });
    });
    box.querySelectorAll("[data-page-num]").forEach((inp) => {
      inp.addEventListener("change", () => {
        state.doc[inp.dataset.pageNum] = Number(inp.value);
        markDirty();
      });
    });
    box.querySelectorAll("[data-set]").forEach((inp) => {
      inp.addEventListener("change", () => {
        state.doc.settings = state.doc.settings || {};
        state.doc.settings[inp.dataset.set] = inp.checked;
        markDirty();
      });
    });
    box.querySelectorAll("[data-set-str]").forEach((inp) => {
      inp.addEventListener("change", () => {
        state.doc.settings = state.doc.settings || {};
        state.doc.settings[inp.dataset.setStr] = inp.value;
        markDirty();
      });
    });
    box.querySelectorAll("[data-hide-bp]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const h = hit();
        if (!h) return;
        h.node.hiddenOn = h.node.hiddenOn || {};
        h.node.hiddenOn[inp.dataset.hideBp] = inp.checked;
        markDirty();
      });
    });
    box.querySelectorAll("[data-seo]").forEach((inp) => {
      const apply = () => {
        state.doc.seo = state.doc.seo || {};
        state.doc.seo[inp.dataset.seo] = inp.type === "number" ? Number(inp.value || 0) : inp.value;
        markDirty();
      };
      inp.addEventListener("input", apply);
      inp.addEventListener("change", apply);
    });
    box.querySelectorAll("[data-seo-media]").forEach((b) => {
      b.onclick = () => {
        if (!window.wp?.media) return;
        const frame = wp.media({ title: "Imagen Open Graph", multiple: false });
        frame.on("select", () => {
          const att = frame.state().get("selection").first().toJSON();
          state.doc.seo = state.doc.seo || {};
          state.doc.seo[b.dataset.seoMedia] = att.id;
          const inp = box.querySelector(`[data-seo="${b.dataset.seoMedia}"]`);
          if (inp) inp.value = att.id;
          markDirty();
        });
        frame.open();
      };
    });
    const setStyle = (prop, value) => {
      const h = hit();
      if (!h) return;
      const st = window.KrgBuilderCore.styleBucket(h.node, state.bp);
      if (value) st[prop] = value;
      else delete st[prop];
      markDirty();
    };
    box.querySelectorAll("[data-style]").forEach((inp) => {
      // El aviso de «esto lo tapa un bloque» depende del color que acabas
      // de elegir, y el inspector no se redibuja con cada tecla. Sin esto
      // el aviso solo aparecia al volver a seleccionar la seccion, que es
      // justo cuando ya has decidido que el campo no funciona. Se repinta
      // en los dos eventos porque hay tres formas de poner un color aqui
      // —teclear, el cuadrito del sistema y la ✕— y no todas mandan los
      // mismos; y se repinta solo el aviso, nunca el inspector entero:
      // redibujarlo en `change` le arranca a la persona el campo al que
      // acaba de saltar.
      const apply = () => {
        setStyle(inp.dataset.style, inp.value);
        if (inp.dataset.style === "background-color") { repaintBgNote(); paintLiveCss(); }
      };
      inp.addEventListener("input", apply);
      inp.addEventListener("change", apply);
    });
    box.querySelectorAll("[data-side]").forEach((inp) => {
      inp.addEventListener("input", () => setStyle(inp.dataset.side, unitize(inp.value, "px")));
    });
    box.querySelectorAll("[data-diag]").forEach((b) => {
      b.onclick = () => {
        const h = findNode(state.doc.sections, b.dataset.diag);
        const caja = b.parentElement.querySelector(".b-diag");
        if (!h || !caja) return;
        caja.value = diagnosticar(h.node);
        caja.hidden = false;
        caja.style.height = "auto";
        caja.style.height = Math.min(420, caja.scrollHeight + 8) + "px";
      };
    });
    const notaBg = box.querySelector("[data-bg-note]");
    if (notaBg) bindBgNote(notaBg);
    box.querySelectorAll("[data-style-set]").forEach((b) => {
      b.onclick = () => {
        const cur = hit()?.node?.styles?.[state.bp]?.[b.dataset.styleSet];
        setStyle(b.dataset.styleSet, cur === b.dataset.v ? "" : b.dataset.v);
        render({ keepFrame: true });
        paintLiveCss();
      };
    });
    box.querySelectorAll("[data-prop-set]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        h.node.props = window.KrgBuilderCore.dict(h.node, "props");
        const key = b.dataset.propSet;
        const val = b.dataset.v;
        if (key === "distribute" && h.node.props[key] === val) h.node.props[key] = "none";
        else h.node.props[key] = val;
        if (key === "alignH" || key === "contentHAlign") {
          const map = { start: "left", center: "center", end: "right" };
          if (map[val]) {
            window.KrgBuilderCore.styleBucket(h.node, state.bp)["text-align"] = map[val];
          }
        }
        markDirty();
        render({ keepFrame: true });
      };
    });
    box.querySelectorAll("[data-parent-prop]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h?.parent) return;
        h.parent.props = window.KrgBuilderCore.dict(h.parent, "props");
        const key = b.dataset.parentProp;
        const val = b.dataset.v;
        h.parent.props[key] = h.parent.props[key] === val ? "none" : val;
        markDirty();
        render({ keepFrame: true });
      };
    });
    box.querySelectorAll("[data-style-num],[data-range]").forEach((inp) => {
      const apply = () => {
        const prop = inp.dataset.styleNum || inp.dataset.range;
        const unit = inp.dataset.unit || "px";
        const other = box.querySelector(inp.dataset.range ? `[data-style-num="${prop}"]` : `[data-range="${prop}"]`);
        if (other) other.value = inp.value;
        setStyle(prop, (inp.value === "" || (Number(inp.value) === 0 && prop === "height")) ? "" : unitize(inp.value, unit));
      };
      inp.addEventListener("input", apply);
    });
    box.querySelectorAll("[data-node]").forEach((inp) => {
      const apply = () => {
        const h = hit();
        if (!h) return;
        const key = inp.dataset.node;
        h.node[key] = inp.type === "number" ? Number(inp.value || 0) : inp.value;
        markDirty();
      };
      inp.addEventListener("input", apply);
      inp.addEventListener("change", apply);
    });
    box.querySelectorAll("[data-insp-tab]").forEach((b) => {
      b.onclick = () => {
        state.inspTab = b.dataset.inspTab;
        render({ keepFrame: true });
      };
    });
    box.querySelectorAll("[data-layout]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        applyLayout(h.node, findLayout(b.getAttribute("data-layout")));
        markDirty();
        render();
      };
    });
    box.querySelectorAll("[data-add-row]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        openLayoutPicker((layout) => {
          snapshot();
          const row = instantiateLayout(layout);
          h.node.children = h.node.children || [];
          h.node.children.push(row);
          state.selected = firstLeafColumn(row)?.id || row.id;
          markDirty();
          render();
        });
      };
    });
    box.querySelectorAll("[data-clear-img]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        h.node.props.imageId = 0;
        h.node.props.imageUrl = "";
        markDirty();
        render();
      };
    });
    box.querySelectorAll("[data-filter]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const h = hit();
        if (!h) return;
        h.node.filters = h.node.filters || { hue: 0, sat: 100, brightness: 100, contrast: 100, invert: 0, sepia: 0 };
        h.node.filters[inp.dataset.filter] = Number(inp.value);
        box.querySelectorAll(`[data-filter="${inp.dataset.filter}"]`).forEach((x) => { x.value = inp.value; });
        markDirty();
        paintLiveCss();
      });
    });
    box.querySelectorAll("[data-anim]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        h.node.animation = b.dataset.anim;
        markDirty();
        render({ keepFrame: true });
      };
    });
    box.querySelectorAll("[data-css]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const h = hit();
        if (!h) return;
        h.node.customCss = h.node.customCss || { before: "", main: "", after: "" };
        h.node.customCss[inp.dataset.css] = inp.value;
        markDirty();
        paintLiveCss();
      });
    });
    box.querySelectorAll("[data-attrs]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const h = hit();
        if (!h) return;
        // «clave: valor» por linea. Lo que no cuadre se ignora en
        // silencio mientras se escribe; el filtro de verdad (que
        // atributos se admiten) esta en el guardado.
        const out = {};
        String(inp.value || "").split("\n").forEach((linea) => {
          const corte = linea.indexOf(":");
          if (corte < 1) return;
          const k = linea.slice(0, corte).trim().toLowerCase();
          const v = linea.slice(corte + 1).trim();
          if (k) out[k] = v;
        });
        h.node.attrs = out;
        markDirty();
      });
    });
    box.querySelectorAll("[data-rt]").forEach((b) => {
      b.onclick = () => {
        const vis = box.querySelector(`[data-rt-html="${b.dataset.rtKey}"]`);
        if (vis) {
          vis.focus();
          const cmd = { b: "bold", i: "italic", u: "underline", ul: "insertUnorderedList" };
          if (b.dataset.rt === "a") {
            const url = window.prompt("URL del enlace", "https://");
            if (url) document.execCommand("createLink", false, url);
          } else if (cmd[b.dataset.rt]) {
            document.execCommand(cmd[b.dataset.rt], false, null);
          }
          const h = hit();
          if (h) h.node.props[b.dataset.rtKey] = vis.innerHTML;
          markDirty();
          return;
        }
        const ta = box.querySelector(`[data-prop="${b.dataset.rtKey}"]`);
        if (!ta) return;
        const a = ta.selectionStart, z = ta.selectionEnd;
        const sel = ta.value.slice(a, z) || "texto";
        const map = {
          b: `<strong>${sel}</strong>`,
          i: `<em>${sel}</em>`,
          u: `<u>${sel}</u>`,
          ul: `<ul><li>${sel}</li></ul>`,
          p: `<p>${sel}</p>`,
          a: `<a href="#">${sel}</a>`,
        };
        ta.value = ta.value.slice(0, a) + (map[b.dataset.rt] || sel) + ta.value.slice(z);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      };
    });
    box.querySelectorAll("[data-rt-mode]").forEach((b) => {
      b.onclick = () => {
        const vis = box.querySelector("[data-rt-html]");
        const h = hit();
        if (vis && h) h.node.props[vis.dataset.rtHtml] = vis.innerHTML;
        state.rtMode = b.dataset.rtMode;
        render({ keepFrame: true });
      };
    });
    box.querySelectorAll("[data-rt-html]").forEach((el) => {
      const h = hit();
      el.innerHTML = h?.node?.props?.[el.dataset.rtHtml] || "";
      el.addEventListener("input", () => {
        const cur = hit();
        if (!cur) return;
        cur.node.props[el.dataset.rtHtml] = el.innerHTML;
        markDirty();
      });
    });
    box.querySelectorAll("[data-rt-media]").forEach((b) => {
      b.onclick = () => {
        if (!window.wp?.media) return;
        const frame = wp.media({ title: "Insertar imagen", multiple: false });
        frame.on("select", () => {
          const att = frame.state().get("selection").first().toJSON();
          const h = hit();
          if (!h) return;
          const key = b.dataset.rtMedia;
          const tag = `<img src="${att.url || ""}" alt="${att.alt || ""}">`;
          h.node.props[key] = (h.node.props[key] || "") + tag;
          markDirty();
          render({ keepFrame: true });
        });
        frame.open();
      };
    });
    box.querySelectorAll("[data-color-custom]").forEach((inp) => {
      const apply = () => {
        const key = inp.dataset.colorCustom;
        const h = hit();
        if (!h) return;
        const v = String(inp.value || "").trim();
        h.node.props[key] = v
          ? { mode: "custom", token: "", value: v }
          : { mode: "none", token: "", value: "" };
        markDirty();
      };
      inp.addEventListener("change", apply);
      inp.addEventListener("input", apply);
    });
    box.querySelectorAll("[data-color-clear]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        h.node.props[b.dataset.colorClear] = { mode: "none", token: "", value: "" };
        markDirty();
        render({ keepFrame: true });
      };
    });
    box.querySelectorAll("[data-rep]").forEach((inp) => {
      const applyRep = () => {
        const h = hit();
        if (!h) return;
        const arr = h.node.props[inp.dataset.rep] || [];
        if (!arr[Number(inp.dataset.i)]) return;
        arr[Number(inp.dataset.i)][inp.dataset.k] = inp.type === "number" ? Number(inp.value) : inp.value;
        h.node.props[inp.dataset.rep] = arr;
        // El nombre de la ficha se actualiza mientras escribes. Es solo
        // la etiqueta: NO se repinta el inspector desde el campo, que es
        // la forma conocida de perder el cursor a media palabra.
        const fila = inp.closest("[data-rep-row]");
        const etiqueta = fila?.querySelector(":scope > .tree-h > .tree-lbl");
        if (etiqueta) {
          const campo = (defOf(h.node.type)?.fields || []).find((x) => x.key === inp.dataset.rep);
          if (campo) etiqueta.textContent = repTitulo(campo, arr[Number(inp.dataset.i)], Number(inp.dataset.i));
        }
        markDirty();
      };
      inp.addEventListener("input", applyRep);
      inp.addEventListener("change", applyRep);
    });
    box.querySelectorAll("[data-rep-bool]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const h = hit();
        if (!h) return;
        const arr = h.node.props[inp.dataset.repBool] || [];
        if (!arr[Number(inp.dataset.i)]) return;
        arr[Number(inp.dataset.i)][inp.dataset.k] = inp.checked;
        h.node.props[inp.dataset.repBool] = arr;
        markDirty();
      });
    });
    box.querySelectorAll("[data-rep-add]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        const def = defOf(h.node.type);
        const field = (def.fields || []).find((f) => f.key === b.dataset.repAdd);
        const blank = {};
        (field?.itemFields || []).forEach((sf) => {
          if (sf.type === "toggle") blank[sf.key] = false;
          else if (sf.type === "number" || sf.type === "image") blank[sf.key] = 0;
          else if (sf.type === "select") {
            const first = (sf.options || [])[0];
            blank[sf.key] = typeof first === "object" ? (first?.value ?? "") : (first ?? "");
          } else blank[sf.key] = "";
        });
        // «Añadir plato a Postres» tiene que crear el plato YA en
        // Postres: si no, aparece en «Sin categoría» y hay que ir a
        // buscarlo, que es justo el paseo que el árbol viene a quitar.
        if (b.dataset.presetK) blank[b.dataset.presetK] = b.dataset.presetV || "";
        snapshot();
        h.node.props[b.dataset.repAdd] = h.node.props[b.dataset.repAdd] || [];
        h.node.props[b.dataset.repAdd].push(blank);
        // La ficha recien creada se abre sola y el cursor cae en su
        // primer campo: se pulsa «Añadir» para escribir, no para buscar.
        const nuevo = h.node.props[b.dataset.repAdd].length - 1;
        CORE.setOpen(`rep.${h.node.id}.${b.dataset.repAdd}.${nuevo}`, true);
        markDirty();
        render();
        const fila = root.querySelector(
          `.b-rep [data-rep-row="${CSS.escape(b.dataset.repAdd)}"][data-i="${nuevo}"]`
        );
        const campo = fila?.querySelector(".tree-b input, .tree-b textarea, .tree-b select");
        if (campo) {
          campo.focus({ preventScroll: true });
          acercar(campo);
        }
      };
    });
    /* --- Arrastrar una ficha para subirla o bajarla --- */
    /* El teclado sigue teniendo las flechas ↑ ↓ de cada ficha: el raton
       es un atajo, no la unica puerta. */
    const limpiarArrastre = () => {
      box.querySelectorAll(".drop-before, .drop-after, .is-drag").forEach((el) => {
        el.classList.remove("drop-before", "drop-after", "is-drag");
      });
    };
    box.querySelectorAll("[data-rep-drag]").forEach((g) => {
      g.addEventListener("dragstart", (e) => {
        const fila = g.closest("[data-rep-row]");
        e.dataTransfer.setData("text/plain", `${g.dataset.repDrag}:${g.dataset.i}`);
        e.dataTransfer.effectAllowed = "move";
        if (fila) {
          fila.classList.add("is-drag");
          try { e.dataTransfer.setDragImage(fila, 12, 12); } catch (err) { /* da igual */ }
        }
        box.dataset.repDragging = `${g.dataset.repDrag}:${g.dataset.i}`;
      });
      g.addEventListener("dragend", () => {
        limpiarArrastre();
        delete box.dataset.repDragging;
      });
    });
    const leeArrastre = (e) => {
      const crudo = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || box.dataset.repDragging || "";
      const corte = crudo.lastIndexOf(":");
      if (corte < 1) return null;
      const i = Number(crudo.slice(corte + 1));
      return Number.isInteger(i) ? { key: crudo.slice(0, corte), i } : null;
    };
    box.querySelectorAll("[data-rep-row]").forEach((fila) => {
      const mismo = (o) => o && o.key === fila.dataset.repRow && o.i !== Number(fila.dataset.i);
      fila.addEventListener("dragover", (e) => {
        const o = leeArrastre(e);
        if (!mismo(o)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const r = fila.getBoundingClientRect();
        const despues = e.clientY > r.top + r.height / 2;
        fila.classList.toggle("drop-before", !despues);
        fila.classList.toggle("drop-after", despues);
      });
      fila.addEventListener("dragleave", (e) => {
        if (!fila.contains(e.relatedTarget)) fila.classList.remove("drop-before", "drop-after");
      });
      fila.addEventListener("drop", (e) => {
        const o = leeArrastre(e);
        const despues = fila.classList.contains("drop-after");
        limpiarArrastre();
        if (!mismo(o)) return;
        e.preventDefault();
        const h = hit();
        const arr = h?.node.props[o.key];
        if (!Array.isArray(arr)) return;
        let destino = Number(fila.dataset.i) + (despues ? 1 : 0);
        if (o.i < destino) destino -= 1;
        if (destino === o.i) return;
        snapshot();
        arr.splice(destino, 0, arr.splice(o.i, 1)[0]);
        markDirty();
        render();
      });
    });

    box.querySelectorAll("[data-rep-del]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        snapshot();
        h.node.props[b.dataset.repDel].splice(Number(b.dataset.i), 1);
        markDirty();
        render();
      };
    });
    box.querySelectorAll("[data-rep-move]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        const arr = h.node.props[b.dataset.repMove] || [];
        const i = Number(b.dataset.i);
        const j = i + Number(b.dataset.dir);
        if (j < 0 || j >= arr.length) return;
        snapshot();
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
        markDirty();
        render();
      };
    });
    box.querySelectorAll("[data-rep-dup]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        const arr = h.node.props[b.dataset.repDup] || [];
        const i = Number(b.dataset.i);
        if (!arr[i]) return;
        snapshot();
        arr.splice(i + 1, 0, JSON.parse(JSON.stringify(arr[i])));
        markDirty();
        render();
      };
    });
    /**
     * Empuja lo justo la caja que se desplaza para que `el` se vea.
     *
     * `scrollIntoView` mueve TODOS los contenedores de arriba, y eso es
     * justo el salto que molesta: aqui se mueve solo la caja propia.
     */
    const acercar = (el) => {
      const caja = el.closest(".b-tree, .b-rep");
      if (!caja || caja.scrollHeight <= caja.clientHeight) return;
      const r = el.getBoundingClientRect();
      const c = caja.getBoundingClientRect();
      if (r.bottom > c.bottom) caja.scrollTop += r.bottom - c.bottom + 8;
      else if (r.top < c.top) caja.scrollTop -= c.top - r.top + 8;
    };

    /* --- Listas dentro de un ítem (las adiciones de un plato) --- */
    const subLista = (ds, crear) => {
      const h = hit();
      if (!h) return null;
      const arr = h.node.props[ds.sub || ds.subAdd || ds.subDel || ds.subMove || ds.subFotos] || [];
      const it = arr[Number(ds.i)];
      if (!it) return null;
      if (!Array.isArray(it[ds.k])) {
        if (!crear) return null;
        it[ds.k] = [];
      }
      return it[ds.k];
    };
    box.querySelectorAll("[data-sub]").forEach((inp) => {
      const aplicar = () => {
        const lista = subLista(inp.dataset, true);
        if (!lista || !lista[Number(inp.dataset.j)]) return;
        lista[Number(inp.dataset.j)][inp.dataset.sk] = inp.value;
        markDirty();
      };
      inp.addEventListener("input", aplicar);
      inp.addEventListener("change", aplicar);
    });
    box.querySelectorAll("[data-sub-add]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        const def = defOf(h.node.type) || {};
        const campo = (def.fields || []).find((x) => x.key === b.dataset.subAdd);
        const sub = ((campo?.itemFields) || []).find((x) => x.key === b.dataset.k);
        const blank = {};
        ((sub?.itemFields) || []).forEach((cf) => { blank[cf.key] = ""; });
        snapshot();
        const lista = subLista(b.dataset, true);
        if (!lista) return;
        lista.push(blank);
        CORE.setOpen(`tree.${h.node.id}.sub.${b.dataset.subAdd}.${b.dataset.i}.${b.dataset.k}`, true);
        markDirty();
        render();
        // Y el cursor en la fila recien creada: se pulsa «Añadir» para
        // escribir, no para buscar donde ha caido.
        const nueva = root.querySelector(
          `[data-sub="${CSS.escape(b.dataset.subAdd)}"][data-i="${CSS.escape(b.dataset.i)}"]`
          + `[data-k="${CSS.escape(b.dataset.k)}"][data-j="${lista.length - 1}"]`
        );
        if (nueva) {
          nueva.focus({ preventScroll: true });
          // `scrollIntoView` mueve TODOS los contenedores de arriba, y eso
          // es justo el salto que molesta. Aqui se empuja a mano lo
          // minimo y solo la caja del arbol: el panel no se entera.
          acercar(nueva);
        }
      };
    });
    box.querySelectorAll("[data-sub-fotos]").forEach((b) => {
      b.onclick = () => {
        if (!window.wp?.media) return;
        const frame = wp.media({ title: "Fotos del plato", multiple: "add", library: { type: "image" } });
        frame.on("select", () => {
          const sel = frame.state().get("selection").toJSON();
          if (!sel.length) return;
          snapshot();
          const lista = subLista(b.dataset, true);
          if (!lista) return;
          sel.forEach((att) => {
            lista.push({
              imageId: att.id,
              imageUrl: att.sizes?.large?.url || att.url || att.sizes?.full?.url || "",
              alt: att.alt || "",
            });
          });
          const h = hit();
          if (h) CORE.setOpen(`tree.${h.node.id}.sub.${b.dataset.subFotos}.${b.dataset.i}.${b.dataset.k}`, true);
          markDirty();
          render();
        });
        frame.open();
      };
    });
    box.querySelectorAll("[data-sub-del]").forEach((b) => {
      b.onclick = () => {
        snapshot();
        const lista = subLista(b.dataset, false);
        if (!lista) return;
        lista.splice(Number(b.dataset.j), 1);
        markDirty();
        render();
      };
    });
    box.querySelectorAll("[data-sub-move]").forEach((b) => {
      b.onclick = () => {
        const lista = subLista(b.dataset, false);
        if (!lista) return;
        const i = Number(b.dataset.j);
        const j = i + Number(b.dataset.dir);
        if (j < 0 || j >= lista.length) return;
        snapshot();
        const t = lista[i];
        lista[i] = lista[j];
        lista[j] = t;
        markDirty();
        render();
      };
    });

    /* --- Plegar y desplegar ramas del árbol --- */
    /* No repinta el inspector: enseña y esconde el cuerpo y lo apunta.
       Repintar desde aquí mataría el campo que se acaba de tocar. */
    box.querySelectorAll("[data-tree-t]").forEach((b) => {
      b.onclick = () => {
        const rama = b.closest(".tree-n");
        if (!rama) return;
        const abierto = !rama.classList.contains("is-open");
        rama.classList.toggle("is-open", abierto);
        b.setAttribute("aria-expanded", abierto ? "true" : "false");
        b.textContent = abierto ? "−" : "+";
        const cuerpo = rama.querySelector(":scope > .tree-b");
        if (cuerpo) cuerpo.hidden = !abierto;
        CORE.setOpen(b.dataset.treeT, abierto);
      };
    });

    box.querySelectorAll("[data-rep-media]").forEach((b) => {
      b.onclick = () => {
        if (!window.wp?.media) return;
        const frame = wp.media({ title: "Añadir imagen", multiple: false });
        frame.on("select", () => {
          const att = frame.state().get("selection").first().toJSON();
          const h = hit();
          if (!h) return;
          snapshot();
          const key = b.dataset.repMedia;
          const arr = h.node.props[key] || [];
          const i = Number(b.dataset.i);
          arr[i] = arr[i] || {};
          arr[i][b.dataset.k] = att.id;
          arr[i].imageUrl = att.url || att.sizes?.large?.url || att.sizes?.full?.url || "";
          h.node.props[key] = arr;
          markDirty();
          render();
        });
        frame.open();
      };
    });
    box.querySelectorAll("[data-rep-media-clear]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        snapshot();
        const arr = h.node.props[b.dataset.repMediaClear] || [];
        const i = Number(b.dataset.i);
        if (arr[i]) {
          arr[i][b.dataset.k] = 0;
          arr[i].imageUrl = "";
        }
        markDirty();
        render();
      };
    });
    box.querySelectorAll("[data-video-media]").forEach((b) => {
      b.onclick = () => {
        if (!window.wp?.media) return;
        const frame = wp.media({
          title: "Subir o elegir video",
          library: { type: "video" },
          multiple: false,
          button: { text: "Usar este video" },
        });
        frame.on("select", () => {
          const att = frame.state().get("selection").first().toJSON();
          const h = hit();
          if (!h) return;
          snapshot();
          h.node.props.source = "upload";
          h.node.props.videoId = att.id;
          h.node.props.videoUrl = att.url || "";
          markDirty();
          render();
        });
        frame.open();
      };
    });
    box.querySelectorAll("[data-video-clear]").forEach((b) => {
      b.onclick = () => {
        const h = hit();
        if (!h) return;
        snapshot();
        h.node.props.videoId = 0;
        h.node.props.videoUrl = "";
        markDirty();
        render();
      };
    });
    box.querySelectorAll("[data-media]").forEach((b) => {
      b.onclick = () => {
        if (!window.wp?.media) return;
        const frame = wp.media({ title: "Seleccionar imagen", multiple: false });
        frame.on("select", () => {
          const att = frame.state().get("selection").first().toJSON();
          const h = hit();
          snapshot();
          h.node.props[b.dataset.media] = att.id;
          if (b.dataset.media === "imageId") h.node.props.imageUrl = att.url || att.sizes?.full?.url || "";
          markDirty();
          render();
        });
        frame.open();
      };
    });
    const galItems = (node) => {
      node.props.items = Array.isArray(node.props.items) ? node.props.items : [];
      return node.props.items;
    };
    const galAtt = (att) => ({
      imageId: att.id,
      imageUrl: att.url || att.sizes?.full?.url || att.sizes?.large?.url || "",
      alt: att.alt || att.title || "",
    });
    const openGal = (multiple, cb) => {
      if (!window.wp?.media) return;
      const frame = wp.media({ title: "Imágenes de la galería", multiple: !!multiple });
      frame.on("select", () => cb(frame.state().get("selection").toJSON()));
      frame.open();
    };
    box.querySelectorAll("[data-gal-add]").forEach((b) => {
      b.onclick = () => openGal(false, (sel) => {
        const h = hit(); if (!h) return;
        snapshot();
        sel.forEach((att) => galItems(h.node).push(galAtt(att)));
        markDirty(); render();
      });
    });
    box.querySelectorAll("[data-gal-add-many]").forEach((b) => {
      b.onclick = () => openGal(true, (sel) => {
        const h = hit(); if (!h) return;
        snapshot();
        sel.forEach((att) => galItems(h.node).push(galAtt(att)));
        markDirty(); render();
      });
    });
    box.querySelectorAll("[data-gal-set]").forEach((b) => {
      b.onclick = () => openGal(false, (sel) => {
        const h = hit(); if (!h || !sel[0]) return;
        snapshot();
        const items = galItems(h.node);
        items[Number(b.dataset.galSet)] = galAtt(sel[0]);
        markDirty(); render();
      });
    });
    box.querySelectorAll("[data-gal-del]").forEach((b) => {
      b.onclick = () => {
        const h = hit(); if (!h) return;
        snapshot();
        galItems(h.node).splice(Number(b.dataset.galDel), 1);
        markDirty(); render();
      };
    });
    box.querySelectorAll("[data-gal-up],[data-gal-down]").forEach((b) => {
      b.onclick = () => {
        const h = hit(); if (!h) return;
        const items = galItems(h.node);
        const i = Number(b.dataset.galUp != null ? b.dataset.galUp : b.dataset.galDown);
        const j = b.dataset.galUp != null ? i - 1 : i + 1;
        if (j < 0 || j >= items.length) return;
        snapshot();
        const [it] = items.splice(i, 1);
        items.splice(j, 0, it);
        markDirty(); render();
      };
    });
    box.querySelectorAll("[data-gal-alt]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const h = hit(); if (!h) return;
        const items = galItems(h.node);
        const it = items[Number(inp.dataset.galAlt)];
        if (it) it.alt = inp.value;
        markDirty();
      });
    });
    box.querySelectorAll("[data-unlink]").forEach((b) => {
      b.onclick = () => unlinkNode(b.dataset.unlink);
    });
    box.querySelectorAll("[data-color-picker]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const key = inp.dataset.colorPicker;
        const custom = box.querySelector(`[data-color-custom="${key}"]`);
        const mode = box.querySelector(`[data-color-mode="${key}"]`);
        if (custom) custom.value = inp.value;
        if (mode) mode.value = "custom";
        custom?.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    window.KrgUi?.wire(box);
  }

    return {
      CORE: CORE,
      KIND_LABEL: KIND_LABEL,
      kindOf: kindOf,
      bindInspector: bindInspector,
      fieldHtml: fieldHtml,
      fieldControl: fieldControl,
      firstLeafColumn: firstLeafColumn,
      instantiateLayout: instantiateLayout,
      makeColumn: makeColumn,
      makeRow: makeRow,
      openLayoutPicker: openLayoutPicker,
      applyLayout: applyLayout,
      buildFromSchema: buildFromSchema,
      diagnosticar: diagnosticar,
      TEXT_TYPES: TEXT_TYPES,
      LAYOUT_TYPES: LAYOUT_TYPES,
      ALL_LAYOUTS: ALL_LAYOUTS,
      AVANZADO: AVANZADO,
      CAJA: CAJA,
    };
  };
})();
