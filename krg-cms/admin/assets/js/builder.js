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
  function subListHtml(node, f, sf, it, i) {
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
      const sub = (sf, it, i) => repSubField(node, f, sf, it, i);
      const resumen = (it) => repResumen(f, it);
      return `<div class="b-rep"><strong>${esc(f.label)}</strong>
        ${items.map((it, i) => `<div class="rep-item">
          <div class="rep-head">
            <span class="rep-n">${i + 1}</span>
            <span class="rep-sum">${esc(resumen(it))}</span>
            <span class="rep-acts">
              <button type="button" class="b-ico" data-rep-move="${f.key}" data-i="${i}" data-dir="-1" title="Subir">↑</button>
              <button type="button" class="b-ico" data-rep-move="${f.key}" data-i="${i}" data-dir="1" title="Bajar">↓</button>
              <button type="button" class="b-ico" data-rep-dup="${f.key}" data-i="${i}" title="Duplicar">⧉</button>
              <button type="button" class="b-ico" data-rep-del="${f.key}" data-i="${i}" title="Eliminar">✕</button>
            </span>
          </div>
          ${(f.itemFields || []).map((sf) => sub(sf, it, i)).join("")}
        </div>`).join("")}
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
        markDirty();
        render();
      };
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
    /* --- Listas dentro de un ítem (las adiciones de un plato) --- */
    const subLista = (ds, crear) => {
      const h = hit();
      if (!h) return null;
      const arr = h.node.props[ds.sub || ds.subAdd || ds.subDel || ds.subMove] || [];
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
          <div class="b-split" data-split="left" title="Arrastra para ensanchar"></div>
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
          <div class="b-split" data-split="right" title="Arrastra para ensanchar"></div>
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
      focus,
    };
  }

  function panelRestore(snap) {
    if (!snap) return;
    const right = root.querySelector(".b-right");
    const left = root.querySelector(".b-left");
    if (right) right.scrollTop = snap.right;
    if (left) left.scrollTop = snap.left;
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
