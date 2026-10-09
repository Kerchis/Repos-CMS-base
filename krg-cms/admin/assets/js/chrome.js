(() => {
  const cfg = window.KrgAdmin || {};
  const api = window.MApi;
  const root = document.getElementById("krg-builder");
  if (!root || !api) return;
  const start = cfg.chrome === "footer" ? "footer" : "header";

  const state = {
    region: start,
    header: null,
    footer: null,
    menus: [],
    save: "Guardado",
    dirty: false,
    saving: false,
    saveQueued: false,
    timer: null,
    bp: "desktop",
    viewW: 1280,
    viewH: 800,
    fit: false,
    shell: false,
    undo: [],
    redo: [],
    history: [],
    last: "",
    inspTab: "content",
    fSel: null,
    registry: [],
    // Ramas plegadas del árbol del pie (estado de interfaz).
    treeClosed: new Set(),
    // Lo escrito en el buscador del árbol. También es interfaz: filtra
    // lo que se ve, no toca el documento.
    treeFiltro: "",
    widths: { desktop: 1280, tablet: 768, mobile: 390 },
  };
  const PRESETS = {
    desktop: { w: 1280, h: 800 },
    tablet: { w: 768, h: 1024 },
    mobile: { w: 390, h: 844 },
  };
  const FOOTER_ANIMS = [
    { v: "none", l: "Ninguna" },
    { v: "fade", l: "Desvanecer" },
    { v: "slide", l: "Diapositiva" },
    { v: "zoom", l: "Zoom" },
    { v: "bounce", l: "Bounce" },
    { v: "flip", l: "Girar" },
  ];
  const uid = () => {
    try {
      if (globalThis.crypto && typeof crypto.randomUUID === "function") return "n_" + crypto.randomUUID();
    } catch (e) { /* */ }
    return "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };

  const BLENDS = [
    { v: "normal", l: "Normal" },
    { v: "multiply", l: "Multiplicar" },
    { v: "screen", l: "Trama" },
    { v: "overlay", l: "Superponer" },
    { v: "darken", l: "Oscurecer" },
    { v: "lighten", l: "Aclarar" },
    { v: "color-dodge", l: "Sobreexponer color" },
    { v: "color-burn", l: "Subexponer color" },
    { v: "hard-light", l: "Luz fuerte" },
    { v: "soft-light", l: "Luz suave" },
    { v: "difference", l: "Diferencia" },
    { v: "exclusion", l: "Exclusión" },
    { v: "hue", l: "Tono" },
    { v: "saturation", l: "Saturación" },
    { v: "color", l: "Color" },
    { v: "luminosity", l: "Luminosidad" },
    { v: "plus-lighter", l: "Añadir (aclarar)" },
  ];
  const BLEND_OK = BLENDS.map((b) => b.v);
  const RADIUS_CSS = { none: "0", sm: "4px", md: "8px", lg: "16px", full: "999px" };
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
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const toast = (t) => {
    const n = document.createElement("div");
    n.className = "m-toast";
    n.textContent = t;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  };

  /* ==================================================================
     El inspector compartido
     ------------------------------------------------------------------
     Esta pantalla y la de páginas montan el MISMO inspector
     (builder-fields.js). Lo único que cambia es el documento: allí la
     página, aquí el pie. Para no tener dos modelos, al estado de esta
     pantalla se le ponen dos asas con los nombres que el inspector
     espera: `doc` (con las secciones del pie) y `selected` (el nodo
     elegido, que aquí se llama `fSel`).
     ================================================================== */
  const docPie = {
    get sections() { return fSections(); },
    set sections(v) { state.footer = state.footer || {}; state.footer.sections = v; },
  };
  Object.defineProperty(state, "doc", { get: () => docPie, configurable: true });
  Object.defineProperty(state, "selected", {
    get: () => state.fSel,
    set: (v) => { state.fSel = v; },
    configurable: true,
  });

  const FIELDS = window.KrgFields({
    state: state,
    root: root,
    cfg: cfg,
    api: api,
    id: 0,
    esc: (x) => esc(x),
    cssColor: (v) => window.KrgBuilderCore.cssColor(v),
    defOf: (slug) => defOf(slug),
    findNode: (list, nid, parent) => findF(list, nid, parent),
    makeNode: (t) => makeNode(t),
    markDirty: () => markDirty(),
    paintLiveCss: () => paintLiveChrome(),
    pingFrame: () => ping(),
    render: () => paintChrome(),
    applyBp: () => applyBp(),
    snapshot: () => pushHistory("cambio"),
    toast: (t) => toast(t),
    unlinkNode: () => {},
    // Aquí no hay plantillas de página ni componentes globales.
    caps: { templates: false, globals: false },
  });

  function pack() {
    return JSON.stringify({ header: state.header, footer: state.footer });
  }
  function applyPack(raw) {
    const s = JSON.parse(raw);
    state.header = window.KrgBuilderCore.adoptDoc(s.header);
    state.footer = window.KrgBuilderCore.adoptDoc(s.footer);
  }
  function pushHistory(label) {
    state.history.unshift({
      at: new Date().toISOString().replace("T", " ").slice(0, 19),
      label,
      data: pack(),
    });
    if (state.history.length > 30) state.history.pop();
  }
  function markDirty() {
    const now = pack();
    if (state.last && state.last !== now) {
      state.undo.push(state.last);
      if (state.undo.length > 50) state.undo.shift();
      state.redo = [];
    }
    state.last = now;
    state.dirty = true;
    state.save = "Sin guardar";
    try { localStorage.setItem("krg-chrome-draft", pack()); } catch (e) { /* */ }
    paint();
    paintLiveChrome();
    clearTimeout(state.timer);
    state.timer = setTimeout(save, 600);
  }
  function undo() {
    if (!state.undo.length) return;
    state.redo.push(pack());
    applyPack(state.undo.pop());
    state.last = pack();
    state.dirty = true;
    state.save = "Sin guardar";
    paintChrome();
    clearTimeout(state.timer);
    state.timer = setTimeout(save, 1200);
  }
  function redo() {
    if (!state.redo.length) return;
    state.undo.push(pack());
    applyPack(state.redo.pop());
    state.last = pack();
    state.dirty = true;
    state.save = "Sin guardar";
    paintChrome();
    clearTimeout(state.timer);
    state.timer = setTimeout(save, 1200);
  }
  function openHistory() {
    const wrap = document.createElement("div");
    wrap.className = "confirm";
    wrap.innerHTML = `<div class="box" style="width:min(520px,92vw);max-height:80vh;overflow:auto">
      <h3>Historial</h3>
      <p class="m-muted">Restaura un estado guardado o cargado en esta sesión. Luego se autoguarda.</p>
      <ul class="b-rev">
        ${(state.history || []).map((r, i) => `<li>
          <span>${esc(r.at)} · ${esc(r.label)}</span>
          <button class="m-btn ghost" data-hi="${i}">Restaurar</button>
        </li>`).join("") || "<li>Sin historial todavía.</li>"}
      </ul>
      <button class="m-btn ghost" id="close">Cerrar</button>
    </div>`;
    window.KrgModal.abrir(wrap);
    wrap.querySelector("#close").onclick = () => wrap.remove();
    wrap.querySelectorAll("[data-hi]").forEach((b) => {
      b.onclick = () => {
        const item = state.history[Number(b.dataset.hi)];
        if (!item) return;
        state.undo.push(pack());
        state.redo = [];
        applyPack(item.data);
        state.last = pack();
        state.dirty = true;
        state.save = "Sin guardar";
        wrap.remove();
        paintChrome();
        clearTimeout(state.timer);
        state.timer = setTimeout(save, 400);
        toast("Estado restaurado");
      };
    });
  }

  function restUrl(path) {
    return String(cfg.rest || "").replace(/\/$/, "") + path;
  }
  async function putChrome(path, payload) {
    try {
      return await api.post(path, payload);
    } catch (err) {
      if (err.status === 404 || err.status === 405) return api.put(path, payload);
      throw err;
    }
  }
  function saveKeepalive() {
    if (!state.header || !state.footer || !state.dirty) return;
    const headers = { "Content-Type": "application/json", "X-WP-Nonce": cfg.nonce };
    const opts = { method: "POST", credentials: "same-origin", keepalive: true, headers };
    fetch(restUrl("/header"), { ...opts, body: JSON.stringify(state.header) });
    fetch(restUrl("/footer"), { ...opts, body: JSON.stringify(state.footer) });
  }
  async function save() {
    if (!state.header || !state.footer) return;
    if (state.saving) {
      state.saveQueued = true;
      return;
    }
    state.saving = true;
    state.saveQueued = false;
    state.save = "Guardando…";
    paint();
    try {
      const payloadH = JSON.parse(JSON.stringify(state.header));
      const payloadF = JSON.parse(JSON.stringify(state.footer));
      const [header, footer] = await Promise.all([
        putChrome("/header", payloadH),
        putChrome("/footer", payloadF),
      ]);
      if (header && typeof header === "object" && (header.ctaText !== undefined || header.background !== undefined)) {
        state.header = window.KrgBuilderCore.adoptDoc({ ...state.header, ...header });
      }
      if (footer && typeof footer === "object" && (footer.text !== undefined || footer.background !== undefined)) {
        state.footer = window.KrgBuilderCore.adoptDoc({ ...state.footer, ...footer });
      }
      state.save = "Guardado";
      state.dirty = false;
      state.last = pack();
      try { localStorage.removeItem("krg-chrome-draft"); } catch (e) { /* */ }
      pushHistory("Guardado");
      FIELDS.paintLiveCss();
      // La vista es la web de verdad y la pinta el servidor: si el pie
      // cambió de piezas —uno nuevo, uno movido, uno menos— hay que
      // volver a cargarla o lo añadido no aparece hasta recargar la
      // pantalla entera. Es lo mismo que hace la pantalla de páginas, y
      // sólo cuando cambia la estructura, para no parpadear al escribir.
      const firmaAhora = firmaPie(fSections());
      if (firmaAhora !== state.frameSig) {
        state.frameSig = firmaAhora;
        clearTimeout(state.reloadTimer);
        state.reloadTimer = setTimeout(() => {
          if (!state.dirty && !state.saving) reload();
        }, 250);
      }
    } catch (e) {
      state.save = "Error al guardar";
      toast((e.message || "No se pudo guardar") + ". El trabajo sigue aquí; no recargues.");
    }
    state.saving = false;
    paint();
    if (state.saveQueued) {
      state.saveQueued = false;
      save();
    }
  }

  function paint() {
    const s = root.querySelector(".b-status");
    if (s) s.textContent = state.save;
  }

  // Este lienzo tambien edita secciones (las del pie), asi que pide la
  // pagina marcada como lienzo: alli una seccion vacia si se imprime
  // para poder seleccionarla. En la web publica no se imprime.
  function canvasUrl(url) {
    return url + (String(url).includes("?") ? "&" : "?") + "krgcms_canvas=1";
  }

  /** Firma de la estructura del pie: ids y tipos, en orden. */
  function firmaPie(nodes) {
    return (nodes || []).map((n) => (n.id || "") + ":" + (n.type || "") + "[" + firmaPie(n.children) + "]").join(",");
  }

  function reload() {
    const iframe = root.querySelector("iframe");
    const base = canvasUrl(cfg.preview || cfg.home);
    if (!iframe) return;
    const slot = root.querySelector(".b-frame-slot");
    let y = slot?.scrollTop || 0;
    try { y = y || iframe.contentWindow?.scrollY || iframe.contentDocument?.documentElement?.scrollTop || 0; } catch (e) { /* */ }
    state.frameSnap = { y, region: state.region, id: state.fSel || "" };
    iframe.src = base + (String(base).includes("?") ? "&" : "?") + "t=" + Date.now();
  }

  function paintLiveChrome() {
    const iframe = root.querySelector("iframe");
    const doc = iframe?.contentDocument;
    if (!doc) return;
    let tag = doc.getElementById("krg-live-chrome");
    if (!tag) {
      tag = doc.createElement("style");
      tag.id = "krg-live-chrome";
      doc.head.appendChild(tag);
    }
    const h = state.header || {};
    const op = Math.max(0, Math.min(100, Number(h.transOpacity ?? 0)));
    const blend = BLEND_OK.includes(h.transBlend) ? h.transBlend : "normal";
    const blur = Math.max(0, Math.min(40, Number(h.transBlur ?? 20)));
    const bg = h.background || "var(--color-background)";
    const fg = h.color || "var(--color-text)";
    const hd = doc.querySelector(".m-site-header");
    if (hd) {
      hd.classList.toggle("is-transparent", !!h.transparent);
      hd.classList.toggle("is-sticky", h.sticky !== false);
      hd.style.setProperty("--m-header-bg", bg);
      hd.style.setProperty("--m-header-fg", fg);
      hd.style.setProperty("--m-header-glass", h.transColor || "#ffffff");
      hd.style.setProperty("--m-header-op", op + "%");
      hd.style.setProperty("--m-header-blend", blend);
      hd.style.setProperty("--m-header-blur", blur + "px");
      hd.style.setProperty("--m-logo-radius", RADIUS_CSS[h.logoRadius] || "0");
      hd.style.setProperty("--m-logo-w", Math.max(16, Math.min(480, Number(h.logoWidth || 140))) + "px");
      hd.style.setProperty("--m-logo-w-tablet", Math.max(16, Math.min(480, Number(h.logoWidthTablet || h.logoWidth || 140))) + "px");
      hd.style.setProperty("--m-logo-w-mobile", Math.max(16, Math.min(480, Number(h.logoWidthMobile || h.logoWidth || 120))) + "px");
      hd.style.setProperty("--m-nav-hover-fg", h.navHoverFg || "var(--color-primary)");
      hd.style.setProperty("--m-nav-hover-bg", h.navHoverBg || "transparent");
      hd.classList.toggle("is-center", h.align === "center");
      hd.classList.toggle("is-right", h.align === "right");
      hd.classList.toggle("is-dist-x", h.distribute === "x");
      hd.classList.toggle("is-dist-y", h.distribute === "y");
      hd.setAttribute("data-nav-d", h.navModeDesktop || "bar");
      hd.setAttribute("data-nav-t", h.navModeTablet || "bar");
      hd.setAttribute("data-nav-m", h.navModeMobile || "drawer");
      hd.classList.remove("m-anim-fade", "m-anim-slide", "m-anim-zoom", "m-anim-bounce", "m-anim-flip");
      if (h.animation && h.animation !== "none") hd.classList.add("m-anim-" + h.animation);
      hd.style.color = fg;
      const width = Number(h.logoWidth || 140);
      applyLogo(doc, h, width);
      if (h.transparent && !hd.querySelector(".m-header-glass")) {
        const g = doc.createElement("div");
        g.className = "m-header-glass";
        g.setAttribute("aria-hidden", "true");
        hd.insertBefore(g, hd.firstChild);
      }
      const glass = hd.querySelector(".m-header-glass");
      if (glass) glass.style.display = h.transparent ? "" : "none";
    }
    const f = state.footer || {};
    const ft = doc.querySelector(".m-site-footer");
    if (ft) {
      const fbg = f.background || "var(--color-secondary)";
      const ffg = f.color || "var(--color-on-secondary, #fff)";
      ft.style.setProperty("--m-footer-bg", fbg);
      ft.style.setProperty("--m-footer-fg", ffg);
      ft.style.setProperty("--m-footer-link", f.linkColor || ffg);
      ft.style.setProperty("--m-footer-heading", f.headingColor || ffg);
      ft.style.setProperty("--m-footer-link-hover", f.linkHoverFg || "var(--color-primary)");
      ft.style.setProperty("--m-footer-link-hover-bg", f.linkHoverBg || "transparent");
      ft.style.background = fbg;
      ft.style.color = ffg;
      const copyEl = ft.querySelector(".m-copyright");
      if (copyEl) {
        const t = f.copyright || "";
        if (!t) copyEl.style.display = "none";
        else {
          copyEl.style.display = "";
          if (f.copyrightUrl) {
            let a = copyEl.querySelector("a");
            if (!a) {
              a = doc.createElement("a");
              a.className = "m-copyright-link";
              copyEl.textContent = "";
              copyEl.appendChild(a);
            }
            a.textContent = t;
            a.setAttribute("href", f.copyrightUrl);
          } else {
            copyEl.textContent = t;
          }
        }
      }
    }
    tag.textContent = `#wpadminbar,.wp-toolbar{display:none!important}html{margin-top:0!important}`
      + `.m-site-header,.m-site-header .m-nav-list a,.m-site-header .m-logo-text,.m-site-header .m-nav-toggle,.m-site-header a:not(.m-btn){color:${fg}!important}`
      + (h.transparent
        ? `.m-site-header,.m-site-header.is-transparent{background:transparent!important;border-bottom-color:transparent}`
        : `.m-site-header{background:${bg}}`)
      + `.m-site-footer{background:${f.background || "var(--color-secondary)"}!important;color:${f.color || "var(--color-on-secondary, #fff)"}!important}`
      + `.m-site-header .m-logo img{border-radius:var(--m-logo-radius,0);width:var(--m-logo-w,140px)!important;max-width:100%;height:auto}`
      + `@media(max-width:1023px){.m-site-header .m-logo img{width:var(--m-logo-w-tablet,var(--m-logo-w,140px))!important}}`
      + `@media(max-width:767px){.m-site-header .m-logo img{width:var(--m-logo-w-mobile,var(--m-logo-w-tablet,120px))!important}}`
      + `.m-site-header .m-nav-list a:hover,.m-site-header .m-nav-list .is-current > a{color:var(--m-nav-hover-fg,var(--color-primary))!important;background:var(--m-nav-hover-bg,transparent)}`
      + (() => {
        // Tipografía del menú: lo mismo que escribe el servidor en
        // Chrome::css(), para que el lienzo enseñe ya el cambio.
        const t = [];
        if (h.navFont) t.push(`font-family:${h.navFont}`);
        if (h.navWeight) t.push(`font-weight:${String(h.navWeight).replace(/[^0-9]/g, "")}`);
        if (h.navStyle && h.navStyle !== "normal") t.push(`font-style:${h.navStyle}`);
        if (Number(h.navSize)) t.push(`font-size:${Math.max(8, Math.min(48, Number(h.navSize)))}px`);
        if (h.navTransform && h.navTransform !== "none") t.push(`text-transform:${h.navTransform}`);
        if (Number(h.navTracking)) t.push(`letter-spacing:${Number(h.navTracking) / 100}em`);
        return t.length ? `.m-site-header .m-nav-list a,.m-site-header .m-nav-toggle{${t.join(";")}}` : "";
      })()
      + `.m-site-footer a:not(.m-btn),.m-site-footer .m-logo-text{color:${f.linkColor || f.color || "inherit"}!important}`
      + `.m-site-footer h1,.m-site-footer h2,.m-site-footer h3,.m-site-footer h4,.m-site-footer strong{color:${f.headingColor || f.color || "inherit"}!important}`
      + `.m-site-footer .m-copyright{color:${f.copyrightColor || f.color || "inherit"}!important;text-align:${f.copyrightAlign || "left"};font-size:${Number(f.copyrightSize || 13)}px${f.copyrightFont ? `;font-family:${f.copyrightFont}` : ""}${f.copyrightWeight ? `;font-weight:${f.copyrightWeight}` : ""}${f.copyrightStyle && f.copyrightStyle !== "normal" ? `;font-style:${f.copyrightStyle}` : ""}${f.copyrightBg ? `;background:${f.copyrightBg}` : ""}!important}`
      + `.m-site-footer .m-copyright a{color:inherit!important}`
      + ((f.align === "center") ? `.m-site-footer .m-footer-grid,.m-site-footer .m-footer-sections{text-align:center;justify-items:center}` : "")
      + ((f.align === "right") ? `.m-site-footer .m-footer-grid,.m-site-footer .m-footer-sections{text-align:right;justify-items:end}` : "")
      + ((f.vAlign === "center") ? `.m-site-footer .m-footer-grid{align-items:center}` : "")
      + ((f.vAlign === "end") ? `.m-site-footer .m-footer-grid{align-items:end}` : "")
      + ((f.distribute === "x") ? `.m-site-footer .m-footer-grid{justify-content:space-between}` : "");
  }

  function applyLogo(doc, h, width) {
    const desk = h.logoSrc || "";
    const mob = h.logoMobileSrc || desk;
    const logo = doc.querySelector(".m-logo");
    if (!logo) return;
    if (!desk && !mob) return;
    let d = logo.querySelector(".m-logo-desktop");
    let m = logo.querySelector(".m-logo-mobile");
    if (!d || !m) {
      logo.innerHTML = `<span class="m-logo-desktop"></span><span class="m-logo-mobile"></span>`;
      d = logo.querySelector(".m-logo-desktop");
      m = logo.querySelector(".m-logo-mobile");
    }
    const put = (wrap, src, w) => {
      if (!wrap || !src) return;
      let img = wrap.querySelector("img");
      if (!img) {
        img = doc.createElement("img");
        wrap.innerHTML = "";
        wrap.appendChild(img);
      }
      img.src = src;
      img.alt = "";
      img.style.width = "";
      img.style.height = "auto";
      img.style.borderRadius = RADIUS_CSS[(state.header || {}).logoRadius] || "0";
    };
      put(d, desk, width);
      put(m, mob, Number((state.header || {}).logoWidthMobile || width));
  }

  function field(label, inner) {
    return `<label>${esc(label)} ${inner}</label>`;
  }

  /* ------------------------------------------------------------------
   * Inspector de cabecera y pie
   * ------------------------------------------------------------------
   * Mismo motor que el constructor de páginas: `KrgBuilderCore` guarda
   * los controles, decide qué grupos ve cada elemento y pinta las tres
   * pestañas con sus acordeones. Aquí solo viven los controles que son
   * propios de la cabecera y del pie (logo, menú, vidrio, copyright…),
   * que es exactamente lo que dice el encargo: un único motor, y la
   * navegación añade lo suyo.
   *
   * Los atributos `data-h*` y `data-f*` no cambian: son el contrato con
   * `bindInspector()` y con el guardado.
   * ------------------------------------------------------------------ */
  const CORE = window.KrgBuilderCore;

  /* --- Cabecera ----------------------------------------------------- */

  function hBodyContent() {
    const h = state.header || {};
    return `${field("Texto del logo", `<input data-h="logoText" value="${esc(h.logoText || "")}" placeholder="Tu logo aquí">`)}
      <p class="m-muted">El rótulo de la marca. Sólo se ve cuando no hay imagen de logo; en cuanto subas una, manda la imagen. Déjalo vacío si no quieres ningún texto.</p>
      ${field("Texto CTA", `<input data-h="ctaText" value="${esc(h.ctaText || "")}">`)}
      ${field("URL CTA", `<input data-h="ctaUrl" value="${esc(h.ctaUrl || "")}">`)}
      ${field("Menú", `<select data-h="menuSlug">${(state.menus || []).map((m) => `<option value="${esc(m.slug)}" ${h.menuSlug === m.slug ? "selected" : ""}>${esc(m.name || m.slug)}</option>`).join("")}</select>`)}
      ${field("Logo escritorio", `${h.logoSrc ? `<img src="${esc(h.logoSrc)}" alt="" style="max-height:36px;width:auto;display:block;margin-bottom:6px">` : ""}<button type="button" class="m-btn ghost" data-hmedia="logoId">Elegir logo</button>`)}
      ${field("Logo móvil / tablet", `${h.logoMobileSrc ? `<img src="${esc(h.logoMobileSrc)}" alt="" style="max-height:36px;width:auto;display:block;margin-bottom:6px">` : ""}<button type="button" class="m-btn ghost" data-hmedia="logoMobile">Elegir logo</button>`)}
      ${field("Clic en el logo", `<select data-h="logoLink">
        <option value="home" ${(h.logoLink || "home") === "home" ? "selected" : ""}>Inicio del sitio</option>
        <option value="section" ${h.logoLink === "section" ? "selected" : ""}>Sección de la página (#id)</option>
        <option value="url" ${h.logoLink === "url" ? "selected" : ""}>URL externa</option>
      </select>`)}
      ${h.logoLink === "section" || h.logoLink === "url" ? field(h.logoLink === "section" ? "ID de sección" : "URL del logo", `<input data-h="logoUrl" placeholder="${h.logoLink === "section" ? "#servicios" : "https://"}" value="${esc(h.logoUrl || "")}">`) : ""}`;
  }

  function hBodyAlign() {
    const h = state.header || {};
    const ah = h.align || "left";
    const av = h.vAlign || "center";
    const dist = h.distribute || "none";
    const abtn = (key, val, cur, icon, title) => `<button type="button" class="b-align-btn${cur === val ? " is-on" : ""}" data-h-set="${key}" data-v="${val}" title="${title}">${ALIGN_ICONS[icon]}</button>`;
    return `<p class="m-muted">Alinear objetos</p>
      <div class="b-align">
        ${abtn("align", "left", ah, "hStart", "Izquierda")}
        ${abtn("align", "center", ah, "hCenter", "Centro horizontal")}
        ${abtn("align", "right", ah, "hEnd", "Derecha")}
        ${abtn("vAlign", "start", av, "vStart", "Arriba")}
        ${abtn("vAlign", "center", av, "vCenter", "Centro vertical")}
        ${abtn("vAlign", "end", av, "vEnd", "Abajo")}
      </div>
      <p class="m-muted">Distribuir objetos</p>
      <div class="b-align">
        ${abtn("distribute", "x", dist, "distX", "Distribuir horizontal")}
        ${abtn("distribute", "y", dist, "distY", "Distribuir vertical")}
      </div>`;
  }

  /**
   * Tipografía del menú de la cabecera.
   *
   * Hasta ahora los enlaces del menú se quedaban con la familia de
   * títulos del tema y no había forma de cambiarlos desde el panel. Son
   * los mismos campos que ya tenía el copyright del pie: familia, peso,
   * estilo, tamaño, caja y espaciado entre letras. Todo vacío o en cero
   * significa «como está»: una cabecera que nadie toque no cambia.
   */
  function hBodyNavType() {
    const h = state.header || {};
    const w = String(h.navWeight || "");
    const sty = h.navStyle || "normal";
    const tr = h.navTransform || "none";
    return `${window.KrgUi.fontFamilyField("Familia", h.navFont || "", 'data-h="navFont"')}
      ${field("Peso", `<select data-h="navWeight">
        ${[["", "Heredar"], ["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"], ["800", "Extrabold"]].map(([v, l]) => `<option value="${v}" ${w === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>`)}
      ${field("Estilo", `<select data-h="navStyle">
        <option value="normal" ${sty === "normal" ? "selected" : ""}>Normal</option>
        <option value="italic" ${sty === "italic" ? "selected" : ""}>Cursiva</option>
      </select>`)}
      ${field("Tamaño (px)", `<input type="number" min="0" max="48" data-h-num="navSize" value="${Number(h.navSize || 0)}" placeholder="auto">`)}
      ${field("Caja", `<select data-h="navTransform">
        ${[["none", "Como se escribe"], ["uppercase", "MAYÚSCULAS"], ["lowercase", "minúsculas"], ["capitalize", "Primera En Mayúscula"]].map(([v, l]) => `<option value="${v}" ${tr === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>`)}
      ${field("Espaciado entre letras (centésimas de em)", `<input type="number" min="-10" max="100" data-h-num="navTracking" value="${Number(h.navTracking || 0)}">`)}
      <p class="m-muted">Con 0 y «auto» manda la tipografía del tema. Afecta a los enlaces del menú y al botón de menú.</p>`;
  }

  function hBodyNavMode() {
    const h = state.header || {};
    const nbtn = (key, val, fallback, lab) => `<button type="button" class="${(h[key] || fallback) === val ? "is-on" : ""}" data-h-set="${key}" data-v="${val}">${lab}</button>`;
    return `<p class="m-muted">Escritorio</p>
      <div class="b-seg">${nbtn("navModeDesktop", "bar", "bar", "Barra (escritorio)")}${nbtn("navModeDesktop", "drawer", "bar", "Hamburguesa (móvil)")}</div>
      <p class="m-muted">Tablet</p>
      <div class="b-seg">${nbtn("navModeTablet", "bar", "bar", "Barra (escritorio)")}${nbtn("navModeTablet", "drawer", "bar", "Hamburguesa (móvil)")}</div>
      <p class="m-muted">Móvil</p>
      <div class="b-seg">${nbtn("navModeMobile", "bar", "drawer", "Barra (escritorio)")}${nbtn("navModeMobile", "drawer", "drawer", "Hamburguesa (móvil)")}</div>`;
  }

  function hBodyColors() {
    const h = state.header || {};
    return `${window.KrgUi.colorField("Fondo", h.background || "", 'data-h="background"')}
      ${window.KrgUi.colorField("Color texto", h.color || "", 'data-h="color"')}
      ${window.KrgUi.colorField("Color de texto hover", h.navHoverFg || "", 'data-h="navHoverFg"')}
      ${window.KrgUi.colorField("Fondo hover", h.navHoverBg || "", 'data-h="navHoverBg"')}`;
  }

  function hBodyLogo() {
    const h = state.header || {};
    const lw = (key, label, fallback) => {
      const v = Number(h[key] ?? fallback);
      return `<label>${label}
        <input type="range" min="16" max="480" data-h-num="${key}" value="${v}">
        <span data-logo-w-lab>${v} px</span>
      </label>`;
    };
    return `${lw("logoWidth", "Escritorio", 140)}
      ${lw("logoWidthTablet", "Tablet", h.logoWidth || 140)}
      ${lw("logoWidthMobile", "Móvil", Math.min(h.logoWidth || 140, 120))}
      ${field("Radio del logo", `<select data-h="logoRadius">
        ${[["none", "Ninguno"], ["sm", "S"], ["md", "M"], ["lg", "L"], ["full", "Círculo"]].map(([v, l]) => `<option value="${v}" ${(h.logoRadius || "none") === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>`)}`;
  }

  function hBodySize() {
    const h = state.header || {};
    return `${field("Alto (px)", `<input type="number" data-h-num="height" value="${h.height || 72}">`)}
      ${field("Padding Y", `<input type="number" data-h-num="paddingY" value="${h.paddingY || 12}">`)}`;
  }

  function hBodyGlass() {
    const h = state.header || {};
    return `<label>Transparente / vidrio <input type="checkbox" data-h-bool="transparent" ${h.transparent ? "checked" : ""}></label>
      ${h.transparent ? `
        ${window.KrgUi.colorField("Color del vidrio", h.transColor || "#ffffff", 'data-h="transColor"')}
        <label>Opacidad del color (%)
          <input type="range" min="0" max="100" data-h-num="transOpacity" value="${Number(h.transOpacity ?? 20)}">
          <span data-op-lab>${Number(h.transOpacity ?? 20)}%</span>
        </label>
        <label>Desenfoque
          <input type="range" min="0" max="40" data-h-num="transBlur" value="${Number(h.transBlur ?? 20)}">
          <span data-blur-lab>${Number(h.transBlur ?? 20)} px</span>
        </label>
        <label>Modo de fusión
          <select data-h="transBlend">
            ${BLENDS.map((b) => `<option value="${b.v}" ${(h.transBlend || "normal") === b.v ? "selected" : ""}>${esc(b.l)}</option>`).join("")}
          </select>
        </label>
      ` : ""}`;
  }

  function hBodyAnim() {
    const h = state.header || {};
    return `<div class="b-seg">${FOOTER_ANIMS.map((a) => `<button type="button" class="${(h.animation || "none") === a.v ? "is-on" : ""}" data-h-anim="${a.v}">${a.l}</button>`).join("")}</div>
      <label>Duración (ms) <input type="number" data-h-num="animDuration" min="0" max="3000" value="${h.animDuration ?? 600}"></label>
      <label>Retardo (ms) <input type="number" data-h-num="animDelay" min="0" max="3000" value="${h.animDelay ?? 0}"></label>`;
  }

  function hBodyAdaptive() {
    const h = state.header || {};
    return `${field("Según la sección de debajo", `<select data-h="adaptive">${[
      ["off", "Desactivado"],
      ["text", "Solo el color del texto"],
      ["full", "Texto y fondo"],
    ].map(([v, l]) => `<option value="${v}" ${(h.adaptive || "off") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}`;
  }

  function hBodyAdvanced() {
    const h = state.header || {};
    return `<label>Sticky <input type="checkbox" data-h-bool="sticky" ${h.sticky !== false ? "checked" : ""}></label>
      ${field("Identificador CSS", `<input data-h="htmlId" value="${esc(h.htmlId || "")}" placeholder="cabecera">`)}
      ${field("Clase CSS", `<input data-h="htmlClass" value="${esc(h.htmlClass || "")}" placeholder="mi-header">`)}`;
  }

  /* --- Pie (ajustes generales) -------------------------------------- */

  function fBodyAlign() {
    const f = state.footer || {};
    const ah = f.align || "left";
    const av = f.vAlign || "start";
    const dist = f.distribute || "none";
    const abtn = (key, val, cur, icon, title) => `<button type="button" class="b-align-btn${cur === val ? " is-on" : ""}" data-f-set="${key}" data-v="${val}" title="${title}">${ALIGN_ICONS[icon]}</button>`;
    return `<p class="m-muted">Alinear el contenido del pie</p>
      <div class="b-align">
        ${abtn("align", "left", ah, "hStart", "Izquierda")}
        ${abtn("align", "center", ah, "hCenter", "Centro horizontal")}
        ${abtn("align", "right", ah, "hEnd", "Derecha")}
        ${abtn("vAlign", "start", av, "vStart", "Arriba")}
        ${abtn("vAlign", "center", av, "vCenter", "Centro vertical")}
        ${abtn("vAlign", "end", av, "vEnd", "Abajo")}
      </div>
      <p class="m-muted">Distribuir objetos</p>
      <div class="b-align">
        ${abtn("distribute", "x", dist, "distX", "Distribuir horizontal")}
        ${abtn("distribute", "y", dist, "distY", "Distribuir vertical")}
      </div>`;
  }

  function fBodyContent() {
    const f = state.footer || {};
    const social = (f.social || []).map((s) => `${s.label || ""}|${s.url || ""}`).join("\\n");
    return `${field("Texto del logo", `<input data-f="logoText" value="${esc(f.logoText || "")}" placeholder="Tu logo aquí">`)}
      ${field("Texto", `<textarea data-f="text">${esc(f.text || "")}</textarea>`)}
      ${field("Columna extra (título)", `<input data-f="extraTitle" value="${esc(f.extraTitle || "")}">`)}
      ${field("Columna extra (texto)", `<textarea data-f="extraText">${esc(f.extraText || "")}</textarea>`)}
      ${field("Redes (Nombre|URL)", `<textarea data-f="social">${esc(social)}</textarea>`)}
      ${field("Menú", `<select data-f="menuSlug">${(state.menus || []).map((m) => `<option value="${esc(m.slug)}" ${f.menuSlug === m.slug ? "selected" : ""}>${esc(m.name || m.slug)}</option>`).join("")}</select>`)}
      ${field("Logo", `<input data-f-num="logoId" value="${f.logoId || 0}"><button type="button" class="m-btn ghost" data-fmedia="logoId">Biblioteca</button>`)}
      <label>Mostrar buscador <input type="checkbox" data-f-bool="showSearch" ${f.showSearch ? "checked" : ""}></label>
      <label>Mostrar columnas clásicas <input type="checkbox" data-f-bool="showClassic" ${f.showClassic !== false ? "checked" : ""}></label>
      <p class="m-muted">Las secciones nuevas se añaden a la izquierda y se pintan debajo de estas columnas.</p>`;
  }

  function fBodyCopyright() {
    const f = state.footer || {};
    const cal = f.copyrightAlign || "left";
    const w = String(f.copyrightWeight || "");
    const sty = f.copyrightStyle || "normal";
    const segA = (val, lab) => `<button type="button" class="${cal === val ? "is-on" : ""}" data-f-set="copyrightAlign" data-v="${val}">${lab}</button>`;
    return `${field("Texto", `<input data-f="copyright" value="${esc(f.copyright || "")}">`)}
      ${field("Enlace", `<input data-f="copyrightUrl" value="${esc(f.copyrightUrl || "")}" placeholder="https:// o #seccion">`)}
      <label>Abrir en pestaña nueva <input type="checkbox" data-f-bool="copyrightNewTab" ${f.copyrightNewTab ? "checked" : ""}></label>
      <p class="m-muted">Alineación del copyright</p>
      <div class="b-seg">${segA("left", "Izquierda")}${segA("center", "Centro")}${segA("right", "Derecha")}</div>
      ${window.KrgUi.fontFamilyField("Familia", f.copyrightFont || "", 'data-f="copyrightFont"')}
      ${field("Peso", `<select data-f="copyrightWeight">
        ${[["", "Heredar"], ["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semibold"], ["700", "Bold"]].map(([v, l]) => `<option value="${v}" ${w === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>`)}
      ${field("Estilo", `<select data-f="copyrightStyle">
        <option value="normal" ${sty === "normal" ? "selected" : ""}>Normal</option>
        <option value="italic" ${sty === "italic" ? "selected" : ""}>Cursiva</option>
      </select>`)}
      ${field("Tamaño (px)", `<input type="number" min="10" max="48" data-f-num="copyrightSize" value="${f.copyrightSize || 13}">`)}
      ${window.KrgUi.colorField("Color", f.copyrightColor || "", 'data-f="copyrightColor"')}
      ${window.KrgUi.colorField("Fondo", f.copyrightBg || "", 'data-f="copyrightBg"')}`;
  }

  function fBodyReveal() {
    const f = state.footer || {};
    return `${field("Revelado al hacer scroll", `<select data-f="reveal">${[
      ["curtain", "Cortina (el contenido lo descubre)"],
      ["stagger", "Escalonada (por bloques)"],
      ["rise", "Aparecer entero"],
      ["none", "Sin animación"],
    ].map(([v, l]) => `<option value="${v}" ${(f.reveal || "stagger") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
      <p class="m-muted">Cortina: el pie se queda quieto al fondo y el contenido de la página se desliza por encima, descubriéndolo poco a poco al llegar al final. Es el efecto de la referencia. Se desactiva solo si el pie no cabe en la pantalla.</p>`;
  }

  function fBodyColors() {
    const f = state.footer || {};
    return `${window.KrgUi.colorField("Fondo", f.background || "", 'data-f="background"')}
      ${window.KrgUi.colorField("Color de texto", f.color || "", 'data-f="color"')}
      ${window.KrgUi.colorField("Color de enlaces", f.linkColor || "", 'data-f="linkColor"')}
      ${window.KrgUi.colorField("Color de títulos", f.headingColor || "", 'data-f="headingColor"')}
      ${window.KrgUi.colorField("Texto de enlace al pasar", f.linkHoverFg || "", 'data-f="linkHoverFg"')}
      ${window.KrgUi.colorField("Fondo de enlace al pasar", f.linkHoverBg || "", 'data-f="linkHoverBg"')}`;
  }

  function fBodySize() {
    const f = state.footer || {};
    return `${field("Columnas clásicas", `<input type="number" min="1" max="4" data-f-num="columns" value="${f.columns || 3}">`)}
      ${field("Padding Y (px)", `<input type="number" data-f-num="paddingY" value="${f.paddingY || 64}">`)}`;
  }

  function fBodyAdvanced() {
    const f = state.footer || {};
    return `${field("Identificador CSS", `<input data-f="htmlId" value="${esc(f.htmlId || "")}" placeholder="pie-sitio">`)}
      ${field("Clase CSS", `<input data-f="htmlClass" value="${esc(f.htmlClass || "")}" placeholder="mi-footer">`)}`;
  }

  /* --- Registro y esquemas ------------------------------------------ */

  let registrado = false;
  function registrarControles() {
    if (registrado || !CORE) return;
    registrado = true;
    const R = (id, label, body, hint) => CORE.registerControl(id, { label: label, body: body, hint: hint });

    R("h.content", "Contenido", hBodyContent);
    R("h.align", "Alinear", hBodyAlign);
    R("h.navType", "Tipografía del menú", hBodyNavType, "Familia, peso, tamaño y caja de los enlaces de navegación.");
    R("h.navMode", "Tipo de menú", hBodyNavMode, "Barra horizontal o botón Menú (hamburguesa), independiente en cada tamaño.");
    R("h.colors", "Colores", hBodyColors);
    R("h.logo", "Escala del logo", hBodyLogo, "Una medida por cada vista del preview.");
    R("h.size", "Medidas", hBodySize);
    R("h.glass", "Vidrio", hBodyGlass);
    R("h.anim", "Animación", hBodyAnim);
    R("h.adaptive", "Color adaptativo", hBodyAdaptive, "La cabecera toma el color que declara cada sección en Diseño → «Color de la cabecera sobre esta sección».");
    R("h.advanced", "Avanzado", hBodyAdvanced);

    R("f.align", "Alinear", fBodyAlign);
    R("f.content", "Contenido del pie", fBodyContent);
    R("f.copyright", "Copyright", fBodyCopyright, "Se edita aparte del resto del pie: texto, enlace, tipografía y color.");
    R("f.reveal", "Animación de entrada", fBodyReveal);
    R("f.colors", "Colores", fBodyColors);
    R("f.size", "Medidas", fBodySize);
    R("f.advanced", "Avanzado", fBodyAdvanced);

    CORE.setSchema("chrome-header", {
      content: ["h.content"],
      design: ["h.align", "h.navType", "h.navMode", "h.colors", "h.logo", "h.size", "h.glass", "h.anim"],
      advanced: ["h.adaptive", "h.advanced"],
    });
    CORE.setSchema("chrome-footer", {
      content: ["f.align", "f.content", "f.copyright"],
      design: ["f.align", "f.reveal", "f.colors", "f.copyright", "f.size"],
      advanced: ["f.advanced"],
    });
    // Los nodos del pie NO se registran aquí: usan el inspector
    // compartido (builder-fields.js), el mismo que las páginas.
  }

  function inspector() {
    registrarControles();
    const tab = state.inspTab || "content";
    if (state.region === "footer") {
      const hit = state.fSel ? findF(fSections(), state.fSel) : null;
      if (hit) {
        const node = hit.node;
        const def = defOf(node.type) || { name: node.type, fields: [] };
        // Mismo esquema que en páginas: sección, fila, columna, texto,
        // imagen, galería, vídeo o módulo. De ahí salen el fondo, el
        // relleno, el margen, el tamaño, el borde, la sombra, la
        // posición y todo lo demás que antes aquí no existía.
        const kind = FIELDS.kindOf(node);
        return CORE.render({
          kind: kind,
          type: node.type,
          kindLabel: FIELDS.KIND_LABEL[kind] || "Módulo",
          title: node.name && node.name !== node.type ? node.name : (def.name || node.type),
          subtitle: def.name && node.name && node.name !== def.name && node.name !== node.type ? def.name : "",
          tab: tab,
          // El mismo portapapeles que en páginas: un bloque copiado en
          // una página se pega aquí, y al revés.
          actions: '<button type="button" class="m-btn ghost" data-froot>← Ajustes del pie</button>'
            + FIELDS.accionesPorta(node),
          schema: def.inspector || null,
          node: node,
          def: def,
          bp: state.bp,
          st: (node.styles && node.styles[state.bp]) || {},
        });
      }
      return CORE.render({
        kind: "chrome-footer",
        kindLabel: "Pie",
        title: "Pie de página",
        subtitle: "Añade secciones a la izquierda",
        tab: tab,
      });
    }
    return CORE.render({
      kind: "chrome-header",
      kindLabel: "Cabecera",
      title: "Cabecera del sitio",
      subtitle: "El preview se ensancha con las manijas naranjas",
      tab: tab,
    });
  }


  function defOf(slug) {
    return (state.registry || []).find((c) => c.slug === slug) || {};
  }
  function makeNode(type) {
    const def = defOf(type);
    const node = {
      id: uid(),
      type,
      name: def.name || type,
      visible: true,
      source: "local",
      props: JSON.parse(JSON.stringify(def.defaults || {})),
      styles: { desktop: {}, tablet: {}, mobile: {} },
      children: [],
    };
    if (type === "section") {
      node.props.fullWidth = false; node.props.background = "";
      node.children = [{
        id: uid(), type: "row", name: "Fila", visible: true, source: "local",
        props: { layout: "12", gap: 24, vAlign: "start" },
        styles: { desktop: {}, tablet: {}, mobile: {} },
        children: [{
          id: uid(), type: "column", name: "Columna", visible: true, source: "local",
          props: { span: 12, spanTablet: 12, spanMobile: 12 },
          styles: { desktop: {}, tablet: {}, mobile: {} },
          children: [],
        }],
      }];
    }
    return node;
  }
  function fSections() {
    if (!state.footer.sections) state.footer.sections = [];
    return state.footer.sections;
  }
  function findF(list, nid, parent = null) {
    for (let i = 0; i < (list || []).length; i++) {
      const n = list[i];
      if (n.id === nid) return { node: n, parent, index: i, list };
      const hit = findF(n.children || [], nid, n);
      if (hit) return hit;
    }
    return null;
  }
  const F_TREE_ICONS = {
    section: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 2h12v3H2V2zm0 4.5h12V14H2V6.5zm1.2 1.2v5.1h9.6V7.7H3.2z"/></svg>',
    row: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v4H2V3zm0 6h12v4H2V9zm1.2 1.2v1.6h9.6v-1.6H3.2zm0-6V5.8h9.6V4.2H3.2z"/></svg>',
    column: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 2h5v12H2V2zm7 0h5v12H9V2zM3.2 3.2v9.6h2.6V3.2H3.2zm7 0v9.6h2.6V3.2h-2.6z"/></svg>',
    text: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v1.6H9v8.4H7V4.6H2V3z"/></svg>',
    image: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v10H2V3zm1.2 1.2v6l2.6-2.4 2.3 2.1 2.3-2.8 2.4 2.7V4.2H3.2zM6 5.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
    module: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2.6 2.6h10.8v10.8H2.6V2.6zm1.2 1.2v8.4h8.4V3.8H3.8z"/></svg>',
  };
  const F_ICON_BY_TYPE = {
    section: "section", row: "row", column: "column",
    heading: "text", paragraph: "text", "rich-text": "text", menu: "text",
    image: "image", logo: "image",
  };
  /* ==================================================================
     Plantillas del pie
     ------------------------------------------------------------------
     «Pie partido por piezas» monta el mismo pie del ejemplo pero con
     bloques de verdad: cada texto, la foto, los iconos de redes y cada
     columna de enlaces son nodos hijos de la sección, así que se
     seleccionan y se editan uno a uno en el árbol de la izquierda.
     ================================================================== */

  function paintLeft() {
    const box = root.querySelector("#chrome-left");
    if (!box) return;
    const regiones = `<div class="b-sec"><h4>Región</h4>
      <div class="b-palette">
        <button data-region="header"${state.region === "header" ? ' class="is-on"' : ""}>Cabecera</button>
        <button data-region="footer"${state.region === "footer" ? ' class="is-on"' : ""}>Pie</button>
      </div>`;
    if (state.region !== "footer") {
      box.innerHTML = regiones + `<p class="b-empty">El lienzo es la web real. Pulsa en la cabecera o en el pie. Los campos se guardan solos.</p></div>`;
      box.querySelectorAll("[data-region]").forEach((b) => {
        b.onclick = () => { state.region = b.dataset.region; state.fSel = null; paintChrome(); ping(); };
      });
      return;
    }
    // El pie usa la MISMA paleta y el MISMO árbol que una página: todos
    // los bloques del registro, arrastrar y soltar, duplicar, ocultar,
    // renombrar y mover entre columnas.
    box.innerHTML = regiones
      + `<button type="button" class="m-btn ghost" data-froot style="margin:8px 0">Ajustes del pie</button></div>`
      + FIELDS.palette()
      + FIELDS.tree();
    box.querySelectorAll("[data-region]").forEach((b) => {
      b.onclick = () => { state.region = b.dataset.region; state.fSel = null; paintChrome(); ping(); };
    });
    box.querySelector("[data-froot]")?.addEventListener("click", () => { state.fSel = null; paintInspector(); });
    FIELDS.bindLeft();
  }

  function bindInspector() {
    const box = root.querySelector(".b-insp");
    if (!box) return;
    // Todo lo que es de un nodo del pie —props, estilos de caja,
    // repetidores, imágenes, acordeones y pestañas— lo ata el
    // inspector compartido, el mismo de la pantalla de páginas. Aquí
    // abajo sólo quedan los ajustes propios de la cabecera y del pie.
    FIELDS.bindInspector();
    const bind = (sel, fn) => box.querySelectorAll(sel).forEach(fn);
    bind("[data-h]", (inp) => {
      const go = () => {
        state.header[inp.dataset.h] = inp.value;
        markDirty();
        if (inp.dataset.h === "logoLink") paintInspector();
      };
      inp.addEventListener("input", go);
      inp.addEventListener("change", go);
    });
    bind("[data-h-num]", (inp) => inp.addEventListener("input", () => { state.header[inp.dataset.hNum] = Number(inp.value); markDirty(); }));
    bind("[data-h-bool]", (inp) => inp.addEventListener("change", () => {
      state.header[inp.dataset.hBool] = inp.checked;
      markDirty();
      if (inp.dataset.hBool === "transparent") paintInspector();
    }));
    bind("[data-h-anim]", (b) => {
      b.onclick = () => { state.header.animation = b.dataset.hAnim; markDirty(); paintInspector(); };
    });
    bind("[data-h-set]", (b) => {
      b.onclick = () => {
        const key = b.dataset.hSet;
        const val = b.dataset.v;
        if ((key === "distribute") && state.header[key] === val) state.header[key] = "none";
        else state.header[key] = val;
        markDirty();
        paintInspector();
      };
    });
    bind("[data-f-set]", (b) => {
      b.onclick = () => {
        const key = b.dataset.fSet;
        const val = b.dataset.v;
        if ((key === "distribute") && state.footer[key] === val) state.footer[key] = "none";
        else state.footer[key] = val;
        markDirty();
        paintInspector();
      };
    });
    bind("[data-h-num]", (inp) => {
      if (inp.type === "range") {
        inp.addEventListener("input", () => {
          const op = inp.parentElement?.querySelector("[data-op-lab]");
          if (op) op.textContent = inp.value + "%";
          const bl = inp.parentElement?.querySelector("[data-blur-lab]");
          if (bl) bl.textContent = inp.value + " px";
          const lw = inp.parentElement?.querySelector("[data-logo-w-lab]");
          if (lw) lw.textContent = inp.value + " px";
        });
      }
    });
    bind("[data-f]", (inp) => {
      const go = () => { state.footer[inp.dataset.f] = inp.value; markDirty(); };
      inp.addEventListener("input", go);
      inp.addEventListener("change", go);
    });
    bind("[data-f-num]", (inp) => inp.addEventListener("input", () => { state.footer[inp.dataset.fNum] = Number(inp.value); markDirty(); }));
    bind("[data-f-bool]", (inp) => inp.addEventListener("change", () => { state.footer[inp.dataset.fBool] = inp.checked; markDirty(); }));
    bind("[data-hmedia]", (b) => {
      b.onclick = () => media("header", b.dataset.hmedia);
    });
    bind("[data-fmedia]", (b) => {
      b.onclick = () => media("footer", b.dataset.fmedia);
    });
    bind("[data-froot]", (b) => {
      b.onclick = () => { state.fSel = null; paintChrome(); };
    });
  }

  function media(which, key) {
    if (!window.wp?.media) return;
    const frame = wp.media({ title: "Imagen", multiple: false });
    frame.on("select", () => {
      const att = frame.state().get("selection").first().toJSON();
      const id = att.id;
      const src = att.url || att.sizes?.full?.url || "";
      if (which === "header") {
        state.header[key] = id;
        if (key === "logoId") state.header.logoSrc = src;
        if (key === "logoMobile") state.header.logoMobileSrc = src;
      } else {
        state.footer[key] = id;
      }
      markDirty();
      paintInspector();
    });
    frame.open();
  }

  function paintInspector() {
    const box = root.querySelector(".b-insp");
    if (!box) return;
    // Repintar no puede devolverte al principio de la lista: se guarda
    // donde estabas —el panel y las cajas con barra propia de dentro— y
    // se devuelve. Es el mismo ayudante que usa la pantalla de páginas.
    const CORE = window.KrgBuilderCore;
    const arriba = box.scrollTop;
    const dentro = CORE.scrollSnap(box);
    box.innerHTML = inspector();
    bindInspector();
    box.scrollTop = arriba;
    CORE.scrollRestore(box, dentro);
  }
  function ensureShell() {
    if (state.shell) return;
    // El mismo armazón que la pantalla de páginas: barra de arriba con
    // los mismos botones, paneles que se pliegan con sus tiradores y
    // raíles para volver a abrirlos.
    root.innerHTML = `
      <div class="b-root">
        <div class="b-top">
          <div class="b-top-ident">
            <a class="b-volver" href="${cfg.admin}?page=krg-nav" title="Volver a Navegación" aria-label="Volver a Navegación">${KrgIco.atras}</a>
            <strong class="b-pagetitle">Cabecera y pie</strong>
          </div>
          <div class="b-bp" id="regions" role="group" aria-label="Qué se edita">
            <button type="button" data-region="header">Cabecera</button>
            <button type="button" data-region="footer">Pie</button>
          </div>
          <div class="b-bp" id="bps" role="group" aria-label="Tamaño de pantalla">
            <button type="button" data-bp="desktop">${KrgIco.escritorio}<span>Escritorio</span></button>
            <button type="button" data-bp="tablet">${KrgIco.tableta}<span>Tableta</span></button>
            <button type="button" data-bp="mobile">${KrgIco.movil}<span>Móvil</span></button>
          </div>
          <div class="b-device">
            <input type="number" data-view-w min="320" max="2560" value="${state.viewW}" title="Ancho" aria-label="Ancho del lienzo">
            <span>×</span>
            <input type="number" data-view-h min="400" max="2400" value="${state.viewH}" title="Alto" aria-label="Alto del lienzo">
            <label class="b-fit" title="Encajar el lienzo en la pantalla"><input type="checkbox" data-fit> Ajustar</label>
          </div>
          <span class="b-bp-label"></span>
          <span class="grow"></span>
          <span class="b-status">${esc(state.save)}</span>
          <div class="b-grupo" role="group" aria-label="Deshacer y rehacer">
            <button class="b-ico" id="undo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${KrgIco.deshacer}</button>
            <button class="b-ico" id="redo" title="Rehacer (Ctrl+Y)" aria-label="Rehacer">${KrgIco.rehacer}</button>
          </div>
          <div class="b-grupo" role="group" aria-label="Paneles">
            <button class="b-ico" data-panel="left" title="Esconder o enseñar la estructura" aria-label="Estructura">${KrgIco.estructura}</button>
            <button class="b-ico" data-panel="right" title="Esconder o enseñar los ajustes" aria-label="Ajustes">${KrgIco.ajustes}</button>
            <button class="b-ico" id="refresh" title="Vuelve a cargar la vista del lienzo" aria-label="Actualizar vista">${KrgIco.refrescar}</button>
          </div>
          <button class="m-btn ghost" id="history">Historial</button>
          <button class="m-btn ghost" id="preview" title="Abrir la web en otra pestaña">Vista previa</button>
          <div class="b-acciones">
            <button class="m-btn" id="save" title="Ctrl+S · la cabecera y el pie se publican al guardar">Guardar</button>
          </div>
        </div>
        <div class="b-layout">
          <aside class="b-left" id="chrome-left"></aside>
          <div class="b-split" data-split="left" title="Arrastra para ensanchar"><button type="button" class="b-split-t" data-panel="left" title="Esconder la estructura">‹</button></div>
          <button type="button" class="b-show" data-show="left" title="Mostrar la estructura" hidden>Estructura ›</button>
          <div class="b-canvas">
            <div class="b-frame-slot">
              <div class="b-frame-wrap">
                <iframe src="${esc(canvasUrl(cfg.preview || cfg.home))}" title="Vista del sitio"></iframe>
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
    const iframe = root.querySelector("iframe");
    if (iframe) iframe.addEventListener("load", () => {
      // Los nodos del pie los pinta el compartido; la cabecera y los
      // ajustes del pie, paintLiveChrome. FIELDS.paintLiveCss() hace
      // los dos, en ese orden.
      state.frameSig = firmaPie(fSections());
      FIELDS.paintLiveCss();
      applyBp();
      restoreChromeView();
    });
    window.addEventListener("resize", applyBp);
    bindDevice();
    root.querySelectorAll("[data-region]").forEach((b) => {
      b.onclick = () => { state.region = b.dataset.region; state.fSel = null; paintChrome(); ping(); };
    });
    root.querySelectorAll("[data-bp]").forEach((b) => {
      b.onclick = () => {
        state.bp = b.dataset.bp;
        const p = PRESETS[state.bp];
        if (p) { state.viewW = p.w; state.viewH = p.h; }
        paintChrome();
      };
    });
    root.querySelector("#save").onclick = () => save();
    root.querySelector("#undo").onclick = undo;
    root.querySelector("#redo").onclick = redo;
    root.querySelector("#history").onclick = openHistory;
    // Red de seguridad, igual que en páginas: guarda lo pendiente y
    // vuelve a cargar el lienzo.
    root.querySelector("#refresh").onclick = async () => {
      if (state.dirty) await save();
      reload();
    };
    const prev = root.querySelector("#preview");
    prev.onclick = async () => {
      prev.disabled = true;
      try {
        if (state.dirty || state.saving) await save();
        const base = cfg.preview || cfg.home;
        window.open(base + (String(base).includes("?") ? "&" : "?") + "t=" + Date.now(), "krg-preview");
      } finally {
        prev.disabled = false;
      }
    };
    // Tiradores y botones de plegar: los mismos que en páginas.
    FIELDS.bindSplit();
  }

  function paintChrome() {
    const snap = FIELDS.panelSnap();
    root.querySelectorAll("[data-region]").forEach((b) => b.classList.toggle("is-on", b.dataset.region === state.region));
    root.querySelectorAll("[data-bp]").forEach((b) => b.classList.toggle("is-on", b.dataset.bp === state.bp));
    applyBp();
    paintLeft();
    paintInspector();
    paint();
    FIELDS.panelRestore(snap);
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
    if (!canvas || !wrap) return;
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
    if (slot) {
      slot.style.width = Math.round(w * scale) + "px";
      slot.style.height = Math.round(h * scale) + "px";
    }
    const iw = root.querySelector("[data-view-w]");
    const ih = root.querySelector("[data-view-h]");
    if (iw && document.activeElement !== iw) iw.value = String(w);
    if (ih && document.activeElement !== ih) ih.value = String(h);
    const label = root.querySelector(".b-bp-label");
    if (label) label.textContent = `${w} × ${h}`;
    root.querySelectorAll("[data-bp]").forEach((b) => b.classList.toggle("is-on", b.dataset.bp === state.bp));
  }

  function bindDevice() {
    root.querySelectorAll("[data-view-w]").forEach((inp) => {
      inp.addEventListener("input", () => {
        state.viewW = Number(inp.value) || state.viewW;
        state.bp = bpFromWidth(state.viewW);
        applyBp();
      });
    });
    root.querySelectorAll("[data-view-h]").forEach((inp) => {
      inp.addEventListener("input", () => {
        state.viewH = Number(inp.value) || state.viewH;
        applyBp();
      });
    });
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

  function restoreChromeView() {
    const iframe = root.querySelector("iframe");
    const slot = root.querySelector(".b-frame-slot");
    const snap = state.frameSnap;
    if (!snap) return;
    const go = () => {
      try {
        const doc = iframe?.contentDocument;
        if (snap.id && doc && slot) {
          const el = doc.querySelector(`.m-n-${snap.id}`) || doc.querySelector(`[data-krg-id="${snap.id}"]`);
          if (el) {
            const er = el.getBoundingClientRect();
            const sr = slot.getBoundingClientRect();
            slot.scrollTop += (er.top - sr.top) - sr.height * 0.28;
            return;
          }
        }
        if (snap.region === "footer" && doc && slot) {
          const f = doc.querySelector(".m-site-footer");
          if (f) {
            const er = f.getBoundingClientRect();
            const sr = slot.getBoundingClientRect();
            slot.scrollTop += (er.top - sr.top);
            return;
          }
        }
      } catch (e) { /* */ }
      if (slot) slot.scrollTop = snap.y || 0;
    };
    go();
    requestAnimationFrame(go);
  }

  function ping() {
    const w = root.querySelector("iframe")?.contentWindow;
    if (!w) return;
    w.postMessage({ source: "krg-parent", type: "chrome", region: state.region }, "*");
    // Y marcar en la vista el bloque elegido, como en páginas.
    if (state.fSel) w.postMessage({ source: "krg-parent", type: "select", id: state.fSel }, "*");
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "krg") return;
    if (d.type === "chrome" && d.region && d.region !== state.region) {
      state.region = d.region;
      paintChrome();
      return;
    }
    // Pulsar un bloque del pie en la vista lo selecciona en el panel,
    // igual que en la pantalla de páginas.
    if (d.type === "select" && d.id) {
      const hit = findF(fSections(), d.id);
      if (!hit) return;
      state.region = "footer";
      state.fSel = d.id;
      paintChrome();
      ping();
    }
  });
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
      save();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      saveKeepalive();
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("pagehide", () => { if (state.dirty) saveKeepalive(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.dirty) saveKeepalive();
  });

  Promise.all([api.get("/header"), api.get("/footer"), api.get("/menus"), api.get("/tokens").catch(() => ({})), api.get("/registry").catch(() => [])])
    .then(([header, footer, menus, tokens, registry]) => {
      state.header = window.KrgBuilderCore.adoptDoc(header);
      state.footer = window.KrgBuilderCore.adoptDoc(footer);
      if (!state.footer.sections) state.footer.sections = [];
      state.menus = menus;
      state.registry = Array.isArray(registry) ? registry : (registry?.components || []);
      window.KrgUi?.setTokens(tokens);
      try {
        const raw = localStorage.getItem("krg-chrome-draft");
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft?.header) state.header = window.KrgBuilderCore.adoptDoc({ ...header, ...draft.header });
          if (draft?.footer) state.footer = window.KrgBuilderCore.adoptDoc({ ...footer, ...draft.footer });
          state.dirty = true;
          state.save = "Sin guardar";
        }
      } catch (e) { /* */ }
      state.last = pack();
      pushHistory("Cargado");
      ensureShell();
      paintChrome();
      if (state.dirty) save();
    })
    .catch((e) => { root.innerHTML = `<p style="padding:24px">${esc(e.message)}</p>`; });
})();
