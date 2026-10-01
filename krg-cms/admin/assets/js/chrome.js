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
    widths: { desktop: 1280, tablet: 768, mobile: 390 },
  };
  const PRESETS = {
    desktop: { w: 1280, h: 800 },
    tablet: { w: 768, h: 1024 },
    mobile: { w: 390, h: 844 },
  };
  const FOOTER_ADD = [
    { t: "section", l: "Sección" },
    { t: "row", l: "Fila" },
    { t: "column", l: "Columna" },
    { t: "heading", l: "Encabezado" },
    { t: "paragraph", l: "Párrafo" },
    { t: "rich-text", l: "Texto" },
    { t: "image", l: "Imagen" },
    { t: "button", l: "Botón" },
    { t: "divider", l: "Separador" },
    { t: "menu", l: "Menú" },
    { t: "social-links", l: "Redes" },
    { t: "search-form", l: "Buscador" },
  ];
  const FOOTER_LAYOUTS = [
    { id: "12", spans: [12], label: "1" },
    { id: "6-6", spans: [6, 6], label: "1/2" },
    { id: "4-4-4", spans: [4, 4, 4], label: "1/3" },
    { id: "3-3-3-3", spans: [3, 3, 3, 3], label: "1/4" },
    { id: "4-8", spans: [4, 8], label: "1/3 · 2/3" },
    { id: "8-4", spans: [8, 4], label: "2/3 · 1/3" },
    { id: "4-5-3", spans: [4, 5, 3], label: "Logo · Menú · Extra" },
  ];
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

  function pack() {
    return JSON.stringify({ header: state.header, footer: state.footer });
  }
  function applyPack(raw) {
    const s = JSON.parse(raw);
    state.header = s.header;
    state.footer = s.footer;
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
    document.body.appendChild(wrap);
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
        state.header = { ...state.header, ...header };
      }
      if (footer && typeof footer === "object" && (footer.text !== undefined || footer.background !== undefined)) {
        state.footer = { ...state.footer, ...footer };
      }
      state.save = "Guardado";
      state.dirty = false;
      state.last = pack();
      try { localStorage.removeItem("krg-chrome-draft"); } catch (e) { /* */ }
      pushHistory("Guardado");
      paintLiveChrome();
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

  function reload() {
    const iframe = root.querySelector("iframe");
    const base = cfg.preview || cfg.home;
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

  function inspector() {
    return state.region === "footer" ? footerFields() : headerFields();
  }

  function headerFields() {
    const h = state.header || {};
    const tab = state.inspTab || "content";
    const lw = (key, label, fallback) => {
      const v = Number(h[key] ?? fallback);
      return `<label>${label}
        <input type="range" min="16" max="480" data-h-num="${key}" value="${v}">
        <span data-logo-w-lab>${v} px</span>
      </label>`;
    };
    let body = "";
    if (tab === "content") {
      body = `<div class="acc"><h5>Contenido</h5>
        ${field("Texto CTA", `<input data-h="ctaText" value="${esc(h.ctaText || "")}">`)}
        ${field("URL CTA", `<input data-h="ctaUrl" value="${esc(h.ctaUrl || "")}">`)}
        ${field("Menú", `<select data-h="menuSlug">${(state.menus || []).map((m) => `<option value="${esc(m.slug)}" ${h.menuSlug === m.slug ? "selected" : ""}>${esc(m.name || m.slug)}</option>`).join("")}</select>`)}
        ${field("Logo escritorio", `${h.logoSrc ? `<img src="${esc(h.logoSrc)}" alt="" style="max-height:36px;width:auto;display:block;margin-bottom:6px">` : ""}<button type="button" class="m-btn ghost" data-media="logoId">Elegir logo</button>`)}
        ${field("Logo móvil / tablet", `${h.logoMobileSrc ? `<img src="${esc(h.logoMobileSrc)}" alt="" style="max-height:36px;width:auto;display:block;margin-bottom:6px">` : ""}<button type="button" class="m-btn ghost" data-media="logoMobile">Elegir logo</button>`)}
        ${field("Clic en el logo", `<select data-h="logoLink">
          <option value="home" ${(h.logoLink || "home") === "home" ? "selected" : ""}>Inicio del sitio</option>
          <option value="section" ${h.logoLink === "section" ? "selected" : ""}>Sección de la página (#id)</option>
          <option value="url" ${h.logoLink === "url" ? "selected" : ""}>URL externa</option>
        </select>`)}
        ${h.logoLink === "section" || h.logoLink === "url" ? field(h.logoLink === "section" ? "ID de sección" : "URL del logo", `<input data-h="logoUrl" placeholder="${h.logoLink === "section" ? "#servicios" : "https://"}" value="${esc(h.logoUrl || "")}">`) : ""}
      </div>`;
    } else if (tab === "design") {
      const ah = h.align || "left";
      const av = h.vAlign || "center";
      const dist = h.distribute || "none";
      const abtn = (key, val, cur, icon, title) => `<button type="button" class="b-align-btn${cur === val ? " is-on" : ""}" data-h-set="${key}" data-v="${val}" title="${title}">${ALIGN_ICONS[icon]}</button>`;
      const nbtn = (key, val, fallback, lab) => `<button type="button" class="${(h[key] || fallback) === val ? "is-on" : ""}" data-h-set="${key}" data-v="${val}">${lab}</button>`;
      body = `<div class="acc"><h5>Alinear</h5>
        <p class="m-muted">Alinear objetos</p>
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
        </div>
      </div>
      <div class="acc"><h5>Tipo de menú</h5>
        <p class="m-muted">Barra horizontal o botón Menú (hamburguesa), independiente en cada tamaño.</p>
        <p class="m-muted">Escritorio</p>
        <div class="b-seg">${nbtn("navModeDesktop", "bar", "bar", "Barra (escritorio)")}${nbtn("navModeDesktop", "drawer", "bar", "Hamburguesa (móvil)")}</div>
        <p class="m-muted">Tablet</p>
        <div class="b-seg">${nbtn("navModeTablet", "bar", "bar", "Barra (escritorio)")}${nbtn("navModeTablet", "drawer", "bar", "Hamburguesa (móvil)")}</div>
        <p class="m-muted">Móvil</p>
        <div class="b-seg">${nbtn("navModeMobile", "bar", "drawer", "Barra (escritorio)")}${nbtn("navModeMobile", "drawer", "drawer", "Hamburguesa (móvil)")}</div>
      </div>
      <div class="acc"><h5>Colores</h5>
        ${window.KrgUi.colorField("Fondo", h.background || "", 'data-h="background"')}
        ${window.KrgUi.colorField("Color texto", h.color || "", 'data-h="color"')}
        ${window.KrgUi.colorField("Color de texto hover", h.navHoverFg || "", 'data-h="navHoverFg"')}
        ${window.KrgUi.colorField("Fondo hover", h.navHoverBg || "", 'data-h="navHoverBg"')}
      </div>
      <div class="acc"><h5>Escala del logo</h5>
        <p class="m-muted">Una medida por cada vista del preview.</p>
        ${lw("logoWidth", "Escritorio", 140)}
        ${lw("logoWidthTablet", "Tablet", h.logoWidth || 140)}
        ${lw("logoWidthMobile", "Móvil", Math.min(h.logoWidth || 140, 120))}
        ${field("Radio del logo", `<select data-h="logoRadius">
          ${[["none","Ninguno"],["sm","S"],["md","M"],["lg","L"],["full","Círculo"]].map(([v,l]) => `<option value="${v}" ${(h.logoRadius || "none") === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>`)}
      </div>
      <div class="acc"><h5>Medidas</h5>
        ${field("Alto (px)", `<input type="number" data-h-num="height" value="${h.height || 72}">`)}
        ${field("Padding Y", `<input type="number" data-h-num="paddingY" value="${h.paddingY || 12}">`)}
      </div>
      <div class="acc"><h5>Vidrio</h5>
        <label>Transparente / vidrio <input type="checkbox" data-h-bool="transparent" ${h.transparent ? "checked" : ""}></label>
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
        ` : ""}
      </div>
      <div class="acc"><h5>Animación</h5>
        <div class="b-seg">${FOOTER_ANIMS.map((a) => `<button type="button" class="${(h.animation || "none") === a.v ? "is-on" : ""}" data-h-anim="${a.v}">${a.l}</button>`).join("")}</div>
        <label>Duración (ms) <input type="number" data-h-num="animDuration" min="0" max="3000" value="${h.animDuration ?? 600}"></label>
        <label>Retardo (ms) <input type="number" data-h-num="animDelay" min="0" max="3000" value="${h.animDelay ?? 0}"></label>
      </div>`;
    } else {
      body = `<div class="acc"><h5>Avanzado</h5>
        <label>Sticky <input type="checkbox" data-h-bool="sticky" ${h.sticky !== false ? "checked" : ""}></label>
        ${field("Identificador CSS", `<input data-h="htmlId" value="${esc(h.htmlId || "")}" placeholder="cabecera">`)}
        ${field("Clase CSS", `<input data-h="htmlClass" value="${esc(h.htmlClass || "")}" placeholder="mi-header">`)}
      </div>`;
    }
    return `<div class="acc"><h5>Header</h5>
      <p class="m-muted">Pestañas como en las páginas. El preview se puede ensanchar con las manijas naranjas.</p>
    </div>${tabsHtml()}${body}`;
  }

  function tabsHtml() {
    const tab = state.inspTab || "content";
    return `<div class="b-tabs">
      <button type="button" data-insp-tab="content" class="${tab === "content" ? "is-on" : ""}">Contenido</button>
      <button type="button" data-insp-tab="design" class="${tab === "design" ? "is-on" : ""}">Diseño</button>
      <button type="button" data-insp-tab="advanced" class="${tab === "advanced" ? "is-on" : ""}">Avanzado</button>
    </div>`;
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
  function firstColumn() {
    const secs = fSections();
    if (!secs.length) {
      const sec = makeNode("section");
      secs.push(sec);
      return sec.children[0].children[0];
    }
    const sec = secs[secs.length - 1];
    const row = (sec.children || []).find((c) => c.type === "row") || sec;
    const col = (row.children || []).find((c) => c.type === "column") || row;
    if (!col.children) col.children = [];
    return col;
  }
  function addFooterNode(type) {
    const n = makeNode(type);
    const hit = state.fSel ? findF(fSections(), state.fSel) : null;
    if (type === "section") {
      n.props.fullWidth = false;
      fSections().push(n);
    } else if (type === "row") {
      let sec = null;
      if (hit) {
        if (hit.node.type === "section") sec = hit.node;
        else {
          let p = hit.parent;
          while (p && p.type !== "section") {
            const up = findF(fSections(), p.id);
            p = up && up.parent;
          }
          sec = p && p.type === "section" ? p : null;
        }
      }
      if (!sec) {
        if (!fSections().length) fSections().push(makeNode("section"));
        sec = fSections()[fSections().length - 1];
      }
      sec.children = sec.children || [];
      sec.children.push(n);
    } else if (type === "column") {
      let row = null;
      if (hit) {
        if (hit.node.type === "row") row = hit.node;
        else if (hit.parent && hit.parent.type === "row") row = hit.parent;
      }
      if (!row) {
        if (!fSections().length) fSections().push(makeNode("section"));
        const sec = fSections()[fSections().length - 1];
        row = (sec.children || []).find((c) => c.type === "row");
        if (!row) {
          row = makeNode("row");
          sec.children = sec.children || [];
          sec.children.push(row);
        }
      }
      row.children = row.children || [];
      row.children.push(n);
    } else {
      let col = null;
      if (hit) {
        if (hit.node.type === "column") col = hit.node;
        else if (hit.parent && hit.parent.type === "column") col = hit.parent;
      }
      if (!col) col = firstColumn();
      col.children = col.children || [];
      col.children.push(n);
    }
    state.fSel = n.id;
    markDirty();
    paintChrome();
  }
  function applyRowLayout(row, spans) {
    row.props = row.props || {};
    row.props.layout = spans.join("-");
    row.children = row.children || [];
    while (row.children.length < spans.length) row.children.push(makeNode("column"));
    if (row.children.length > spans.length) row.children = row.children.slice(0, spans.length);
    row.children.forEach((c, i) => {
      c.props = c.props || {};
      c.props.span = spans[i];
      c.props.spanTablet = spans[i] >= 6 ? 6 : 12;
      c.props.spanMobile = 12;
    });
  }
  function alignBar(node) {
    const p = node.props || {};
    const isCol = node.type === "column";
    const isRow = node.type === "row";
    const hKey = isCol ? "contentHAlign" : "alignH";
    const vKey = isRow ? "vAlign" : isCol ? "contentVAlign" : "alignV";
    const h = p[hKey] || "start";
    const v = p[vKey] || "start";
    const dist = p.distribute || "none";
    const btn = (key, val, cur, icon, title) => `<button type="button" class="b-align-btn${cur === val ? " is-on" : ""}" data-fprop-set="${key}" data-v="${val}" title="${title}">${ALIGN_ICONS[icon]}</button>`;
    return `<div class="acc"><h5>Alinear</h5>
      <p class="m-muted">Alinear objetos</p>
      <div class="b-align">
        ${btn(hKey, "start", h, "hStart", "Izquierda")}
        ${btn(hKey, "center", h, "hCenter", "Centro horizontal")}
        ${btn(hKey, "end", h, "hEnd", "Derecha")}
        ${btn(vKey, "start", v, "vStart", "Arriba")}
        ${btn(vKey, "center", v, "vCenter", "Centro vertical")}
        ${btn(vKey, "end", v, "vEnd", "Abajo")}
      </div>
      <p class="m-muted">Distribuir objetos</p>
      <div class="b-align">
        ${btn("distribute", "x", dist, "distX", "Distribuir horizontal")}
        ${btn("distribute", "y", dist, "distY", "Distribuir vertical")}
      </div>
    </div>`;
  }
  function chromeNavMode(node) {
    if (node.type !== "menu") return "";
    const p = node.props || {};
    const row = (key, label, fallback) => {
      const cur = p[key] || fallback;
      return `<p class="m-muted">${label}</p>
        <div class="b-seg">
          <button type="button" class="${cur === "bar" ? "is-on" : ""}" data-fprop-set="${key}" data-v="bar">Barra (escritorio)</button>
          <button type="button" class="${cur === "drawer" ? "is-on" : ""}" data-fprop-set="${key}" data-v="drawer">Hamburguesa (móvil)</button>
        </div>`;
    };
    return `<div class="acc"><h5>Tipo de menú</h5>
      <p class="m-muted">Barra horizontal o botón Menú, en cada tamaño.</p>
      ${row("navModeDesktop", "Escritorio", "bar")}
      ${row("navModeTablet", "Tablet", "bar")}
      ${row("navModeMobile", "Móvil", "drawer")}
    </div>`;
  }
  function animBar(node) {
    const cur = node.animation || "none";
    return `<div class="acc"><h5>Animación</h5>
      <div class="b-seg">${FOOTER_ANIMS.map((a) => `<button type="button" class="${cur === a.v ? "is-on" : ""}" data-fanim="${a.v}">${a.l}</button>`).join("")}</div>
      <label>Duración (ms) <input type="number" data-fnode="animDuration" min="0" max="3000" value="${esc(node.animDuration ?? 600)}"></label>
      <label>Retardo (ms) <input type="number" data-fnode="animDelay" min="0" max="3000" value="${esc(node.animDelay ?? 0)}"></label>
    </div>`;
  }
  function moveInList(list, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const t = list[i];
    list[i] = list[j];
    list[j] = t;
  }
  function treeHtml(nodes, depth) {
    return (nodes || []).map((n) => `
      <div class="b-tree-row ${state.fSel === n.id ? "is-on" : ""}" style="padding-left:${8 + depth * 12}px">
        <button type="button" data-fsel="${esc(n.id)}">${esc(n.name || n.type)}</button>
        <span>
          <button type="button" data-fup="${esc(n.id)}" title="Subir">↑</button>
          <button type="button" data-fdn="${esc(n.id)}" title="Bajar">↓</button>
          <button type="button" data-frm="${esc(n.id)}" title="Quitar">×</button>
        </span>
      </div>
      ${treeHtml(n.children || [], depth + 1)}`).join("");
  }
  function paintLeft() {
    const box = root.querySelector("#chrome-left");
    if (!box) return;
    if (state.region !== "footer") {
      box.innerHTML = `<div class="b-sec"><h4>Región</h4>
        <div class="b-palette">
          <button data-region="header">Header</button>
          <button data-region="footer">Footer</button>
        </div>
        <p class="b-empty">El canvas es la home real. Click en cabecera o pie. Los campos se guardan solos.</p>
      </div>`;
      box.querySelectorAll("[data-region]").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.region === state.region);
        b.onclick = () => { state.region = b.dataset.region; state.fSel = null; paintChrome(); ping(); };
      });
      return;
    }
    box.innerHTML = `<div class="b-sec"><h4>Footer</h4>
      <div class="b-palette">
        <button data-region="header">Header</button>
        <button data-region="footer" class="is-on">Footer</button>
      </div>
      <button type="button" class="m-btn ghost" data-froot style="margin:8px 0">Ajustes del pie</button>
      <h4>Añadir</h4>
      <div class="b-palette">
        ${FOOTER_ADD.map((x) => `<button type="button" data-fadd="${x.t}">${esc(x.l)}</button>`).join("")}
      </div>
      <h4>Estructura</h4>
      <div class="b-tree">${treeHtml(fSections(), 0) || "<p class='b-empty'>Añade una sección.</p>"}</div>
    </div>`;
    box.querySelectorAll("[data-region]").forEach((b) => {
      b.onclick = () => { state.region = b.dataset.region; state.fSel = null; paintChrome(); ping(); };
    });
    box.querySelector("[data-froot]")?.addEventListener("click", () => { state.fSel = null; paintInspector(); });
    box.querySelectorAll("[data-fadd]").forEach((b) => b.onclick = () => addFooterNode(b.dataset.fadd));
    box.querySelectorAll("[data-fsel]").forEach((b) => b.onclick = () => { state.fSel = b.dataset.fsel; paintChrome(); });
    box.querySelectorAll("[data-fup],[data-fdn],[data-frm]").forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        const id = b.dataset.fup || b.dataset.fdn || b.dataset.frm;
        const hit = findF(fSections(), id);
        if (!hit) return;
        if (b.dataset.frm) {
          hit.list.splice(hit.index, 1);
          if (state.fSel === id) state.fSel = null;
        } else {
          moveInList(hit.list, hit.index, b.dataset.fup ? -1 : 1);
        }
        markDirty();
        paintChrome();
      };
    });
  }
  function footerFields() {
    const hit = state.fSel ? findF(fSections(), state.fSel) : null;
    if (hit) return footerNodeFields(hit.node);
    return footerChromeFields();
  }
  function footerChromeAlign() {
    const f = state.footer || {};
    const ah = f.align || "left";
    const av = f.vAlign || "start";
    const dist = f.distribute || "none";
    const abtn = (key, val, cur, icon, title) => `<button type="button" class="b-align-btn${cur === val ? " is-on" : ""}" data-f-set="${key}" data-v="${val}" title="${title}">${ALIGN_ICONS[icon]}</button>`;
    return `<div class="acc"><h5>Alinear</h5>
      <p class="m-muted">Alinear el contenido del pie</p>
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
      </div>
    </div>`;
  }
  function copyrightFields() {
    const f = state.footer || {};
    const cal = f.copyrightAlign || "left";
    const w = String(f.copyrightWeight || "");
    const sty = f.copyrightStyle || "normal";
    const segA = (val, lab) => `<button type="button" class="${cal === val ? "is-on" : ""}" data-f-set="copyrightAlign" data-v="${val}">${lab}</button>`;
    return `<div class="acc"><h5>Copyright</h5>
      <p class="m-muted">Se edita aparte del resto del pie: texto, enlace, tipografía y color.</p>
      ${field("Texto", `<input data-f="copyright" value="${esc(f.copyright || "")}">`)}
      ${field("Enlace", `<input data-f="copyrightUrl" value="${esc(f.copyrightUrl || "")}" placeholder="https:// o #seccion">`)}
      <label>Abrir en pestaña nueva <input type="checkbox" data-f-bool="copyrightNewTab" ${f.copyrightNewTab ? "checked" : ""}></label>
      <p class="m-muted">Alineación del copyright</p>
      <div class="b-seg">${segA("left", "Izquierda")}${segA("center", "Centro")}${segA("right", "Derecha")}</div>
      ${window.KrgUi.fontFamilyField("Familia", f.copyrightFont || "", 'data-f="copyrightFont"')}
      ${field("Peso", `<select data-f="copyrightWeight">
        ${[["","Heredar"],["300","Light"],["400","Regular"],["500","Medium"],["600","Semibold"],["700","Bold"]].map(([v,l]) => `<option value="${v}" ${w === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>`)}
      ${field("Estilo", `<select data-f="copyrightStyle">
        <option value="normal" ${sty === "normal" ? "selected" : ""}>Normal</option>
        <option value="italic" ${sty === "italic" ? "selected" : ""}>Cursiva</option>
      </select>`)}
      ${field("Tamaño (px)", `<input type="number" min="10" max="48" data-f-num="copyrightSize" value="${f.copyrightSize || 13}">`)}
      ${window.KrgUi.colorField("Color", f.copyrightColor || "", 'data-f="copyrightColor"')}
      ${window.KrgUi.colorField("Fondo", f.copyrightBg || "", 'data-f="copyrightBg"')}
    </div>`;
  }
  function footerChromeFields() {
    const f = state.footer || {};
    const social = (f.social || []).map((s) => `${s.label || ""}|${s.url || ""}`).join("\\n");
    const tab = state.inspTab || "content";
    let body = "";
    if (tab === "content") {
      body = `
        ${footerChromeAlign()}
        <div class="acc"><h5>Contenido del pie</h5>
          ${field("Texto", `<textarea data-f="text">${esc(f.text || "")}</textarea>`)}
          ${field("Columna extra (título)", `<input data-f="extraTitle" value="${esc(f.extraTitle || "")}">`)}
          ${field("Columna extra (texto)", `<textarea data-f="extraText">${esc(f.extraText || "")}</textarea>`)}
          ${field("Redes (Nombre|URL)", `<textarea data-f="social">${esc(social)}</textarea>`)}
          ${field("Menú", `<select data-f="menuSlug">${(state.menus || []).map((m) => `<option value="${esc(m.slug)}" ${f.menuSlug === m.slug ? "selected" : ""}>${esc(m.name || m.slug)}</option>`).join("")}</select>`)}
          ${field("Logo", `<input data-f-num="logoId" value="${f.logoId || 0}"><button type="button" class="m-btn ghost" data-fmedia="logoId">Biblioteca</button>`)}
          <label>Mostrar buscador <input type="checkbox" data-f-bool="showSearch" ${f.showSearch ? "checked" : ""}></label>
          <label>Mostrar columnas clásicas <input type="checkbox" data-f-bool="showClassic" ${f.showClassic !== false ? "checked" : ""}></label>
          <p class="m-muted">Las secciones nuevas se añaden a la izquierda y se pintan debajo de estas columnas.</p>
        </div>
        ${copyrightFields()}`;
    } else if (tab === "design") {
      body = `
        ${footerChromeAlign()}
        <div class="acc"><h5>Colores</h5>
          ${window.KrgUi.colorField("Fondo", f.background || "", 'data-f="background"')}
          ${window.KrgUi.colorField("Color de texto", f.color || "", 'data-f="color"')}
          ${window.KrgUi.colorField("Color de enlaces", f.linkColor || "", 'data-f="linkColor"')}
          ${window.KrgUi.colorField("Color de títulos", f.headingColor || "", 'data-f="headingColor"')}
          ${window.KrgUi.colorField("Texto de enlace al pasar", f.linkHoverFg || "", 'data-f="linkHoverFg"')}
          ${window.KrgUi.colorField("Fondo de enlace al pasar", f.linkHoverBg || "", 'data-f="linkHoverBg"')}
        </div>
        ${copyrightFields()}
        <div class="acc"><h5>Medidas</h5>
          ${field("Columnas clásicas", `<input type="number" min="1" max="4" data-f-num="columns" value="${f.columns || 3}">`)}
          ${field("Padding Y (px)", `<input type="number" data-f-num="paddingY" value="${f.paddingY || 64}">`)}
        </div>`;
    } else {
      body = `
        <div class="acc"><h5>Avanzado</h5>
          ${field("Identificador CSS", `<input data-f="htmlId" value="${esc(f.htmlId || "")}" placeholder="pie-sitio">`)}
          ${field("Clase CSS", `<input data-f="htmlClass" value="${esc(f.htmlClass || "")}" placeholder="mi-footer">`)}
        </div>`;
    }
    return `<div class="acc"><h5>Footer</h5><p class="m-muted">Pestañas como en las páginas. Añade secciones a la izquierda.</p></div>${tabsHtml()}${body}`;
  }
  function footerNodeFields(node) {
    const def = defOf(node.type);
    const tab = state.inspTab || "content";
    const fields = def.fields || [];
    const st = (node.styles && node.styles[state.bp]) || {};
    node.props = node.props || {};
    const layoutTypes = ["section", "row", "column"];
    let body = "";
    if (tab === "content") {
      if (layoutTypes.includes(node.type)) {
        let row = node.type === "row" ? node : (node.children || []).find((c) => c.type === "row");
        if (node.type === "column") row = null;
        const current = row ? (row.props?.layout || "") : (node.props?.layout || "");
        body = `<div class="acc"><h5>${esc(node.name || def.name || node.type)}</h5>
          ${field("Nombre interno", `<input data-fnode="name" value="${esc(node.name || "")}">`)}
          ${node.type === "column" ? `
            ${field("Ancho desktop (1–12)", `<input type="number" min="1" max="12" data-fprop="span" value="${node.props.span ?? 12}">`)}
            ${field("Ancho tablet (1–12)", `<input type="number" min="1" max="12" data-fprop="spanTablet" value="${node.props.spanTablet ?? 12}">`)}
            ${field("Ancho móvil (1–12)", `<input type="number" min="1" max="12" data-fprop="spanMobile" value="${node.props.spanMobile ?? 12}">`)}
            <p class="m-muted">Selecciona esta columna y añade módulos (logo, texto, menú) desde la paleta.</p>
          ` : ""}
          ${node.type === "row" || node.type === "section" ? `
            <p class="m-muted">Disposición de columnas</p>
            <div class="b-seg">${FOOTER_LAYOUTS.map((l) => `<button type="button" class="${current === l.id ? "is-on" : ""}" data-flayout="${l.id}">${l.label}</button>`).join("")}</div>
            ${node.type === "row" ? field("Separación (px)", `<input type="number" min="0" max="80" data-fprop="gap" value="${node.props.gap ?? 24}">`) : ""}
          ` : ""}
        </div>
        ${alignBar(node)}`;
      } else {
        const list = fields.filter((f) => (f.group || "content") === "content");
        body = `<div class="acc"><h5>${esc(node.name || def.name || node.type)}</h5>
          ${list.map((f) => nodeField(node, f)).join("") || "<p class='m-muted'>Sin campos de contenido.</p>"}
        </div>`;
      }
    } else if (tab === "design") {
      const list = fields.filter((f) => ["design", "colors", "spacing", "typography"].includes(f.group));
      body = `<div class="acc"><h5>Diseño</h5>
        ${window.KrgUi.colorField("Fondo del bloque", st.background || "", 'data-fstyle="background"')}
        ${window.KrgUi.colorField("Color de texto", st.color || "", 'data-fstyle="color"')}
        ${field("Relleno", `<input data-fstyle="padding" value="${esc(st.padding || "")}" placeholder="24px">`)}
        ${node.type === "image" ? `
          <p class="m-muted">Radio</p>
          <div class="b-seg">${[["none","Ninguno"],["sm","S"],["md","M"],["lg","L"],["full","Círculo"]].map(([v,l]) => `<button type="button" class="${(node.props.radius || "none") === v ? "is-on" : ""}" data-fprop-set="radius" data-v="${v}">${l}</button>`).join("")}</div>
          <label>Escala (%)
            <input type="range" min="10" max="200" data-fprop="scale" value="${Number(node.props.scale ?? 100)}">
            <span>${Number(node.props.scale ?? 100)}</span>
          </label>
          ${field("Ancho", `<input data-fstyle="width" value="${esc(st.width || "")}" placeholder="180px">`)}
          ${field("Alto", `<input data-fstyle="height" value="${esc(st.height || "")}" placeholder="auto">`)}
          ${field("Máximo ancho", `<input data-fstyle="max-width" value="${esc(st["max-width"] || "")}" placeholder="180px">`)}
        ` : ""}
        ${list.map((f) => nodeField(node, f)).join("")}
      </div>
      ${alignBar(node)}
      ${chromeNavMode(node)}
      ${animBar(node)}`;
    } else {
      body = `<div class="acc"><h5>Avanzado</h5>
        ${field("Identificador CSS", `<input data-fnode="htmlId" value="${esc(node.htmlId || "")}">`)}
        ${field("Clase CSS", `<input data-fnode="htmlClass" value="${esc(node.htmlClass || "")}">`)}
        <label>Visible <input type="checkbox" data-fnode-bool="visible" ${node.visible !== false ? "checked" : ""}></label>
      </div>
      ${animBar(node)}`;
    }
    return `<div class="acc"><h5>${esc(node.type)}</h5>
      <button type="button" class="m-btn ghost" data-froot>← Ajustes del pie</button>
    </div>${tabsHtml()}${body}`;
  }
  function nodeField(node, f) {
    const v = node.props?.[f.key];
    const attr = `data-fprop="${esc(f.key)}"`;
    if (f.type === "toggle") {
      return `<label>${esc(f.label)} <input type="checkbox" ${attr} ${v ? "checked" : ""}></label>`;
    }
    if (f.type === "textarea") {
      return field(f.label, `<textarea ${attr}>${esc(v || "")}</textarea>`);
    }
    if (f.type === "select" || f.type === "htmlTag") {
      const opts = (f.options || []).map((o) => {
        const val = typeof o === "string" ? o : (o.value || o);
        const lab = typeof o === "string" ? o : (o.label || o.value);
        return `<option value="${esc(val)}" ${String(v) === String(val) ? "selected" : ""}>${esc(lab)}</option>`;
      }).join("");
      return field(f.label, `<select ${attr}>${opts}</select>`);
    }
    if (f.type === "color") {
      return window.KrgUi.colorField(f.label, typeof v === "string" ? v : "", attr);
    }
    if (f.type === "number") {
      return field(f.label, `<input type="number" ${attr} value="${esc(v ?? "")}">`);
    }
    if (f.key === "imageId" || f.type === "image") {
      return field(f.label, `<input type="number" ${attr} value="${esc(v || 0)}"><button type="button" class="m-btn ghost" data-fprop-media="${esc(f.key)}">Biblioteca</button>`);
    }
    return field(f.label || f.key, `<input ${attr} value="${esc(v ?? "")}">`);
  }

  function bindInspector() {
    const box = root.querySelector(".b-insp");
    if (!box) return;
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
    bind("[data-media]", (b) => {
      b.onclick = () => media("header", b.dataset.media);
    });
    bind("[data-fmedia]", (b) => {
      b.onclick = () => media("footer", b.dataset.fmedia);
    });
    bind("[data-insp-tab]", (b) => {
      b.onclick = () => { state.inspTab = b.dataset.inspTab; paintInspector(); };
    });
    bind("[data-froot]", (b) => {
      b.onclick = () => { state.fSel = null; paintChrome(); };
    });
    bind("[data-fprop]", (inp) => {
      const go = () => {
        const hit = state.fSel ? findF(fSections(), state.fSel) : null;
        if (!hit) return;
        hit.node.props = hit.node.props || {};
        hit.node.props[inp.dataset.fprop] = inp.type === "checkbox" ? inp.checked : (inp.type === "number" ? Number(inp.value) : inp.value);
        markDirty();
      };
      inp.addEventListener("input", go);
      inp.addEventListener("change", go);
    });
    bind("[data-fstyle]", (inp) => {
      const go = () => {
        const hit = state.fSel ? findF(fSections(), state.fSel) : null;
        if (!hit) return;
        hit.node.styles = hit.node.styles || { desktop: {}, tablet: {}, mobile: {} };
        hit.node.styles[state.bp] = hit.node.styles[state.bp] || {};
        if (inp.value) hit.node.styles[state.bp][inp.dataset.fstyle] = inp.value;
        else delete hit.node.styles[state.bp][inp.dataset.fstyle];
        markDirty();
      };
      inp.addEventListener("input", go);
      inp.addEventListener("change", go);
    });
    bind("[data-fnode]", (inp) => {
      inp.addEventListener("input", () => {
        const hit = state.fSel ? findF(fSections(), state.fSel) : null;
        if (!hit) return;
        hit.node[inp.dataset.fnode] = inp.value;
        markDirty();
      });
    });
    bind("[data-fnode-bool]", (inp) => {
      inp.addEventListener("change", () => {
        const hit = state.fSel ? findF(fSections(), state.fSel) : null;
        if (!hit) return;
        hit.node[inp.dataset.fnodeBool] = inp.checked;
        markDirty();
      });
    });
    bind("[data-flayout]", (b) => {
      b.onclick = () => {
        const hit = state.fSel ? findF(fSections(), state.fSel) : null;
        if (!hit) return;
        const lay = FOOTER_LAYOUTS.find((l) => l.id === b.dataset.flayout);
        if (!lay) return;
        let row = hit.node.type === "row" ? hit.node : (hit.node.children || []).find((c) => c.type === "row");
        if (!row && hit.parent && hit.parent.type === "row") row = hit.parent;
        if (!row) return;
        applyRowLayout(row, lay.spans);
        markDirty();
        paintChrome();
      };
    });
    bind("[data-fprop-set]", (b) => {
      b.onclick = () => {
        const hit = state.fSel ? findF(fSections(), state.fSel) : null;
        if (!hit) return;
        hit.node.props = hit.node.props || {};
        hit.node.props[b.dataset.fpropSet] = b.dataset.v;
        markDirty();
        paintInspector();
      };
    });
    bind("[data-fanim]", (b) => {
      b.onclick = () => {
        const hit = state.fSel ? findF(fSections(), state.fSel) : null;
        if (!hit) return;
        hit.node.animation = b.dataset.fanim;
        markDirty();
        paintInspector();
      };
    });
    bind("[data-fprop-media]", (b) => {
      b.onclick = () => {
        if (!window.wp?.media) return;
        const frame = wp.media({ title: "Imagen", multiple: false });
        frame.on("select", () => {
          const att = frame.state().get("selection").first().toJSON();
          const hit = state.fSel ? findF(fSections(), state.fSel) : null;
          if (!hit) return;
          hit.node.props = hit.node.props || {};
          hit.node.props[b.dataset.fpropMedia] = att.id;
          markDirty();
          paintInspector();
        });
        frame.open();
      };
    });
    window.KrgUi?.wire(box);
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
    box.innerHTML = inspector();
    bindInspector();
  }

  function ensureShell() {
    if (state.shell) return;
    root.innerHTML = `
      <div class="b-root">
        <div class="b-top">
          <a href="${cfg.admin}?page=krg" title="Volver a KRG CMS">←</a>
          <a href="${cfg.admin}?page=krg-nav">Navegación</a>
          <strong>Chrome del sitio</strong>
          <div class="b-bp" id="regions">
            <button data-region="header">Header</button>
            <button data-region="footer">Footer</button>
          </div>
          <div class="b-bp" id="bps">
            <button type="button" data-bp="desktop">Desktop</button>
            <button type="button" data-bp="tablet">Tablet</button>
            <button type="button" data-bp="mobile">Mobile</button>
          </div>
          <div class="b-device">
            <input type="number" data-view-w min="320" max="2560" value="1280" title="Ancho">
            <span>×</span>
            <input type="number" data-view-h min="400" max="2400" value="800" title="Alto">
            <label class="b-fit"><input type="checkbox" data-fit> Ajustar</label>
          </div>
          <span class="grow"></span>
          <button class="m-btn ghost" id="undo" title="Ctrl+Z">Deshacer</button>
          <button class="m-btn ghost" id="redo" title="Ctrl+Y">Rehacer</button>
          <button class="m-btn ghost" id="history">Historial</button>
          <span class="b-status">Guardado</span>
          <button class="m-btn" id="save">Guardar</button>
        </div>
        <div class="b-layout">
          <aside class="b-left" id="chrome-left"></aside>
          <div class="b-split" aria-hidden="true"></div>
          <div class="b-canvas">
            <div class="b-frame-slot">
              <div class="b-frame-wrap">
                <iframe src="${esc(cfg.preview || cfg.home)}" title="Vista del sitio"></iframe>
                <div class="b-rz b-rz-e" data-rz="e" title="Arrastra el ancho"></div>
                <div class="b-rz b-rz-s" data-rz="s" title="Arrastra el alto"></div>
                <div class="b-rz b-rz-se" data-rz="se" title="Arrastra el tamaño"></div>
              </div>
            </div>
          </div>
          <aside class="b-right b-insp"></aside>
        </div>
      </div>`;
    state.shell = true;
    const iframe = root.querySelector("iframe");
    if (iframe) iframe.addEventListener("load", () => {
      paintLiveChrome();
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
    root.querySelector("#save").onclick = save;
    root.querySelector("#undo").onclick = undo;
    root.querySelector("#redo").onclick = redo;
    root.querySelector("#history").onclick = openHistory;
  }

  function paintChrome() {
    root.querySelectorAll("[data-region]").forEach((b) => b.classList.toggle("is-on", b.dataset.region === state.region));
    root.querySelectorAll("[data-bp]").forEach((b) => b.classList.toggle("is-on", b.dataset.bp === state.bp));
    applyBp();
    paintLeft();
    paintInspector();
    paint();
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
    root.querySelector("iframe")?.contentWindow?.postMessage({ source: "krg-parent", type: "chrome", region: state.region }, "*");
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "krg") return;
    if (d.type === "chrome" && d.region && d.region !== state.region) {
      state.region = d.region;
      paintChrome();
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
      state.header = header;
      state.footer = footer;
      if (!state.footer.sections) state.footer.sections = [];
      state.menus = menus;
      state.registry = Array.isArray(registry) ? registry : (registry?.components || []);
      window.KrgUi?.setTokens(tokens);
      try {
        const raw = localStorage.getItem("krg-chrome-draft");
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft?.header) state.header = { ...header, ...draft.header };
          if (draft?.footer) state.footer = { ...footer, ...draft.footer };
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
