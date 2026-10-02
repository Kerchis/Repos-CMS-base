(() => {
  const cfg = window.KrgAdmin || {};
  const uid = (p) => {
    try {
      if (globalThis.crypto && typeof crypto.randomUUID === "function") return (p || "") + crypto.randomUUID();
    } catch (e) { /* HTTP */ }
    return (p || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };
  const api = {
    async req(path, opts = {}) {
      const { headers: extraHeaders, body, ...rest } = opts;
      const res = await fetch(cfg.rest.replace(/\/$/, "") + path, {
        credentials: "same-origin",
        ...rest,
        headers: {
          "Content-Type": "application/json",
          ...(extraHeaders || {}),
          "X-WP-Nonce": cfg.nonce,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.message || json.data?.message || json.code || "Error";
        const err = new Error(msg);
        err.status = res.status;
        err.code = json.code || json.data?.code || "";
        throw err;
      }
      return json;
    },
    get: (p) => api.req(p),
    post: (p, body) => api.req(p, { method: "POST", body }),
    put: (p, body) => api.req(p, { method: "PUT", body }),
    patch: (p, body, headers) => api.req(p, { method: "PATCH", body, headers }),
    del: (p) => api.req(p, { method: "DELETE" }),
  };
  window.MApi = api;

  const uiEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  window.KrgUi = {
    tokens: { color: {}, font: {}, typography: {} },
    fonts: [],
    setTokens(pack) {
      const data = pack?.data || pack || {};
      this.tokens = data.tokens || data || this.tokens;
      if (Array.isArray(pack?.fonts)) this.fonts = pack.fonts;
      return this.tokens;
    },
    ensureFontLink(google) {
      if (!google) return;
      const id = "krg-f-" + String(google).replace(/\s+/g, "-");
      if (document.getElementById(id)) return;
      const l = document.createElement("link");
      l.id = id;
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(google) + ":wght@300;400;500;600;700&display=swap";
      document.head.appendChild(l);
    },
    load() {
      if (!this._p) {
        this._p = api.get("/tokens").then((p) => this.setTokens(p)).catch(() => this.tokens);
      }
      return this._p;
    },
    hex(v) {
      const s = String(v || "").trim();
      if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
      const m = /^var\(--color-([a-z0-9-]+)\)$/i.exec(s);
      if (m) {
        const item = this.tokens.color?.[m[1]];
        const raw = item?.value || item;
        if (typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
      }
      return "#1d1d1b";
    },
    colorField(label, value, attr) {
      const v = String(value || "");
      return `<label class="m-pick-label">${uiEsc(label)}
        <div class="m-pick m-pick-color">
          <input type="color" data-pick-hex value="${uiEsc(this.hex(v))}" title="Selector de color">
          <input ${attr} value="${uiEsc(v)}" class="m-pick-val" placeholder="#D94E27" spellcheck="false">
        </div>
      </label>`;
    },
    fontFamilyField(label, value, attr) {
      const v = String(value || "");
      const isVar = /^var\(--font-/.test(v);
      const tokenOpts = Object.entries(this.tokens.font || {}).map(([k, item]) => {
        const css = `var(--font-${k})`;
        return `<option value="${uiEsc(css)}" ${v === css ? "selected" : ""}>${uiEsc(item.label || k)}</option>`;
      }).join("");
      const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
      const fonts = this.fonts || [];
      const matched = fonts.find((f) => norm(f.css) === norm(v) || (f.name && v.includes(f.name)));
      const isCustom = !!(v && !isVar && !matched);
      const groups = [
        { id: "wordpress", label: "WordPress (instaladas)" },
        { id: "web", label: "Catálogo web" },
        { id: "system", label: "Sistema" },
      ];
      const listOpts = groups.map((g) => {
        const list = fonts.filter((f) => f.group === g.id);
        if (!list.length) return "";
        return `<optgroup label="${uiEsc(g.label)}">${list.map((f) =>
          `<option value="${uiEsc(f.css)}" data-google="${uiEsc(f.google || "")}" ${matched && matched.css === f.css ? "selected" : ""}>${uiEsc(f.name)}</option>`
        ).join("")}</optgroup>`;
      }).join("");
      return `<label class="m-pick-label">${uiEsc(label)}
        <div class="m-pick m-pick-font">
          <select data-pick-token title="Estilo de marca (tokens)">
            <option value="">— Estilo —</option>
            ${tokenOpts}
          </select>
          <select data-pick-font title="Tipografía">
            <option value="">— Tipografía —</option>
            ${listOpts}
            <option value="__custom__" ${isCustom ? "selected" : ""}>Personalizada…</option>
          </select>
          <input ${attr} value="${uiEsc(v)}" class="m-pick-val" ${isCustom ? "" : "hidden"} placeholder='Palatino, Georgia, serif' spellcheck="false">
        </div>
      </label>`;
    },
    fontSizeField(label, value, attr) {
      const v = String(value || "");
      const roles = {
        display: "Display", h1: "Título 1", h2: "Título 2", h3: "Título 3",
        h4: "Título 4", h5: "Título 5", h6: "Título 6", body: "Párrafo",
        lead: "Lead", small: "Pequeño", eyebrow: "Eyebrow", caption: "Caption", button: "Botón",
      };
      const typo = this.tokens.typography && Object.keys(this.tokens.typography).length ? this.tokens.typography : roles;
      const opts = Object.keys(typo).map((k) => {
        const css = `var(--text-${k}-size)`;
        return `<option value="${uiEsc(css)}" ${v === css ? "selected" : ""}>${uiEsc(roles[k] || k)}</option>`;
      }).join("");
      const px = /^(\d+(?:\.\d+)?)px$/.exec(v);
      return `<label class="m-pick-label">${uiEsc(label)}
        <div class="m-pick m-pick-size">
          <select data-pick-token>
            <option value="">— Estilo —</option>
            ${opts}
            <option value="__custom__" ${v && !/^var\(--text-/.test(v) ? "selected" : ""}>Personalizado</option>
          </select>
          <input type="number" min="8" max="200" step="1" data-pick-px value="${px ? px[1] : ""}" title="Tamaño en px">
          <span class="m-pick-unit">px</span>
          <input ${attr} value="${uiEsc(v)}" class="m-pick-val" placeholder="var(--text-h2-size)">
        </div>
      </label>`;
    },
    fontWeightField(label, value, attr) {
      const v = String(value || "");
      const weights = ["", "300", "400", "500", "600", "700", "800"];
      return `<label class="m-pick-label">${uiEsc(label)}
        <select ${attr}>
          ${weights.map((w) => `<option value="${w}" ${v === w ? "selected" : ""}>${w || "—"}</option>`).join("")}
        </select>
      </label>`;
    },
    wire(box) {
      if (!box) return;
      box.querySelectorAll(".m-pick").forEach((row) => {
        const token = row.querySelector("[data-pick-token]");
        const fontList = row.querySelector("[data-pick-font]");
        const hex = row.querySelector("[data-pick-hex]");
        const px = row.querySelector("[data-pick-px]");
        const val = row.querySelector(".m-pick-val");
        if (!val) return;
        const fire = () => {
          val.dispatchEvent(new Event("input", { bubbles: true }));
          val.dispatchEvent(new Event("change", { bubbles: true }));
        };
        token?.addEventListener("change", () => {
          if (token.value && token.value !== "__custom__") {
            val.value = token.value;
            val.hidden = true;
            if (fontList) fontList.value = "";
            if (px) px.value = "";
            fire();
          }
        });
        fontList?.addEventListener("change", () => {
          if (token) token.value = "";
          if (fontList.value === "__custom__") {
            val.hidden = false;
            val.focus();
            return;
          }
          if (fontList.value) {
            val.value = fontList.value;
            val.hidden = true;
            const opt = fontList.selectedOptions[0];
            window.KrgUi.ensureFontLink(opt?.dataset.google || "");
            fire();
          }
        });
        hex?.addEventListener("input", () => {
          val.value = hex.value;
          fire();
        });
        px?.addEventListener("input", () => {
          if (!px.value) return;
          val.value = `${px.value}px`;
          if (token) token.value = "__custom__";
          fire();
        });
        val.addEventListener("input", () => {
          if (hex && /^#[0-9a-fA-F]{6}$/.test(val.value.trim())) hex.value = val.value.trim();
        });
      });
    },
  };

  const el = document.getElementById("krg-admin");
  if (!el) return;

  const toast = (t) => {
    const n = document.createElement("div");
    n.className = "m-toast";
    n.textContent = t;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2400);
  };

  const h = (strings, ...vals) => {
    // not tagged; we use html() below
  };
  const html = (s) => s;

  const nav = (active) => `
    <aside class="m-aside">
      <div class="m-aside-head">
        <a class="m-back-wp" href="${cfg.wpAdmin || "/wp-admin/"}" title="Volver a WordPress">←</a>
        <a class="m-brand" href="${cfg.admin}?page=krg">KRG <small>CMS</small></a>
      </div>
      <nav>
        <div class="grp">Contenido</div>
        ${cfg.canEditPages !== false ? `
        <a class="${active==="home"?"is-active":""}" href="${cfg.admin}?page=krg">Inicio</a>
        ${cfg.canManage ? `<a class="${active==="onboard"?"is-active":""}" href="${cfg.admin}?page=krg&view=onboard">Asistente de identidad</a>` : ""}
        <a class="${active==="pages"?"is-active":""}" href="${cfg.admin}?page=krg-pages">Páginas</a>` : ""}
        <a class="${active==="blog"?"is-active":""}" href="${cfg.admin}?page=krg-blog">Blog</a>
        ${cfg.canEditPages !== false ? `
        <a class="${active==="templates"?"is-active":""}" href="${cfg.admin}?page=krg-pages&view=templates">Plantillas</a>
        <a class="${active==="globals"?"is-active":""}" href="${cfg.admin}?page=krg-pages&view=globals">Componentes globales</a>` : ""}
        ${cfg.canManage ? `
        <div class="grp">Apariencia</div>
        <a class="${active==="design"?"is-active":""}" href="${cfg.admin}?page=krg-design">Identidad y tokens</a>
        <a class="${active==="nav"?"is-active":""}" href="${cfg.admin}?page=krg-nav">Navegación</a>
        <a href="${cfg.admin}?page=krg-builder&chrome=header">Header / Footer visual</a>
        <div class="grp">Sistema</div>
        <a class="${active==="seo"?"is-active":""}" href="${cfg.admin}?page=krg-seo">SEO</a>
        <a class="${active==="users"?"is-active":""}" href="${cfg.admin}?page=krg-users">Usuarios</a>
        <a class="${active==="settings"?"is-active":""}" href="${cfg.admin}?page=krg-settings">Configuración</a>` : ""}
        <a href="${cfg.home}" target="_blank" rel="noopener">Ver sitio</a>
      </nav>
    </aside>`;

  const shell = (active, body) => {
    el.innerHTML = `<div class="m-shell">${nav(active)}<div class="m-main-col">${body}</div></div>`;
  };

  const pageKey = cfg.page;
  const view = cfg.view;

  async function home() {
    if (view === "onboard") {
      if (!cfg.canManage) {
        shell("onboard", `<p class="m-form-error">No tienes permiso para el asistente de identidad.</p>`);
        return;
      }
      return onboard();
    }
    const d = await api.get("/bootstrap");
    shell("home", `
      <div class="m-top"><h1>Inicio</h1>
        <div class="m-row">
          <a class="m-btn ghost" href="${cfg.admin}?page=krg&view=onboard">Asistente de identidad</a>
          <a class="m-btn" href="${cfg.admin}?page=krg-pages&view=new">Nueva página</a>
        </div>
      </div>
      <p class="m-muted">Hola, ${cfg.user}. Construye páginas, cambia tokens y publica. Nada de esto es un mock.</p>
      <div class="m-cards">
        <div class="m-kpi"><span>Páginas</span><b>${d.counts.pages}</b></div>
        <div class="m-kpi"><span>Borradores</span><b>${d.counts.drafts}</b></div>
        <div class="m-kpi"><span>Entradas</span><b>${d.counts.posts}</b></div>
      </div>
      <div class="m-cards">
        <a class="m-kpi" href="${cfg.admin}?page=krg&view=onboard" style="text-decoration:none;color:inherit"><span>Marca</span><b style="font-size:18px">Asistente</b></a>
        <a class="m-kpi" href="${cfg.admin}?page=krg-builder&chrome=header" style="text-decoration:none;color:inherit"><span>Chrome</span><b style="font-size:18px">Header / Footer</b></a>
        <a class="m-kpi" href="${cfg.admin}?page=krg-design" style="text-decoration:none;color:inherit"><span>Tokens</span><b style="font-size:18px">Apariencia</b></a>
      </div>
      <div class="m-panel" style="padding:16px 20px">
        <h3>Páginas recientes</h3>
        <ul>${(d.pages||[]).slice(0,8).map(p => `<li><a href="${cfg.admin}?page=krg-builder&id=${p.id}">${esc(p.title)}</a> · ${p.status}</li>`).join("")}</ul>
      </div>`);
  }

  function contrastHint(bg, fg) {
    const hex = (v) => {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(v || "");
      return m ? m[1] : null;
    };
    const a = hex(bg), b = hex(fg);
    if (!a || !b) return "";
    const lum = (h) => {
      const c = [0, 1, 2].map((i) => {
        const n = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
        return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    return ratio < 4.5 ? `Contraste ${ratio.toFixed(1)}:1 — conviene revisar (objetivo AA ≥ 4.5).` : `Contraste ${ratio.toFixed(1)}:1 (AA).`;
  }

  async function onboard() {
    const [identity, tokensPack, header] = await Promise.all([api.get("/identity"), api.get("/tokens"), api.get("/header")]);
    const tokens = tokensPack.data || tokensPack;
    const col = (k, fallback) => tokens.tokens?.color?.[k]?.value || fallback;
    const data = {
      siteName: identity.siteName || "",
      tagline: identity.tagline || "",
      logoId: identity.logoId || 0,
      logoUrl: identity.logoUrl || "",
      faviconId: identity.faviconId || 0,
      faviconUrl: identity.faviconUrl || "",
      ctaText: header.ctaText || "Contacto",
      ctaUrl: header.ctaUrl || "/contacto/",
      heroTitle: "",
      heroSubtitle: "",
      colors: {
        primary: col("primary", "#D94E27"),
        secondary: col("secondary", "#512517"),
        tertiary: col("tertiary", "#E19C31"),
        background: col("background", "#FFFFFF"),
        surface: col("surface", "#F5F5F3"),
        text: col("text", "#1D1D1B"),
        success: col("success", "#7EB733"),
        info: col("info", "#274E97"),
      },
    };
    let step = 1;
    const paint = () => {
      const c = data.colors;
      shell("onboard", `
        <div class="m-top"><h1>Asistente de identidad</h1><span class="m-muted">Paso ${step} de 3</span></div>
        <div class="m-panel" style="padding:20px;margin-bottom:16px">
          ${step === 1 ? `
            <h3>1. Marca</h3>
            <form class="m-form-grid" id="s1">
              <label class="m-field">Nombre del sitio <input name="siteName" value="${esc(data.siteName)}"></label>
              <label class="m-field">Eslogan <input name="tagline" value="${esc(data.tagline)}"></label>
              <label class="m-field">Logo del sitio
                <input name="logoId" type="hidden" value="${data.logoId}">
                <div class="m-media-row">
                  ${data.logoUrl ? `<img class="m-thumb m-thumb-logo" src="${esc(data.logoUrl)}" alt="Logo">` : `<span class="m-thumb m-thumb-empty">Sin logo</span>`}
                  <button type="button" class="m-btn ghost" id="pick">Elegir logo</button>
                </div>
              </label>
              <label class="m-field">Favicon (icono de pestaña)
                <input name="faviconId" type="hidden" value="${data.faviconId}">
                <div class="m-media-row">
                  ${data.faviconUrl ? `<img class="m-thumb m-thumb-fav" src="${esc(data.faviconUrl)}" alt="Favicon">` : `<span class="m-thumb m-thumb-empty">32×32</span>`}
                  <button type="button" class="m-btn ghost" id="pick-fav">Elegir favicon</button>
                </div>
                <small class="m-muted">PNG o ICO. Se muestra en la pestaña del navegador y como apple-touch-icon.</small>
              </label>
              <label class="m-field">Titular del hero (home) <input name="heroTitle" value="${esc(data.heroTitle)}" placeholder="Déjalo vacío para no tocar el hero"></label>
              <label class="m-field">Subtítulo del hero <input name="heroSubtitle" value="${esc(data.heroSubtitle)}"></label>
            </form>` : ""}
          ${step === 2 ? `
            <h3>2. Paleta</h3>
            <p class="m-muted">Se escribe en tokens. Los componentes usan var(--color-primary), no estos hex.</p>
            <div id="pal">${Object.entries(c).map(([k,v]) => `<div class="m-field-row">
              <span>${esc(k)}</span>
              <input data-c="${k}" value="${esc(v)}">
              <input class="m-color" type="color" data-cp="${k}" value="${/^#[0-9a-fA-F]{6}$/.test(v)?v:"#000000"}">
            </div>`).join("")}</div>
            <p class="m-muted" id="hint">${esc(contrastHint(c.background, c.text))}</p>
            <div style="margin-top:16px;padding:20px;border-radius:16px;background:${esc(c.background)};color:${esc(c.text)};border:1px solid ${esc(c.secondary)}22">
              <p style="margin:0 0 8px;letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:${esc(c.primary)}">${esc(data.siteName || "Marca")}</p>
              <p style="font-family:Palatino,Georgia,serif;font-size:28px;margin:0 0 12px">${esc(data.heroTitle || "Titular de muestra")}</p>
              <span style="display:inline-block;padding:10px 16px;border-radius:8px;background:${esc(c.primary)};color:#fff">${esc(data.ctaText || "CTA")}</span>
            </div>` : ""}
          ${step === 3 ? `
            <h3>3. Header</h3>
            <label class="m-field">Texto del botón <input id="ctaText" value="${esc(data.ctaText)}"></label>
            <label class="m-field">URL del botón <input id="ctaUrl" value="${esc(data.ctaUrl)}"></label>
            <p class="m-muted">Al aplicar se actualizan identidad, tokens, header y —si escribiste un titular— el hero de la home publicada.</p>` : ""}
        </div>
        <div class="m-row">
          ${step > 1 ? `<button class="m-btn ghost" id="prev">Atrás</button>` : `<a class="m-btn ghost" href="${cfg.admin}?page=krg">Cancelar</a>`}
          ${step < 3 ? `<button class="m-btn" id="next">Continuar</button>` : `<button class="m-btn" id="apply">Aplicar identidad</button>`}
        </div>`);
      const bindMedia = (btnId, idKey, urlKey, title) => {
        const pick = el.querySelector(btnId);
        if (pick && window.wp?.media) {
          pick.onclick = () => {
            const frame = wp.media({ title, multiple: false, library: { type: "image" } });
            frame.on("select", () => {
              const att = frame.state().get("selection").first().toJSON();
              data[idKey] = att.id;
              data[urlKey] = att.url;
              const hidden = el.querySelector(`[name=${idKey}]`);
              if (hidden) hidden.value = att.id;
              paint();
            });
            frame.open();
          };
        }
      };
      bindMedia("#pick", "logoId", "logoUrl", "Logo");
      bindMedia("#pick-fav", "faviconId", "faviconUrl", "Favicon");
      el.querySelectorAll("[data-c]").forEach((inp) => {
        const p = el.querySelector(`[data-cp="${inp.dataset.c}"]`);
        const sync = () => {
          data.colors[inp.dataset.c] = inp.value;
          if (p && /^#[0-9a-fA-F]{6}$/.test(inp.value)) p.value = inp.value;
          const hint = el.querySelector("#hint");
          if (hint) hint.textContent = contrastHint(data.colors.background, data.colors.text);
        };
        inp.oninput = sync;
        if (p) p.oninput = () => { inp.value = p.value; sync(); };
      });
      el.querySelector("#next")?.addEventListener("click", () => {
        if (step === 1) {
          const f = el.querySelector("#s1");
          data.siteName = f.siteName.value;
          data.tagline = f.tagline.value;
          data.logoId = Number(f.logoId.value || 0);
          data.faviconId = Number(f.faviconId.value || 0);
          data.heroTitle = f.heroTitle.value;
          data.heroSubtitle = f.heroSubtitle.value;
        }
        step += 1;
        paint();
      });
      el.querySelector("#prev")?.addEventListener("click", () => { step -= 1; paint(); });
      el.querySelector("#apply")?.addEventListener("click", async () => {
        data.ctaText = el.querySelector("#ctaText").value;
        data.ctaUrl = el.querySelector("#ctaUrl").value;
        try {
          await api.post("/onboard", data);
          toast("Identidad aplicada al sitio público");
          location.href = `${cfg.admin}?page=krg`;
        } catch (e) {
          toast(e.message);
        }
      });
    };
    paint();
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  async function pages() {
    if (view === "new") return newPage();
    if (view === "templates") return templates();
    if (view === "globals") return globals();
    const list = await api.get("/pages");
    const front = list.find((p) => p.isFront);
    const canPub = cfg.canPublish !== false;
    shell("pages", `
      <div class="m-top"><h1>Páginas</h1>
        <div class="m-row">
          <a class="m-btn" href="${cfg.admin}?page=krg-pages&view=new">Nueva página</a>
          <button class="m-btn ghost" id="exp-pages">Exportar JSON</button>
          <label class="m-btn ghost">Importar JSON <input type="file" id="imp-pages" accept="application/json" hidden></label>
        </div>
      </div>
      <div class="m-panel m-front-bar">
        <h2>Portada del sitio</h2>
        <p class="m-muted">Lo que ve quien entra a la web. Los borradores (como una página a medias) no se muestran aquí.</p>
        <div class="m-front-row">
          <label class="m-field">Página de inicio
            <select id="site-front">
              <option value="0">Últimas entradas del blog</option>
              ${list.map((p) => `<option value="${p.id}" ${p.isFront ? "selected" : ""} ${p.uiStatus !== "publish" && p.status !== "private" ? "disabled" : ""}>${esc(p.title)}${p.uiStatus !== "publish" && p.status !== "private" ? " (borrador)" : ""}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="m-btn" id="save-front" ${canPub ? "" : "disabled"}>Usar como portada</button>
        </div>
        <p class="m-muted">${front ? `Ahora mismo la portada es «${esc(front.title)}».` : "Ahora mismo no hay una página de inicio: se muestran las entradas."}</p>
      </div>
      <div class="m-table"><table>
        <thead><tr><th>Título</th><th>Slug</th><th>Estado</th><th>Visibilidad</th><th>Portada</th><th></th></tr></thead>
        <tbody>
          ${list.map((p) => `<tr data-row="${p.id}">
            <td><a href="${cfg.admin}?page=krg-builder&id=${p.id}">${esc(p.title)}</a>
              ${p.isFront ? `<span class="m-pill pub">Portada</span>` : ""}</td>
            <td>/${esc(p.slug)}</td>
            <td>
              <select data-status ${canPub ? "" : "disabled"}>
                <option value="draft" ${p.uiStatus === "draft" ? "selected" : ""}>Borrador</option>
                <option value="pending" ${p.uiStatus === "pending" ? "selected" : ""}>Pendiente de revisión</option>
                <option value="publish" ${p.uiStatus === "publish" ? "selected" : ""}>Publicada</option>
              </select>
            </td>
            <td>
              <select data-vis ${canPub ? "" : "disabled"}>
                <option value="public" ${p.visibility === "public" ? "selected" : ""}>Público</option>
                <option value="protected" ${p.visibility === "protected" ? "selected" : ""}>Protegido con contraseña</option>
                <option value="private" ${p.visibility === "private" ? "selected" : ""}>Privada</option>
              </select>
              <input data-pw type="password" placeholder="${p.hasPassword ? "Nueva contraseña" : "Contraseña"}" autocomplete="new-password" ${p.visibility === "protected" ? "" : "hidden"}>
            </td>
            <td>${p.isFront ? `<span class="m-pill pub">Sí</span>` : `<button type="button" class="m-btn ghost" data-front="${p.id}" ${canPub ? "" : "disabled"}>Usar como portada</button>`}</td>
            <td>
              <a href="${cfg.admin}?page=krg-builder&id=${p.id}">Editar</a>
              · <button class="m-btn ghost" data-dup="${p.id}">Duplicar</button>
              · <button class="m-btn ghost" data-del="${p.id}">Eliminar</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table></div>`);
    const saveMeta = async (row, extra = {}) => {
      const id = row.getAttribute("data-row");
      const payload = {
        status: row.querySelector("[data-status]").value,
        visibility: row.querySelector("[data-vis]").value,
        ...extra,
      };
      const pw = row.querySelector("[data-pw]")?.value;
      if (payload.visibility === "protected" && pw) payload.password = pw;
      try {
        await api.post(`/pages/${id}/settings`, payload);
        toast("Página actualizada");
        pages();
      } catch (err) {
        toast(err.message);
      }
    };
    el.querySelectorAll("[data-status]").forEach((s) => s.onchange = () => saveMeta(s.closest("tr")));
    el.querySelectorAll("[data-vis]").forEach((s) => {
      s.onchange = () => {
        const pw = s.closest("tr").querySelector("[data-pw]");
        if (pw) pw.hidden = s.value !== "protected";
        if (s.value === "protected" && pw && !pw.value) {
          pw.focus();
          return;
        }
        saveMeta(s.closest("tr"));
      };
    });
    el.querySelectorAll("[data-pw]").forEach((inp) => {
      inp.onchange = () => {
        if (inp.closest("tr").querySelector("[data-vis]").value === "protected") saveMeta(inp.closest("tr"));
      };
    });
    el.querySelectorAll("[data-front]").forEach((b) => b.onclick = async () => {
      try {
        await api.post("/site/front", { pageId: Number(b.dataset.front) });
        toast("Portada actualizada");
        pages();
      } catch (err) {
        toast(err.message);
      }
    });
    el.querySelector("#save-front").onclick = async () => {
      try {
        await api.post("/site/front", { pageId: Number(el.querySelector("#site-front").value) });
        toast("Portada actualizada");
        pages();
      } catch (err) {
        toast(err.message);
      }
    };
    el.querySelectorAll("[data-dup]").forEach((b) => b.onclick = async () => {
      const d = await api.post(`/pages/${b.dataset.dup}/duplicate`, {});
      location.href = `${cfg.admin}?page=krg-builder&id=${d.id}`;
    });
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      if (!confirm("¿Eliminar esta página?")) return;
      await api.del(`/pages/${b.dataset.del}`);
      toast("Página eliminada");
      pages();
    });
    el.querySelector("#exp-pages").onclick = async () => {
      const pack = await api.post("/export", {});
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "krg-export.json";
      a.click();
    };
    el.querySelector("#imp-pages").onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const pack = JSON.parse(await file.text());
        const r = await api.post("/import", pack);
        toast("Importado. Páginas nuevas: " + (r.pages ?? 0));
        pages();
      } catch (err) {
        toast(err.message);
      }
    };
  }

  async function newPage() {
    const pages = await api.get("/pages").catch(() => []);
    shell("pages", `
      <div class="m-top"><h1>Nueva página</h1></div>
      <form class="m-form-grid" id="np">
        <label class="m-field">Nombre <input name="title" required placeholder="Página Servicios"></label>
        <label class="m-field">Slug <input name="slug" placeholder="servicios"></label>
        <label class="m-field">Página padre
          <select name="parentId">
            <option value="0">— Ninguna (raíz) —</option>
            ${pages.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("")}
          </select>
        </label>
        <button class="m-btn" type="submit">Crear y abrir constructor</button>
      </form>`);
    el.querySelector("#np").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const doc = await api.post("/pages", { title: fd.get("title"), slug: fd.get("slug"), parentId: Number(fd.get("parentId") || 0) });
      location.href = `${cfg.admin}?page=krg-builder&id=${doc.id}`;
    };
  }

  async function templates() {
    const list = await api.get("/templates");
    shell("templates", `
      <div class="m-top"><h1>Plantillas</h1></div>
      <p class="m-muted">Guarda una sección desde el constructor con “Guardar plantilla”.</p>
      <div class="m-table"><table><tbody>
        ${list.length ? list.map((t) => `<tr><td>${esc(t.name)}</td><td><button class="m-btn ghost" data-del="${t.id}">Eliminar</button></td></tr>`).join("") : "<tr><td>No hay plantillas todavía.</td></tr>"}
      </tbody></table></div>`);
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      await api.del(`/templates/${b.dataset.del}`);
      templates();
    });
  }

  async function globals() {
    const list = await api.get("/globals");
    shell("globals", `
      <div class="m-top"><h1>Componentes globales</h1></div>
      <p class="m-muted">Un global se reutiliza en varias páginas. Editarlo afecta a todas las instancias.</p>
      <div class="m-table"><table><tbody>
        ${list.length ? list.map((t) => `<tr><td>${esc(t.name)}</td><td><button class="m-btn ghost" data-del="${t.id}">Eliminar</button></td></tr>`).join("") : "<tr><td>Ninguno todavía.</td></tr>"}
      </tbody></table></div>`);
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      await api.del(`/globals/${b.dataset.del}`);
      globals();
    });
  }

  function defaultFontVariants() {
    return [
      { id: "300-normal", label: "Light", weight: "300", style: "normal" },
      { id: "400-normal", label: "Regular", weight: "400", style: "normal" },
      { id: "500-normal", label: "Medium", weight: "500", style: "normal" },
      { id: "600-normal", label: "Semibold", weight: "600", style: "normal" },
      { id: "700-normal", label: "Bold", weight: "700", style: "normal" },
      { id: "300-italic", label: "Light Italic", weight: "300", style: "italic" },
      { id: "400-italic", label: "Italic", weight: "400", style: "italic" },
      { id: "500-italic", label: "Medium Italic", weight: "500", style: "italic" },
      { id: "600-italic", label: "Semibold Italic", weight: "600", style: "italic" },
      { id: "700-italic", label: "Bold Italic", weight: "700", style: "italic" },
    ];
  }

  function variantOptionsHtml(variants, weight, style) {
    const list = (variants && variants.length) ? variants : defaultFontVariants();
    const cur = `${String(weight || "400")}-${String(style || "normal")}`;
    return list.map((v) => {
      const id = v.id || `${v.weight}-${v.style}`;
      const on = id === cur || (String(v.weight) === String(weight || "400") && String(v.style) === String(style || "normal"));
      return `<option value="${esc(id)}" data-weight="${esc(v.weight)}" data-style="${esc(v.style)}" ${on ? "selected" : ""}>${esc(v.label || id)}</option>`;
    }).join("");
  }

  function fillFontVariants(wrap, weight, style) {
    const sel = wrap?.querySelector("[data-font]");
    const vsel = wrap?.querySelector("[data-font-variant]");
    if (!vsel) return;
    const opt = sel?.selectedOptions[0];
    let list = [];
    try {
      list = JSON.parse(opt?.getAttribute("data-variants") || "[]");
    } catch (e) {
      list = [];
    }
    if (!Array.isArray(list) || !list.length) list = defaultFontVariants();
    const prevW = weight || vsel.selectedOptions[0]?.dataset.weight || "400";
    const prevS = style || vsel.selectedOptions[0]?.dataset.style || "normal";
    vsel.innerHTML = variantOptionsHtml(list, prevW, prevS);
  }

  function fontFamilyRow(key, item, catalog) {
    const current = String(item.value || item || "");
    const weight = String(item.weight || "400");
    const style = String(item.style || "normal");
    const groups = [
      { id: "wordpress", label: "WordPress (instaladas)" },
      { id: "web", label: "Catálogo web" },
      { id: "system", label: "Sistema" },
    ];
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const matched = catalog.find((f) => norm(f.css) === norm(current) || (f.name && current.includes(f.name)));
    const isCustom = current && !matched;
    const opts = groups.map((g) => {
      const list = catalog.filter((f) => f.group === g.id);
      if (!list.length) return "";
      return `<optgroup label="${esc(g.label)}">${list.map((f) =>
        `<option value="${esc(f.css)}" data-google="${esc(f.google || "")}" data-variants="${esc(JSON.stringify(f.variants || []))}" ${matched && matched.css === f.css ? "selected" : ""}>${esc(f.name)}</option>`
      ).join("")}</optgroup>`;
    }).join("");
    const preview = matched ? matched.css : current;
    return `<div class="m-font-row" data-font-wrap="${esc(key)}">
      <span>${esc(item.label || key)}</span>
      <select data-font="${esc(key)}">
        ${opts}
        <option value="__custom__" ${isCustom ? "selected" : ""}>Personalizada…</option>
      </select>
      <select data-font-variant="${esc(key)}" title="Variante">${variantOptionsHtml(matched?.variants, weight, style)}</select>
      <span class="m-font-preview" style="font-family:${esc(preview || "inherit")};font-weight:${esc(weight)};font-style:${esc(style)}">Aa Bb Cc 123</span>
      <input data-font-custom="${esc(key)}" value="${esc(current)}" ${isCustom ? "" : "hidden"} placeholder='"Mi Fuente", sans-serif'>
    </div>`;
  }

  function ensureFontLink(google) {
    if (!google) return;
    const id = "krg-f-" + String(google).replace(/\s+/g, "-");
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(google) + ":wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }

  function tokenMap(obj, prefix) {
    return Object.entries(obj || {}).map(([k, v]) => {
      const val = v && typeof v === "object" && "value" in v ? v.value : (typeof v === "object" ? JSON.stringify(v) : v);
      const label = (v && v.label) || k;
      return `<div class="m-field-row" style="grid-template-columns:160px 1fr">
        <span>${esc(label)}</span>
        <input data-tok="${prefix}.${k}" value="${esc(val ?? "")}">
      </div>`;
    }).join("");
  }

  function typeRows(typo, fonts) {
    const names = {
      display: "Display",
      h1: "Título 1",
      h2: "Título 2",
      h3: "Título 3",
      h4: "Título 4",
      h5: "Título 5",
      h6: "Título 6",
      p: "Párrafo",
      small: "Texto pequeño",
      button: "Botón",
      label: "Etiqueta",
      caption: "Pie / caption",
    };
    const fontOpts = (selected) => Object.entries(fonts || {}).map(([k, item]) =>
      `<option value="${esc(k)}" ${String(selected || "") === k ? "selected" : ""}>${esc(item.label || k)}</option>`
    ).join("");
    return Object.entries(typo || {}).map(([role, item]) => `
      <div class="m-panel" style="padding:12px 16px;margin-bottom:10px">
        <strong>${esc(names[role] || role)}</strong>
        <div class="m-field-row" style="grid-template-columns:repeat(6,1fr);margin-top:8px">
          <label class="m-field">Familia <select data-typo="${role}" data-k="fontFamily">${fontOpts(item.fontFamily)}</select></label>
          <label class="m-field">Tamaño <input data-typo="${role}" data-k="fontSize" value="${esc(item.fontSize || "")}"></label>
          <label class="m-field">Peso <input data-typo="${role}" data-k="fontWeight" value="${esc(item.fontWeight || "")}"></label>
          <label class="m-field">Interlineado <input data-typo="${role}" data-k="lineHeight" value="${esc(item.lineHeight || "")}"></label>
          <label class="m-field">Tracking <input data-typo="${role}" data-k="letterSpacing" value="${esc(item.letterSpacing || "")}"></label>
          <label class="m-field">Mayúsculas <select data-typo="${role}" data-k="textTransform">${
            [["none", "Como se escribe"], ["uppercase", "MAYÚSCULAS"], ["lowercase", "minúsculas"], ["capitalize", "Iniciales"]]
              .map(([v, l]) => `<option value="${v}" ${String(item.textTransform || "none") === v ? "selected" : ""}>${esc(l)}</option>`)
              .join("")
          }</select></label>
        </div>
      </div>`).join("");
  }

  function tokVal(v) {
    return (v && typeof v === "object" && "value" in v) ? v.value : v;
  }

  let identityCache = null;

  // Colores de los que dependen los componentes: se pueden cambiar de valor
  // pero no borrar, o el sistema se quedaría sin referencias.
  const CORE_COLORS = [
    "primary", "secondary", "tertiary", "background", "surface", "surface-alt",
    "text", "text-secondary", "muted", "border", "border-strong", "error",
    "highlight", "on-primary", "on-secondary", "on-surface",
  ];

  function colorRow(key, label, val, locked) {
    const del = locked
      ? ""
      : `<button type="button" class="m-color-del" data-del-color="${uiEsc(key)}" title="Quitar el color ${uiEsc(label)}" aria-label="Quitar el color ${uiEsc(label)}">×</button>`;
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(val || "").trim()) ? String(val).trim() : "#000000";
    return `<div class="m-field-row" data-color-row="${uiEsc(key)}">
      <span>${uiEsc(label)}</span>
      <input data-color="${uiEsc(key)}" value="${uiEsc(val)}">
      <input class="m-color" type="color" data-color-picker="${uiEsc(key)}" value="${uiEsc(hex)}">
      ${del}
    </div>`;
  }

  async function design() {
    const packP = api.get("/tokens?_=" + Date.now());
    const skinP = api.get("/admin-skin?_=" + Date.now()).catch(() => null);
    if (!identityCache) identityCache = api.get("/identity");
    const [pack, identity, skinPack] = await Promise.all([packP, identityCache, skinP]);
    const data = pack.data || pack;
    const tokens = data.tokens || {};
    const fontCatalog = pack.fonts || [];
    const activePreset = String(data.activePreset || "");
    const colorRows = Object.entries(tokens.color || {}).map(([k, v]) => {
      const val = (v && typeof v === "object" && "value" in v) ? v.value : v;
      return colorRow(k, v.label || k, val, CORE_COLORS.includes(k));
    }).join("");
    const paletteBar = Object.entries(tokens.color || {}).map(([k, v]) => {
      const val = (v && typeof v === "object" && "value" in v) ? v.value : v;
      return `<span class="m-palette-chip" title="${esc(v.label || k)}" style="background:${esc(val)}"></span>`;
    }).join("");
    const activeLabel = (pack.presets || []).find((p) => p.slug === activePreset)?.name || activePreset;
    const presetStatus = activePreset
      ? ("Activo: <strong>" + esc(activeLabel) + "</strong>")
      : "Ningún preset activo (valores personalizados).";
    const presetCards = (pack.presets || []).map((p) => {
      const on = activePreset === p.slug;
      const chips = (p.swatches || []).map((c) => `<i style="background:${esc(c)}"></i>`).join("");
      const del = p.custom
        ? `<button type="button" class="m-preset-del" data-del-preset="${esc(p.slug)}" title="Borrar el preset ${esc(p.name)}" aria-label="Borrar el preset ${esc(p.name)}">×</button>`
        : "";
      return `<div class="m-preset-wrap">
        <label class="m-preset ${on ? "is-on" : ""}">
          <span class="m-preset-copy">
            <strong>${esc(p.name)}</strong>
            <span class="m-preset-swatches">${chips}</span>
          </span>
          <input type="checkbox" data-preset="${esc(p.slug)}" ${on ? "checked" : ""} role="switch" aria-checked="${on ? "true" : "false"}" aria-label="Activar ${esc(p.name)}">
          <span class="m-ios-switch" aria-hidden="true"></span>
        </label>
        ${del}
      </div>`;
    }).join("");
    const skinData = (skinPack && skinPack.data) || {};
    const skinDefaults = (skinPack && skinPack.defaults) || {};
    const skinLabels = {
      sidebar: "Barra lateral",
      sidebarDeep: "Barra lateral (tono oscuro)",
      action: "Color de acción (botones)",
      actionDeep: "Acción al pasar el ratón",
      accentSoft: "Tinte suave de acción",
      paper: "Fondo del panel",
      surface: "Superficie",
      surfaceSoft: "Superficie suave",
      line: "Líneas y bordes",
      lineStrong: "Bordes marcados",
      ink: "Texto",
      muted: "Texto secundario",
    };
    const skinVars = {
      sidebar: "--m-brown", sidebarDeep: "--m-brown-deep", action: "--m-orange",
      actionDeep: "--m-orange-deep", accentSoft: "--m-accent-soft", paper: "--m-paper",
      surface: "--m-surface", surfaceSoft: "--m-surface-soft", line: "--m-line",
      lineStrong: "--m-line-strong", ink: "--m-ink", muted: "--m-muted",
    };

    function adminSkinPanel() {
      if (!skinPack) return "";
      const rows = Object.keys(skinLabels).map((k) => {
        const v = skinData[k] || skinDefaults[k] || "#000000";
        return `<div class="m-field-row">
          <span>${esc(skinLabels[k])}</span>
          <input data-skin="${k}" value="${esc(v)}">
          <input class="m-color" type="color" data-skin-picker="${k}" value="${esc(normalizeHex(v))}">
        </div>`;
      }).join("");
      return `<div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Colores del CMS</h3>
        <p class="m-muted">Cambian el aspecto de este panel, no el del sitio público. Se ven al instante mientras los tocas; pulsa Guardar para dejarlos fijos.</p>
        <div id="skin-colors">${rows}</div>
        <div class="m-section-save m-row">
          <button type="button" class="m-btn" id="save-skin">Guardar colores del CMS</button>
          <button type="button" class="m-btn ghost" id="skin-from-palette">Usar la paleta del sitio</button>
          <button type="button" class="m-btn ghost" id="skin-reset">Restablecer</button>
        </div>
      </div>`;
    }

    shell("design", `
      <div class="m-top"><h1>Apariencia</h1>
        <div class="m-row">
          <button class="m-btn" id="save-tokens">Guardar tokens</button>
          <button class="m-btn ghost" id="exp-tokens">Exportar tokens</button>
          <label class="m-btn ghost">Importar tokens <input type="file" id="imp-tokens" accept="application/json" hidden></label>
        </div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Presets</h3>
        <p class="m-muted">El interruptor aplica la paleta al instante en esta pantalla. Luego pulsa Guardar paleta para publicarla en el sitio. Solo un interruptor queda encendido.</p>
        <div class="m-presets">${presetCards}</div>
        <p class="m-preset-status">${presetStatus}</p>
        <div class="m-palette-bar">${paletteBar}</div>
        <div class="m-preset-actions">
          <button class="m-btn" type="button" id="save-preset">Guardar paleta</button>
          <span class="m-muted" id="preset-dirty" hidden>Hay un cambio de preset sin guardar.</span>
        </div>
        <div class="m-preset-new">
          <h4>Crear un preset</h4>
          <p class="m-muted">Guarda los colores y tipografías que tienes ahora mismo como un preset nuevo, para poder volver a ellos cuando quieras. Los presets que vienen con el tema no se tocan.</p>
          <div class="m-row">
            <label class="m-field m-field-grow">Nombre del preset
              <input id="new-preset-name" placeholder="Por ejemplo: Verano 2026" maxlength="60">
            </label>
            <button class="m-btn" type="button" id="new-preset">Guardar como preset</button>
          </div>
        </div>
      </div>
      ${adminSkinPanel()}
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Identidad</h3>
        <form class="m-form-grid" id="idform">
          <label class="m-field">Nombre del sitio <input name="siteName" value="${esc(identity.siteName)}"></label>
          <label class="m-field">Eslogan <input name="tagline" value="${esc(identity.tagline)}"></label>
          <label class="m-field">Logo
            <input name="logoId" type="hidden" value="${identity.logoId||0}">
            <div class="m-media-row">
              ${identity.logoUrl ? `<img class="m-thumb m-thumb-logo" src="${esc(identity.logoUrl)}" alt="Logo">` : `<span class="m-thumb m-thumb-empty">Sin logo</span>`}
              <button type="button" class="m-btn ghost" id="pick-logo">Elegir logo</button>
            </div>
          </label>
          <label class="m-field">Favicon (icono de pestaña)
            <input name="faviconId" type="hidden" value="${identity.faviconId||0}">
            <div class="m-media-row">
              ${identity.faviconUrl ? `<img class="m-thumb m-thumb-fav" src="${esc(identity.faviconUrl)}" alt="Favicon">` : `<span class="m-thumb m-thumb-empty">32×32</span>`}
              <button type="button" class="m-btn ghost" id="pick-fav">Elegir favicon</button>
            </div>
            <small class="m-muted">PNG cuadrado (32×32 o 512×512). Aparece en la pestaña del navegador.</small>
          </label>
          <button class="m-btn" type="submit">Guardar identidad</button>
        </form>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Colores</h3>
        <p class="m-muted">Alimentan var(--color-*). Ningún componente usa hex de marca.</p>
        <div id="colors">${colorRows}</div>
        <div class="m-add-color">
          <label class="m-field m-field-grow">Añadir un color
            <input id="new-color-name" placeholder="Por ejemplo: Acento cálido" maxlength="40">
          </label>
          <button type="button" class="m-btn ghost" id="add-color">Añadir</button>
        </div>
        <p class="m-muted">Cada color queda disponible como <code>var(--color-nombre)</code> y aparece en los selectores de color de los bloques. Los del núcleo no se pueden quitar porque los usan los componentes.</p>
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="colores">Guardar colores</button></div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Familias tipográficas</h3>
        <p class="m-muted">Elige la familia y su variante (Regular, Bold, Italic…). En fuentes de WordPress aparecen las caras instaladas. Luego pulsa Guardar familias.</p>
        ${Object.entries(tokens.font || {}).map(([k, v]) => fontFamilyRow(k, v, fontCatalog)).join("")}
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="familias">Guardar familias</button></div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Roles tipográficos</h3>
        <p class="m-muted">Tamaño, peso, familia, interlineado y tracking de cada rol (títulos, párrafo, botón…).</p>
        ${typeRows(tokens.typography, tokens.font)}
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="roles">Guardar roles tipográficos</button></div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Espaciado</h3>${tokenMap(tokens.spacing, "spacing")}
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="espaciado">Guardar espaciado</button></div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Radios</h3>${tokenMap(tokens.radius, "radius")}
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="radios">Guardar radios</button></div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Sombras</h3>${tokenMap(tokens.shadow, "shadow")}
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="sombras">Guardar sombras</button></div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Layout</h3>${tokenMap(tokens.layout, "layout")}
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="layout">Guardar layout</button></div>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Breakpoints</h3>${tokenMap(tokens.breakpoint, "breakpoint")}
        <div class="m-section-save"><button type="button" class="m-btn" data-save-section="breakpoints">Guardar breakpoints</button></div>
      </div>`);
    el.querySelectorAll("[data-color]").forEach((inp) => {
      const p = el.querySelector(`[data-color-picker="${inp.dataset.color}"]`);
      inp.oninput = () => { if (p && /^#[0-9a-fA-F]{6}$/.test(inp.value)) p.value = inp.value; };
      if (p) p.oninput = () => { inp.value = p.value; };
    });
    const collect = () => {
      const next = structuredClone(data);
      next.tokens = next.tokens || {};
      // Se reconstruye entero desde el DOM para que al borrar una fila el
      // color desaparezca de verdad, no solo de la pantalla.
      const prevColors = next.tokens.color || {};
      const nextColors = {};
      el.querySelectorAll("[data-color]").forEach((inp) => {
        const key = inp.dataset.color;
        const cur = prevColors[key];
        nextColors[key] = (cur && typeof cur === "object")
          ? Object.assign({}, cur, { value: inp.value })
          : { value: inp.value, type: "color" };
      });
      if (Object.keys(nextColors).length) next.tokens.color = nextColors;
      el.querySelectorAll("[data-font]").forEach((inp) => {
        let v = inp.value;
        if (v === "__custom__") {
          const c = el.querySelector(`[data-font-custom="${inp.dataset.font}"]`);
          v = c ? c.value : "";
        }
        next.tokens.font = next.tokens.font || {};
        const cur = next.tokens.font[inp.dataset.font];
        if (cur && typeof cur === "object") cur.value = v;
        else next.tokens.font[inp.dataset.font] = { value: v, type: "fontFamily" };
      });
      el.querySelectorAll("[data-font-variant]").forEach((sel) => {
        const key = sel.dataset.fontVariant;
        const opt = sel.selectedOptions[0];
        next.tokens.font = next.tokens.font || {};
        next.tokens.font[key] = next.tokens.font[key] || {};
        next.tokens.font[key].weight = opt?.dataset.weight || "400";
        next.tokens.font[key].style = opt?.dataset.style || "normal";
      });
      el.querySelectorAll("[data-typo]").forEach((inp) => {
        next.tokens.typography = next.tokens.typography || {};
        next.tokens.typography[inp.dataset.typo] = next.tokens.typography[inp.dataset.typo] || {};
        next.tokens.typography[inp.dataset.typo][inp.dataset.k] = inp.value;
      });
      el.querySelectorAll("[data-tok]").forEach((inp) => {
        const [group, key] = inp.dataset.tok.split(".");
        next.tokens[group] = next.tokens[group] || {};
        if (next.tokens[group][key] && typeof next.tokens[group][key] === "object") {
          next.tokens[group][key].value = inp.value;
        } else {
          next.tokens[group][key] = { value: inp.value };
        }
      });
      return next;
    };

    const paletteHtml = (colorMap) => Object.entries(colorMap || {}).map(([k, v]) => {
      const val = tokVal(v);
      return `<span class="m-palette-chip" title="${esc(v.label || k)}" style="background:${esc(val)}"></span>`;
    }).join("");

    const applyTokensToForm = (nextTokens) => {
      Object.entries(nextTokens.color || {}).forEach(([k, v]) => {
        const val = String(tokVal(v) ?? "");
        const inp = el.querySelector(`[data-color="${k}"]`);
        const pick = el.querySelector(`[data-color-picker="${k}"]`);
        if (inp) inp.value = val;
        if (pick) pick.value = normalizeHex(val);
      });
      Object.entries(nextTokens.font || {}).forEach(([k, v]) => {
        const css = String(tokVal(v) ?? "");
        const wrap = el.querySelector(`[data-font-wrap="${k}"]`);
        const sel = wrap?.querySelector("[data-font]");
        const vsel = wrap?.querySelector("[data-font-variant]");
        const custom = wrap?.querySelector("[data-font-custom]");
        const preview = wrap?.querySelector(".m-font-preview");
        if (!sel) return;
        const match = [...sel.options].some((o) => o.value === css);
        sel.value = match ? css : "__custom__";
        if (custom) {
          custom.hidden = sel.value !== "__custom__";
          custom.value = css;
        }
        fillFontVariants(wrap, v.weight, v.style);
        if (preview) {
          preview.style.fontFamily = css || "inherit";
          preview.style.fontWeight = v.weight || "400";
          preview.style.fontStyle = v.style || "normal";
        }
      });
      Object.entries(nextTokens.typography || {}).forEach(([role, item]) => {
        Object.entries(item || {}).forEach(([k, val]) => {
          const inp = el.querySelector(`[data-typo="${role}"][data-k="${k}"]`);
          if (inp) inp.value = val ?? "";
        });
      });
      ["spacing", "radius", "shadow", "layout", "breakpoint"].forEach((group) => {
        Object.entries(nextTokens[group] || {}).forEach(([k, v]) => {
          const inp = el.querySelector(`[data-tok="${group}.${k}"]`);
          if (inp) inp.value = tokVal(v) ?? "";
        });
      });
      const bar = el.querySelector(".m-palette-bar");
      if (bar) bar.innerHTML = paletteHtml(nextTokens.color);
    };

    const setPresetUI = (slug) => {
      el.querySelectorAll(".m-preset").forEach((lab) => {
        const box = lab.querySelector("[data-preset]");
        const on = !!(slug && box && box.dataset.preset === slug);
        if (box) {
          box.checked = on;
          box.setAttribute("aria-checked", on ? "true" : "false");
        }
        lab.classList.toggle("is-on", on);
      });
      const name = (pack.presets || []).find((p) => p.slug === slug)?.name || slug;
      const st = el.querySelector(".m-preset-status");
      if (st) {
        st.innerHTML = slug
          ? ("Activo: <strong>" + esc(name) + "</strong>")
          : "Ningún preset activo (valores personalizados).";
      }
    };

    const markPresetDirty = (yes) => {
      const hint = el.querySelector("#preset-dirty");
      if (hint) hint.hidden = !yes;
      el.querySelectorAll("#save-preset, #save-tokens").forEach((b) => b.classList.toggle("is-pulse", !!yes));
    };

    const saveTokens = async (btn, msg) => {
      if (btn) btn.disabled = true;
      try {
        const payload = collect();
        if (!payload.tokens || !Object.keys(payload.tokens).length) {
          throw new Error("No hay tokens para guardar.");
        }
        let saved;
        try {
          saved = await api.put("/tokens", payload);
        } catch (err) {
          if (err.status === 405 || err.status === 411 || err.status === 400) {
            saved = await api.post("/tokens", payload);
          } else {
            throw err;
          }
        }
        const stored = saved?.data || saved || payload;
        if (stored.tokens) {
          data.tokens = stored.tokens;
          data.activePreset = stored.activePreset || data.activePreset;
        } else {
          Object.assign(data, payload);
        }
        if (window.KrgUi) {
          window.KrgUi._p = null;
          window.KrgUi.setTokens({ data: stored, fonts: saved?.fonts });
        }
        markPresetDirty(false);
        toast(msg || "Guardado. El sitio público ya usa estos valores.");
      } catch (err) {
        toast(err.message || "No se pudo guardar. Vuelve a intentarlo.");
      } finally {
        if (btn) btn.disabled = false;
      }
    };
    el.querySelectorAll("[data-font]").forEach((sel) => {
      const wrap = sel.closest("[data-font-wrap]");
      const custom = wrap?.querySelector("[data-font-custom]");
      const preview = wrap?.querySelector(".m-font-preview");
      const vsel = wrap?.querySelector("[data-font-variant]");
      const sync = () => {
        const opt = sel.selectedOptions[0];
        const isCustom = sel.value === "__custom__";
        if (custom) custom.hidden = !isCustom;
        const css = isCustom ? (custom?.value || "") : sel.value;
        fillFontVariants(wrap);
        const vopt = vsel?.selectedOptions[0];
        if (preview) {
          preview.style.fontFamily = css || "inherit";
          preview.style.fontWeight = vopt?.dataset.weight || "400";
          preview.style.fontStyle = vopt?.dataset.style || "normal";
        }
        ensureFontLink(opt?.dataset.google || "");
      };
      sel.addEventListener("change", sync);
      custom?.addEventListener("input", sync);
      vsel?.addEventListener("change", sync);
      sync();
    });
    el.querySelector("#save-tokens").onclick = () => saveTokens(el.querySelector("#save-tokens"), "Todos los tokens guardados. El sitio público ya los usa.");
    const savePresetBtn = el.querySelector("#save-preset");
    if (savePresetBtn) savePresetBtn.onclick = () => saveTokens(savePresetBtn, "Paleta guardada. El sitio público ya la usa.");
    const sectionMsg = {
      colores: "Colores guardados. El sitio público ya los usa.",
      familias: "Familias tipográficas guardadas. El sitio público ya las usa.",
      roles: "Roles tipográficos guardados. El sitio público ya los usa.",
      espaciado: "Espaciado guardado. El sitio público ya lo usa.",
      radios: "Radios guardados. El sitio público ya los usa.",
      sombras: "Sombras guardadas. El sitio público ya las usa.",
      layout: "Layout guardado. El sitio público ya lo usa.",
      breakpoints: "Breakpoints guardados. El sitio público ya los usa.",
    };
    el.querySelectorAll("[data-save-section]").forEach((b) => {
      b.onclick = () => saveTokens(b, sectionMsg[b.dataset.saveSection] || "Cambios guardados. El sitio público ya los usa.");
    });
    el.querySelector("#exp-tokens").onclick = async () => {
      const pack = collect();
      const blob = new Blob([JSON.stringify({ krg: 1, tokens: pack }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "krg-tokens.json";
      a.click();
    };
    el.querySelector("#imp-tokens").onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const pack = JSON.parse(await file.text());
        const tokens = pack.tokens || pack;
        await api.put("/tokens", tokens);
        toast("Tokens importados");
        design();
      } catch (err) {
        toast(err.message);
      }
    };
    /* ---- Añadir y quitar colores ------------------------------------ */
    const addColorBtn = el.querySelector("#add-color");
    if (addColorBtn) {
      addColorBtn.onclick = () => {
        const input = el.querySelector("#new-color-name");
        const label = (input?.value || "").trim();
        if (!label) { toast("Ponle un nombre al color."); input?.focus(); return; }
        const key = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        if (!key) { toast("Ese nombre no sirve como identificador. Usa letras o números."); return; }
        if (el.querySelector(`[data-color="${CSS.escape(key)}"]`)) {
          toast("Ya existe un color con ese nombre.");
          return;
        }
        el.querySelector("#colors").insertAdjacentHTML("beforeend", colorRow(key, label, "#000000", false));
        const row = el.querySelector(`[data-color-row="${CSS.escape(key)}"]`);
        wireColorRow(row);
        input.value = "";
        row.querySelector("[data-color]").focus();
        toast("Color añadido. Pulsa Guardar colores para publicarlo.");
      };
    }

    function wireColorRow(row) {
      if (!row) return;
      const text = row.querySelector("[data-color]");
      const pick = row.querySelector("[data-color-picker]");
      // Asignacion, no addEventListener: asi no se duplica con el cableado
      // general de mas arriba cuando la fila ya existia.
      if (text && pick) {
        pick.oninput = () => { text.value = pick.value; };
        text.oninput = () => {
          const v = normalizeHex(text.value);
          if (v) pick.value = v;
        };
      }
      const del = row.querySelector("[data-del-color]");
      if (del) {
        del.onclick = () => {
          const name = row.querySelector("span")?.textContent || del.dataset.delColor;
          if (!confirm(`¿Quitar el color «${name}»? Los bloques que lo usen volverán a su color por defecto.`)) return;
          row.remove();
          toast("Color quitado. Pulsa Guardar colores para confirmarlo.");
        };
      }
    }
    el.querySelectorAll("[data-color-row]").forEach(wireColorRow);

    /* ---- Crear y borrar presets -------------------------------------- */
    const newPresetBtn = el.querySelector("#new-preset");
    if (newPresetBtn) {
      newPresetBtn.onclick = async () => {
        const input = el.querySelector("#new-preset-name");
        const name = (input?.value || "").trim();
        if (!name) { toast("Ponle un nombre al preset."); input?.focus(); return; }
        newPresetBtn.disabled = true;
        try {
          const res = await api.post("/tokens/presets", { name, tokens: collect().tokens });
          toast(`Preset «${res.preset?.name || name}» creado.`);
          design();
        } catch (err) {
          toast(err.message);
        } finally {
          newPresetBtn.disabled = false;
        }
      };
    }

    el.querySelectorAll("[data-del-preset]").forEach((btn) => {
      btn.onclick = async () => {
        const slug = btn.dataset.delPreset;
        const name = btn.closest(".m-preset-wrap")?.querySelector("strong")?.textContent || slug;
        if (!confirm(`¿Borrar el preset «${name}»? Los colores que tiene el sitio ahora mismo no cambian.`)) return;
        btn.disabled = true;
        try {
          await api.del("/tokens/presets/" + encodeURIComponent(slug));
          toast(`Preset «${name}» borrado.`);
          design();
        } catch (err) {
          toast(err.message);
          btn.disabled = false;
        }
      };
    });

    /* ---- Colores del CMS --------------------------------------------- */
    if (skinPack) {
      const liveSkin = (key, value) => {
        const v = normalizeHex(value);
        if (v && skinVars[key]) document.documentElement.style.setProperty(skinVars[key], v);
      };
      const readSkin = () => {
        const out = {};
        el.querySelectorAll("[data-skin]").forEach((inp) => { out[inp.dataset.skin] = inp.value; });
        return out;
      };
      const fillSkin = (map) => {
        Object.entries(map || {}).forEach(([k, v]) => {
          const t = el.querySelector(`[data-skin="${CSS.escape(k)}"]`);
          const p = el.querySelector(`[data-skin-picker="${CSS.escape(k)}"]`);
          if (t) t.value = v;
          if (p && normalizeHex(v)) p.value = normalizeHex(v);
          liveSkin(k, v);
        });
      };
      el.querySelectorAll("[data-skin-picker]").forEach((pick) => {
        pick.addEventListener("input", () => {
          const t = el.querySelector(`[data-skin="${CSS.escape(pick.dataset.skinPicker)}"]`);
          if (t) t.value = pick.value;
          liveSkin(pick.dataset.skinPicker, pick.value);
        });
      });
      el.querySelectorAll("[data-skin]").forEach((inp) => {
        inp.addEventListener("input", () => {
          const p = el.querySelector(`[data-skin-picker="${CSS.escape(inp.dataset.skin)}"]`);
          if (p && normalizeHex(inp.value)) p.value = normalizeHex(inp.value);
          liveSkin(inp.dataset.skin, inp.value);
        });
      });
      const saveSkinBtn = el.querySelector("#save-skin");
      if (saveSkinBtn) {
        saveSkinBtn.onclick = async () => {
          saveSkinBtn.disabled = true;
          try {
            await api.put("/admin-skin", { colors: readSkin() });
            toast("Colores del CMS guardados.");
          } catch (err) {
            toast(err.message);
          } finally {
            saveSkinBtn.disabled = false;
          }
        };
      }
      const fromPalette = el.querySelector("#skin-from-palette");
      if (fromPalette) {
        fromPalette.onclick = () => {
          fillSkin(skinPack.suggest || {});
          toast("Propuesta a partir de la paleta del sitio. Pulsa Guardar si te convence.");
        };
      }
      const resetSkin = el.querySelector("#skin-reset");
      if (resetSkin) {
        resetSkin.onclick = async () => {
          if (!confirm("¿Devolver el panel a sus colores de fábrica?")) return;
          try {
            const res = await api.put("/admin-skin", { reset: true });
            fillSkin(res.data || {});
            toast("Colores del CMS restablecidos.");
          } catch (err) {
            toast(err.message);
          }
        };
      }
    }

    el.querySelectorAll("[data-preset]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const slug = inp.dataset.preset;
        if (!inp.checked) {
          data.activePreset = "";
          setPresetUI("");
          markPresetDirty(true);
          toast("Preset desactivado en pantalla. Los valores se mantienen. Pulsa Guardar paleta.");
          return;
        }
        const preset = (pack.presets || []).find((p) => p.slug === slug);
        if (!preset || !preset.tokens || !Object.keys(preset.tokens).length) {
          inp.checked = false;
          toast("Este preset no tiene paleta cargada.");
          return;
        }
        data.tokens = structuredClone(preset.tokens);
        data.activePreset = slug;
        data.slug = slug;
        data.name = preset.name || slug;
        applyTokensToForm(data.tokens);
        setPresetUI(slug);
        markPresetDirty(true);
        const label = slug === "marca" ? "Marca Novamix" : (preset.name || "Preset");
        toast(label + " aplicada. Pulsa Guardar paleta para publicarla.");
      });
    });
    const picker = (btnId, inputName, title) => {
      const pick = el.querySelector(btnId);
      if (pick && window.wp?.media) {
        pick.onclick = () => {
          const frame = wp.media({ title, multiple: false, library: { type: "image" } });
          frame.on("select", () => {
            const att = frame.state().get("selection").first().toJSON();
            el.querySelector(`[name=${inputName}]`).value = att.id;
            const img = pick.parentElement.querySelector("img, .m-thumb-empty");
            if (img && img.tagName === "IMG") img.src = att.url;
            else if (img) {
              const n = document.createElement("img");
              n.className = inputName === "faviconId" ? "m-thumb m-thumb-fav" : "m-thumb m-thumb-logo";
              n.src = att.url;
              img.replaceWith(n);
            }
          });
          frame.open();
        };
      }
    };
    picker("#pick-logo", "logoId", "Logo");
    picker("#pick-fav", "faviconId", "Favicon");
    el.querySelector("#idform").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api.put("/identity", {
        siteName: fd.get("siteName"),
        tagline: fd.get("tagline"),
        logoId: Number(fd.get("logoId") || 0),
        faviconId: Number(fd.get("faviconId") || 0),
      });
      identityCache = null;
      toast("Identidad y favicon guardados. Recarga el sitio para ver la pestaña.");
    };
  }

  function normalizeHex(v) {
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
  }

  async function navigation() {
    const [menus, pages] = await Promise.all([api.get("/menus"), api.get("/pages")]);
    const menuState = {};
    menus.forEach((m) => { menuState[m.slug] = structuredClone(m.items || []); });
    const chromeUrl = `${cfg.admin}?page=krg-builder&chrome=header`;
    shell("nav", `
      <div class="m-top"><h1>Menús</h1>
        <div class="m-row">
          <a class="m-btn ghost" href="${chromeUrl}">Constructor visual</a>
          <button class="m-btn" id="save-nav">Guardar menús</button>
        </div>
      </div>
      <p class="m-muted">Aquí solo se editan los enlaces. El diseño del header y del footer (colores, vidrio, logo, CTA) vive en el constructor visual, para que no se pisen los guardados.</p>
      <div class="m-nav-jump">
        <a href="${cfg.admin}?page=krg-builder&chrome=header">
          <strong>Header visual</strong>
          <span>Logo, CTA, vidrio, color, fusión, desenfoque</span>
        </a>
        <a href="${cfg.admin}?page=krg-builder&chrome=footer">
          <strong>Footer visual</strong>
          <span>Columnas, textos, redes, colores</span>
        </a>
      </div>
      <p class="m-muted" style="margin:8px 0 18px">One page: pon un ID a la sección (Avanzado → Identificador CSS) y en URL escribe #ese-id. Elige “URL externa”.</p>
      ${menus.map((m) => `
        <div class="m-panel" style="padding:20px;margin-bottom:16px">
          <h3>Menú ${esc(m.name || m.slug)}</h3>
          <div data-menu="${m.slug}"></div>
          <button class="m-btn ghost" data-add-menu="${m.slug}">Añadir enlace</button>
        </div>`).join("")}`);
    const renderItems = (slug) => {
      const box = el.querySelector(`[data-menu="${slug}"]`);
      if (!box) return;
      const items = menuState[slug] || [];
      box.innerHTML = items.map((it, i) => `
        <div class="m-field-row" style="grid-template-columns:1fr 1fr 1fr 70px 40px;margin-bottom:8px">
          <input data-slug="${slug}" data-i="${i}" data-k="label" value="${esc(it.label)}">
          <select data-slug="${slug}" data-i="${i}" data-k="pageId">
            <option value="0">URL externa</option>
            ${pages.map((p) => `<option value="${p.id}" ${Number(it.pageId)===p.id?"selected":""}>${esc(p.title)}</option>`).join("")}
          </select>
          <input data-slug="${slug}" data-i="${i}" data-k="url" placeholder="#servicios o https://" value="${esc(it.url||"")}">
          <label style="font-weight:400;font-size:12px"><input type="checkbox" data-slug="${slug}" data-i="${i}" data-k="visible" ${it.visible!==false?"checked":""}> visible</label>
          <button class="m-btn ghost" data-rm-slug="${slug}" data-rm="${i}">×</button>
        </div>`).join("");
      box.querySelectorAll("input,select").forEach((inp) => {
        const apply = () => {
          const arr = menuState[inp.dataset.slug];
          if (!arr) return;
          const i = Number(inp.dataset.i);
          const k = inp.dataset.k;
          if (!arr[i] || !k) return;
          if (k === "visible") arr[i][k] = inp.checked;
          else if (k === "pageId") {
            arr[i][k] = Number(inp.value);
            arr[i].type = Number(inp.value) ? "internal" : "external";
          } else {
            arr[i][k] = inp.value;
            if (k === "url" && String(inp.value).trim()) {
              arr[i].type = "external";
              if (String(inp.value).trim().startsWith("#") || String(inp.value).includes("#")) {
                if (String(inp.value).trim().startsWith("#")) arr[i].pageId = 0;
              }
            }
          }
        };
        inp.addEventListener("input", apply);
        inp.addEventListener("change", apply);
      });
      box.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => {
        menuState[b.dataset.rmSlug].splice(Number(b.dataset.rm), 1);
        renderItems(b.dataset.rmSlug);
      });
    };
    menus.forEach((m) => renderItems(m.slug));
    el.querySelectorAll("[data-add-menu]").forEach((b) => {
      b.onclick = () => {
        const slug = b.dataset.addMenu;
        menuState[slug] = menuState[slug] || [];
        menuState[slug].push({ id: uid("itm_"), label: "Nuevo", type: "internal", pageId: pages[0]?.id || 0, url: "", target: "_self", visible: true, children: [] });
        renderItems(slug);
      };
    });
    el.querySelector("#save-nav").onclick = async () => {
      try {
        el.querySelectorAll("[data-k][data-slug][data-i]").forEach((inp) => {
          const arr = menuState[inp.dataset.slug];
          if (!arr) return;
          const i = Number(inp.dataset.i);
          const k = inp.dataset.k;
          if (!arr[i]) return;
          if (k === "visible") arr[i][k] = inp.checked;
          else if (k === "pageId") {
            arr[i][k] = Number(inp.value);
            arr[i].type = Number(inp.value) ? "internal" : "external";
          } else {
            arr[i][k] = inp.value;
            if (k === "url" && String(inp.value).trim()) arr[i].type = "external";
          }
        });
        const next = menus.map((m) => ({ ...m, items: menuState[m.slug] || [] }));
        await api.post("/menus", { menus: next });
        toast("Menús guardados");
      } catch (err) {
        toast(err.message || "No se pudo guardar");
      }
    };
  }

  async function blog() {
    if (view === "edit" && cfg.pageId) return blogEdit(cfg.pageId);
    const list = await api.get("/blog");
    shell("blog", `
      <div class="m-top"><h1>Blog</h1><button class="m-btn" id="np">Nueva entrada</button></div>
      <div class="m-table"><table>
        <thead><tr><th>Título</th><th>Estado</th><th></th></tr></thead>
        <tbody>${list.map((p)=>`<tr>
          <td><a href="${cfg.admin}?page=krg-blog&view=edit&id=${p.id}">${esc(p.title)}</a></td>
          <td><span class="m-pill ${p.status==="publish"?"pub":""}">${esc(p.status)}</span></td>
          <td><button class="m-btn ghost" data-del="${p.id}">Eliminar</button></td>
        </tr>`).join("")}</tbody>
      </table></div>`);
    el.querySelector("#np").onclick = async () => {
      const p = await api.post("/blog", { title: "Nueva entrada", status: "draft", content: "<p></p>" });
      location.href = `${cfg.admin}?page=krg-blog&view=edit&id=${p.id}`;
    };
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      if (!confirm("¿Eliminar esta entrada?")) return;
      await api.del(`/blog/${b.dataset.del}`);
      blog();
    });
  }

  async function blogEdit(id) {
    const [p, tax] = await Promise.all([api.get(`/blog/${id}`), api.get("/blog/taxonomies")]);
    shell("blog", `
      <div class="m-top"><h1>Editar entrada</h1>
        <div class="m-row">
          <button class="m-btn ghost" id="draft">Guardar borrador</button>
          <button class="m-btn" id="pub">Publicar</button>
        </div>
      </div>
      <form class="m-form-grid" id="be">
        <label class="m-field">Título <input name="title" value="${esc(p.title)}"></label>
        <label class="m-field">Subtítulo <input name="subtitle" value="${esc(p.subtitle)}"></label>
        <label class="m-field">Slug <input name="slug" value="${esc(p.slug)}"></label>
        <label class="m-field">Extracto <textarea name="excerpt">${esc(p.excerpt)}</textarea></label>
        <div class="m-field">
          <span>Contenido</span>
          <div class="m-toolbar" id="tb">
            <button type="button" data-w="p">P</button>
            <button type="button" data-w="h2">H2</button>
            <button type="button" data-w="h3">H3</button>
            <button type="button" data-w="strong">Negrita</button>
            <button type="button" data-w="em">Cursiva</button>
            <button type="button" data-w="blockquote">Cita</button>
            <button type="button" data-w="ul">Lista</button>
            <button type="button" data-w="a">Enlace</button>
            <button type="button" data-w="hr">Separador</button>
            <button type="button" id="img-in">Imagen</button>
          </div>
          <textarea name="content" id="content" style="min-height:240px">${esc(p.content)}</textarea>
        </div>
        <label class="m-field">Imagen destacada (ID) <input name="featuredImageId" type="number" value="${p.featuredImageId||0}">
          <button type="button" class="m-btn ghost" id="feat">Elegir</button></label>
        <label class="m-field">Categorías
          <select name="categories" multiple>${(tax.categories||[]).map(c=>`<option value="${c.id}" ${(p.categories||[]).includes(c.id)?"selected":""}>${esc(c.name)}</option>`).join("")}</select>
        </label>
        <label class="m-field">Etiquetas
          <select name="tags" multiple>${(tax.tags||[]).map(c=>`<option value="${c.id}" ${(p.tags||[]).includes(c.id)?"selected":""}>${esc(c.name)}</option>`).join("")}</select>
        </label>
        <label class="m-field">Nueva etiqueta <input id="newtag" placeholder="Nombre">
          <button type="button" class="m-btn ghost" id="addtag">Crear etiqueta</button></label>
        <label class="m-field">SEO title <input name="seoTitle" value="${esc(p.seo?.title||"")}"></label>
        <label class="m-field">Meta description <textarea name="seoDesc">${esc(p.seo?.description||"")}</textarea></label>
        <label class="m-field">Fecha (programar) <input type="datetime-local" name="date"></label>
      </form>`);
    const ta = el.querySelector("#content");
    const wrap = (open, close) => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const sel = ta.value.slice(s, e) || "texto";
      ta.setRangeText(`${open}${sel}${close}`, s, e, "end");
      ta.focus();
    };
    el.querySelectorAll("#tb [data-w]").forEach((b) => {
      b.onclick = () => {
        const t = b.dataset.w;
        if (t === "hr") return wrap("<hr>\n", "");
        if (t === "a") {
          const url = prompt("URL", "https://");
          if (!url) return;
          return wrap(`<a href="${url}">`, "</a>");
        }
        if (t === "ul") return wrap("<ul>\n<li>", "</li>\n</ul>");
        wrap(`<${t}>`, `</${t}>`);
      };
    });
    const media = (title, cb) => {
      if (!window.wp?.media) return;
      const frame = wp.media({ title, multiple: false });
      frame.on("select", () => cb(frame.state().get("selection").first().toJSON()));
      frame.open();
    };
    el.querySelector("#feat").onclick = () => media("Imagen destacada", (att) => {
      el.querySelector("[name=featuredImageId]").value = att.id;
    });
    el.querySelector("#img-in").onclick = () => media("Insertar imagen", (att) => {
      wrap(`<figure><img src="${att.url}" alt="${att.alt || ""}"></figure>\n`, "");
    });
    el.querySelector("#addtag").onclick = async () => {
      const name = el.querySelector("#newtag").value.trim();
      if (!name) return;
      const t = await api.post("/blog/terms", { name, taxonomy: "post_tag" });
      const sel = el.querySelector("[name=tags]");
      const opt = document.createElement("option");
      opt.value = t.id; opt.textContent = name; opt.selected = true;
      sel.appendChild(opt);
      el.querySelector("#newtag").value = "";
      toast("Etiqueta creada");
    };
    const payload = (status) => {
      const f = el.querySelector("#be");
      const cats = [...f.categories.selectedOptions].map((o) => Number(o.value));
      const tags = [...f.tags.selectedOptions].map((o) => Number(o.value));
      return {
        title: f.title.value,
        subtitle: f.subtitle.value,
        slug: f.slug.value,
        excerpt: f.excerpt.value,
        content: f.content.value,
        featuredImageId: Number(f.featuredImageId.value || 0),
        categories: cats,
        tags,
        status,
        date: f.date.value ? f.date.value.replace("T", " ") + ":00" : undefined,
        seo: { title: f.seoTitle.value, description: f.seoDesc.value },
      };
    };
    el.querySelector("#draft").onclick = async () => { await api.put(`/blog/${id}`, payload("draft")); toast("Borrador guardado"); };
    el.querySelector("#pub").onclick = async () => { await api.put(`/blog/${id}`, payload("publish")); toast("Publicada"); };
  }

  async function seo() {
    const s = await api.get("/seo");
    const robotsOpts = ["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"];
    shell("seo", `
      <div class="m-top"><h1>SEO global</h1></div>
      <form class="m-form-grid" id="sf">
        <label class="m-field">Separador del título <input name="separator" value="${esc(s.separator||"|")}"></label>
        <label class="m-field">Robots por defecto
          <select name="robots">${robotsOpts.map((o) => `<option value="${o}" ${(s.robots||"index,follow")===o?"selected":""}>${o}</option>`).join("")}</select>
        </label>
        <label class="m-field">Twitter / X (@usuario) <input name="twitter" value="${esc(s.twitter||"")}" placeholder="marca"></label>
        <label class="m-field">Imagen Open Graph por defecto
          <input name="ogImageId" type="hidden" value="${s.ogImageId||0}">
          <div class="m-media-row">
            ${s.ogImageUrl ? `<img class="m-thumb m-thumb-logo" src="${esc(s.ogImageUrl)}" alt="OG">` : `<span class="m-thumb m-thumb-empty">1200×630</span>`}
            <button type="button" class="m-btn ghost" id="pick-og">Elegir imagen</button>
          </div>
          <small class="m-muted">Se usa cuando la página no tiene imagen OG propia.</small>
        </label>
        <button class="m-btn">Guardar SEO</button>
      </form>
      <div class="m-panel" style="padding:16px 20px;margin-top:16px">
        <h3>Archivos públicos</h3>
        <p><a href="${esc(s.sitemapUrl)}" target="_blank">${esc(s.sitemapUrl)}</a> — páginas y posts publicados (omite noindex).</p>
        <p><a href="${esc(s.robotsUrl)}" target="_blank">${esc(s.robotsUrl)}</a></p>
        <p class="m-muted">Por página: constructor → inspector (sin seleccionar un bloque) → Título SEO, description, robots, imagen OG.</p>
      </div>`);
    const pick = el.querySelector("#pick-og");
    if (pick && window.wp?.media) {
      pick.onclick = () => {
        const frame = wp.media({ title: "Imagen Open Graph", multiple: false, library: { type: "image" } });
        frame.on("select", () => {
          const att = frame.state().get("selection").first().toJSON();
          el.querySelector("[name=ogImageId]").value = att.id;
          const slot = pick.parentElement.querySelector("img, .m-thumb-empty");
          if (slot && slot.tagName === "IMG") slot.src = att.url;
          else if (slot) {
            const n = document.createElement("img");
            n.className = "m-thumb m-thumb-logo";
            n.src = att.url;
            slot.replaceWith(n);
          }
        });
        frame.open();
      };
    }
    el.querySelector("#sf").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      await api.put("/seo", {
        separator: f.separator.value,
        robots: f.robots.value,
        twitter: f.twitter.value,
        ogImageId: Number(f.ogImageId.value || 0),
      });
      toast("SEO global guardado. Ya está en el HTML público.");
    };
  }

  async function users() {
    const roles = [
      { id: "administrator", label: "Administrador" },
      { id: "editor", label: "Editor" },
      { id: "author", label: "Autor" },
      { id: "contributor", label: "Colaborador" },
      { id: "subscriber", label: "Suscriptor" },
    ];
    const roleOpts = (sel) => roles.map((r) => `<option value="${r.id}" ${sel===r.id?"selected":""}>${r.label}</option>`).join("");
    const [list, pack] = await Promise.all([api.get("/users"), api.get("/roles")]);
    let editing = null;
    const paint = (rows) => {
      const capHead = (pack.caps || []).map((c) => `<th>${esc(c.label)}</th>`).join("");
      const capRows = (pack.roles || []).map((r) => {
        const cells = (pack.caps || []).map((c) => {
          const on = (r.caps || []).includes(c.key);
          const lock = r.slug === "administrator" && c.key === "meridian_manage";
          return `<td><input type="checkbox" data-role="${r.slug}" data-cap="${c.key}" ${on?"checked":""} ${lock?"disabled":""}></td>`;
        }).join("");
        return `<tr><th>${esc(r.label)}</th>${cells}</tr>`;
      }).join("");
      shell("users", `
        <div class="m-top"><h1>Usuarios</h1></div>
        <p class="m-muted">Solo el administrador crea, edita y elimina cuentas. El rol define qué pueden hacer en KRG CMS.</p>
        <div class="m-table"><table>
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead>
          <tbody>${rows.map((u) => `<tr>
            <td><code>${esc(u.login)}</code>${u.isYou ? " <span class=\"m-pill\">tú</span>" : ""}</td>
            <td>${esc(u.name)}</td>
            <td>${esc(u.email)}</td>
            <td>${esc(u.roleLabel)}</td>
            <td>
              <button class="m-btn ghost" data-ed="${u.id}">Editar</button>
              ${u.isYou ? "" : `· <button class="m-btn ghost" data-del="${u.id}">Eliminar</button>`}
            </td>
          </tr>`).join("")}</tbody>
        </table></div>
        <div class="m-panel" style="padding:20px;margin-top:20px">
          <h3>${editing ? "Editar cuenta" : "Nueva cuenta"}</h3>
          <form class="m-form-grid" id="uf">
            <label class="m-field">Usuario (login) <input name="login" required minlength="3" value="${esc(editing?.login || "")}" ${editing?" ":" "}></label>
            <label class="m-field">Nombre para mostrar <input name="name" value="${esc(editing?.name || "")}"></label>
            <label class="m-field">Correo <input name="email" type="email" required value="${esc(editing?.email || "")}"></label>
            <label class="m-field">Rol <select name="role">${roleOpts(editing?.role || "author")}</select></label>
            <label class="m-field">${editing ? "Nueva contraseña (vacío = no cambiar)" : "Contraseña"}
              <input name="password" type="password" autocomplete="new-password" ${editing ? "" : "required minlength=\"8\""} placeholder="${editing ? "••••••••" : "mínimo 8 caracteres"}">
            </label>
            <div class="m-row">
              <button class="m-btn" type="submit">${editing ? "Guardar cambios" : "Crear cuenta"}</button>
              ${editing ? `<button type="button" class="m-btn ghost" id="cancel">Cancelar</button>` : ""}
            </div>
          </form>
        </div>
        <div class="m-panel" style="padding:20px;margin-top:20px">
          <h3>Permisos por rol</h3>
          <p class="m-muted">Aplica a todas las cuentas con ese rol. El administrador no puede perder «Tokens / usuarios».</p>
          <div class="m-table" style="overflow:auto"><table>
            <thead><tr><th>Rol</th>${capHead}</tr></thead>
            <tbody>${capRows}</tbody>
          </table></div>
          <button class="m-btn" type="button" id="save-roles" style="margin-top:12px">Guardar permisos</button>
        </div>`);
      el.querySelectorAll("[data-ed]").forEach((b) => {
        b.onclick = () => { editing = rows.find((x) => String(x.id) === b.dataset.ed); paint(rows); };
      });
      el.querySelectorAll("[data-del]").forEach((b) => {
        b.onclick = async () => {
          if (!confirm("¿Eliminar esta cuenta? Sus entradas pasarán a tu usuario.")) return;
          try {
            await api.del(`/users/${b.dataset.del}`);
            toast("Cuenta eliminada");
            users();
          } catch (e) { toast(e.message); }
        };
      });
      el.querySelector("#cancel")?.addEventListener("click", () => { editing = null; paint(rows); });
      el.querySelector("#save-roles")?.addEventListener("click", async () => {
        const next = (pack.roles || []).map((r) => {
          const caps = [...el.querySelectorAll(`[data-role="${r.slug}"]:checked`)].map((i) => i.dataset.cap);
          if (r.slug === "administrator" && !caps.includes("meridian_manage")) caps.push("meridian_manage");
          return { slug: r.slug, caps };
        });
        try {
          const saved = await api.put("/roles", { roles: next });
          pack.roles = saved.roles || next;
          toast("Permisos de rol guardados. Las cuentas ya los usan.");
        } catch (err) {
          toast(err.message);
        }
      });
      el.querySelector("#uf").onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const body = {
          login: f.login.value.trim(),
          name: f.name.value.trim() || f.login.value.trim(),
          email: f.email.value.trim(),
          role: f.role.value,
          password: f.password.value,
        };
        try {
          if (editing) {
            if (!body.password) delete body.password;
            await api.put(`/users/${editing.id}`, body);
            toast("Usuario guardado" + (editing.isYou && body.password ? ". Si cambiaste tu contraseña, vuelve a entrar." : ""));
          } else {
            await api.post("/users", body);
            toast("Cuenta creada");
          }
          users();
        } catch (err) {
          toast(err.message);
        }
      };
    };
    paint(list);
  }

  async function settings() {
    const s = await api.get("/settings");
    const rows = (s.caps || []).map((c) => `<tr>
      <td>${esc(c.role)}</td>
      <td>${c.manage ? "sí" : "no"}</td>
      <td>${c.pages ? "sí" : "no"}</td>
      <td>${c.publish ? "sí" : "no"}</td>
      <td>${esc(c.blog)}</td>
    </tr>`).join("");
    shell("settings", `
      <div class="m-top"><h1>Configuración</h1></div>
      <label class="m-field">Modo debug <input type="checkbox" id="dbg" ${s.debug?"checked":""}></label>
      <p class="m-muted">El debug escribe logs técnicos. Nunca se muestran al visitante.</p>
      <div class="m-row">
        <button class="m-btn" id="sv">Guardar</button>
        <button class="m-btn ghost" id="exp">Exportar JSON</button>
        <label class="m-btn ghost">Importar JSON <input type="file" id="imp" accept="application/json" hidden></label>
      </div>
      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Caché</h3>
        <p class="m-muted">Si guardas o publicas y la web no muestra el cambio, borra la caché. No se eliminan páginas ni borradores.</p>
        <button class="m-btn" type="button" id="flush-cache">Borrar caché</button>
        <p class="m-muted" id="flush-msg" hidden></p>
      </div>
      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Permisos</h3>
        <p class="m-muted">Las rutas REST comprueban caps, no “está logueado”. El autor no puede cambiar tokens.</p>
        <table class="m-table"><thead><tr><th>Rol</th><th>Tokens / chrome</th><th>Páginas</th><th>Publicar</th><th>Blog</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="m-muted">Usuario de prueba autor: <code>autor</code> / <code>autor123</code></p>
      </div>`);
    el.querySelector("#sv").onclick = async () => {
      await api.put("/settings", { debug: el.querySelector("#dbg").checked });
      toast("Guardado");
    };
    el.querySelector("#flush-cache").onclick = async () => {
      const btn = el.querySelector("#flush-cache");
      const msg = el.querySelector("#flush-msg");
      btn.disabled = true;
      try {
        const r = await api.post("/cache/flush", {});
        if (msg) {
          msg.hidden = false;
          msg.textContent = r.message || "Caché borrada.";
        }
        toast(r.message || "Caché borrada");
      } catch (err) {
        toast(err.message || "No se pudo borrar la caché");
      }
      btn.disabled = false;
    };
    el.querySelector("#exp").onclick = async () => {
      const pack = await api.post("/export", {});
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "krg-export.json";
      a.click();
    };
    el.querySelector("#imp").onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const pack = JSON.parse(await file.text());
        const r = await api.post("/import", pack);
        toast("Paquete importado. Páginas nuevas: " + (r.pages ?? 0));
      } catch (err) {
        toast(err.message);
      }
    };
  }

  const routes = {
    krg: home,
    "krg-pages": pages,
    "krg-blog": blog,
    "krg-design": design,
    "krg-nav": navigation,
    "krg-seo": seo,
    "krg-users": users,
    "krg-settings": settings,
  };
  const run = routes[pageKey];
  if (run) {
    run().catch((e) => {
      shell("home", `<p class="m-form-error">${esc(e.message)}</p>`);
    });
  }
})();
