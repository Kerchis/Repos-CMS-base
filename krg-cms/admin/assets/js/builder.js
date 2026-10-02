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
  };
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
  const groups = {
    content: "Contenido",
    layout: "Disposición",
    design: "Diseño",
    typography: "Tipografía",
    colors: "Colores",
    spacing: "Espaciado",
    responsive: "Responsive",
    advanced: "Avanzado",
  };

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
            if (!v) return;
            const d = `${p}:${v}!important`;
            if (textProps.includes(p)) text.push(d);
            else box.push(d);
            if (imgProps.includes(p)) img.push(d);
          });
          if (st["text-align"] === "center") {
            box.push("margin-left:auto!important", "margin-right:auto!important");
          }
          const sel = `.m-n-${id}`;
          if (box.length) css += `${sel}{${box.join(";")}}`;
          if (text.length) css += `${sel},${sel} :is(h1,h2,h3,h4,h5,h6,p,.m-hero-title,.m-hero-sub,.m-heading,.m-eyebrow,.m-role-h1,.m-role-h2,.m-role-h3){${text.join(";")}}`;
          if (img.length) css += `${sel} img{${img.join(";")}}`;
          const fl = n.filters || {};
          const hasF = n.filters && (Number(fl.hue) || Number(fl.sat) !== 100 || Number(fl.brightness) !== 100 || Number(fl.contrast) !== 100 || Number(fl.invert) || Number(fl.sepia));
          if (hasF) {
            css += `${sel}{filter:hue-rotate(${fl.hue || 0}deg) saturate(${fl.sat ?? 100}%) brightness(${fl.brightness ?? 100}%) contrast(${fl.contrast ?? 100}%) invert(${fl.invert || 0}%) sepia(${fl.sepia || 0}%)!important}`;
          }
          const cc = n.customCss || {};
          if (cc.main) css += `${sel}{${cc.main}}`;
          if (cc.before) css += `${sel}::before{content:"";display:block;${cc.before}}`;
          if (cc.after) css += `${sel}::after{content:"";display:block;${cc.after}}`;
          if (n.animDuration) css += `${sel}{--m-anim-dur:${n.animDuration}ms;animation-duration:${n.animDuration}ms;animation-delay:${n.animDelay || 0}ms;animation-timing-function:${n.animEasing || "ease"}}`;
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
              ["screen", "screen-minus-header", "tall", "half"].forEach((v) => {
                els.classList.toggle("is-mh-" + v, mh === v);
              });
              ["start", "center", "end"].forEach((v) => {
                els.classList.toggle("is-va-" + v, mh !== "auto" && va === v);
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
      if (saved?.checksum) state.doc.checksum = saved.checksum;
      if (saved?.previewUrl) state.doc.previewUrl = saved.previewUrl;
      if (state.dirtyGen === gen) {
        state.dirty = false;
        state.saveTries = 0;
        state.save = "Guardado (borrador)";
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
  function reloadFrame(opts = {}) {
    const iframe = root.querySelector("iframe");
    if (!iframe || !state.doc.previewUrl) return;
    if (opts.keepView !== false) state.frameSnap = frameScrollSnap(iframe);
    iframe.src = state.doc.previewUrl + "&t=" + Date.now();
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
        hit.node.props = hit.node.props || {};
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

  function tree() {
    const walk = (nodes, depth = 0, parent = null) =>
      (nodes || []).map((n) => {
        const sel = n.id === state.selected ? " sel" : "";
        const vis = n.visible === false ? " (oculto)" : "";
        const glob = n.source === "global" ? " ⌁" : "";
        const isSec = n.type === "section";
        const inCol = parent?.type === "column";
        return `<div class="sec${sel}" style="margin-left:${depth * 8}px" data-tree="${n.id}">
          <div class="hd" data-nid="${n.id}">
            <span class="b-drag" draggable="true" data-drag="${n.id}" title="Arrastrar para mover">⋮⋮</span>
            <span data-sel="${n.id}" data-rename="${n.id}" title="Clic para seleccionar · Doble clic para renombrar">${esc(n.name || n.type)}${glob}${vis}</span>
            <button class="b-ico" data-up="${n.id}" title="Subir">↑</button>
            <button class="b-ico" data-down="${n.id}" title="Bajar">↓</button>
            ${inCol ? `<button type="button" class="b-ico" data-shift="${n.id}" data-dir="prev" title="Mover a columna izquierda">‹</button>
              <button type="button" class="b-ico" data-shift="${n.id}" data-dir="next" title="Mover a columna derecha">›</button>` : ""}
            <button class="b-ico" data-dup="${n.id}" title="Duplicar">⧉</button>
            <button class="b-ico" data-hid="${n.id}" title="Ocultar">${n.visible === false ? "○" : "●"}</button>
            ${isSec ? `<button class="b-ico" data-tpl="${n.id}" title="Plantilla">☆</button>` : ""}
            <button class="b-ico" data-glb="${n.id}" title="Global">G</button>
            <button class="b-ico" data-del="${n.id}" title="Eliminar">✕</button>
          </div>
          ${walk(n.children, depth + 1, n)}
        </div>`;
      }).join("");
    return `<div class="b-sec"><h4>Estructura</h4><div class="b-tree">${walk(state.doc.sections) || "<p class='b-empty'>Añade una sección.</p>"}</div></div>`;
  }

  function unitize(v, unit) {
    v = String(v ?? "").trim();
    if (!v) return "";
    if (/[a-z%]/i.test(v)) return v;
    return v + (unit || "px");
  }
  function sideVal(st, kind, side) {
    const key = `${kind}-${side}`;
    if (st[key]) return String(st[key]).replace(/px$/i, "");
    const sh = String(st[kind] || "").trim();
    if (!sh) return "";
    const p = sh.split(/\s+/);
    const strip = (x) => String(x || "").replace(/px$/i, "");
    if (p.length === 1) return strip(p[0]);
    if (p.length === 2) return strip(side === "top" || side === "bottom" ? p[0] : p[1]);
    if (p.length === 3) return strip(side === "top" ? p[0] : side === "bottom" ? p[2] : p[1]);
    const i = { top: 0, right: 1, bottom: 2, left: 3 }[side];
    return strip(p[i]);
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
        ${sides.map(([s, lab]) => `<label>${lab}<input type="number" data-side="${kind}-${s}" value="${esc(sideVal(st, kind, s))}" placeholder="0"></label>`).join("")}
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
  function panelAlign(node) {
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
    return `<div class="acc"><h5>Alinear</h5>
      <p class="m-muted">Alinear objetos</p>
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
      </div>
    </div>`;
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

  function inspTabs() {
    const tab = state.inspTab || "content";
    return `<div class="b-tabs">
      <button type="button" data-insp-tab="content" class="${tab === "content" ? "is-on" : ""}">Contenido</button>
      <button type="button" data-insp-tab="design" class="${tab === "design" ? "is-on" : ""}">Diseño</button>
      <button type="button" data-insp-tab="advanced" class="${tab === "advanced" ? "is-on" : ""}">Avanzado</button>
    </div>`;
  }
  function panelSpacing(st) {
    return `<div class="acc"><h5>Separación (${state.bp})</h5>
      ${boxControl("padding", "Relleno", st)}
      ${boxControl("margin", "Margen", st)}
    </div>`;
  }
  function panelBorder(st) {
    return `<div class="acc"><h5>Borde</h5>
      <div class="b-box-grid">
        <label>Sup. izq. <input type="number" data-side="border-top-left-radius" value="${esc(String(st["border-top-left-radius"] || "").replace(/px$/i, ""))}" placeholder="0"></label>
        <label>Sup. der. <input type="number" data-side="border-top-right-radius" value="${esc(String(st["border-top-right-radius"] || "").replace(/px$/i, ""))}" placeholder="0"></label>
        <label>Inf. izq. <input type="number" data-side="border-bottom-left-radius" value="${esc(String(st["border-bottom-left-radius"] || "").replace(/px$/i, ""))}" placeholder="0"></label>
        <label>Inf. der. <input type="number" data-side="border-bottom-right-radius" value="${esc(String(st["border-bottom-right-radius"] || "").replace(/px$/i, ""))}" placeholder="0"></label>
      </div>
      <p class="m-muted">Estilo</p>
      ${seg("border-style", st["border-style"] || "none", [
        { v: "none", l: "Ninguno" }, { v: "solid", l: "Sólido" }, { v: "dashed", l: "Guion" }, { v: "dotted", l: "Punto" },
      ])}
      ${rangeControl("Grosor", "border-width", st, 0, 20, "px")}
      ${window.KrgUi.colorField("Color borde", st["border-color"] || "", 'data-style="border-color"')}
    </div>`;
  }
  function panelShadow(st) {
    return `<div class="acc"><h5>Sombra</h5>
      ${seg("box-shadow", st["box-shadow"] || "", SHADOWS.map((s) => ({ v: s.v, l: s.l })))}
    </div>`;
  }
  function panelFilters(node) {
    const f = node.filters || { hue: 0, sat: 100, brightness: 100, contrast: 100, invert: 0, sepia: 0 };
    return `<div class="acc"><h5>Filtros</h5>
      ${[["hue", "Tono", 0, 360, "deg"], ["sat", "Saturación", 0, 200, "%"], ["brightness", "Brillo", 0, 200, "%"], ["contrast", "Contraste", 0, 200, "%"], ["invert", "Invertir", 0, 100, "%"], ["sepia", "Sepia", 0, 100, "%"]].map(([k, lab, min, max, u]) => `
        <label class="m-pick-label">${lab}
          <div class="b-range">
            <input type="range" min="${min}" max="${max}" data-filter="${k}" value="${f[k] ?? min}">
            <input type="number" min="${min}" max="${max}" data-filter="${k}" value="${f[k] ?? min}">
            <span class="m-pick-unit">${u}</span>
          </div>
        </label>`).join("")}
    </div>`;
  }
  function panelAnim(node) {
    return `<div class="acc"><h5>Animación</h5>
      <div class="b-anim">${ANIMS.map((a) => `<button type="button" class="${(node.animation || "none") === a.v ? "is-on" : ""}" data-anim="${a.v}">${a.l}</button>`).join("")}</div>
      <label>Duración (ms) <input type="number" data-node="animDuration" min="0" max="3000" value="${esc(node.animDuration ?? 600)}"></label>
      <label>Retardo (ms) <input type="number" data-node="animDelay" min="0" max="3000" value="${esc(node.animDelay ?? 0)}"></label>
      <label>Curva
        <select data-node="animEasing">
          ${["ease", "linear", "ease-in", "ease-out", "ease-in-out"].map((e) => `<option value="${e}" ${(node.animEasing || "ease") === e ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </label>
    </div>`;
  }
  // Opciones propias de la sección: alto, cortina y color de la cabecera.
  // Hasta ahora existían en el renderizador pero no había dónde tocarlas.
  function panelSection(node) {
    const p = node.props || {};
    const mh = p.minHeight || "auto";
    const sel = (key, value, opts) => `<select data-prop="${key}">${opts.map(([v, l]) =>
      `<option value="${v}" ${String(value) === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const width = p.width || (p.fullWidth === false ? "boxed" : "full");
    return `<div class="acc"><h5>Ancho del contenido</h5>
      <label>Hasta dónde llega el contenido
        ${sel("width", width, [
          ["boxed", "Centrado y limitado"],
          ["full", "Ancho completo con margen"],
          ["bleed", "A sangre: de borde a borde"],
        ])}
      </label>
      <p class="m-muted">A sangre deja el contenido pegado a los bordes del dispositivo, sin ningún margen. Es lo que necesitan los mapas, los vídeos y las fotos a pantalla completa.</p>
    </div>
    <div class="acc"><h5>Animación de entrada</h5>
      <label>Revelado al hacer scroll
        ${sel("curtain", p.curtain || "off", [
          ["on", "Cortina (la siguiente sección la tapa)"],
          ["off", "Sin cortina"],
        ])}
      </label>
      <p class="m-muted">Cortina: la sección se queda quieta y la siguiente se desliza por encima, tapándola. Es el mismo efecto del pie. Se desactiva sola si la sección no cabe en la pantalla, así que va mejor con alto Pantalla completa.</p>
    </div>
    <div class="acc"><h5>Alto de la sección</h5>
      <label>Alto mínimo
        ${sel("minHeight", mh, [
          ["auto", "El del contenido"],
          ["screen", "Pantalla completa"],
          ["screen-minus-header", "Pantalla menos la cabecera"],
          ["tall", "Alta (78 %)"],
          ["half", "Media (50 %)"],
        ])}
      </label>
      ${mh !== "auto" ? `<label>Alineación vertical del contenido
        ${sel("vAlign", p.vAlign || "start", [
          ["start", "Arriba"],
          ["center", "Centro"],
          ["end", "Abajo"],
        ])}
      </label>` : `<p class="m-muted">Con un alto fijo podrás centrar el contenido verticalmente.</p>`}
    </div>
    <div class="acc"><h5>Cabecera sobre esta sección</h5>
      <label>Color del texto de la cabecera
        ${sel("headerSkin", p.headerSkin || "auto", [
          ["auto", "Automático (según el fondo)"],
          ["dark", "Forzar texto oscuro"],
          ["light", "Forzar texto claro"],
          ["none", "No cambiar nada"],
        ])}
      </label>
      <p class="m-muted">Automático mira la luminosidad del fondo y elige el que se lee mejor. Requiere tener el color adaptativo activo en Chrome → Cabecera.</p>
    </div>`;
  }

  function panelBg(st) {
    return `<div class="acc"><h5>Fondo</h5>
      ${window.KrgUi.colorField("Color de fondo", st.background || "", 'data-style="background"')}
    </div>`;
  }
  function panelAdvanced(node) {
    const css = node.customCss || { before: "", main: "", after: "" };
    const hide = node.hiddenOn || {};
    const st = node.styles?.[state.bp] || {};
    return `
      <div class="acc"><h5>ID y clases de CSS</h5>
        <label>Identificador CSS <input data-node="htmlId" value="${esc(node.htmlId || "")}" placeholder="mi-bloque"></label>
        <label>Clase CSS <input data-node="htmlClass" value="${esc(node.htmlClass || "")}" placeholder="mi-clase"></label>
      </div>
      <div class="acc"><h5>CSS personalizado</h5>
        <label>Antes ( ::before ) <textarea data-css="before">${esc(css.before || "")}</textarea></label>
        <label>Elemento principal <textarea data-css="main">${esc(css.main || "")}</textarea></label>
        <label>Después ( ::after ) <textarea data-css="after">${esc(css.after || "")}</textarea></label>
      </div>
      <div class="acc"><h5>Visibilidad</h5>
        <label><input type="checkbox" data-hide-bp="mobile" ${hide.mobile ? "checked" : ""}> Ocultar en teléfono</label>
        <label><input type="checkbox" data-hide-bp="tablet" ${hide.tablet ? "checked" : ""}> Ocultar en tablet</label>
        <label><input type="checkbox" data-hide-bp="desktop" ${hide.desktop ? "checked" : ""}> Ocultar en escritorio</label>
      </div>
      <div class="acc"><h5>Transiciones</h5>
        ${rangeControl("Duración", "transition-duration", { "transition-duration": (st["transition-duration"] || "300ms") }, 0, 2000, "ms", 50)}
        ${rangeControl("Retardo", "transition-delay", { "transition-delay": (st["transition-delay"] || "0ms") }, 0, 2000, "ms", 50)}
        <label>Curva
          <select data-style="transition-timing-function">
            ${["ease", "linear", "ease-in", "ease-out", "ease-in-out"].map((e) => `<option value="${e}" ${(st["transition-timing-function"] || "ease") === e ? "selected" : ""}>${e}</option>`).join("")}
          </select>
        </label>
      </div>`;
  }
  function panelTypography(st) {
    return `<div class="acc"><h5>Texto</h5>
      <p class="m-muted">Alineación</p>
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
      ${seg("font-style", st["font-style"] || "", [{ v: "normal", l: "Normal" }, { v: "italic", l: "<i>Cursiva</i>" }])}
      <p class="m-muted">Decoración</p>
      ${seg("text-decoration", st["text-decoration"] || "none", [
        { v: "none", l: "Ninguna" }, { v: "underline", l: "Subrayado" }, { v: "line-through", l: "Tachado" },
      ])}
      <p class="m-muted">Transformar</p>
      ${seg("text-transform", st["text-transform"] || "", [
        { v: "none", l: "aa" }, { v: "uppercase", l: "AA" }, { v: "capitalize", l: "Aa" },
      ])}
      ${window.KrgUi.colorField("Color texto", st.color || "", 'data-style="color"')}
      ${window.KrgUi.colorField("Fondo", st.background || "", 'data-style="background"')}
    </div>`;
  }
  function panelHeading(node, st) {
    const tag = node.props?.tag || "h2";
    return `<div class="acc"><h5>Encabezado</h5>
      ${seg("tag", tag, ["h1", "h2", "h3", "h4", "h5", "h6"].map((v) => ({ v, l: v.toUpperCase() })), "data-prop-set")}
      ${panelTypography(st).replace("<h5>Texto</h5>", "<p class=\"m-muted\">Tipografía del título</p>")}
    </div>`;
  }
  function panelTextSize(st) {
    return `<div class="acc"><h5>Tamaño (${state.bp})</h5>
      ${rangeControl("Tamaño de fuente", "font-size", st, 10, 96, "px")}
      ${rangeControl("Interlineado", "line-height", st, 80, 220, "%")}
      ${rangeControl("Espaciado de letras", "letter-spacing", st, -4, 20, "px")}
    </div>`;
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

  function imageInspector(node) {
    const st = node.styles?.[state.bp] || {};
    const p = node.props || {};
    const tab = state.inspTab || "content";
    const thumb = p.imageUrl || "";
    const tabs = inspTabs();
    const content = `
      <div class="acc"><h5>Imagen</h5>
        <div class="b-thumb">
          ${thumb ? `<img src="${esc(thumb)}" alt="">` : `<span class="m-thumb-empty">${p.imageId ? "Imagen #" + p.imageId : "Sin imagen"}</span>`}
          <div class="b-thumb-actions">
            <button type="button" class="m-btn ghost" data-media="imageId">Cambiar</button>
            <button type="button" class="m-btn ghost" data-clear-img>Quitar</button>
          </div>
        </div>
        <label>Texto alternativo <input data-prop="alt" value="${esc(p.alt || "")}"></label>
      </div>
      <div class="acc"><h5>Enlace</h5>
        <label>Lightbox <input type="checkbox" data-prop="lightbox" ${p.lightbox ? "checked" : ""}></label>
        <label>URL del enlace <input data-prop="link" value="${esc(p.link || "")}" placeholder="https://"></label>
        <label>Destino
          <select data-prop="linkTarget">
            <option value="_self" ${p.linkTarget !== "_blank" ? "selected" : ""}>Misma ventana</option>
            <option value="_blank" ${p.linkTarget === "_blank" ? "selected" : ""}>Nueva ventana</option>
          </select>
        </label>
      </div>`;
    const design = `
      ${panelAlign(node)}
      <div class="acc"><h5>Móvil</h5>
        <label>Centrar en móvil <input type="checkbox" data-prop="centerOnMobile" ${p.centerOnMobile ? "checked" : ""}></label>
      </div>
      <div class="acc"><h5>Relleno</h5>
        <p class="m-muted">Propio deja la foto con su proporción. Columna la estira a la altura del resto de la fila.</p>
        ${seg("fillMode", p.fillMode || "natural", [
          { v: "natural", l: "Propio" },
          { v: "fill", l: "Columna" },
        ], "data-prop-set")}
        <p class="m-muted">Recorte dentro del marco (solo si Relleno = Columna)</p>
        ${seg("objectFit", p.objectFit || st["object-fit"] || "cover", [
          { v: "cover", l: "Cover" }, { v: "contain", l: "Contain" }, { v: "fill", l: "Fill" },
        ], "data-prop-set")}
      </div>
      <div class="acc"><h5>Radio</h5>
        ${seg("radius", p.radius || "none", [
          { v: "none", l: "Ninguno" }, { v: "sm", l: "S" }, { v: "md", l: "M" }, { v: "lg", l: "L" }, { v: "full", l: "Círculo" },
        ], "data-prop-set")}
      </div>
      <div class="acc"><h5>Escala</h5>
        <p class="m-muted">100 % es el tamaño natural. Baja para que no ocupe todo el hueco.</p>
        ${propRange("Escala de la imagen", "scale", p.scale ?? 100, 10, 200, "%")}
      </div>
      <div class="acc"><h5>Parallax</h5>
        <label>Activar efecto <input type="checkbox" data-prop="parallax" ${p.parallax ? "checked" : ""}></label>
        ${p.parallax ? `
          <p class="m-muted">La ampliación deja margen para que al moverse no se vean bordes. Baja ambos valores para un efecto más sutil.</p>
          ${propRange("Ampliación de la imagen", "parallaxZoom", p.parallaxZoom ?? 8, 0, 40, "%")}
          ${propRange("Intensidad del movimiento", "parallaxAmount", p.parallaxAmount ?? 10, 0, 40, "%")}
          <label>Invertir dirección <input type="checkbox" data-prop="parallaxInvert" ${p.parallaxInvert ? "checked" : ""}></label>
        ` : `<p class="m-muted">Actívalo para mover la imagen al hacer scroll.</p>`}
      </div>
      <div class="acc"><h5>Tamaño (${state.bp})</h5>
        ${rangeControl("Ancho", "width", st, 10, 100, "%")}
        ${rangeControl("Alto (opcional)", "height", st, 0, 800, "px")}
        ${rangeControl("Máximo ancho", "max-width", st, 10, 100, "%")}
      </div>
      ${panelSpacing(st)}
      ${panelBorder(st)}
      ${panelShadow(st)}
      ${panelFilters(node)}
      ${panelAnim(node)}
      ${panelBg(st)}`;
    const advanced = panelAdvanced(node);
    const body = tab === "design" ? design : tab === "advanced" ? advanced : content;
    return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
      <div class="acc"><h5>Imagen</h5><p class="m-muted">Ajustes de imagen</p></div>
      ${tabs}${body}`;
  }

  function galleryInspector(node) {
    const st = node.styles?.[state.bp] || {};
    const p = node.props || {};
    const tab = state.inspTab || "content";
    let items = Array.isArray(p.items) ? p.items : [];
    if (!items.length && p.ids) {
      items = String(p.ids).split(",").map((id) => ({ imageId: Number(id) || 0, imageUrl: "", alt: "" })).filter((it) => it.imageId);
    }
    const content = `
      <div class="acc"><h5>Imágenes</h5>
        <p class="m-muted">Añade una por una o varias a la vez.</p>
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
        </div>
      </div>`;
    const design = `
      ${panelAlign(node)}
      <div class="acc"><h5>Presentación</h5>
        ${seg("layout", p.layout || "carousel", [
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
        ], "data-prop-set")}` : `<p class="m-muted">Las fotos se escalan solas para llenar el recuadro, aunque no tengan el mismo tamaño. No quedan franjas vacías en escritorio, tablet ni móvil.</p>`}
      </div>
      <div class="acc"><h5>Navegación</h5>
        <label>Flechas <input type="checkbox" data-prop="arrows" ${p.arrows !== false ? "checked" : ""}></label>
        <label>Teclado (← →) <input type="checkbox" data-prop="keyboard" ${p.keyboard !== false ? "checked" : ""}></label>
        <label>Reproducción automática <input type="checkbox" data-prop="autoplay" ${p.autoplay ? "checked" : ""}></label>
        ${p.autoplay ? propRange("Intervalo", "interval", p.interval ?? 5000, 1500, 12000, "ms", 500) : ""}
      </div>
      <div class="acc"><h5>Parallax</h5>
        <label>Activar efecto <input type="checkbox" data-prop="parallax" ${p.parallax ? "checked" : ""}></label>
        ${p.parallax ? `
          <p class="m-muted">La ampliación deja margen para que al moverse no se vean bordes. Baja ambos valores para un efecto más sutil.</p>
          ${propRange("Ampliación de la imagen", "parallaxZoom", p.parallaxZoom ?? 8, 0, 40, "%")}
          ${propRange("Intensidad del movimiento", "parallaxAmount", p.parallaxAmount ?? 10, 0, 40, "%")}
          <label>Invertir dirección <input type="checkbox" data-prop="parallaxInvert" ${p.parallaxInvert ? "checked" : ""}></label>
        ` : `<p class="m-muted">Actívalo para mover las fotos al hacer scroll.</p>`}
      </div>
      ${(p.layout === "grid") ? `<div class="acc"><h5>Columnas (cuadrícula)</h5>
        <label>Desktop <input type="number" data-prop="desktop" min="1" max="6" value="${esc(p.desktop ?? 3)}"></label>
        <label>Tablet <input type="number" data-prop="tablet" min="1" max="4" value="${esc(p.tablet ?? 2)}"></label>
        <label>Móvil <input type="number" data-prop="mobile" min="1" max="2" value="${esc(p.mobile ?? 1)}"></label>
      </div>` : ""}
      ${panelSpacing(st)}${panelBorder(st)}${panelBg(st)}`;
    const body = tab === "design" ? design : tab === "advanced" ? panelAdvanced(node) : content;
    return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
      <div class="acc"><h5>Galería</h5><p class="m-muted">Carrusel o cuadrícula</p></div>
      ${inspTabs()}${body}`;
  }

  function videoInspector(node) {
    const st = node.styles?.[state.bp] || {};
    const p = node.props || {};
    const tab = state.inspTab || "content";
    const src = p.source === "upload" ? "upload" : "link";
    const content = `
      <div class="acc"><h5>Origen</h5>
        ${seg("source", src, [
          { v: "link", l: "Enlace" },
          { v: "upload", l: "Subir archivo" },
        ], "data-prop-set")}
      </div>
      ${src === "upload" ? `<div class="acc"><h5>Archivo</h5>
        <p class="m-muted">${p.videoUrl ? "Video de la biblioteca." : "Sube un MP4 o elige uno de la biblioteca."}</p>
        ${p.videoUrl ? `<p class="m-muted">${esc(p.videoUrl)}</p>` : ""}
        <button type="button" class="m-btn" data-video-media>Elegir o subir video</button>
        ${p.videoId ? `<button type="button" class="m-btn ghost" data-video-clear>Quitar</button>` : ""}
      </div>` : `<div class="acc"><h5>Enlace</h5>
        <label>URL <input data-prop="url" value="${esc(p.url || "")}" placeholder="https://… mp4, YouTube o Vimeo"></label>
        <p class="m-muted">Para que el visitante no vea controles ni pueda descargar, usa un archivo subido (MP4). YouTube y Vimeo ocultan lo que permiten, pero no se puede bloquear del todo.</p>
      </div>`}`;
    const design = `
      ${panelAlign(node)}
      <div class="acc"><h5>Tamaño</h5>
        ${seg("sizeMode", p.sizeMode || "auto", [
          { v: "auto", l: "Del lugar" },
          { v: "full", l: "Pantalla" },
          { v: "fullWidth", l: "Ancho" },
          { v: "fullHeight", l: "Alto" },
          { v: "custom", l: "Medidas" },
        ], "data-prop-set")}
        ${(p.sizeMode === "custom" || p.sizeMode === "fullWidth" || p.sizeMode === "fullHeight" || p.sizeMode === "auto") ? `
          ${p.sizeMode === "custom" ? propRange("Ancho", "width", p.width ?? 800, 120, 1600, "px", 10) : ""}
          ${p.sizeMode !== "fullWidth" || true ? propRange("Alto", "height", p.height ?? 420, 80, 1000, "px", 10) : ""}
        ` : ""}
        <p class="m-muted">Ajuste dentro del marco. Cubrir llena el recuadro sin bandas negras.</p>
        ${seg("fit", p.fit || "cover", [
          { v: "cover", l: "Cubrir" },
          { v: "contain", l: "Contener" },
        ], "data-prop-set")}
      </div>
      <div class="acc"><h5>Reproducción</h5>
        <p class="m-muted">El autoplay arranca en silencio (lo exigen los navegadores). El visitante puede activar sonido y el volumen con el control del video. Clic en el video para pausar. No hay descarga.</p>
        <label>Reproducción automática <input type="checkbox" data-prop="autoplay" ${p.autoplay !== false ? "checked" : ""}></label>
        <label>Repetir <input type="checkbox" data-prop="loop" ${p.loop !== false ? "checked" : ""}></label>
        ${propRange("Volumen inicial (tras activar sonido)", "volume", p.volume ?? 70, 0, 100, "%")}
      </div>
      ${panelSpacing(st)}${panelBg(st)}`;
    const body = tab === "design" ? design : tab === "advanced" ? panelAdvanced(node) : content;
    return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
      <div class="acc"><h5>Video</h5><p class="m-muted">Enlace o archivo, sin visor descargable</p></div>
      ${inspTabs()}${body}`;
  }

  function everestInspector(node) {
    const st = node.styles?.[state.bp] || {};
    const p = node.props || {};
    const tab = state.inspTab || "content";
    const def = defOf("everest-form") || {};
    const field = (def.fields || []).find((f) => f.key === "formId") || {};
    const opts = def.everestForms || field.options || [];
    const forms = opts.filter((o) => String(typeof o === "object" ? (o.value ?? "") : o) !== "0");
    const val = String(Number(p.formId) || 0);
    const plugin = !!def.pluginActive;
    const content = `
      <div class="acc"><h5>Formulario de Everest Forms</h5>
        ${plugin ? "" : `<p class="m-form-error">El plugin Everest Forms no está activo. Actívalo en WordPress → Plugins y recarga el constructor.</p>`}
        ${plugin && !forms.length ? `<p class="m-muted">No hay formularios. Créalos en WordPress → Everest Forms y recarga.</p>` : ""}
        ${plugin && forms.length ? `<label>Formulario <select data-prop="formId">
          ${opts.map((o) => {
            const v = typeof o === "object" ? String(o.value ?? "") : String(o);
            const l = typeof o === "object" ? (o.label || v) : o;
            return `<option value="${esc(v)}" ${val === v ? "selected" : ""}>${esc(l)}</option>`;
          }).join("")}
        </select></label>
        ${Number(val) > 0 ? `<p class="m-muted">Shortcode: [everest_form id="${esc(val)}"]</p>` : `<p class="m-muted">Elige el formulario que ya tenías en el plugin. Se muestra en esta página tal cual.</p>`}` : ""}
      </div>`;
    const design = `${panelAlign(node)}${panelSpacing(st)}${panelBg(st)}`;
    const body = tab === "design" ? design : tab === "advanced" ? panelAdvanced(node) : content;
    return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
      <div class="acc"><h5>Everest Forms</h5><p class="m-muted">Inserta un formulario del plugin</p></div>
      ${inspTabs()}${body}`;
  }

  function textInspector(node) {
    const st = node.styles?.[state.bp] || {};
    const p = node.props || {};
    const tab = state.inspTab || "content";
    const def = defOf(node.type) || { name: node.type };
    let content = "";
    if (node.type === "heading") {
      content = `<div class="acc"><h5>Texto</h5>
        <label>Contenido <textarea data-prop="text">${esc(p.text || "")}</textarea></label>
        <label>Enlace <input data-prop="link" value="${esc(p.link || "")}" placeholder="https://"></label>
      </div>`;
    } else if (node.type === "paragraph") {
      content = `<div class="acc"><h5>Texto</h5>
        <label>Contenido <textarea data-prop="text">${esc(p.text || "")}</textarea></label>
      </div>`;
    } else if (node.type === "rich-text") {
      content = `<div class="acc"><h5>Texto</h5>${richEditor(node, "html")}</div>`;
    } else if (node.type === "eyebrow") {
      content = `<div class="acc"><h5>Texto</h5>
        <label>Contenido <input data-prop="text" value="${esc(p.text || "")}"></label>
      </div>`;
    } else if (node.type === "quote") {
      content = `<div class="acc"><h5>Cita</h5>
        <label>Texto <textarea data-prop="text">${esc(p.text || "")}</textarea></label>
        <label>Autor <input data-prop="cite" value="${esc(p.cite || "")}"></label>
      </div>`;
    }
    const headingBlock = node.type === "heading"
      ? `<div class="acc"><h5>Encabezado</h5>
          ${seg("tag", p.tag || "h2", ["h1", "h2", "h3", "h4", "h5", "h6"].map((v) => ({ v, l: v.toUpperCase() })), "data-prop-set")}
        </div>`
      : "";
    const design = `${panelAlign(node)}${headingBlock}${panelTypography(st)}${panelTextSize(st)}${panelSpacing(st)}${panelBorder(st)}${panelShadow(st)}${panelFilters(node)}${panelAnim(node)}${panelBg(st)}`;
    const body = tab === "design" ? design : tab === "advanced" ? panelAdvanced(node) : content;
    return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
      <div class="acc"><h5>${esc(def.name || node.type)}</h5><p class="m-muted">Ajustes de texto</p></div>
      ${inspTabs()}${body}`;
  }

  function layoutInspector(node) {
    const st = node.styles?.[state.bp] || {};
    const p = node.props || {};
    const tab = state.inspTab || "content";
    const def = defOf(node.type) || { name: node.type };
    const current = node.type === "row"
      ? (p.layout || (node.children || []).map((c) => c.props?.span || 12).join("-"))
      : node.type === "section"
        ? ((node.children || []).find((c) => c.type === "row")?.props?.layout || "")
        : "";
    let content = "";
    if (node.type === "section") {
      content = `<div class="acc"><h5>Sección</h5>
        <label>Nombre interno <input data-prop="name" value="${esc(p.name || node.name || "")}"></label>
        <p class="m-muted">El ancho del contenido se elige en la pestaña Diseño, en «Ancho del contenido».</p>
      </div>
      <div class="acc"><h5>Disposición</h5>
        <p class="m-muted">Agrupa los módulos en columnas. ‹ › en el árbol mueve un módulo a la columna vecina.</p>
        ${layoutGallery(current)}
        <button type="button" class="m-btn ghost" data-add-row>Añadir otra fila</button>
      </div>
      `;
    } else if (node.type === "row") {
      content = `<div class="acc"><h5>Fila</h5>
        <p class="m-muted">Cada bloque es una columna (grupo de módulos).</p>
        ${layoutThumbs(current)}
        <label>Separación (px) <input type="number" data-prop="gap" min="0" max="80" value="${esc(p.gap ?? 24)}"></label>
      </div>`;
    } else {
      content = `<div class="acc"><h5>Columna · grupo de módulos</h5>
        <p class="m-muted">Selecciona esta columna y añade título, texto o imagen desde la paleta. Quedarán apilados aquí.</p>
        <label>Ancho desktop (1–12) <input type="number" data-prop="span" min="1" max="12" value="${esc(p.span ?? 12)}"></label>
        <label>Ancho tablet (1–12) <input type="number" data-prop="spanTablet" min="1" max="12" value="${esc(p.spanTablet ?? 12)}"></label>
        <label>Ancho móvil (1–12) <input type="number" data-prop="spanMobile" min="1" max="12" value="${esc(p.spanMobile ?? 12)}"></label>
      </div>`;
    }
    const extra = node.type === "section" ? panelSection(node) : "";
    const design = `${extra}${panelAlign(node)}${panelSpacing(st)}${panelBorder(st)}${panelBg(st)}${panelAnim(node)}`;
    const body = tab === "design" ? design : tab === "advanced" ? panelAdvanced(node) : content;
    return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
      <div class="acc"><h5>${esc(def.name || node.type)}</h5><p class="m-muted">${esc(node.name || node.type)}</p></div>
      ${inspTabs()}${body}`;
  }

  function inspector() {
    if (!state.selected) {
      return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
        <div class="b-empty">Selecciona un elemento en el árbol o en el canvas.</div>`;
    }
    const hit = findNode(state.doc.sections, state.selected);
    if (!hit) return `<div class="b-empty">Elemento no encontrado.</div>`;
    const node = hit.node;
    if (node.type === "image") return imageInspector(node);
    if (node.type === "gallery") return galleryInspector(node);
    if (node.type === "video") return videoInspector(node);
    if (node.type === "everest-form") return everestInspector(node);
    if (TEXT_TYPES.includes(node.type)) return textInspector(node);
    if (LAYOUT_TYPES.includes(node.type)) return layoutInspector(node);
    const def = defOf(node.type) || { fields: [] };
    const byGroup = {};
    (def.fields || []).forEach((f) => {
      const g = f.group || "content";
      byGroup[g] = byGroup[g] || [];
      byGroup[g].push(f);
    });
    const glob = node.source === "global" ? `
      <div class="acc"><h5>Componente global</h5>
        <p class="m-muted">Instancia de #${node.globalId}. Editar props aquí es override local. Editar el global afecta todas las páginas.</p>
        <button type="button" class="m-btn ghost" data-unlink="${node.id}">Desvincular</button>
      </div>` : "";
    const fieldsHtml = Object.entries(byGroup).map(([g, fields]) => `
      <div class="acc"><h5>${groups[g] || g}</h5>
        ${fields.map((f) => fieldHtml(node, f)).join("")}
      </div>`).join("");
    const hide = node.hiddenOn || {};
    const st = node.styles?.[state.bp] || {};
    const isImg = node.type === "image" || node.type === "hero";
    const visHtml = `
      <div class="acc"><h5>Visibilidad</h5>
        <label><input type="checkbox" data-hide-bp="desktop" ${hide.desktop ? "checked" : ""}> Ocultar en desktop</label>
        <label><input type="checkbox" data-hide-bp="tablet" ${hide.tablet ? "checked" : ""}> Ocultar en tablet</label>
        <label><input type="checkbox" data-hide-bp="mobile" ${hide.mobile ? "checked" : ""}> Ocultar en mobile</label>
        <p class="m-muted">Aplica al breakpoint del canvas (${state.bp}, ${state.widths[state.bp]}px).</p>
      </div>`;
    const typeHtml = `
      <div class="acc"><h5>Diseño de texto (${state.bp})</h5>
        <p class="m-muted">Alineación</p>
        ${seg("text-align", st["text-align"] || "", [
          { v: "left", l: "⟸", t: "Izquierda" },
          { v: "center", l: "≡", t: "Centro" },
          { v: "right", l: "⟹", t: "Derecha" },
          { v: "justify", l: "☰", t: "Justificado" },
        ])}
        ${rangeControl("Tamaño de fuente", "font-size", st, 10, 96, "px")}
        <p class="m-muted">Peso</p>
        ${seg("font-weight", st["font-weight"] || "", [
          { v: "300", l: "Light" }, { v: "400", l: "Reg" }, { v: "600", l: "Semi" }, { v: "700", l: "Bold" },
        ])}
        <p class="m-muted">Estilo</p>
        ${seg("font-style", st["font-style"] || "", [{ v: "normal", l: "I", t: "Normal" }, { v: "italic", l: "<i>I</i>", t: "Cursiva" }])}
        <p class="m-muted">Transformar</p>
        ${seg("text-transform", st["text-transform"] || "", [
          { v: "none", l: "aa" }, { v: "uppercase", l: "AA" }, { v: "capitalize", l: "Aa" },
        ])}
        ${window.KrgUi.fontFamilyField("Familia", st["font-family"] || "", 'data-style="font-family"')}
        ${window.KrgUi.colorField("Color texto", st.color || "", 'data-style="color"')}
        ${window.KrgUi.colorField("Fondo", st.background || "", 'data-style="background"')}
      </div>`;
    const spaceHtml = `
      <div class="acc"><h5>Espaciado (${state.bp})</h5>
        ${boxControl("padding", "Padding", st)}
        ${boxControl("margin", "Margin", st)}
      </div>`;
    const imgHtml = isImg ? `
      <div class="acc"><h5>Imagen (${state.bp})</h5>
        ${rangeControl("Ancho", "width", st, 10, 100, "%")}
        ${rangeControl("Alto (opcional)", "height", st, 0, 800, "px")}
        ${rangeControl("Máximo ancho", "max-width", st, 10, 100, "%")}
        <p class="m-muted">Ajuste</p>
        ${seg("object-fit", st["object-fit"] || node.props?.objectFit || "cover", [
          { v: "cover", l: "Cover" }, { v: "contain", l: "Contain" }, { v: "fill", l: "Fill" },
        ])}
        <p class="m-muted">Posición en el recorte</p>
        ${seg("object-position", st["object-position"] || "center", [
          { v: "left", l: "Izq" }, { v: "center", l: "Centro" }, { v: "right", l: "Der" }, { v: "top", l: "Arriba" }, { v: "bottom", l: "Abajo" },
        ])}
      </div>` : "";
    const advHtml = `
      <div class="acc"><h5>Avanzado</h5>
        <label>Identificador CSS (id) <input data-node="htmlId" value="${esc(node.htmlId || node.props?.htmlId || "")}" placeholder="hero-inicio"></label>
        <label>Clase CSS <input data-node="htmlClass" value="${esc(node.htmlClass || "")}" placeholder="mi-clase"></label>
        <label>Order <input data-style="order" value="${esc(st.order || "")}"></label>
      </div>`;
    const contentFields = (byGroup.content || []).map((f) => fieldHtml(node, f)).join("");
    const designFields = ["layout", "design", "colors", "spacing", "typography"].flatMap((g) => byGroup[g] || []).map((f) => fieldHtml(node, f)).join("");
    const tab = state.inspTab || "content";
    const menuModes = node.type === "menu" ? navModeFields(node.props || {}, "data-prop-set") : "";
    let body = "";
    if (tab === "design") {
      body = `${panelAlign(node)}${menuModes}${designFields}${typeHtml}${spaceHtml}${imgHtml}${panelAnim(node)}`;
    } else if (tab === "advanced") {
      body = `${visHtml}${advHtml}`;
    } else {
      body = `${glob}${contentFields ? `<div class="acc"><h5>Contenido</h5>${contentFields}</div>` : fieldsHtml}`;
    }
    return `<div class="acc"><h5>Página</h5>${pageFields()}</div>
      <div class="acc"><h5>${esc(def.name || node.type)}</h5><p class="m-muted">${esc(node.type)}</p></div>
      ${inspTabs()}${body}`;
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
      const cssVar = val?.token ? `var(--${String(val.token).replace(".", "-")})` : "";
      const shown = (val?.mode === "custom" && val?.value) ? val.value : cssVar;
      const hex = window.KrgUi ? window.KrgUi.hex(val?.value || cssVar) : "#D94E27";
      return `<label class="m-pick-label">${esc(f.label)}
        <div class="m-pick m-pick-color">
          <input type="color" data-color-picker="${f.key}" value="${esc(hex)}" title="Selector de color">
          <input data-color-custom="${f.key}" value="${esc(shown || hex)}" placeholder="#D94E27" class="m-pick-val">
        </div>
      </label>`;
    }
    if (f.type === "repeater") {
      const items = Array.isArray(val) ? val : [];
      const sub = (sf, it, i) => {
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
        if (sf.key === "imageUrl") return "";
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
      };
      return `<div><strong>${esc(f.label)}</strong>
        ${items.map((it, i) => `<div class="rep-item">
          ${(f.itemFields || []).map((sf) => sub(sf, it, i)).join("")}
          <button type="button" class="b-ico" data-rep-del="${f.key}" data-i="${i}">Eliminar ítem</button>
        </div>`).join("")}
        <button type="button" class="m-btn ghost" data-rep-add="${f.key}">Añadir</button>
      </div>`;
    }
    return `<label>${esc(f.label)} <input data-prop="${f.key}" value="${esc(val ?? "")}"></label>`;
  }

  function bindInspector() {
    const box = root.querySelector(".b-insp");
    if (!box) return;
    const hit = () => findNode(state.doc.sections, state.selected);
    box.querySelectorAll("[data-prop]").forEach((inp) => {
      const apply = () => {
        const h = hit();
        if (!h) return;
        let v = inp.type === "checkbox" ? inp.checked : inp.value;
        if (inp.type === "number" || inp.type === "range") v = Number(v);
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
        // Estos cambian la forma de la sección o qué campos tienen sentido,
        // así que hay que repintar el lienzo y el inspector.
        const REDRAW = ["parallax", "autoplay", "minHeight", "vAlign", "curtain", "headerSkin", "width", "heightUnit"];
        if (REDRAW.includes(inp.dataset.prop)) render();
      };
      inp.addEventListener("change", apply);
      inp.addEventListener("input", apply);
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
      h.node.styles = h.node.styles || { desktop: {}, tablet: {}, mobile: {} };
      h.node.styles[state.bp] = h.node.styles[state.bp] || {};
      if (value) h.node.styles[state.bp][prop] = value;
      else delete h.node.styles[state.bp][prop];
      markDirty();
    };
    box.querySelectorAll("[data-style]").forEach((inp) => {
      const apply = () => setStyle(inp.dataset.style, inp.value);
      inp.addEventListener("input", apply);
      inp.addEventListener("change", apply);
    });
    box.querySelectorAll("[data-side]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const prop = inp.dataset.side;
        const kind = prop.split("-")[0];
        setStyle(prop, unitize(inp.value, "px"));
        const h = hit();
        if (h?.node?.styles?.[state.bp]) delete h.node.styles[state.bp][kind];
      });
    });
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
        h.node.props = h.node.props || {};
        const key = b.dataset.propSet;
        const val = b.dataset.v;
        if (key === "distribute" && h.node.props[key] === val) h.node.props[key] = "none";
        else h.node.props[key] = val;
        if (key === "alignH" || key === "contentHAlign") {
          const map = { start: "left", center: "center", end: "right" };
          if (map[val]) {
            h.node.styles = h.node.styles || {};
            h.node.styles[state.bp] = h.node.styles[state.bp] || {};
            h.node.styles[state.bp]["text-align"] = map[val];
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
        h.parent.props = h.parent.props || {};
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
        h.node.props[key] = { mode: "custom", token: "", value: inp.value };
        markDirty();
      };
      inp.addEventListener("change", apply);
      inp.addEventListener("input", apply);
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

  function bindSplit() {
    const layout = root.querySelector(".b-layout");
    const handle = root.querySelector("[data-split=left]");
    if (!layout || !handle || handle.dataset.bound) return;
    handle.dataset.bound = "1";
    const stored = Number(localStorage.getItem("krg-left-w") || 0);
    const apply = (w) => {
      w = Math.max(220, Math.min(560, w));
      layout.style.setProperty("--b-left", w + "px");
      localStorage.setItem("krg-left-w", String(w));
    };
    if (stored) apply(stored);
    else apply(320);
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startW = layout.querySelector(".b-left")?.getBoundingClientRect().width || 320;
      const move = (ev) => apply(startW + (ev.clientX - startX));
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
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
    const prev = root.querySelector("#preview");
    if (prev) prev.onclick = () => window.open(state.doc.previewUrl, "_blank");
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
          state.doc = doc;
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
          <button class="m-btn ghost" id="history">Historial</button>
          <span class="b-status">${esc(state.save)}</span>
          <button class="m-btn ghost" id="save" title="Ctrl+S">Guardar</button>
          <button class="m-btn ghost" id="preview">Preview</button>
          <button class="m-btn" id="publish">Publicar</button>
        </div>
        <div class="b-layout">
          <aside class="b-left"></aside>
          <div class="b-split" data-split="left" title="Arrastra para ensanchar"></div>
          <div class="b-canvas">
            <div class="b-frame-slot">
              <div class="b-frame-wrap">
                <iframe src="${esc(state.doc.previewUrl || "about:blank")}"></iframe>
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
  }

  function onMsg(e) {
    const d = e.data;
    if (!d || d.source !== "krg") return;
    if (d.type === "select" && d.id) {
      state.selected = d.id;
      render();
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
      state.doc = doc;
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
