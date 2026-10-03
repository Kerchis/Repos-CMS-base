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

  /** Un grupo: cabecera pulsable y cuerpo que se pliega. */
  function grupo(id, label, html, abierto, hint) {
    if (!html) return "";
    return `<section class="acc b-group${abierto ? " is-open" : ""}" data-acc="${esc(id)}">
      <button type="button" class="acc-h" data-acc-t="${esc(id)}" aria-expanded="${abierto ? "true" : "false"}">
        <span class="acc-t">${esc(label)}</span>
        <span class="acc-x" aria-hidden="true"></span>
      </button>
      <div class="acc-b"${abierto ? "" : " hidden"}>
        ${hint ? `<p class="m-muted">${esc(hint)}</p>` : ""}
        ${html}
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

    const tabsHtml = `<div class="b-tabs" role="tablist">${TABS.map(([v, l]) => {
      const vacia = !(esquema[v] || []).length;
      return `<button type="button" role="tab" data-insp-tab="${v}" class="${tab === v ? "is-on" : ""}"${vacia ? " disabled" : ""}>${l}</button>`;
    }).join("")}</div>`;

    const cuerpo = grupos(esquema[tab], ctx)
      || `<div class="b-empty">Este elemento no tiene ajustes de ${esc((TABS.find((t) => t[0] === tab) || [])[1] || tab).toLowerCase()}.</div>`;

    return `${paginaHtml}${cabecera}${tabsHtml}<div class="b-groups">${cuerpo}</div>`;
  }

  /**
   * Abrir y cerrar grupos.
   *
   * No repinta nada: cambia el atributo `hidden` y lo apunta. Repintar
   * desde aqui mataria el control en el que el usuario acaba de pulsar.
   */
  function bindGroups(root) {
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

  window.KrgBuilderCore = {
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
