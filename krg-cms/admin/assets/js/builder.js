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

  function regen(n) {
    n.id = uid();
    n.source = n.source || "local";
    (n.children || []).forEach(regen);
    return n;
  }

  function cloneNode(node) {
    return regen(JSON.parse(JSON.stringify(node)));
  }

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
   * Es el gemelo en JavaScript de `BoxStyles::declarations()` en PHP. Son
   * dos porque el lienzo tiene que repintar antes de guardar, pero la
   * lista de propiedades y la forma de escribirlas son una sola, y hay un
   * banco que compara letra por letra lo que generan los dos.
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

  function paintLiveCss() {
    const iframe = root.querySelector("iframe");
    const doc = iframe?.contentDocument;
    if (!doc || !state.doc) return;
    let tag = doc.getElementById("krg-live-styles");
    if (!tag) {
      tag = doc.createElement("style");
      tag.id = "krg-live-styles";
      doc.head.appendChild(tag);
    }
    const textProps = ["color", "font-size", "font-weight", "font-family", "font-style", "letter-spacing", "line-height", "text-transform", "text-decoration"];
    const imgProps = ["width", "height", "max-width", "max-height", "object-fit", "object-position", "border-radius", "box-shadow", "filter", "border-width", "border-style", "border-color", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"];
    let css = "";
    const walk = (nodes) => {
      (nodes || []).forEach((n) => {
        const id = String(n.id || "").replace(/[^a-zA-Z0-9_-]/g, "");
        const st = n.styles?.[state.bp] || {};
        if (id && st) {
          const box = [];
          const text = [];
          const img = [];
          Object.entries(st).forEach(([p, v]) => {
            if (!v || CAJA_PROPS.includes(p)) return;
            // Sin `!important`, igual que el servidor: esta hoja se
            // inyecta la ultima del documento y el tema entero vive en
            // `@layer krg`, asi que gana sin forzar nada. Si aqui se
            // forzara y alla no, el lienzo y la web dejarian de ser lo
            // mismo en cuanto algo compitiera.
            const d = `${p}:${v}`;
            if (textProps.includes(p)) text.push(d);
            else box.push(d);
            if (imgProps.includes(p)) img.push(d);
          });
          const sel = `.m-n-${id}`;
          // Un solo emisor y una sola forma de escribirlo: lo mismo que
          // pone DocumentCssCompiler en la web, con el mismo orden de
          // reglas y sin `!important` en ninguna.
          const caja = cssCaja(st);
          if (caja.length) css += `${sel}{${caja.join(";")}}`;
          if (box.length) css += `${sel}{${box.join(";")}}`;
          if (text.length) css += `${sel},${sel} :is(h1,h2,h3,h4,h5,h6,p,.m-hero-title,.m-hero-sub,.m-heading,.m-eyebrow,.m-role-h1,.m-role-h2,.m-role-h3){${text.join(";")}}`;
          if (img.length) css += `${sel} img{${img.join(";")}}`;
          const fl = n.filters || {};
          const hasF = n.filters && (Number(fl.hue) || Number(fl.sat) !== 100 || Number(fl.brightness) !== 100 || Number(fl.contrast) !== 100 || Number(fl.invert) || Number(fl.sepia));
          if (hasF) {
            css += `${sel}{filter:hue-rotate(${fl.hue || 0}deg) saturate(${fl.sat ?? 100}%) brightness(${fl.brightness ?? 100}%) contrast(${fl.contrast ?? 100}%) invert(${fl.invert || 0}%) sepia(${fl.sepia || 0}%)}`;
          }
          const cc = n.customCss || {};
          if (cc.main) css += `${sel}{${cc.main}}`;
          if (cc.before) css += `${sel}::before{content:"";display:block;${cc.before}}`;
          if (cc.after) css += `${sel}::after{content:"";display:block;${cc.after}}`;
          if (n.animDuration) css += `${sel}{--m-anim-dur:${n.animDuration}ms;animation-duration:${n.animDuration}ms;animation-delay:${n.animDelay || 0}ms;animation-timing-function:${n.animEasing || "ease"}}`;
          // Colores y espacio propios del bloque de marca. El servidor los
          // emite como variables en linea; aqui se repintan en el lienzo
          // sin esperar al guardado, que es lo que hacia parecer que el
          // panel de color «no actualizaba».
          const vars = [];
          const themeVars = [];
          [["bgColor", "--m-th-bg"], ["textColor", "--m-th-fg"]].forEach(([k, v]) => {
            const c = cssColor(n.props?.[k]);
            if (c) themeVars.push(`${v}:${c}`);
          });
          [["cardColor", "--m-rev-card-bg"],
            ["accent", "--m-carta-accent"], ["titleColor", "--m-carta-h-c"], ["catColor", "--m-carta-cat-c"],
            ["nameColor", "--m-carta-name-c"], ["descColor", "--m-carta-desc-c"],
            ["priceColor", "--m-carta-price-c"], ["badgeColor", "--m-carta-badge-c"]].forEach(([k, v]) => {
            const c = cssColor(n.props?.[k]);
            if (c) vars.push(`${v}:${c}`);
          });
          // En el panel partido y en el pie partido el tema vive en el
          // panel de texto, no en la raiz: ahi hay que escribirlo.
          const panelSel = n.type === "split-panel" ? `${sel} .m-sp-copy`
            : n.type === "footer-split" ? `${sel} .m-fs-panel` : sel;
          if (themeVars.length) css += `${panelSel}{${themeVars.join(";")}}`;
          if (vars.length) css += `${sel}{${vars.join(";")}}`;
          if (n.type === "row") {
            const g = Number(n.props?.gap ?? 24);
            const va = ["start", "center", "end", "stretch"].includes(n.props?.vAlign) ? n.props.vAlign : "start";
            css += `${sel}{display:grid;gap:${g}px;grid-template-columns:repeat(12,minmax(0,1fr));align-items:${va}}`;
          }
          if (n.type === "column") {
            const bp = state.bp;
            const span = bp === "mobile" ? (n.props?.spanMobile ?? 12) : bp === "tablet" ? (n.props?.spanTablet ?? n.props?.span ?? 12) : (n.props?.span ?? 12);
            let col = `grid-column:span ${span};min-width:0`;
            const cv = n.props?.contentVAlign || "start";
            const ch = n.props?.contentHAlign || "start";
            if (cv === "center" || cv === "end" || ch === "center" || ch === "end") {
              const jc = cv === "center" ? "center" : cv === "end" ? "flex-end" : "flex-start";
              const ai = ch === "center" ? "center" : ch === "end" ? "flex-end" : "flex-start";
              col += `;display:flex;flex-direction:column;justify-content:${jc};align-items:${ai};height:100%`;
            }
            css += `${sel}{${col}}`;
          }
          if (n.type === "section") {
            const els = doc.querySelector(`.m-n-${id}`);
            if (els) {
              const w = n.props?.width || (n.props?.fullWidth === false ? "boxed" : "full");
              ["boxed", "full", "bleed"].forEach((v) => els.classList.toggle("is-w-" + v, w === v));
              els.classList.toggle("is-full", w !== "boxed");
              els.classList.toggle("is-boxed", w === "boxed");
              // Alto, alineación y cortina también en el lienzo, para que
              // lo que se ve aquí sea lo que sale publicado.
              const mh = n.props?.minHeight || "auto";
              const va = n.props?.vAlign || "start";
              ["screen", "screen-minus-header", "tall", "half", "custom"].forEach((v) => {
                els.classList.toggle("is-mh-" + v, mh === v);
              });
              const exact = (n.props?.heightMode || "exact") !== "min";
              els.classList.toggle("is-h-exact", mh === "custom" && exact);
              els.classList.toggle("is-h-min", mh === "custom" && !exact);
              if (mh === "custom") {
                const u = n.props?.minHeightUnit === "px" ? "px" : "svh";
                els.style.setProperty("--m-sec-h", (n.props?.minHeightValue || 60) + u);
              } else {
                els.style.removeProperty("--m-sec-h");
              }
              // `stretch` faltaba en esta lista: el servidor sí lo
              // imprimía, pero en el lienzo no pasaba nada hasta que el
              // marco se recargaba, así que elegirlo parecía no hacer
              // nada. Las tres clases de `is-sa-*` van detrás porque sólo
              // tienen sentido estirando.
              ["start", "center", "end", "stretch"].forEach((v) => {
                els.classList.toggle("is-va-" + v, mh !== "auto" && va === v);
              });
              const sa = ["start", "center", "end"].includes(n.props?.stretchAlign) ? n.props.stretchAlign : "center";
              ["start", "center", "end"].forEach((v) => {
                els.classList.toggle("is-sa-" + v, mh !== "auto" && va === "stretch" && sa === v);
              });
              els.classList.toggle("is-curtain", n.props?.curtain === "on");
            }
          }
          if (n.type === "gallery") {
            const h = Math.max(120, Math.min(900, Number(n.props?.height ?? 420)));
            const ht = Math.min(h, 360);
            const hm = Math.min(h, 240);
            css += `${sel}{--m-gal-h:${h}px;--m-gal-h-t:${ht}px;--m-gal-h-m:${hm}px}`;
            const elg = doc.querySelector(`.m-n-${id}`);
            if (elg) {
              elg.classList.toggle("is-full", !!n.props?.fullWidth);
              const adapt = n.props?.adaptSmall !== false;
              elg.classList.toggle("is-adapt", !!n.props?.fullWidth && adapt);
              elg.classList.toggle("is-full-sm", !!n.props?.fullWidth && !adapt);
              const carousel = (n.props?.layout || "carousel") !== "grid";
              elg.classList.toggle("is-fit-cover", carousel || n.props?.objectFit !== "contain");
              elg.classList.toggle("is-fit-contain", !carousel && n.props?.objectFit === "contain");
              if (carousel) {
                css += `${sel} .m-gallery-slide img,${sel}.m-gallery.is-carousel .m-img{width:100%;height:100%;max-width:none;max-height:none;object-fit:cover;object-position:center center}`;
              }
              elg.classList.toggle("is-parallax", !!n.props?.parallax);
              if (n.props?.parallax) {
                const zoom = Math.max(0, Math.min(40, Number(n.props.parallaxZoom ?? 8)));
                const amount = Math.max(0, Math.min(40, Number(n.props.parallaxAmount ?? 10)));
                elg.setAttribute("data-parallax-zoom", String(zoom));
                elg.setAttribute("data-parallax-amount", String(amount));
                elg.setAttribute("data-parallax-dir", n.props.parallaxInvert ? "-1" : "1");
                elg.style.setProperty("--m-px-zoom", String(1 + zoom / 100));
              } else {
                elg.removeAttribute("data-parallax-zoom");
                elg.removeAttribute("data-parallax-amount");
                elg.removeAttribute("data-parallax-dir");
                elg.style.removeProperty("--m-px-zoom");
              }
            }
          }
          if (n.type === "statement-cta") {
            // Mismo trato que la galeria: la foto de fondo, su encaje,
            // la fusion y el parallax se ven en el lienzo sin esperar al
            // guardado. Las variables van en el elemento porque el
            // servidor tambien las pinta en linea y un estilo en linea
            // le gana a cualquier hoja.
            const els = doc.querySelector(`.m-n-${id}`);
            if (els) {
              const hayFoto = !!Number(n.props?.imageId || 0);
              const fit = n.props?.bgFit === "contain" ? "contain" : "cover";
              const pos = ["center", "top", "bottom", "left", "right"].includes(n.props?.bgPosition) ? n.props.bgPosition : "center";
              const blend = n.props?.blend || "normal";
              els.style.setProperty("--m-sc-fit", hayFoto ? fit : "");
              els.style.setProperty("--m-sc-pos", hayFoto ? pos : "");
              els.style.setProperty("--m-sc-blend", hayFoto ? blend : "");
              const veil = els.querySelector(".m-sc-veil");
              if (veil) veil.style.opacity = String(Math.max(0, Math.min(90, Number(n.props?.overlay ?? 40))) / 100);
              els.classList.toggle("is-bg-section", hayFoto && n.props?.bgScope === "section");
              const px = hayFoto && !!n.props?.parallax;
              els.classList.toggle("is-parallax", px);
              if (px) {
                const zoom = Math.max(0, Math.min(40, Number(n.props.parallaxZoom ?? 8)));
                const amount = Math.max(0, Math.min(40, Number(n.props.parallaxAmount ?? 10)));
                els.setAttribute("data-parallax-zoom", String(zoom));
                els.setAttribute("data-parallax-amount", String(amount));
                els.setAttribute("data-parallax-dir", n.props.parallaxInvert ? "-1" : "1");
                els.style.setProperty("--m-px-zoom", String(1 + zoom / 100));
              } else {
                els.removeAttribute("data-parallax-zoom");
                els.removeAttribute("data-parallax-amount");
                els.removeAttribute("data-parallax-dir");
                els.style.removeProperty("--m-px-zoom");
              }
            }
          }
          if (n.type === "video") {
            const h = Math.max(80, Math.min(1200, Number(n.props?.height ?? 420)));
            const w = Math.max(0, Number(n.props?.width ?? 100));
            const mode = n.props?.sizeMode || "auto";
            css += `${sel}{--m-vid-h:${h}px;--m-vid-w:${w}${mode === "custom" ? "px" : "%"}}`;
            const elv = doc.querySelector(`.m-n-${id}`);
            if (elv) {
              ["is-auto", "is-full", "is-fullWidth", "is-fullHeight", "is-custom", "is-fit-cover", "is-fit-contain"].forEach((c) => elv.classList.remove(c));
              elv.classList.add("is-" + mode);
              elv.classList.add("is-fit-" + (n.props?.fit === "contain" ? "contain" : "cover"));
              elv.setAttribute("data-volume", String(Math.max(0, Math.min(100, Number(n.props?.volume ?? 0)))));
            }
          }
          if (n.type === "image" && n.props?.fillMode === "fill") {
            const fit = ["cover", "contain", "fill"].includes(n.props?.objectFit) ? n.props.objectFit : "cover";
            css += `.m-row:has(${sel}){align-items:stretch}`;
            css += `.m-col:has(${sel}){display:flex;flex-direction:column;height:100%}`;
            css += `${sel}{flex:1 1 auto;height:100%;min-height:0;overflow:hidden}`;
            css += `${sel} img{width:100%;height:100%;object-fit:${fit};max-width:none}`;
          }
          const el = id ? doc.querySelector(`.m-n-${id}`) : null;
          if (el && n.type === "image") {
            el.classList.toggle("is-fill", n.props?.fillMode === "fill");
            ["none", "sm", "md", "lg", "full"].forEach((r) => el.classList.remove("is-radius-" + r));
            el.classList.add("is-radius-" + (["none", "sm", "md", "lg", "full"].includes(n.props?.radius) ? n.props.radius : "none"));
            const sc = Math.max(10, Math.min(200, Number(n.props?.scale ?? 100)));
            el.classList.toggle("is-scale", sc !== 100);
            if (sc !== 100) el.style.setProperty("--m-img-scale", sc + "%");
            else el.style.removeProperty("--m-img-scale");
            el.classList.toggle("is-parallax", !!n.props?.parallax);
            if (n.props?.parallax) {
              const zoom = Math.max(0, Math.min(40, Number(n.props.parallaxZoom ?? 8)));
              const amount = Math.max(0, Math.min(40, Number(n.props.parallaxAmount ?? 10)));
              el.setAttribute("data-parallax-zoom", String(zoom));
              el.setAttribute("data-parallax-amount", String(amount));
              el.setAttribute("data-parallax-dir", n.props.parallaxInvert ? "-1" : "1");
              el.style.setProperty("--m-px-zoom", String(1 + zoom / 100));
            } else {
              el.removeAttribute("data-parallax-zoom");
              el.removeAttribute("data-parallax-amount");
              el.removeAttribute("data-parallax-dir");
              el.style.removeProperty("--m-px-zoom");
            }
          }
          if (el && n.type === "row") {
            el.classList.remove("m-valign-start", "m-valign-center", "m-valign-end", "m-valign-stretch");
            el.classList.add("m-valign-" + (["start", "center", "end", "stretch"].includes(n.props?.vAlign) ? n.props.vAlign : "start"));
          }
          if (el && n.type === "column") {
            el.classList.remove("m-content-v-center", "m-content-v-end", "m-content-h-center", "m-content-h-end");
            if (n.props?.contentVAlign === "center" || n.props?.contentVAlign === "end") el.classList.add("m-content-v-" + n.props.contentVAlign);
            if (n.props?.contentHAlign === "center" || n.props?.contentHAlign === "end") el.classList.add("m-content-h-" + n.props.contentHAlign);
          }
          if (el) {
            ["h-center", "h-end", "h-stretch", "v-center", "v-end", "v-stretch"].forEach((c) => el.classList.remove("m-align-" + c));
            el.classList.remove("is-dist-x", "is-dist-y");
            const ah = n.type === "column" ? n.props?.contentHAlign : n.props?.alignH;
            const av = n.type === "column" ? n.props?.contentVAlign : n.type === "row" ? "" : n.props?.alignV;
            if (ah && ah !== "start") el.classList.add("m-align-h-" + ah);
            if (av && av !== "start") el.classList.add("m-align-v-" + av);
            if (n.props?.distribute === "x" || n.props?.distribute === "y") el.classList.add("is-dist-" + n.props.distribute);
            patchLiveContent(el, n);
          }
        }
        if (n.children) walk(n.children);
      });
    };
    walk(state.doc.sections);
    tag.textContent = css;
    iframe.contentWindow?.dispatchEvent(new Event("scroll"));
  }

  function treeSig(nodes) {
    return (nodes || []).map((n) => (n.id || "") + ":" + (n.type || "") + "[" + treeSig(n.children) + "]").join(",");
  }

  function patchLiveContent(el, n) {
    const p = n.props || {};
    const setText = (node, val) => {
      if (!node || val == null) return;
      if (node.childElementCount) {
        const t = node.querySelector("h1,h2,h3,h4,h5,h6,p,span,a") || node;
        if (t.childElementCount === 0) t.textContent = val;
        else t.childNodes.forEach((c) => { if (c.nodeType === 3) c.textContent = val; });
      } else node.textContent = val;
    };
    if (n.type === "heading") setText(el.querySelector("h1,h2,h3,h4,h5,h6,.m-heading") || el, p.text);
    if (n.type === "paragraph") setText(el.querySelector("p,.m-p") || el, p.text);
    if (n.type === "eyebrow") setText(el.querySelector(".m-eyebrow") || el, p.text);
    if (n.type === "quote") {
      setText(el.querySelector("blockquote, p, .m-quote") || el, p.text);
      const cite = el.querySelector("cite");
      if (cite && p.cite != null) cite.textContent = p.cite;
    }
    if (n.type === "rich-text" && p.html != null) {
      const box = el.querySelector(".m-rich, .m-rt") || el;
      if (box.innerHTML !== p.html) box.innerHTML = p.html;
    }
    if (n.type === "button" || n.type === "buttons") {
      const a = el.querySelector("a.m-btn, a");
      if (a) {
        if (p.text != null) a.textContent = p.text;
        if (p.url) a.setAttribute("href", p.url);
      }
    }
    if (n.type === "image") {
      const img = el.querySelector("img");
      if (img && p.imageUrl && img.getAttribute("src") !== p.imageUrl) img.src = p.imageUrl;
      if (img && p.alt != null) img.alt = p.alt;
    }
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

  function addComponent(type) {
    if (type === "section" || type === "row") {
      openLayoutPicker((layout) => {
        snapshot();
        if (!state.doc?.sections) state.doc.sections = [];
        const built = instantiateLayout(layout);
        if (type === "section") {
          const sec = makeNode("section");
          sec.props.name = "Sección";
          sec.name = "Sección";
          sec.children = [built];
          state.doc.sections.push(sec);
          state.selected = firstLeafColumn(built)?.id || sec.id;
        } else {
          insertNode(built);
          state.selected = firstLeafColumn(built)?.id || built.id;
        }
        markDirty();
        render();
      });
      return;
    }
    if (type === "column") {
      snapshot();
      const col = makeColumn(12);
      const hit = state.selected ? findNode(state.doc.sections, state.selected) : null;
      const row = hit?.node?.type === "row" ? hit.node : hit?.parent?.type === "row" ? hit.parent : null;
      if (row) {
        row.children = row.children || [];
        row.children.push(col);
      } else {
        insertNode(makeRow([12]));
      }
      state.selected = col.id;
      markDirty();
      render();
      return;
    }
    snapshot();
    const node = makeNode(type);
    insertNode(node);
    state.selected = node.id;
    markDirty();
    render();
  }

  function insertCloned(node) {
    snapshot();
    const copy = cloneNode(node);
    if (copy.type !== "section") {
      const sec = makeNode("section");
      sec.name = copy.name || copy.type;
      sec.children.push(copy);
      state.doc.sections.push(sec);
      state.selected = copy.id;
    } else {
      state.doc.sections.push(copy);
      state.selected = copy.id;
    }
    markDirty();
    render();
  }

  function containsId(node, id) {
    if (!node) return false;
    if (node.id === id) return true;
    return (node.children || []).some((c) => containsId(c, id));
  }
  function canDropInside(parent, child) {
    if (!parent || !child || parent.id === child.id) return false;
    if (parent.type === "section") return child.type === "row";
    if (parent.type === "row") return child.type === "column";
    if (parent.type === "column") return child.type !== "section" && child.type !== "column";
    return !!(defOf(parent.type)?.children);
  }
  function dropPlace(e, hd, src, dest) {
    const r = hd.getBoundingClientRect();
    const y = r.height ? (e.clientY - r.top) / r.height : 0.5;
    if (canDropInside(dest.node, src.node) && y > 0.28 && y < 0.72) return "inside";
    return y < 0.5 ? "before" : "after";
  }
  function dropNode(srcId, destId, place) {
    if (!srcId || !destId || srcId === destId) return false;
    const src = findNode(state.doc.sections, srcId);
    const dest = findNode(state.doc.sections, destId);
    if (!src || !dest) return false;
    if (containsId(src.node, destId)) {
      toast("No se puede soltar un bloque dentro de sí mismo.");
      return false;
    }
    if (place === "inside" && !canDropInside(dest.node, src.node)) {
      toast("Ese bloque no puede ir dentro de «" + (dest.node.name || dest.node.type) + "».");
      return false;
    }
    snapshot();
    const [item] = src.list.splice(src.index, 1);
    const dest2 = findNode(state.doc.sections, destId);
    if (!dest2) {
      src.list.splice(src.index, 0, item);
      return false;
    }
    if (place === "inside") {
      dest2.node.children = dest2.node.children || [];
      dest2.node.children.push(item);
    } else {
      const idx = dest2.index + (place === "after" ? 1 : 0);
      dest2.list.splice(idx, 0, item);
    }
    state.selected = item.id;
    markDirty();
    render();
    return true;
  }
  function startRename(nid, el) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit || !el) return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "b-rename";
    input.value = hit.node.name || hit.node.type || "";
    el.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (ok && v && v !== hit.node.name) {
        snapshot();
        hit.node.name = v;
        hit.node.props = window.KrgBuilderCore.dict(hit.node, "props");
        if (hit.node.type === "section") hit.node.props.name = v;
        markDirty();
      }
      render({ keepFrame: true });
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }
  function bindTree() {
    const treeEl = root.querySelector(".b-tree");
    if (!treeEl) return;
    const clearDrop = () => {
      treeEl.querySelectorAll(".drop-before, .drop-after, .drop-in").forEach((el) => {
        el.classList.remove("drop-before", "drop-after", "drop-in");
      });
    };
    treeEl.querySelectorAll("[data-drag]").forEach((grip) => {
      grip.addEventListener("dragstart", (e) => {
        const nid = grip.getAttribute("data-drag");
        e.dataTransfer.setData("text/plain", nid);
        e.dataTransfer.effectAllowed = "move";
        const hd = grip.closest(".hd");
        if (hd) {
          hd.classList.add("is-drag");
          try { e.dataTransfer.setDragImage(hd, 12, 12); } catch (err) { /* ok */ }
        }
        treeEl.dataset.drag = nid;
      });
      grip.addEventListener("dragend", () => {
        clearDrop();
        treeEl.querySelectorAll(".is-drag").forEach((el) => el.classList.remove("is-drag"));
        delete treeEl.dataset.drag;
      });
    });
    treeEl.querySelectorAll(".hd[data-nid]").forEach((hd) => {
      hd.addEventListener("dragover", (e) => {
        const srcId = treeEl.dataset.drag;
        const destId = hd.getAttribute("data-nid");
        if (!srcId || srcId === destId) return;
        const src = findNode(state.doc.sections, srcId);
        const dest = findNode(state.doc.sections, destId);
        if (!src || !dest || containsId(src.node, destId)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        clearDrop();
        const place = dropPlace(e, hd, src, dest);
        hd.classList.add(place === "inside" ? "drop-in" : place === "before" ? "drop-before" : "drop-after");
      });
      hd.addEventListener("dragleave", (e) => {
        if (!hd.contains(e.relatedTarget)) hd.classList.remove("drop-before", "drop-after", "drop-in");
      });
      hd.addEventListener("drop", (e) => {
        e.preventDefault();
        const srcId = e.dataTransfer.getData("text/plain") || treeEl.dataset.drag;
        const destId = hd.getAttribute("data-nid");
        const src = findNode(state.doc.sections, srcId);
        const dest = findNode(state.doc.sections, destId);
        clearDrop();
        if (!src || !dest) return;
        dropNode(srcId, destId, dropPlace(e, hd, src, dest));
      });
    });
    treeEl.querySelectorAll("[data-tw]").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        treeToggle(b.getAttribute("data-tw"));
      });
    });
    root.querySelectorAll("[data-tree-all]").forEach((b) => {
      b.onclick = () => treeAll(b.getAttribute("data-tree-all") === "open");
    });
    treeEl.querySelectorAll("[data-rename]").forEach((el) => {
      el.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startRename(el.getAttribute("data-rename"), el);
      });
    });
  }
  function moveNode(nid, dir) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit) return;
    const j = hit.index + dir;
    if (j < 0 || j >= hit.list.length) return;
    snapshot();
    const [item] = hit.list.splice(hit.index, 1);
    hit.list.splice(j, 0, item);
    markDirty();
    render();
  }

  function shiftAcrossColumns(nid, dir) {
    dir = dir < 0 ? -1 : 1;
    const origin = findNode(state.doc.sections, nid);
    if (!origin) return;
    let cursor = origin.parent ? findNode(state.doc.sections, origin.parent.id) : null;
    while (cursor) {
      if (cursor.node.type === "column" && cursor.parent && cursor.parent.type === "row") {
        const cols = (cursor.parent.children || []).filter((c) => c.type === "column");
        const ci = cols.findIndex((c) => c.id === cursor.node.id);
        const ni = ci + dir;
        if (ci >= 0 && ni >= 0 && ni < cols.length) {
          snapshot();
          const fresh = findNode(state.doc.sections, nid);
          if (!fresh) return;
          const [item] = fresh.list.splice(fresh.index, 1);
          const dest = cols[ni];
          dest.children = dest.children || [];
          const leaf = firstLeafColumn(dest) || dest;
          leaf.children = leaf.children || [];
          leaf.children.push(item);
          state.selected = item.id;
          markDirty();
          render();
          return;
        }
      }
      cursor = cursor.parent ? findNode(state.doc.sections, cursor.parent.id) : null;
    }
    toast(dir < 0 ? "No hay columna a la izquierda." : "No hay columna a la derecha.");
  }

  function duplicateNode(nid) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit) return;
    snapshot();
    const copy = cloneNode(hit.node);
    hit.list.splice(hit.index + 1, 0, copy);
    state.selected = copy.id;
    markDirty();
    render();
  }

  function hideNode(nid) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit) return;
    snapshot();
    hit.node.visible = hit.node.visible === false;
    markDirty();
    render();
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

  function deleteNode(nid, confirmed) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit) return;
    if (!confirmed) {
      const name = hit.node.name || hit.node.type;
      const wrap = document.createElement("div");
      wrap.className = "confirm";
      wrap.innerHTML = `<div class="box">
        <h3>Eliminar «${esc(name)}»</h3>
        <p>Esta acción no se puede deshacer desde aquí, solo con Ctrl+Z o Historial.</p>
        <div class="m-row">
          <button class="m-btn danger" id="yes">Eliminar</button>
          <button class="m-btn ghost" id="no">Cancelar</button>
        </div>
      </div>`;
      document.body.appendChild(wrap);
      wrap.querySelector("#no").onclick = () => wrap.remove();
      wrap.querySelector("#yes").onclick = () => { wrap.remove(); deleteNode(nid, true); };
      return;
    }
    snapshot();
    hit.list.splice(hit.index, 1);
    state.selected = null;
    markDirty();
    render();
  }

  async function saveTemplate(nid) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit) return;
    const name = prompt("Nombre de la plantilla", hit.node.name || hit.node.type);
    if (!name) return;
    await api.post("/templates", { name, node: hit.node });
    state.templates = await api.get("/templates");
    toast("Plantilla guardada");
  }

  async function saveGlobal(nid) {
    const hit = findNode(state.doc.sections, nid);
    if (!hit) return;
    const name = prompt("Nombre del componente global", hit.node.name || hit.node.type);
    if (!name) return;
    snapshot();
    const g = await api.post("/globals", { name, node: hit.node });
    hit.node.source = "global";
    hit.node.globalId = g.id;
    state.globals = await api.get("/globals");
    markDirty();
    render();
    toast("Componente global creado");
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function palette() {
    const cats = {};
    state.registry.forEach((c) => {
      cats[c.category] = cats[c.category] || [];
      cats[c.category].push(c);
    });
    return Object.entries(cats).map(([cat, items]) => `
      <div class="b-sec">
        <h4>${esc(cat)}</h4>
        <div class="b-palette">
          ${items.filter((c) => c.slug !== "column").map((c) => `<button type="button" data-add="${c.slug}">${esc(c.name)}</button>`).join("")}
        </div>
      </div>`).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Árbol de estructura                                                  */
  /* ------------------------------------------------------------------ */

  // Iconos por tipo de nodo. Hacen el árbol legible de un vistazo: el
  // nombre ya no es lo único que distingue una fila de una columna.
  const TREE_ICONS = {
    section: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 2h12v3H2V2zm0 4.5h12V14H2V6.5zm1.2 1.2v5.1h9.6V7.7H3.2z"/></svg>',
    row: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v4H2V3zm0 6h12v4H2V9zm1.2 1.2v1.6h9.6v-1.6H3.2zm0-6V5.8h9.6V4.2H3.2z"/></svg>',
    column: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 2h5v12H2V2zm7 0h5v12H9V2zM3.2 3.2v9.6h2.6V3.2H3.2zm7 0v9.6h2.6V3.2h-2.6z"/></svg>',
    text: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v1.6H9v8.4H7V4.6H2V3z"/></svg>',
    image: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v10H2V3zm1.2 1.2v6l2.6-2.4 2.3 2.1 2.3-2.8 2.4 2.7V4.2H3.2zM6 5.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
    video: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v10H2V3zm4.4 2.4v5.2L10.8 8 6.4 5.4z"/></svg>',
    map: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M8 1.6a4 4 0 0 0-4 4c0 3 4 8.8 4 8.8s4-5.8 4-8.8a4 4 0 0 0-4-4zm0 5.6a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z"/></svg>',
    form: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v3.2H2V3zm0 4.6h12V14H2V7.6zM3.2 8.8v4h9.6v-4H3.2zm0-4.6v1.8h9.6V4.2H3.2z"/></svg>',
    button: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 5h12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm.2 1.4v3.2h11.6V6.4H2.2z"/></svg>',
    list: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3.2h2v2H2v-2zm3.6 0H14v2H5.6v-2zM2 7h2v2H2V7zm3.6 0H14v2H5.6V7zM2 10.8h2v2H2v-2zm3.6 0H14v2H5.6v-2z"/></svg>',
    module: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2.6 2.6h10.8v10.8H2.6V2.6zm1.2 1.2v8.4h8.4V3.8H3.8z"/></svg>',
  };
  const TREE_ICON_BY_TYPE = {
    section: "section", row: "row", column: "column",
    heading: "text", paragraph: "text", "rich-text": "text", text: "text",
    "display-type": "text", "scroll-text": "text", wordmark: "text",
    "statement-list": "list", "numbered-list": "list", "info-table": "list",
    "menu-list": "list", marquee: "text",
    image: "image", gallery: "image", figure: "image", logo: "image",
    video: "video", map: "map",
    "everest-form": "form", form: "form", "contact-form": "form", "search-form": "form",
    button: "button", buttons: "button",
  };
  function treeIcon(type) {
    return TREE_ICONS[TREE_ICON_BY_TYPE[type] || "module"] || TREE_ICONS.module;
  }

  /** Ruta de ancestros de un nodo, de la raíz hacia abajo. */
  function ancestorIds(nid) {
    const path = [];
    let hit = findNode(state.doc.sections, nid);
    while (hit && hit.parent) {
      path.unshift(hit.parent.id);
      hit = findNode(state.doc.sections, hit.parent.id);
    }
    return path;
  }

  function treeToggle(nid) {
    if (state.treeClosed.has(nid)) state.treeClosed.delete(nid);
    else state.treeClosed.add(nid);
    render({ keepFrame: true });
  }

  function treeAll(open) {
    if (open) {
      state.treeClosed.clear();
    } else {
      const walk = (nodes) => (nodes || []).forEach((n) => {
        if ((n.children || []).length) {
          state.treeClosed.add(n.id);
          walk(n.children);
        }
      });
      walk(state.doc.sections);
    }
    render({ keepFrame: true });
  }

  function tree() {
    // Al cambiar la selección se abren sus ancestros: seleccionar algo
    // desde el lienzo no puede dejarlo escondido en una rama plegada.
    if (state.selected && state.treeOpenedFor !== state.selected) {
      state.treeOpenedFor = state.selected;
      ancestorIds(state.selected).forEach((id) => state.treeClosed.delete(id));
    }
    const walk = (nodes, parent = null) =>
      (nodes || []).map((n) => {
        const kids = (n.children || []).length > 0;
        const open = kids && !state.treeClosed.has(n.id);
        const cls = ["sec"];
        if (n.id === state.selected) cls.push("sel");
        if (kids) cls.push("has-kids");
        if (open) cls.push("is-open");
        if (n.visible === false) cls.push("is-off");
        const isSec = n.type === "section";
        const inCol = parent?.type === "column";
        return `<div class="${cls.join(" ")}" data-tree="${n.id}">
          <div class="hd" data-nid="${n.id}">
            ${kids
              ? `<button type="button" class="b-tw" data-tw="${n.id}" aria-expanded="${open ? "true" : "false"}" title="${open ? "Contraer" : "Expandir"}">${open ? "−" : "+"}</button>`
              : `<span class="b-tw is-leaf" aria-hidden="true"></span>`}
            <span class="b-drag" draggable="true" data-drag="${n.id}" title="Arrastrar para mover">⋮⋮</span>
            <span class="b-tico" aria-hidden="true">${treeIcon(n.type)}</span>
            <span class="b-tname" data-sel="${n.id}" data-rename="${n.id}" title="Clic para seleccionar · Doble clic para renombrar">${esc(n.name || n.type)}</span>
            ${n.source === "global" ? `<span class="b-tag" title="Componente global">⌁</span>` : ""}
            ${n.visible === false ? `<span class="b-tag">oculto</span>` : ""}
            <span class="b-acts">
              <button class="b-ico" data-up="${n.id}" title="Subir">↑</button>
              <button class="b-ico" data-down="${n.id}" title="Bajar">↓</button>
              ${inCol ? `<button type="button" class="b-ico" data-shift="${n.id}" data-dir="prev" title="Mover a columna izquierda">‹</button>
                <button type="button" class="b-ico" data-shift="${n.id}" data-dir="next" title="Mover a columna derecha">›</button>` : ""}
              <button class="b-ico" data-dup="${n.id}" title="Duplicar">⧉</button>
              <button class="b-ico" data-hid="${n.id}" title="${n.visible === false ? "Mostrar" : "Ocultar"}">${n.visible === false ? "○" : "●"}</button>
              ${isSec ? `<button class="b-ico" data-tpl="${n.id}" title="Guardar como plantilla">☆</button>` : ""}
              <button class="b-ico" data-glb="${n.id}" title="Convertir en global">G</button>
              <button class="b-ico" data-del="${n.id}" title="Eliminar">✕</button>
            </span>
          </div>
          ${kids ? `<div class="b-kids">${walk(n.children, n)}</div>` : ""}
        </div>`;
      }).join("");
    return `<div class="b-sec">
      <h4 class="b-tree-h">Estructura
        <span class="b-tree-tools">
          <button type="button" class="b-ico" data-tree-all="open" title="Expandir todo">⤢</button>
          <button type="button" class="b-ico" data-tree-all="close" title="Contraer todo">⤡</button>
        </span>
      </h4>
      <div class="b-tree">${walk(state.doc.sections) || "<p class='b-empty'>Añade una sección.</p>"}</div>
    </div>`;
  }
  /* ================================================================
     El inspector
     ----------------------------------------------------------------
     Los controles, el esquema y el cableado están en
     builder-fields.js, compartidos con la pantalla de navegación.
     Aquí sólo se le dice con qué documento trabaja.
     ================================================================ */
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
    paintLiveCss: () => paintLiveCss(),
    pingFrame: () => pingFrame(),
    render: (o) => render(o),
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
  function insertNode(node, preferred) {
    let target = preferred || null;
    if (!target && state.selected) {
      const hit = findNode(state.doc.sections, state.selected);
      if (hit) {
        if (hit.node.type === "column" || hit.node.type === "row" || hit.node.type === "section" || defOf(hit.node.type)?.children) {
          target = hit.node;
        } else if (hit.parent) target = hit.parent;
      }
    }
    if (node.type === "row") {
      if (target?.type === "section" || target?.type === "column") {
        target.children = target.children || [];
        target.children.push(node);
        return;
      }
      if (target?.type === "row" && target) {
        const ph = findNode(state.doc.sections, target.id);
        if (ph?.parent) {
          ph.parent.children = ph.parent.children || [];
          ph.parent.children.push(node);
          return;
        }
      }
      const sec = makeNode("section");
      sec.name = "Sección";
      sec.children.push(node);
      state.doc.sections.push(sec);
      return;
    }
    if (target?.type === "column") {
      target.children = target.children || [];
      target.children.push(node);
      return;
    }
    if (target?.type === "row") {
      target.children = target.children || [];
      if (!target.children.length) target.children.push(makeColumn(12));
      target.children[0].children.push(node);
      return;
    }
    if (target?.type === "section") {
      let row = (target.children || []).find((c) => c.type === "row");
      if (!row) {
        row = makeRow([12]);
        const loose = (target.children || []).filter((c) => c.type !== "row");
        row.children[0].children = loose;
        target.children = [row];
      }
      row.children[0].children.push(node);
      return;
    }
    if (target && defOf(target.type)?.children) {
      target.children = target.children || [];
      target.children.push(node);
      return;
    }
    const sec = makeNode("section");
    const row = makeRow([12]);
    row.children[0].children.push(node);
    sec.children = [row];
    sec.name = defOf(node.type)?.name || "Sección";
    state.doc.sections.push(sec);
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
    root.querySelectorAll("[data-add]").forEach((b) => { b.onclick = () => addComponent(b.dataset.add); });
    root.querySelectorAll("[data-sel]").forEach((b) => {
      b.onclick = () => { state.selected = b.dataset.sel; render({ keepFrame: true }); pingFrame(); };
    });
    root.querySelectorAll("[data-up]").forEach((b) => { b.onclick = () => moveNode(b.dataset.up, -1); });
    root.querySelectorAll("[data-down]").forEach((b) => { b.onclick = () => moveNode(b.dataset.down, 1); });
    root.querySelectorAll("[data-shift]").forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dir = b.getAttribute("data-dir") === "prev" ? -1 : 1;
        shiftAcrossColumns(b.getAttribute("data-shift"), dir);
      };
    });
    root.querySelectorAll("[data-dup]").forEach((b) => { b.onclick = () => duplicateNode(b.dataset.dup); });
    root.querySelectorAll("[data-hid]").forEach((b) => { b.onclick = () => hideNode(b.dataset.hid); });
    root.querySelectorAll("[data-del]").forEach((b) => { b.onclick = () => deleteNode(b.dataset.del); });
    root.querySelectorAll("[data-tpl]").forEach((b) => { b.onclick = () => saveTemplate(b.dataset.tpl); });
    root.querySelectorAll("[data-glb]").forEach((b) => { b.onclick = () => saveGlobal(b.dataset.glb); });
    bindTree();
    const lib = root.querySelector("#open-lib");
    if (lib) lib.onclick = openLibrary;
  }

  /**
   * Los dos paneles: se arrastran para ensanchar y se esconden.
   *
   * El de la izquierda ya se arrastraba; el de la derecha no, y en un
   * portatil ese panel de 320 px es justo donde no cabe nada. Ahora los
   * dos van por la misma funcion: mismo tope, misma memoria, misma
   * forma de esconderse. Cada ancho vive en una variable CSS de la
   * rejilla, asi que esconder es poner la columna a cero y quitar el
   * panel de en medio; el lienzo se queda con todo el hueco sin que
   * nadie recalcule nada a mano.
   */
  const PANELES = {
    left: { aside: ".b-left", mem: "krg-left-w", varW: "--b-left", signo: 1 },
    right: { aside: ".b-right", mem: "krg-right-w", varW: "--b-right", signo: -1 },
  };

  function panelOculto(lado) {
    return localStorage.getItem(`krg-${lado}-oculto`) === "1";
  }

  function pintaPaneles() {
    const layout = root.querySelector(".b-layout");
    if (!layout) return;
    Object.keys(PANELES).forEach((lado) => {
      const oculto = panelOculto(lado);
      layout.classList.toggle(`is-no-${lado}`, oculto);
      const btn = root.querySelector(`[data-panel="${lado}"]`);
      if (btn) {
        btn.classList.toggle("is-off", oculto);
        btn.setAttribute("aria-pressed", oculto ? "false" : "true");
      }
      const rail = root.querySelector(`[data-show="${lado}"]`);
      if (rail) rail.hidden = !oculto;
    });
    // El lienzo se escala al hueco disponible: al cambiar el ancho de
    // los paneles hay que recalcularlo o se queda cortado.
    applyBp();
  }

  function bindSplit() {
    const layout = root.querySelector(".b-layout");
    if (!layout) return;

    Object.entries(PANELES).forEach(([lado, cfg]) => {
      const ancho = (w) => {
        w = Math.max(220, Math.min(620, w));
        layout.style.setProperty(cfg.varW, w + "px");
        localStorage.setItem(cfg.mem, String(w));
        return w;
      };
      ancho(Number(localStorage.getItem(cfg.mem) || 0) || 320);

      const handle = root.querySelector(`[data-split="${lado}"]`);
      if (handle && !handle.dataset.bound) {
        handle.dataset.bound = "1";
        handle.addEventListener("pointerdown", (e) => {
          // El botón de plegar vive dentro del tirador: pulsarlo no puede
          // arrancar un arrastre, o el panel se movería al esconderlo.
          if (e.target.closest(".b-split-t")) return;
          e.preventDefault();
          handle.setPointerCapture(e.pointerId);
          const x0 = e.clientX;
          const w0 = layout.querySelector(cfg.aside)?.getBoundingClientRect().width || 320;
          const move = (ev) => ancho(w0 + (ev.clientX - x0) * cfg.signo);
          const up = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            applyBp();
          };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
        });
        // Doble clic en el tirador: esconder y volver, sin ir al botón.
        handle.addEventListener("dblclick", () => {
          localStorage.setItem(`krg-${lado}-oculto`, panelOculto(lado) ? "0" : "1");
          pintaPaneles();
        });
      }
    });

    root.querySelectorAll("[data-panel], [data-show]").forEach((b) => {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      const lado = b.dataset.panel || b.dataset.show;
      b.onclick = () => {
        // El botón de la barra alterna; el del raíl sólo abre.
        const oculto = b.dataset.show ? false : !panelOculto(lado);
        localStorage.setItem(`krg-${lado}-oculto`, oculto ? "1" : "0");
        pintaPaneles();
      };
    });

    pintaPaneles();
  }

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

  // --------------------------------------------------------------------
  // El inspector se reconstruye entero con innerHTML en cada render(), asi
  // que perdia la posicion de la barra y el foco: al tocar cualquier cosa el
  // panel derecho saltaba arriba. Esto guarda y devuelve ambas cosas.
  // --------------------------------------------------------------------
  const FOCUS_KEYS = ["data-prop", "data-style", "data-node", "data-page",
    "data-rep", "data-style-num", "data-range", "data-page-num", "data-typo"];

  /* El guardar y devolver el sitio vive en el nucleo (`builder-core.js`):
     la pantalla de cabecera y pie hace exactamente lo mismo. */
  const scrollSnap = CORE.scrollSnap;
  const scrollRestore = CORE.scrollRestore;

  function panelSnap() {
    const ae = document.activeElement;
    let focus = null;
    if (ae && root.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) {
      for (const key of FOCUS_KEYS) {
        if (!ae.hasAttribute(key)) continue;
        let sel = `[${key}="${CSS.escape(ae.getAttribute(key))}"]`;
        // Los repetidores necesitan indice y subcampo para no confundirse.
        if (ae.hasAttribute("data-i")) sel += `[data-i="${CSS.escape(ae.getAttribute("data-i"))}"]`;
        if (ae.hasAttribute("data-k")) sel += `[data-k="${CSS.escape(ae.getAttribute("data-k"))}"]`;
        let start = null, end = null;
        // selectionStart revienta en los input de tipo number.
        try { start = ae.selectionStart; end = ae.selectionEnd; } catch (e) { /* sin cursor */ }
        focus = { sel, start, end };
        break;
      }
    }
    return {
      right: root.querySelector(".b-right")?.scrollTop || 0,
      left: root.querySelector(".b-left")?.scrollTop || 0,
      dentroDer: scrollSnap(root.querySelector(".b-right")),
      dentroIzq: scrollSnap(root.querySelector(".b-left")),
      focus,
    };
  }

  function panelRestore(snap) {
    if (!snap) return;
    const right = root.querySelector(".b-right");
    const left = root.querySelector(".b-left");
    if (right) right.scrollTop = snap.right;
    if (left) left.scrollTop = snap.left;
    scrollRestore(right, snap.dentroDer);
    scrollRestore(left, snap.dentroIzq);
    if (!snap.focus) return;
    let el = null;
    try { el = root.querySelector(snap.focus.sel); } catch (e) { return; }
    if (!el || el === document.activeElement) return;
    el.focus({ preventScroll: true });
    if (snap.focus.start == null || !el.setSelectionRange) return;
    try { el.setSelectionRange(snap.focus.start, snap.focus.end); } catch (e) { /* sin cursor */ }
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
