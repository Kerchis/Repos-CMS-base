(() => {
  const cfg = window.KrgAdmin || {};
  const api = window.MApi;
  const root = document.getElementById("krg-builder");
  if (!root || !api) return;

  const id = Number(cfg.pageId || 0);
  if (!id) {
    root.innerHTML = `<p style="padding:24px">Falta el id de página. <a href="${cfg.admin}?page=krg-pages">Volver</a></p>`;
    return;
  }

  const state = {
    doc: null,
    registry: [],
    templates: [],
    globals: [],
    revisions: [],
    pages: [],
    menus: [],
    selected: null,
    bp: "desktop",
    viewW: 1280,
    viewH: 800,
    fit: false,
    save: "Guardado",
    styleWarn: "",
    dirty: false,
    dirtyGen: 0,
    saving: false,
    saveQueued: false,
    saveTries: 0,
    timer: null,
    drawer: null,
    undo: [],
    redo: [],
    shell: false,
    inspTab: "content",
    widths: { desktop: 1280, tablet: 768, mobile: 390 },
    // Ramas plegadas del árbol de estructura. Es estado de interfaz, no
    // del documento: no se guarda ni ensucia la página.
    treeClosed: new Set(),
  };
  // Asa de solo lectura sobre el estado. La usan el diagnostico de
  // estilos y los bancos de pruebas para mirar el documento que el
  // constructor tiene cargado de verdad, no el que creen que tiene.
  // No se escribe nunca desde fuera.
  window.KrgBuilderState = state;
  const PRESETS = {
    desktop: { w: 1280, h: 800 },
    tablet: { w: 768, h: 1024 },
    mobile: { w: 390, h: 844 },
  };

  const uid = () => {
    try {
      if (globalThis.crypto && typeof crypto.randomUUID === "function") {
        return "n_" + crypto.randomUUID();
      }
    } catch (e) { /* HTTP / contexto no seguro */ }
    return "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };
  const defOf = (slug) => state.registry.find((c) => c.slug === slug);
  function findNode(list, nid, parent = null) {
    for (let i = 0; i < (list || []).length; i++) {
      const n = list[i];
      if (n.id === nid) return { node: n, parent, index: i, list };
      const hit = findNode(n.children || [], nid, n);
      if (hit) return hit;
    }
    return null;
  }

  function makeNode(type) {
    const def = defOf(type) || {};
    return {
      id: uid(),
      type,
      name: def.name || type,
      visible: true,
      source: "local",
      globalId: 0,
      props: structuredClone(def.defaults || {}),
      styles: { desktop: {}, tablet: {}, mobile: {} },
      children: def.children ? [] : [],
    };
  }
  // El árbol de estructura, la paleta y las operaciones sobre nodos
  // (mover, duplicar, ocultar, borrar, arrastrar y soltar) también son
  // del inspector compartido: la pantalla de navegación usa los mismos.
  const tree = (...a) => FIELDS.tree(...a);
  const bindTree = (...a) => FIELDS.bindTree(...a);
  const palette = (...a) => FIELDS.palette(...a);
  const addComponent = (...a) => FIELDS.addComponent(...a);
  const insertCloned = (...a) => FIELDS.insertCloned(...a);
  const cloneNode = (...a) => FIELDS.cloneNode(...a);
  const moveNode = (...a) => FIELDS.moveNode(...a);
  const shiftAcrossColumns = (...a) => FIELDS.shiftAcrossColumns(...a);
  const duplicateNode = (...a) => FIELDS.duplicateNode(...a);
  const hideNode = (...a) => FIELDS.hideNode(...a);
  const deleteNode = (...a) => FIELDS.deleteNode(...a);
  const saveTemplate = (...a) => FIELDS.saveTemplate(...a);
  const saveGlobal = (...a) => FIELDS.saveGlobal(...a);

  function toast(t) {
    const n = document.createElement("div");
    n.className = "m-toast";
    n.textContent = t;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function snapshot() {
    if (!state.doc) return;
    state.undo.push(JSON.stringify({
      sections: state.doc.sections,
      title: state.doc.title,
      slug: state.doc.slug,
      seo: state.doc.seo,
      parentId: state.doc.parentId,
      settings: state.doc.settings,
    }));
    if (state.undo.length > 50) state.undo.shift();
    state.redo = [];
  }

  function applySnap(raw) {
    const s = JSON.parse(raw);
    state.doc.sections = s.sections;
    state.doc.title = s.title;
    state.doc.slug = s.slug;
    state.doc.seo = s.seo;
    state.doc.parentId = s.parentId;
    state.doc.settings = s.settings;
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(JSON.stringify({
      sections: state.doc.sections,
      title: state.doc.title,
      slug: state.doc.slug,
      seo: state.doc.seo,
      parentId: state.doc.parentId,
      settings: state.doc.settings,
    }));
    applySnap(state.undo.pop());
    markDirty({ history: false });
    render();
  }

  function redo() {
    if (!state.redo.length) return;
    snapshot();
    applySnap(state.redo.pop());
    markDirty({ history: false });
    render();
  }

  function markDirty(opts = {}) {
    if (opts.history !== false && opts.snap) snapshot();
    state.dirty = true;
    state.dirtyGen = (state.dirtyGen || 0) + 1;
    state.save = "Sin guardar";
    paintStatus();
    paintLiveCss();
    clearTimeout(state.timer);
    state.timer = setTimeout(saveDraft, 1200);
  }

  /** Valor CSS de un campo de color del panel: hex, var(--x) o nada. */
  // Color, caja y propiedades: una sola copia, en el núcleo, que usan
  // también la pantalla de navegación y el inspector compartido.
  const cssColor = (v) => window.KrgBuilderCore.cssColor(v);

  const CAJA_PROPS = window.KrgBuilderCore.CAJA_PROPS;
  const cssCaja = (styles) => window.KrgBuilderCore.cssCaja(styles);
  // La vista viva de los nodos (estilos de caja, colores, filas,
  // columnas, secciones y el texto que se va escribiendo) la pinta el
  // inspector compartido: es la misma en páginas y en navegación.
  const paintLiveCss = () => FIELDS.paintLiveCss();

  function treeSig(nodes) {
    return (nodes || []).map((n) => (n.id || "") + ":" + (n.type || "") + "[" + treeSig(n.children) + "]").join(",");
  }

  // El servidor devuelve el documento tal y como ha quedado guardado, ya
  // pasado por el saneador. Hasta ahora solo se aprovechaban la firma y la
  // URL de previsualizacion, asi que el editor seguia trabajando con una
  // version que ya no existia en la base de datos: si el servidor recortaba
  // o descartaba algo, el lienzo lo seguia pintando igual —paintLiveCss lo
  // vuelve a aplicar encima del marcado del servidor— y la diferencia solo
  // salia a la luz al abrir «Preview». Adoptar la respuesta hace que el
  // constructor muestre siempre lo que de verdad se ha guardado.
  function adoptSaved(saved) {
    if (!saved || !Array.isArray(saved.sections) || !state.doc) return false;
    const antes = JSON.stringify(state.doc.sections);
    const urls = { previewUrl: state.doc.previewUrl, publicUrl: state.doc.publicUrl };
    state.doc = window.KrgBuilderCore.adoptDoc(Object.assign({}, saved));
    if (!state.doc.previewUrl) state.doc.previewUrl = urls.previewUrl;
    if (!state.doc.publicUrl) state.doc.publicUrl = urls.publicUrl;
    const cambio = antes !== JSON.stringify(state.doc.sections);
    // Repintar solo si no se esta escribiendo: reconstruir el inspector con
    // el foco dentro de un campo le roba el cursor a quien escribe.
    const foco = document.activeElement;
    const escribiendo = foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName) && root.contains(foco);
    if (cambio && !escribiendo) render();
    return cambio;
  }

  /**
   * Mapa id de nodo → estilos, para comparar lo enviado con lo devuelto.
   */
  function mapaEstilos(secciones) {
    const out = {};
    const walk = (list) => (list || []).forEach((n) => {
      if (n && n.id) out[n.id] = n.styles || {};
      walk(n?.children);
    });
    walk(secciones);
    return out;
  }

  /**
   * ¿El servidor devolvió algún estilo menos de los que le mandamos?
   *
   * Un ajuste que se escribe en el panel, se guarda sin error y al recargar
   * aparece vacío no deja rastro en ningún sitio: parece que el campo «no
   * funciona». Esto lo convierte en un aviso con nombre y apellidos. Pasa
   * si hay una copia antigua del tema, un plugin que filtra la petición o
   * un saneador que no conoce esa propiedad.
   */
  function estilosDescartados(enviado, devuelto) {
    const a = mapaEstilos(enviado);
    const b = mapaEstilos(devuelto);
    const perdidos = [];
    Object.keys(a).forEach((id) => {
      if (!(id in b)) return;
      ["desktop", "tablet", "mobile"].forEach((bp) => {
        const antes = a[id]?.[bp] || {};
        const ahora = b[id]?.[bp] || {};
        Object.keys(antes).forEach((prop) => {
          if (antes[prop] && !ahora[prop]) perdidos.push(prop);
        });
      });
    });
    return [...new Set(perdidos)];
  }

  async function saveDraft() {
    if (!state.doc) return;
    if (state.saving) {
      state.saveQueued = true;
      return;
    }
    state.saving = true;
    state.saveQueued = false;
    const gen = state.dirtyGen;
    state.save = "Guardando…";
    paintStatus();
    try {
      const payload = JSON.parse(JSON.stringify(state.doc));
      delete payload.previewUrl;
      delete payload.publicUrl;
      if (!Array.isArray(payload.sections)) payload.sections = [];
      let saved;
      try {
        saved = await api.post(`/pages/${id}/save`, payload);
      } catch (err) {
        if (err.status === 404 || err.status === 405) {
          saved = await api.post(`/pages/${id}`, payload);
        } else {
          throw err;
        }
      }
      const perdidos = estilosDescartados(payload.sections, saved?.sections);
      if (perdidos.length) {
        state.styleWarn = `El servidor descartó: ${perdidos.join(", ")}. Puede haber una copia antigua del tema o un plugin filtrando el guardado.`;
        console.warn("[KRG] estilos descartados al guardar:", perdidos);
      } else {
        state.styleWarn = "";
      }
      if (saved?.checksum) state.doc.checksum = saved.checksum;
      if (saved?.previewUrl) state.doc.previewUrl = saved.previewUrl;
      if (state.dirtyGen === gen) {
        // El lienzo solo repintaba el CSS en vivo: los cambios de contenido
        // no se veian hasta recargar a mano. Tras guardar se refresca el
        // marco, conservando el scroll y la seleccion.
        clearTimeout(state.frameTimer);
        state.frameTimer = setTimeout(function () {
          if (!state.dirty && !state.saving) reloadFrame();
        }, 250);
        state.dirty = false;
        state.saveTries = 0;
        state.save = "Guardado (borrador)";
        adoptSaved(saved);
        const sig = treeSig(state.doc.sections);
        if (state.frameSig && sig !== state.frameSig) {
          state.frameSig = sig;
          reloadFrame({ keepView: true });
        } else {
          state.frameSig = sig;
          paintLiveCss();
        }
      } else {
        state.save = "Sin guardar";
        state.saveQueued = true;
      }
    } catch (e) {
      state.saveTries = 0;
      state.save = "Error al guardar";
      toast((e.message || "No se pudo guardar") + ". El trabajo sigue aquí; no recargues la página.");
    }
    state.saving = false;
    paintStatus();
    if (state.saveQueued) {
      state.saveQueued = false;
      saveDraft();
    }
  }

  function paintStatus() {
    const s = root.querySelector(".b-status");
    if (s) s.textContent = state.save;
    const w = root.querySelector(".b-warn");
    if (w) {
      w.textContent = state.styleWarn || "";
      w.hidden = !state.styleWarn;
    }
  }

  function frameScrollSnap(iframe) {
    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      return {
        y: win?.scrollY || doc?.documentElement?.scrollTop || 0,
        id: state.selected || "",
      };
    } catch (e) {
      return { y: 0, id: state.selected || "" };
    }
  }
  function restoreFrameView(iframe, snap) {
    const win = iframe?.contentWindow;
    const doc = iframe?.contentDocument;
    if (!win || !doc || !snap) return;
    const go = () => {
      const id = snap.id || state.selected;
      if (id) {
        const el = doc.querySelector(`[data-krg-id="${id}"]`) || doc.querySelector(`.m-n-${id}`);
        if (el) {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
          return;
        }
      }
      win.scrollTo(0, snap.y || 0);
    };
    go();
    requestAnimationFrame(go);
    setTimeout(go, 80);
  }
  // El lienzo pide la pagina marcada como lienzo. Con esa marca el
  // renderizador imprime las secciones todavia vacias para que se puedan
  // seleccionar y soltarles contenido; sin ella —web publica y pestana
  // «Preview»— no se imprimen y no ocupan nada.
  function canvasUrl(url) {
    return url + (url.includes("?") ? "&" : "?") + "krgcms_canvas=1";
  }
  function reloadFrame(opts = {}) {
    const iframe = root.querySelector("iframe");
    if (!iframe || !state.doc.previewUrl) return;
    if (opts.keepView !== false) state.frameSnap = frameScrollSnap(iframe);
    iframe.src = canvasUrl(state.doc.previewUrl) + "&t=" + Date.now();
  }

  function unlinkNode(nid) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit) return;
    snapshot();
    hit.node.source = "local";
    hit.node.globalId = 0;
    markDirty();
    render();
    toast("Desvinculado. Los cambios ya no afectan otras páginas.");
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  const FIELDS = window.KrgFields({
    state: state,
    root: root,
    cfg: cfg,
    api: api,
    id: id,
    esc: (s) => esc(s),
    cssColor: (v) => cssColor(v),
    defOf: (s) => defOf(s),
    findNode: (list, nid, parent) => findNode(list, nid, parent),
    makeNode: (t) => makeNode(t),
    markDirty: (o) => markDirty(o),
    // (la vista viva de los nodos ya la pinta el propio compartido)
    pingFrame: () => pingFrame(),
    render: (o) => render(o),
    applyBp: () => applyBp(),
    snapshot: () => snapshot(),
    toast: (t) => toast(t),
    tree: () => tree(),
    unlinkNode: (nid) => unlinkNode(nid),
  });
  const CORE = FIELDS.CORE;
  const KIND_LABEL = FIELDS.KIND_LABEL;
  const kindOf = FIELDS.kindOf;
  const bindInspector = FIELDS.bindInspector;
  const firstLeafColumn = FIELDS.firstLeafColumn;
  const instantiateLayout = FIELDS.instantiateLayout;
  const makeColumn = FIELDS.makeColumn;
  const makeRow = FIELDS.makeRow;
  const openLayoutPicker = FIELDS.openLayoutPicker;

  /**
   * El inspector: un solo camino para todos los elementos.
   *
   * Monta el contexto y se lo pasa al nucleo, que pinta la cabecera del
   * elemento, las tres pestañas y los grupos del esquema.
   */
  function inspector() {
    const pagina = { label: "Configuración de página", html: pageFields() };
    if (!state.selected) {
      return window.KrgBuilderCore.render({ page: pagina, tab: state.inspTab || "content" });
    }
    const hit = findNode(state.doc.sections, state.selected);
    if (!hit) return `<div class="b-empty">Elemento no encontrado.</div>`;
    const node = hit.node;
    const def = defOf(node.type) || { name: node.type, fields: [] };
    const kind = kindOf(node);
    return window.KrgBuilderCore.render({
      page: pagina,
      kind: kind,
      type: node.type,
      kindLabel: KIND_LABEL[kind] || "Módulo",
      // El nombre que se lee. Un documento viejo puede traer el nombre
      // interno igual al tipo («statement-cta»); en ese caso manda el
      // nombre del catalogo, que es el que la persona reconoce.
      title: node.name && node.name !== node.type ? node.name : (def.name || node.type),
      subtitle: def.name && node.name && node.name !== def.name && node.name !== node.type ? def.name : "",
      tab: state.inspTab || "content",
      schema: def.inspector || null,
      node: node,
      def: def,
      bp: state.bp,
      st: node.styles?.[state.bp] || {},
    });
  }

  function pageFields() {
    const pages = state.pages.filter((p) => p.id !== id);
    return `
      <label>Nombre <input data-page="title" value="${esc(state.doc.title || "")}"></label>
      <label>Slug <input data-page="slug" value="${esc(state.doc.slug || "")}"></label>
      <label>Página padre <select data-page-num="parentId">
        <option value="0">— Ninguna —</option>
        ${pages.map((p) => `<option value="${p.id}" ${Number(state.doc.parentId) === p.id ? "selected" : ""}>${esc(p.title)}</option>`).join("")}
      </select></label>
      <label>Mostrar header <input type="checkbox" data-set="showHeader" ${state.doc.settings?.showHeader !== false ? "checked" : ""}></label>
      <label>Menú del header
        <select data-set-str="headerMenu">
          <option value="">El menú por defecto (constructor visual)</option>
          ${(state.menus || []).map((m) => `<option value="${esc(m.slug)}" ${(state.doc.settings?.headerMenu || "") === m.slug ? "selected" : ""}>${esc(m.name || m.slug)}</option>`).join("")}
        </select>
      </label>
      <label>Mostrar footer <input type="checkbox" data-set="showFooter" ${state.doc.settings?.showFooter !== false ? "checked" : ""}></label>
      <label>Título SEO <input data-seo="title" value="${esc(state.doc.seo?.title || "")}"></label>
      <label>Meta description <textarea data-seo="description">${esc(state.doc.seo?.description || "")}</textarea></label>
      <label>Canonical <input data-seo="canonical" value="${esc(state.doc.seo?.canonical || "")}"></label>
      <label>Título Open Graph <input data-seo="ogTitle" value="${esc(state.doc.seo?.ogTitle || "")}"></label>
      <label>Descripción Open Graph <textarea data-seo="ogDescription">${esc(state.doc.seo?.ogDescription || "")}</textarea></label>
      <label>Robots
        <select data-seo="robots">
          ${["index,follow","noindex,follow","index,nofollow","noindex,nofollow"].map((o) =>
            `<option value="${o}" ${(state.doc.seo?.robots || "index,follow") === o ? "selected" : ""}>${o}</option>`
          ).join("")}
        </select>
      </label>
      <label>Imagen Open Graph (ID) <input data-seo="ogImageId" type="number" value="${state.doc.seo?.ogImageId || 0}">
        <button type="button" class="m-btn ghost" data-seo-media="ogImageId">Elegir imagen OG</button></label>
    `;
  }

  function leftHtml() {
    return `
      <div class="b-sec"><h4>Agregar</h4>
        <div class="b-palette">
          <button data-add="section">+ Sección</button>
          <button type="button" id="open-lib">Biblioteca</button>
        </div>
      </div>
      ${palette()}
      ${tree()}`;
  }

  function bindLeftAndTop() {
    // La paleta y el árbol los ata el compartido; aquí sólo queda lo
    // que es de esta pantalla.
    FIELDS.bindLeft();
    const lib = root.querySelector("#open-lib");
    if (lib) lib.onclick = openLibrary;
  }
  // Los paneles plegables (tiradores, botones «Estructura» y «Ajustes»,
  // raíles para volver a abrirlos) y el recuerdo de dónde estabas al
  // repintar: compartidos con la pantalla de navegación.
  const bindSplit = () => FIELDS.bindSplit();
  const panelSnap = () => FIELDS.panelSnap();
  const panelRestore = (s) => FIELDS.panelRestore(s);

  function bindTop() {
    root.querySelectorAll("[data-bp]").forEach((b) => {
      b.onclick = () => {
        state.bp = b.dataset.bp;
        const p = PRESETS[state.bp];
        if (p) { state.viewW = p.w; state.viewH = p.h; }
        render();
      };
    });
    const pub = root.querySelector("#publish");
    if (pub) pub.onclick = async () => {
      clearTimeout(state.timer);
      while (state.saving) await new Promise((r) => setTimeout(r, 60));
      await saveDraft();
      if (state.save === "Error al guardar") {
        toast("No se pudo guardar el borrador. No se publicó.");
        return;
      }
      try {
        await api.post(`/pages/${id}/publish`, {});
        toast("Publicado. Ya se ve en la web.");
        state.save = "Publicado";
        paintStatus();
        reloadFrame();
      } catch (e) {
        toast(e.message);
      }
    };
    const sav = root.querySelector("#save");
    if (sav) sav.onclick = () => saveDraft();
    // Red de seguridad: recarga el lienzo a mano, por si algo queda atrás.
    const rfr = root.querySelector("#refresh");
    if (rfr) {
      rfr.onclick = async () => {
        if (state.dirty) await saveDraft();
        reloadFrame();
      };
    }
    const prev = root.querySelector("#preview");
    if (prev) {
      // Abria la pagina sin guardar antes, asi que mostraba el ultimo
      // borrador grabado y no lo que acabas de tocar. Y al repetir la misma
      // URL el navegador reutilizaba la pestana cacheada. Ahora se guarda
      // primero y se anade una marca de tiempo para forzar una carga limpia.
      prev.onclick = async () => {
        prev.disabled = true;
        try {
          if (state.dirty || state.saving) await saveDraft();
          const url = state.doc.previewUrl + (state.doc.previewUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
          window.open(url, "krg-preview");
        } finally {
          prev.disabled = false;
        }
      };
    }
    bindSplit();
    const hist = root.querySelector("#history");
    if (hist) hist.onclick = openHistory;
    const und = root.querySelector("#undo");
    if (und) und.onclick = undo;
    const red = root.querySelector("#redo");
    if (red) red.onclick = redo;
  }

  async function openHistory() {
    try {
      state.revisions = await api.get(`/pages/${id}/revisions`);
    } catch (e) {
      toast(e.message);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "confirm";
    wrap.innerHTML = `<div class="box" style="width:min(520px,92vw);max-height:80vh;overflow:auto">
      <h3>Historial</h3>
      <p class="m-muted">Restaurar escribe sobre el borrador. Luego puedes publicar.</p>
      <ul class="b-rev">
        ${(state.revisions || []).map((r) => `<li>
          <span>${esc(r.createdAt)} · ${esc(r.origin)} · ${esc(r.author)}</span>
          <button class="m-btn ghost" data-rid="${r.id}">Restaurar</button>
        </li>`).join("") || "<li>Sin revisiones</li>"}
      </ul>
      <button class="m-btn ghost" id="close">Cerrar</button>
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#close").onclick = () => wrap.remove();
    wrap.querySelectorAll("[data-rid]").forEach((b) => {
      b.onclick = async () => {
        try {
          const doc = await api.post(`/pages/${id}/revisions/${b.dataset.rid}/restore`, {});
          state.doc = window.KrgBuilderCore.adoptDoc(doc);
          state.selected = null;
          wrap.remove();
          render();
          reloadFrame();
          toast("Revisión restaurada en el borrador");
        } catch (e) {
          toast(e.message);
        }
      };
    });
  }

  function openLibrary() {
    const wrap = document.createElement("div");
    wrap.className = "confirm";
    wrap.innerHTML = `<div class="box" style="width:min(560px,92vw);max-height:80vh;overflow:auto">
      <h3>Biblioteca</h3>
      <h4>Plantillas</h4>
      <ul class="b-rev">
        ${(state.templates || []).map((t) => `<li><span>${esc(t.name)}</span>
          <button class="m-btn" data-tpl="${t.id}">Insertar</button></li>`).join("") || "<li>Ninguna. Guarda una sección con ☆.</li>"}
      </ul>
      <h4>Globales</h4>
      <ul class="b-rev">
        ${(state.globals || []).map((t) => `<li><span>${esc(t.name)}</span>
          <button class="m-btn" data-g="${t.id}">Insertar instancia</button></li>`).join("") || "<li>Ninguno. Usa G en el árbol.</li>"}
      </ul>
      <button class="m-btn ghost" id="close">Cerrar</button>
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#close").onclick = () => wrap.remove();
    wrap.querySelectorAll("[data-tpl]").forEach((b) => {
      b.onclick = () => {
        const t = state.templates.find((x) => String(x.id) === String(b.dataset.tpl));
        if (t?.node) insertCloned(t.node);
        wrap.remove();
      };
    });
    wrap.querySelectorAll("[data-g]").forEach((b) => {
      b.onclick = () => {
        const g = state.globals.find((x) => String(x.id) === String(b.dataset.g));
        if (!g?.node) return;
        const inst = cloneNode(g.node);
        inst.source = "global";
        inst.globalId = g.id;
        insertCloned(inst);
        wrap.remove();
      };
    });
  }

  function pingFrame() {
    const iframe = root.querySelector("iframe");
    iframe?.contentWindow?.postMessage({ source: "krg-parent", type: "select", id: state.selected }, "*");
  }

  function ensureShell() {
    if (state.shell) return;
    root.innerHTML = `
      <div class="b-root">
        <div class="b-top">
          <a href="${cfg.admin}?page=krg" title="Volver a KRG CMS">←</a>
          <a href="${cfg.admin}?page=krg-pages">Páginas</a>
          <strong class="b-pagetitle">${esc(state.doc.title)}</strong>
          <div class="b-bp">
            <button type="button" data-bp="desktop" class="${state.bp === "desktop" ? "is-on" : ""}">Desktop</button>
            <button type="button" data-bp="tablet" class="${state.bp === "tablet" ? "is-on" : ""}">Tablet</button>
            <button type="button" data-bp="mobile" class="${state.bp === "mobile" ? "is-on" : ""}">Mobile</button>
          </div>
          <div class="b-device">
            <input type="number" data-view-w min="320" max="2560" value="${state.viewW}" title="Ancho">
            <span>×</span>
            <input type="number" data-view-h min="400" max="2400" value="${state.viewH}" title="Alto">
            <label class="b-fit"><input type="checkbox" data-fit> Ajustar</label>
          </div>
          <span class="b-bp-label"></span>
          <span class="grow"></span>
          <button class="m-btn ghost" id="undo" title="Ctrl+Z">Deshacer</button>
          <button class="m-btn ghost" id="redo" title="Ctrl+Y">Rehacer</button>
          <button class="m-btn ghost" data-panel="left" title="Esconder o enseñar la estructura">Estructura</button>
          <button class="m-btn ghost" data-panel="right" title="Esconder o enseñar los ajustes">Ajustes</button>
          <button class="m-btn ghost" id="history">Historial</button>
          <span class="b-status">${esc(state.save)}</span>
          <span class="b-warn" hidden></span>
          <button class="m-btn ghost" id="refresh" title="Vuelve a cargar la vista del lienzo">Actualizar vista</button>
          <button class="m-btn ghost" id="save" title="Ctrl+S">Guardar</button>
          <button class="m-btn ghost" id="preview">Preview</button>
          <button class="m-btn" id="publish">Publicar</button>
        </div>
        <div class="b-layout">
          <aside class="b-left"></aside>
          <div class="b-split" data-split="left" title="Arrastra para ensanchar"><button type="button" class="b-split-t" data-panel="left" title="Esconder la estructura">‹</button></div>
          <button type="button" class="b-show" data-show="left" title="Mostrar la estructura" hidden>Estructura ›</button>
          <div class="b-canvas">
            <div class="b-frame-slot">
              <div class="b-frame-wrap">
                <iframe src="${esc(state.doc.previewUrl ? canvasUrl(state.doc.previewUrl) : "about:blank")}"></iframe>
                <div class="b-rz b-rz-e" data-rz="e" title="Arrastra el ancho"></div>
                <div class="b-rz b-rz-s" data-rz="s" title="Arrastra el alto"></div>
                <div class="b-rz b-rz-se" data-rz="se" title="Arrastra el tamaño"></div>
              </div>
            </div>
          </div>
          <div class="b-split" data-split="right" title="Arrastra para ensanchar"><button type="button" class="b-split-t" data-panel="right" title="Esconder los ajustes">›</button></div>
          <aside class="b-right b-insp"></aside>
          <button type="button" class="b-show" data-show="right" title="Mostrar los ajustes" hidden>‹ Ajustes</button>
        </div>
      </div>`;
    state.shell = true;
    bindTop();
    bindDevice();
    root.querySelector("iframe")?.addEventListener("load", () => {
      state.frameSig = treeSig(state.doc?.sections);
      paintLiveCss();
      applyBp();
      restoreFrameView(root.querySelector("iframe"), state.frameSnap);
    });
    window.addEventListener("resize", applyBp);
  }

  function bpFromWidth(w) {
    if (w <= 480) return "mobile";
    if (w <= 900) return "tablet";
    return "desktop";
  }

  function applyBp() {
    const canvas = root.querySelector(".b-canvas");
    const slot = root.querySelector(".b-frame-slot");
    const wrap = root.querySelector(".b-frame-wrap");
    const iframe = root.querySelector("iframe");
    const label = root.querySelector(".b-bp-label");
    if (!canvas || !slot || !wrap) return;
    const w = Math.max(320, Math.min(2560, Number(state.viewW) || 1280));
    const h = Math.max(400, Math.min(2400, Number(state.viewH) || 800));
    state.viewW = w;
    state.viewH = h;
    const availW = Math.max(280, canvas.clientWidth - 32);
    const availH = Math.max(320, canvas.clientHeight - 24);
    const scale = state.fit ? Math.min(1, availW / w, availH / h) : 1;
    wrap.style.width = w + "px";
    wrap.style.height = h + "px";
    wrap.style.transform = scale < 0.999 ? `scale(${scale})` : "none";
    if (iframe) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    }
    slot.style.width = Math.round(w * scale) + "px";
    slot.style.height = Math.round(h * scale) + "px";
    const iw = root.querySelector("[data-view-w]");
    const ih = root.querySelector("[data-view-h]");
    if (iw && document.activeElement !== iw) iw.value = String(w);
    if (ih && document.activeElement !== ih) ih.value = String(h);
    if (label) label.textContent = `${w} × ${h}`;
    root.querySelectorAll("[data-bp]").forEach((b) => b.classList.toggle("is-on", b.dataset.bp === state.bp));
  }

  function bindDevice() {
    const onW = (inp) => inp.addEventListener("input", () => {
      state.viewW = Number(inp.value) || state.viewW;
      state.bp = bpFromWidth(state.viewW);
      applyBp();
    });
    const onH = (inp) => inp.addEventListener("input", () => {
      state.viewH = Number(inp.value) || state.viewH;
      applyBp();
    });
    root.querySelectorAll("[data-view-w]").forEach(onW);
    root.querySelectorAll("[data-view-h]").forEach(onH);
    root.querySelectorAll("[data-fit]").forEach((inp) => {
      inp.checked = !!state.fit;
      inp.addEventListener("change", () => { state.fit = inp.checked; applyBp(); });
    });
    root.querySelectorAll("[data-rz]").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = state.viewW;
        const startH = state.viewH;
        const kind = handle.dataset.rz;
        const move = (ev) => {
          if (kind === "e" || kind === "se") state.viewW = Math.max(320, Math.min(2560, Math.round(startW + (ev.clientX - startX))));
          if (kind === "s" || kind === "se") state.viewH = Math.max(400, Math.min(2400, Math.round(startH + (ev.clientY - startY))));
          state.bp = bpFromWidth(state.viewW);
          applyBp();
        };
        const up = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
      });
    });
  }

  function render() {
    const snap = panelSnap();
    ensureShell();
    root.querySelectorAll("[data-bp]").forEach((b) => b.classList.toggle("is-on", b.dataset.bp === state.bp));
    applyBp();
    root.querySelector(".b-left").innerHTML = leftHtml();
    root.querySelector(".b-insp").innerHTML = inspector();
    const t = root.querySelector(".b-pagetitle");
    if (t) t.textContent = state.doc.title || "";
    paintStatus();
    bindLeftAndTop();
    bindInspector();
    paintLiveCss();
    panelRestore(snap);
  }

  function onMsg(e) {
    const d = e.data;
    if (!d || d.source !== "krg") return;
    if (d.type === "select" && d.id) {
      state.selected = d.id;
      render();
      return;
    }
    // El lienzo avisa de las secciones de alto exacto cuyo contenido no cabe.
    if (d.type === "fit" && Array.isArray(d.items)) {
      const next = {};
      d.items.forEach((it) => { next[it.id] = it; });
      const before = JSON.stringify(state.fitWarn || {});
      state.fitWarn = next;
      // Solo se repinta si cambia el aviso de la seccion que estas editando.
      const sel = state.selected;
      if (before !== JSON.stringify(next) && sel && (next[sel] || JSON.parse(before)[sel])) render();
    }
  }

  window.addEventListener("message", onMsg);
  window.addEventListener("keydown", (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      redo();
    } else if (meta && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveDraft();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.dirty) saveDraft();
  });

  Promise.all([
    api.get(`/pages/${id}`),
    api.get("/registry"),
    api.get("/templates"),
    api.get("/globals"),
    api.get("/pages"),
    api.get("/tokens").catch(() => ({})),
    api.get("/menus").catch(() => []),
  ])
    .then(([doc, registry, templates, globals, pages, tokens, menus]) => {
      state.doc = window.KrgBuilderCore.adoptDoc(doc);
      state.registry = registry;
      state.templates = templates;
      state.globals = globals;
      state.pages = pages;
      state.menus = Array.isArray(menus) ? menus : [];
      window.KrgUi?.setTokens(tokens);
      render();
    })
    .catch((e) => {
      root.innerHTML = `<p style="padding:24px">${esc(e.message)}</p>`;
    });
})();
