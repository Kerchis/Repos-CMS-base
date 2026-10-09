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

  /**
   * Los iconos del panel.
   *
   * Dibujados a mano, de trazo, sobre una rejilla de 16 y heredando el
   * color del texto: así siguen al tema sin que nadie los repinte. Van
   * aquí porque los usan `builder.js` y `chrome.js`, que cuelgan de este
   * archivo. Cada icono es decorativo: quien lo pone al lado de un botón
   * sin texto tiene que escribir el `aria-label`.
   */
  const svg = (d, extra = "") =>
    `<svg class="b-svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}${extra}</svg>`;
  window.KrgIco = {
    atras: svg('<path d="M10 3 5 8l5 5"/>'),
    escritorio: svg('<rect x="1.5" y="2.5" width="13" height="9" rx="1.2"/><path d="M5.5 14h5"/>'),
    tableta: svg('<rect x="3.5" y="1.5" width="9" height="13" rx="1.2"/><path d="M7.5 12.5h1"/>'),
    movil: svg('<rect x="5" y="1.5" width="6" height="13" rx="1.2"/><path d="M7.5 12.8h1"/>'),
    deshacer: svg('<path d="M6 4.5 3 7.5l3 3"/><path d="M3 7.5h6.2A3.3 3.3 0 0 1 12.5 11v.5"/>'),
    rehacer: svg('<path d="M10 4.5l3 3-3 3"/><path d="M13 7.5H6.8A3.3 3.3 0 0 0 3.5 11v.5"/>'),
    /* El árbol de la página (lista con sangría) y los ajustes (mandos
       deslizantes): dos dibujos que no se confunden de lejos. Con dos
       rectángulos cada uno, a 16 px parecían el mismo icono. */
    estructura: svg('<path d="M2 3.5h12"/><path d="M5 7.5h9"/><path d="M5 11.5h9"/><path d="M2.5 7.5v4"/>'),
    ajustes: svg('<path d="M2 5h8"/><path d="M12.5 5h1.5"/><circle cx="11.2" cy="5" r="1.5"/><path d="M2 11h2"/><path d="M6.5 11h7.5"/><circle cx="5.2" cy="11" r="1.5"/>'),
    refrescar: svg('<path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13.2 2.5v3h-3"/>'),
    buscar: svg('<circle cx="7" cy="7" r="4.2"/><path d="m10.2 10.2 3.3 3.3"/>'),
    ayuda: svg('<circle cx="8" cy="8" r="6.2"/><path d="M6.4 6.2a1.7 1.7 0 1 1 1.9 1.9v1.1"/><path d="M8.3 12h.01"/>'),
    /* Los de los grupos del inspector. Mismo trazo, misma rejilla. */
    rejilla: svg('<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.2"/><path d="M6 2.8v10.4"/><path d="M10 2.8v10.4"/>'),
    texto: svg('<path d="M2.5 3.5h11"/><path d="M2.5 7h11"/><path d="M2.5 10.5h7"/>'),
    imagen: svg('<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.4"/><circle cx="5.6" cy="6.2" r="1.1"/><path d="m2.4 11.6 3.4-3 2.6 2.2 2.3-1.9 3.3 2.7"/>'),
    video: svg('<rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.4"/><path d="m6.6 6.3 3.6 1.7-3.6 1.7z"/>'),
    enlace: svg('<path d="M6.6 9.4a2.6 2.6 0 0 1 0-3.6l1.6-1.6a2.6 2.6 0 1 1 3.6 3.6l-.8.8"/><path d="M9.4 6.6a2.6 2.6 0 0 1 0 3.6l-1.6 1.6a2.6 2.6 0 1 1-3.6-3.6l.8-.8"/>'),
    alinear: svg('<path d="M2.5 3.5h11"/><path d="M2.5 8h7"/><path d="M2.5 12.5h9"/>'),
    medida: svg('<path d="M1.8 6.2h12.4v3.6H1.8z"/><path d="M4.6 6.2v1.6"/><path d="M7 6.2v2.4"/><path d="M9.4 6.2v1.6"/><path d="M11.8 6.2v2.4"/>'),
    espacio: svg('<path d="M2.2 2.6h11.6"/><path d="M2.2 13.4h11.6"/><path d="M8 5.2v5.6"/><path d="m6.4 6.8 1.6-1.6 1.6 1.6"/><path d="m6.4 9.2 1.6 1.6 1.6-1.6"/>'),
    gota: svg('<path d="M8 2.2S3.8 6.6 3.8 9.2a4.2 4.2 0 0 0 8.4 0C12.2 6.6 8 2.2 8 2.2z"/>'),
    tipo: svg('<path d="M2.6 12.6 6 3.4l3.4 9.2"/><path d="M3.8 9.6h4.4"/><path d="M11 12.6V7.8a1.9 1.9 0 0 1 2.6 1.7v3.1"/>'),
    borde: svg('<rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.4" stroke-dasharray="3 2"/>'),
    sombra: svg('<rect x="1.8" y="1.8" width="9" height="9" rx="1.2"/><path d="M5.6 13.8h7a1.6 1.6 0 0 0 1.6-1.6v-7" opacity=".55"/>'),
    movimiento: svg('<path d="M2 11.5c3.4 0 3.4-7 6.8-7s3.4 7 5.2 7"/><path d="M11.6 2.6 14 5l-2.4 2.4"/>'),
    codigo: svg('<path d="m5.6 5.4-3 2.6 3 2.6"/><path d="m10.4 5.4 3 2.6-3 2.6"/><path d="m9.2 3.4-2.4 9.2"/>'),
    ojo: svg('<path d="M1.6 8S3.9 3.8 8 3.8 14.4 8 14.4 8 12.1 12.2 8 12.2 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="1.9"/>'),
    forma: svg('<rect x="2.2" y="2.6" width="11.6" height="10.8" rx="1.4"/><path d="M4.8 6.2h6.4"/><path d="M4.8 9h3.6"/>'),
    pagina: svg('<path d="M3.4 1.8h5.4l3.8 3.8v8.6H3.4z"/><path d="M8.8 1.8v3.8h3.8"/>'),
    /* Los de la barra lateral. */
    casa: svg('<path d="m2.2 7.4 5.8-4.8 5.8 4.8"/><path d="M4 8.6v5h8v-5"/>'),
    blog: svg('<path d="M2.4 3.2h11.2v7.4H8.6L5.4 13v-2.4H2.4z"/>'),
    reserva: svg('<rect x="2.2" y="3" width="11.6" height="10.6" rx="1.3"/><path d="M2.2 6.3h11.6"/><path d="M5.4 1.8v2.4"/><path d="M10.6 1.8v2.4"/>'),
    plantilla: svg('<rect x="4.2" y="1.8" width="9.6" height="9.6" rx="1.3"/><path d="M11 14.2H3.5a1.3 1.3 0 0 1-1.3-1.3V5.2"/>'),
    global: svg('<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4"/><path d="M8 1.8a9.6 9.6 0 0 1 0 12.4A9.6 9.6 0 0 1 8 1.8z"/>'),
    mapa: svg('<path d="M2.2 4.2 6 2.8l4 1.4 3.8-1.4v9l-3.8 1.4-4-1.4-3.8 1.4z"/><path d="M6 2.8v9.4"/><path d="M10 4.2v9.4"/>'),
    cabecera: svg('<rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.3"/><path d="M1.8 6h12.4"/>'),
    grafico: svg('<path d="M2.4 13.2h11.2"/><path d="M4.6 13.2V8"/><path d="M8 13.2V3.4"/><path d="M11.4 13.2V6.4"/>'),
    persona: svg('<circle cx="8" cy="5.6" r="2.8"/><path d="M2.8 13.6a5.2 5.2 0 0 1 10.4 0"/>'),
    caja: svg('<path d="M2.2 5.2 8 2.4l5.8 2.8v5.6L8 13.6l-5.8-2.8z"/><path d="M2.2 5.2 8 8l5.8-2.8"/><path d="M8 8v5.6"/>'),
    salir: svg('<path d="M9.4 2.6h3.4a1 1 0 0 1 1 1v8.8a1 1 0 0 1-1 1H9.4"/><path d="M6.6 10.6 9.6 8 6.6 5.4"/><path d="M9.6 8H2.4"/>'),
    cerrar: svg('<path d="M4.2 4.2l7.6 7.6"/><path d="M11.8 4.2l-7.6 7.6"/>'),
  };

  /**
   * Las salidas de un aviso.
   *
   * Todos los avisos del panel son el mismo armazón: un `<div class="confirm">`
   * con una `.box` dentro, que hasta ahora sólo se cerraba con el botón que
   * cada uno trajera al final. Esta función los convierte en un diálogo de
   * verdad: aspa arriba a la derecha, tecla Escape, clic en el fondo, foco
   * atrapado dentro mientras está abierto y devuelto a donde estaba al salir.
   *
   * No quita nada: los «Cerrar», «Cancelar» o «Ahora no, lo arreglo» que ya
   * tiene cada caja siguen en su sitio. Esto suma caminos de salida.
   *
   * Quien lo llama sigue escribiendo `wrap.remove()` como antes: la función
   * envuelve ese método para que, se cierre por donde se cierre, se suelten
   * los oyentes y vuelva el foco.
   *
   * @param {HTMLElement} wrap  El `.confirm` ya montado, todavía fuera del DOM.
   * @param {{fondo?: boolean, titulo?: string}} opciones
   * @returns {() => void} La función de cerrar, por si hace falta de fuera.
   */
  let modalN = 0;
  window.KrgModal = {
    abrir(wrap, opciones = {}) {
      const box = wrap.querySelector(".box");
      if (!box) {
        document.body.appendChild(wrap);
        return () => wrap.remove();
      }
      const previo = document.activeElement;
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.tabIndex = -1;
      const titulo = box.querySelector("h3");
      if (titulo) {
        if (!titulo.id) titulo.id = "krg-modal-t" + ++modalN;
        box.setAttribute("aria-labelledby", titulo.id);
      } else if (opciones.titulo) {
        box.setAttribute("aria-label", opciones.titulo);
      }

      // El aspa va la primera del marcado para que el tabulador y el lector
      // de pantalla la encuentren sin recorrer antes toda la caja.
      const x = document.createElement("button");
      x.type = "button";
      x.className = "b-modal-x";
      x.setAttribute("aria-label", "Cerrar");
      x.innerHTML = window.KrgIco.cerrar;
      box.insertBefore(x, box.firstChild);
      box.classList.add("has-x");

      const FOCO = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      const focoables = () => [...box.querySelectorAll(FOCO)].filter((el) => el.offsetParent !== null);

      let vivo = true;
      const quitar = wrap.remove.bind(wrap);
      const cerrar = () => {
        if (!vivo) return;
        vivo = false;
        document.removeEventListener("keydown", teclas, true);
        wrap.removeEventListener("mousedown", fondo);
        quitar();
        if (previo && typeof previo.focus === "function" && document.contains(previo)) {
          previo.focus();
        }
      };

      function teclas(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cerrar();
          return;
        }
        if (e.key !== "Tab") return;
        const lista = focoables();
        if (!lista.length) return;
        const primero = lista[0];
        const ultimo = lista[lista.length - 1];
        if (e.shiftKey && (document.activeElement === primero || document.activeElement === box)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
      // Sólo el fondo, no la caja: un clic que empieza dentro y acaba fuera
      // (al arrastrar para seleccionar texto) no cierra nada.
      function fondo(e) {
        if (e.target === wrap) cerrar();
      }

      wrap.remove = cerrar;
      x.onclick = cerrar;
      document.addEventListener("keydown", teclas, true);
      if (opciones.fondo !== false) wrap.addEventListener("mousedown", fondo);
      document.body.appendChild(wrap);
      // El foco entra en la caja, no en el primer botón: así nadie pulsa sin
      // querer un «Eliminar» con la barra espaciadora nada más abrirse.
      box.focus();
      return cerrar;
    },
  };

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
      // Un campo de color vacio tiene que PARECER vacio. Antes el hueco
      // llevaba de ejemplo un hexadecimal («#D94E27») y el cuadrito salia
      // casi negro, asi que un campo sin color se leia como un color ya
      // elegido: se cambiaba el de al lado, no pasaba nada y parecia que
      // el panel mentia. Ahora el texto dice que esta vacio, el cuadrito
      // se marca con una franja y hay una ✕ para volver a vaciarlo.
      const v = String(value || "");
      const vacio = "" === v.trim();
      return `<label class="m-pick-label">${uiEsc(label)}
        <div class="m-pick m-pick-color${vacio ? " is-empty" : ""}">
          <input type="color" data-pick-hex value="${uiEsc(this.hex(v))}" title="Elegir un color">
          <input ${attr} value="${uiEsc(v)}" class="m-pick-val" placeholder="Sin color" spellcheck="false">
          <button type="button" class="m-pick-clear" data-pick-clear title="Quitar el color">✕</button>
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
        // El cuadrito y la casilla de texto son el mismo dato: lo que se
        // elija en uno tiene que verse en el otro al momento, y la marca
        // de «vacio» tiene que irse en cuanto haya color.
        const marcarVacio = () => row.classList.toggle("is-empty", "" === String(val.value || "").trim());
        hex?.addEventListener("input", () => {
          val.value = hex.value;
          marcarVacio();
          fire();
        });
        row.querySelector("[data-pick-clear]")?.addEventListener("click", () => {
          val.value = "";
          marcarVacio();
          fire();
        });
        val.addEventListener("input", () => {
          marcarVacio();
          const limpio = String(val.value || "").trim();
          if (hex && /^#[0-9a-fA-F]{6}$/.test(limpio)) hex.value = limpio.toLowerCase();
        });
        px?.addEventListener("input", () => {
          if (!px.value) return;
          val.value = `${px.value}px`;
          if (token) token.value = "__custom__";
          fire();
        });
      });
    },
  };

  const el = document.getElementById("krg-admin");
  if (!el) return;

  /**
   * El aviso de abajo a la derecha.
   *
   * Tres sabores: bien, mal y a secas. El de «mal» se queda más tiempo
   * —cuatro segundos y medio— porque suele traer una instrucción, y se
   * anuncia como alerta para que un lector de pantalla lo lea en el
   * momento; los otros, como estado, sin interrumpir.
   *
   * Cuando no se dice el sabor se adivina por el texto: casi todas las
   * llamadas que ya había avisan de un fallo con las mismas palabras.
   */
  const toast = (t, tipo) => {
    const texto = String(t ?? "");
    const clase = tipo || (/\b(no se pudo|no se ha podido|error|falló|fallo|no hay|inválid)/i.test(texto) ? "mal" : "info");
    const n = document.createElement("div");
    n.className = "m-toast is-" + clase;
    n.setAttribute("role", clase === "mal" ? "alert" : "status");
    n.innerHTML = `<span class="m-toast-i" aria-hidden="true">${
      clase === "bien" ? "✓" : clase === "mal" ? "!" : "·"
    }</span><span class="m-toast-t"></span>`;
    n.querySelector(".m-toast-t").textContent = texto;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), clase === "mal" ? 4500 : 2600);
  };

  /**
   * Una lista vacía.
   *
   * Una tabla sin filas —o peor, una celda que pone «No hay nada»— deja
   * al usuario sin saber si la pantalla se ha roto, si está cargando o
   * si es que de verdad no hay nada. Esto dice las tres cosas: qué
   * falta, por qué puede faltar y dónde se empieza.
   */
  const vacio = (icono, titulo, texto, accion) => `
    <div class="m-vacio">
      <span class="m-vacio-i" aria-hidden="true">${(window.KrgIco || {})[icono] || ""}</span>
      <strong>${titulo}</strong>
      <p class="m-muted">${texto}</p>
      ${accion || ""}
    </div>`;

  const h = (strings, ...vals) => {
    // not tagged; we use html() below
  };
  const html = (s) => s;
  // «1 página» / «3 páginas», sin el «(s)» de los formularios feos.
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  /**
   * Una entrada de la barra lateral.
   *
   * El icono es decorativo —el rótulo siempre está— pero hace que la
   * lista se recorra con la vista en vez de leyéndola entera, que con
   * dieciséis entradas es lo que pasaba.
   */
  const navItem = (icono, rotulo, href, activo, extra) =>
    `<a class="${activo ? "is-active" : ""}" href="${href}"${extra || ""}>
      <span class="m-nav-i" aria-hidden="true">${(window.KrgIco || {})[icono] || ""}</span>
      <span>${rotulo}</span>
    </a>`;

  const nav = (active) => `
    <aside class="m-aside">
      <div class="m-aside-head">
        <a class="m-back-wp" href="${cfg.wpAdmin || "/wp-admin/"}" title="Volver a WordPress" aria-label="Volver a WordPress">←</a>
        <a class="m-brand" href="${cfg.admin}?page=krg">KRG <small>CMS</small></a>
      </div>
      <nav>
        <div class="grp">Contenido</div>
        ${cfg.canEditPages !== false ? `
        ${navItem("casa", "Inicio", `${cfg.admin}?page=krg`, active === "home")}
        ${cfg.canManage ? navItem("gota", "Asistente de identidad", `${cfg.admin}?page=krg&view=onboard`, active === "onboard") : ""}
        ${navItem("pagina", "Páginas", `${cfg.admin}?page=krg-pages`, active === "pages")}` : ""}
        ${navItem("blog", "Blog", `${cfg.admin}?page=krg-blog`, active === "blog")}
        ${navItem("reserva", "Reservas", `${cfg.admin}?page=krg-reservas`, active === "reservas")}
        ${cfg.canEditPages !== false ? `
        ${navItem("plantilla", "Plantillas", `${cfg.admin}?page=krg-pages&view=templates`, active === "templates")}
        ${navItem("global", "Componentes globales", `${cfg.admin}?page=krg-pages&view=globals`, active === "globals")}
        ${navItem("buscar", "Buscar y reemplazar", `${cfg.admin}?page=krg-buscar`, active === "buscar")}` : ""}
        ${cfg.canManage ? `
        <div class="grp">Apariencia</div>
        ${navItem("tipo", "Identidad y diseño", `${cfg.admin}?page=krg-design`, active === "design")}
        ${navItem("mapa", "Navegación", `${cfg.admin}?page=krg-nav`, active === "nav")}
        ${navItem("cabecera", "Cabecera y pie", `${cfg.admin}?page=krg-builder&chrome=header`, false)}
        <div class="grp">Sistema</div>
        ${navItem("grafico", "SEO", `${cfg.admin}?page=krg-seo`, active === "seo")}
        ${navItem("persona", "Usuarios", `${cfg.admin}?page=krg-users`, active === "users")}
        ${navItem("caja", "Exportar e importar", `${cfg.admin}?page=krg-kit`, active === "kit")}
        ${navItem("ajustes", "Configuración", `${cfg.admin}?page=krg-settings`, active === "settings")}` : ""}
        ${navItem("salir", "Ver sitio", cfg.home, false, ' target="_blank" rel="noopener"')}
      </nav>
    </aside>`;

  /* ------------------------------------------------------------------ */
  /* Editor clasico (TinyMCE) para el cuerpo de las entradas.            */
  /*                                                                      */
  /* Es el mismo cuadro que trae WordPress: pestanas «Visual» y «Texto»,  */
  /* barra de formato con el desplegable de parrafo/encabezado y boton    */
  /* «Anadir multimedia». Lo monta `wp.editor.initialize()`, que solo     */
  /* existe si la pantalla ha encolado el editor (Assets.php lo hace en   */
  /* la pagina del blog).                                                 */
  /*                                                                      */
  /* Si no estuviera, el area de texto de siempre con su barra de         */
  /* etiquetas sigue ahi y funciona igual: plan B, no pantalla rota.      */
  /* ------------------------------------------------------------------ */
  const EDITOR_RICO = "content";
  const hayEditorRico = () => !!(window.wp && wp.editor && typeof wp.editor.initialize === "function");

  /**
   * Avisa cuando `wp.editor` este disponible.
   *
   * WordPress imprime el editor por defecto al final del pie, despues de
   * nuestro script, asi que al abrir la pantalla puede no estar todavia.
   * Se mira cada 50 ms durante dos segundos como mucho; mientras tanto el
   * area de texto ya esta escrita y se puede usar.
   */
  function cuandoHayaEditor(fn, intentos = 40) {
    if (hayEditorRico() || intentos <= 0) { fn(hayEditorRico()); return; }
    setTimeout(() => cuandoHayaEditor(fn, intentos - 1), 50);
  }

  function montaEditorRico(id) {
    if (!hayEditorRico()) return false;
    desmontaEditorRico(id);
    wp.editor.initialize(id, {
      tinymce: {
        wpautop: true,
        height: 420,
        toolbar1: "formatselect,bold,italic,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_more,fullscreen,wp_adv",
        toolbar2: "strikethrough,hr,forecolor,pastetext,removeformat,charmap,outdent,indent,undo,redo",
      },
      quicktags: true,
      mediaButtons: true,
    });
    return true;
  }

  function desmontaEditorRico(id) {
    if (!window.wp || !wp.editor || typeof wp.editor.remove !== "function") return;
    try { wp.editor.remove(id); } catch (err) { /* no habia ninguno */ }
  }

  /** Lo que hay escrito ahora mismo, venga del editor rico o del area. */
  function contenidoRico(id, campo) {
    if (window.wp && wp.editor && typeof wp.editor.getContent === "function") {
      const v = wp.editor.getContent(id);
      if (typeof v === "string") return v;
    }
    return campo ? campo.value : "";
  }

  // Lo de fuera para que lo use cualquier pantalla del panel (y para que
  // los bancos puedan montarlo y desmontarlo como lo hace el panel).
  window.KrgEditor = {
    id: EDITOR_RICO,
    hay: hayEditorRico,
    monta: (id = EDITOR_RICO) => montaEditorRico(id),
    desmonta: (id = EDITOR_RICO) => desmontaEditorRico(id),
    contenido: (id = EDITOR_RICO) => contenidoRico(id, document.getElementById(id)),
  };

  const shell = (active, body) => {
    // Un TinyMCE vivo cuyo textarea desaparece deja al siguiente sin
    // poder arrancar con el mismo id: se desmonta antes de borrar.
    desmontaEditorRico(EDITOR_RICO);
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
        <a class="m-kpi" href="${cfg.admin}?page=krg-design" style="text-decoration:none;color:inherit"><span>Diseño</span><b style="font-size:18px">Apariencia</b></a>
      </div>
      <div class="m-panel" style="padding:16px 20px">
        <h3>Páginas recientes</h3>
        <ul>${(d.pages||[]).slice(0,8).map(p => `<li><a href="${cfg.admin}?page=krg-builder&id=${p.id}">${esc(p.title)}</a> · ${p.status}</li>`).join("")}</ul>
      </div>`);
  }

  /**
   * Contraste entre dos colores, en la escala de WCAG (de 1 a 21).
   */
  function ratio(a, b) {
    const lum = (h) => {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(h || "");
      if (!m) return 0;
      const c = [0, 1, 2].map((i) => {
        const n = parseInt(m[1].slice(i * 2, i * 2 + 2), 16) / 255;
        return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
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
          ${cfg.canManage ? `<a class="m-btn ghost" href="${cfg.admin}?page=krg-kit">Exportar e importar</a>` : ""}
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
      ${list.length ? "" : vacio("pagina", "Todavía no hay ninguna página",
        "Una página es cada dirección de tu web: la portada, «Nosotros», «Contacto»… Se montan con bloques y se pueden empezar desde una plantilla ya hecha.",
        `<a class="m-btn" href="${cfg.admin}?page=krg-pages&view=new">Crear la primera página</a>`)}
      <div class="m-table"${list.length ? "" : " hidden"}><table>
        <thead><tr><th>Título</th><th>Dirección</th><th>Estado</th><th>Quién la ve</th><th>Portada</th><th></th></tr></thead>
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
            <td class="m-acts">
              <a class="m-btn" href="${cfg.admin}?page=krg-builder&id=${p.id}">Editar</a>
              <button class="m-btn ghost" data-dup="${p.id}">Duplicar</button>
              <button class="m-btn ghost" data-del="${p.id}">Eliminar</button>
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

  }

  async function newPage() {
    const pages = await api.get("/pages").catch(() => []);
    const plantillas = window.KrgPaginas ? window.KrgPaginas.list() : [];
    shell("pages", `
      <div class="m-top"><h1>Nueva página</h1></div>
      <form class="m-form-grid" id="np">
        <label class="m-field">Nombre <input name="title" required placeholder="Página Servicios"></label>
        <label class="m-field">Dirección en la web (slug) <input name="slug" placeholder="servicios"></label>
        <label class="m-field">Página padre
          <select name="parentId">
            <option value="0">— Ninguna (raíz) —</option>
            ${pages.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("")}
          </select>
        </label>
        <label class="m-field">Empezar con
          <select name="tpl" id="np-tpl">
            <option value="">— Página vacía —</option>
            ${plantillas.map((t) => `<option value="${esc(t.slug)}">${esc(t.name)}</option>`).join("")}
          </select>
          <small class="m-muted" id="np-tpl-nota">La plantilla pone unas cuantas secciones ya montadas; luego se editan, se mueven y se borran una a una.</small>
        </label>
        <button class="m-btn" type="submit">Crear y abrir constructor</button>
      </form>`);
    // La nota de debajo del desplegable cuenta qué trae cada plantilla,
    // que el nombre solo no dice gran cosa.
    const selTpl = el.querySelector("#np-tpl");
    const notaTpl = el.querySelector("#np-tpl-nota");
    if (selTpl && notaTpl) {
      selTpl.onchange = () => {
        const f = plantillas.find((x) => x.slug === selTpl.value);
        notaTpl.textContent = f
          ? `${f.secciones.length} secciones: ${f.nota}`
          : "La plantilla pone unas cuantas secciones ya montadas; luego se editan, se mueven y se borran una a una.";
      };
    }
    el.querySelector("#np").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const doc = await api.post("/pages", { title: fd.get("title"), slug: fd.get("slug"), parentId: Number(fd.get("parentId") || 0) });
      // La plantilla se monta en el constructor, que es quien tiene el
      // registro de bloques cargado; aquí sólo viaja el nombre.
      const tpl = String(fd.get("tpl") || "");
      location.href = `${cfg.admin}?page=krg-builder&id=${doc.id}${tpl ? `&tpl=${encodeURIComponent(tpl)}` : ""}`;
    };
  }

  async function templates() {
    const list = await api.get("/templates");
    shell("templates", `
      <div class="m-top"><h1>Plantillas</h1></div>
      <p class="m-muted">Una sección suelta se guarda desde el árbol del constructor con ☆.
      Una página entera, desde «Plantillas de página» → «Guardar esta página como plantilla».
      Las dos se ponen luego en cualquier página.</p>
      <div class="m-table"><table><tbody>
        ${list.length ? list.map((t) => `<tr><td>${esc(t.name)}</td>
          <td>${(t.sections || []).length
            ? `Página entera · ${(t.sections || []).length} secciones`
            : "Una sección"}</td>
          <td><button class="m-btn ghost" data-del="${t.id}">Eliminar</button></td></tr>`).join("") : ""}
      </tbody></table></div>
      ${list.length ? "" : vacio("plantilla", "Todavía no has guardado ninguna plantilla",
        "Una plantilla es un trozo de página que ya tienes montado y quieres volver a usar: una sección suelta o la página entera. Se guardan desde el constructor.",
        `<a class="m-btn" href="${cfg.admin}?page=krg-pages">Ir a las páginas</a>`)}`);
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
        ${list.length ? list.map((t) => `<tr><td>${esc(t.name)}</td><td><button class="m-btn ghost" data-del="${t.id}">Eliminar</button></td></tr>`).join("") : ""}
      </tbody></table></div>
      ${list.length ? "" : vacio("global", "Todavía no hay ningún componente global",
        "Un global es un bloque que vive en un sitio y aparece en muchas páginas: una llamada a la acción, un aviso, un pie de sección. Se crea desde el árbol del constructor, con el botón de global.",
        `<a class="m-btn" href="${cfg.admin}?page=krg-pages">Ir a las páginas</a>`)}`);
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

  /**
   * Las familias del panel, con la cuarta siempre presente.
   *
   * «Títulos», «Cuerpo» y «Display» mandan en los titulares, el texto
   * corrido y los rótulos grandes. Todo lo demás —menús, botones,
   * antetítulos, etiquetas, precios, pestañas, letra pequeña— se queda
   * con la familia de títulos si nadie dice otra cosa, y hasta ahora no
   * había dónde decirlo. Esa cuarta fila es «Texto general».
   *
   * Si la instalación todavía no la tiene guardada se muestra vacía: no
   * cambia nada hasta que se elija una familia.
   */
  function familiasConUi(font) {
    const out = Object.entries(font || {});
    if (!out.some(([k]) => k === "ui")) {
      out.push(["ui", { value: "", label: "Texto general", weight: "", style: "normal" }]);
    }
    const etiquetas = {
      heading: "Títulos",
      body: "Cuerpo",
      display: "Display",
      ui: "Texto general",
    };
    return out.map(([k, v]) => {
      const item = (v && typeof v === "object") ? { ...v } : { value: String(v || "") };
      item.label = etiquetas[k] || item.label || k;
      return [k, item];
    });
  }

  function fontFamilyRow(key, item, catalog) {
    // Ojo con la familia vacía: `item.value || item` convertía el
    // objeto entero en texto («[object Object]») y la fila aparecía
    // como «Personalizada…» sin que nadie hubiera elegido nada.
    const current = String((item && typeof item === "object") ? (item.value || "") : (item || ""));
    const weight = String(item.weight || "400");
    const style = String(item.style || "normal");
    const groups = [
      { id: "wordpress", label: "WordPress (instaladas)" },
      { id: "web", label: "Catálogo web" },
      { id: "system", label: "Sistema" },
    ];
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
    // Primero la coincidencia exacta. Buscando por nombre suelto,
    // «Inter Tight» caía en «Inter» —que aparece antes en el catálogo y
    // está contenido en el otro— y la fila volvía cambiada.
    const matched = catalog.find((f) => norm(f.css) === norm(current))
      || catalog.filter((f) => f.name && current.includes(f.name)).sort((a, b) => b.name.length - a.name.length)[0];
    const isCustom = current && !matched;
    const opts = groups.map((g) => {
      const list = catalog.filter((f) => f.group === g.id);
      if (!list.length) return "";
      return `<optgroup label="${esc(g.label)}">${list.map((f) =>
        `<option value="${esc(f.css)}" data-google="${esc(f.google || "")}" data-variants="${esc(JSON.stringify(f.variants || []))}" ${matched && matched.css === f.css ? "selected" : ""}>${esc(f.name)}</option>`
      ).join("")}</optgroup>`;
    }).join("");
    const preview = matched ? matched.css : current;
    // Una familia escrita a mano no la sirve nadie: hay que pedirle el
    // archivo a Google o la web la pinta con la de respaldo (Arial) por
    // mucho que el CSS diga otra cosa. Se marca por defecto porque es
    // lo que quiere el 99 % de quien escribe un nombre ahí; quien aloje
    // su propia fuente lo desmarca.
    const googleOn = item.google === undefined ? isCustom : !!item.google;
    // Una fuente de un solo peso no tiene negrita: si el diseño la pide,
    // el navegador la engorda él mismo y la letra deja de parecerse a la
    // original. Mejor decirlo aquí que dejar que se descubra mirando la
    // web y pensando que la fuente no se aplicó.
    const pesos = (matched?.weights || []).map(String);
    const corto = pesos.length > 0 && pesos.length <= 2;
    const aviso = `<small class="m-font-aviso" data-font-aviso="${esc(key)}" ${corto ? "" : "hidden"}>`
      + (corto
        ? `Esta fuente solo existe en ${pesos.length === 1 ? "el peso" : "los pesos"} ${esc(pesos.join(" y "))}. Si el diseño pide una negrita, el navegador la simula y la letra cambia de aspecto.`
        : "")
      + "</small>";
    return `<div class="m-font-row" data-font-wrap="${esc(key)}">
      <span>${esc(item.label || key)}${key === "ui" ? "<small>menús, botones, etiquetas…</small>" : ""}</span>
      <select data-font="${esc(key)}">
        <option value="" ${current ? "" : "selected"}>— Sin elegir —</option>
        ${opts}
        <option value="__custom__" ${isCustom ? "selected" : ""}>Personalizada…</option>
      </select>
      <select data-font-variant="${esc(key)}" title="Variante">${variantOptionsHtml(matched?.variants, weight, style)}</select>
      <span class="m-font-preview" style="font-family:${esc(preview || "inherit")};font-weight:${esc(weight)};font-style:${esc(style)}">Aa Bb Cc 123</span>
      <input data-font-custom="${esc(key)}" value="${esc(current)}" ${isCustom ? "" : "hidden"} placeholder='"Mi Fuente", sans-serif'>
      ${aviso}
      <label class="m-font-google" data-font-google-wrap="${esc(key)}" ${isCustom ? "" : "hidden"}>
        <input type="checkbox" data-font-google="${esc(key)}" ${googleOn ? "checked" : ""}>
        Cargar desde Google Fonts
      </label>
    </div>`;
  }

  /** «"Questrial", sans-serif» → «Questrial». */
  function nombreDeFamilia(css) {
    return String(css || "").split(",")[0].replace(/["']/g, "").trim();
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

  /**
   * Cómo se llama cada token en castellano.
   *
   * Los tokens se guardan con su nombre técnico —`2xl`, `page-max-width`,
   * `sm`— porque es el que acaba en el CSS y el que hay que escribir en
   * `var(--…)`. Pero una pantalla que pone «xs, sm, md, lg, xl, 2xl» en
   * una columna no dice nada a quien no se sabe la convención. Aquí se
   * enseñan las dos cosas: el nombre en palabras y, debajo, el técnico.
   */
  const NOMBRES_TOKEN = {
    spacing: {
      xs: "Muy pequeño", sm: "Pequeño", md: "Medio", lg: "Grande", xl: "Muy grande",
      "2xl": "Enorme", section: "Aire entre secciones", card: "Aire dentro de una tarjeta",
    },
    radius: {
      sm: "Esquina apenas redondeada", md: "Esquina redondeada", lg: "Esquina muy redondeada",
      full: "Redondo del todo", buttons: "Botones", cards: "Tarjetas", inputs: "Campos de formulario",
      badges: "Etiquetas y sellos",
    },
    shadow: { sm: "Sombra corta", md: "Sombra media", lg: "Sombra larga" },
    layout: {
      "page-max-width": "Ancho máximo de la página", "section-gap": "Separación entre secciones",
      "card-padding": "Relleno de las tarjetas",
    },
    breakpoint: { tablet: "A partir de aquí, tableta", desktop: "A partir de aquí, escritorio" },
  };
  function nombreToken(grupo, clave, etiqueta) {
    if (etiqueta) return etiqueta;
    const dic = NOMBRES_TOKEN[grupo] || {};
    if (dic[clave]) return dic[clave];
    // Lo que no esté en el diccionario, al menos legible: guiones fuera
    // y la primera en mayúscula.
    const suelto = String(clave).replace(/[-_]+/g, " ").trim();
    return suelto.charAt(0).toUpperCase() + suelto.slice(1);
  }

  function tokenMap(obj, prefix) {
    return Object.entries(obj || {}).map(([k, v]) => {
      const val = v && typeof v === "object" && "value" in v ? v.value : (typeof v === "object" ? JSON.stringify(v) : v);
      const label = nombreToken(prefix, k, v && v.label);
      return `<div class="m-field-row m-tok-row">
        <span class="m-tok-nombre">${esc(label)}<code>${esc(k)}</code></span>
        <input data-tok="${prefix}.${k}" value="${esc(val ?? "")}" aria-label="${esc(label)}">
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
      : "Ninguna paleta puesta: los valores son tuyos.";
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
      accent: "Realce (insignias y selección)",
      accentSoft: "Tinte suave de acción",
      paper: "Fondo del panel",
      surface: "Superficie",
      surfaceSoft: "Superficie suave",
      card: "Tarjetas y campos",
      line: "Líneas y bordes",
      lineStrong: "Bordes marcados",
      ink: "Texto",
      muted: "Texto secundario",
      ok: "Correcto",
      warn: "Aviso",
      danger: "Peligro",
    };
    const skinVars = {
      sidebar: "--m-brown", sidebarDeep: "--m-brown-deep", action: "--m-orange",
      actionDeep: "--m-orange-deep", accent: "--m-accent", accentSoft: "--m-accent-soft",
      paper: "--m-paper", surface: "--m-surface", surfaceSoft: "--m-surface-soft",
      card: "--m-white", line: "--m-line", lineStrong: "--m-line-strong",
      ink: "--m-ink", muted: "--m-muted", ok: "--m-ok", warn: "--m-warn", danger: "--m-danger",
    };
    const skinTemas = (skinPack && skinPack.themes) || {};
    const skinTemaActivo = (skinPack && skinPack.theme) || "";

    /**
     * El apartado «El panel KRG».
     *
     * Va plegado y solo lo ve quien puede administrar: cambiar la cara del
     * gestor no es tarea de quien edita páginas. El servidor ya rechaza la
     * escritura sin `manage_options`; esto es para no enseñar una puerta
     * que está cerrada.
     */
    function adminSkinPanel() {
      if (!skinPack || !cfg.canManage) return "";
      const rows = Object.keys(skinLabels).map((k) => {
        const v = skinData[k] || skinDefaults[k] || "#000000";
        return `<div class="m-field-row">
          <span>${esc(skinLabels[k])}</span>
          <input data-skin="${k}" value="${esc(v)}" aria-label="${esc(skinLabels[k])}">
          <input class="m-color" type="color" data-skin-picker="${k}" value="${esc(normalizeHex(v))}" aria-label="${esc(skinLabels[k])} (selector)">
        </div>`;
      }).join("");
      const cartas = Object.entries(skinTemas).map(([slug, t]) => {
        const c = t.colores || {};
        const on = slug === skinTemaActivo;
        const chips = ["sidebar", "action", "accent", "paper", "card"]
          .map((k) => `<i style="background:${esc(c[k] || "#000")}"></i>`).join("");
        return `<button type="button" class="m-tema${on ? " is-on" : ""}" data-tema="${esc(slug)}" aria-pressed="${on ? "true" : "false"}">
          <span class="m-tema-chips" aria-hidden="true">${chips}</span>
          <strong>${esc(t.nombre || slug)}</strong>
          <span class="m-muted">${esc(t.nota || "")}</span>
        </button>`;
      }).join("");
      return `<details class="m-panel m-skin" id="skin-zona">
        <summary>
          <span class="m-skin-tit"><strong>El panel KRG</strong>
            <span class="m-pill">Solo administradores</span></span>
          <span class="m-muted">La cara del gestor: colores y temas. No toca tu web.</span>
        </summary>
        <div class="m-skin-body">
          <p class="m-muted">Son dos paletas distintas a propósito. Todo lo de arriba viaja al sitio que estás construyendo; esto de aquí solo cambia cómo se ve este panel, para ti y para quien entre a gestionarlo.</p>
          <div class="m-temas">${cartas}</div>
          <p class="m-muted" id="skin-contraste"></p>
          <details class="m-skin-avanzado">
            <summary>Ajustar los colores uno a uno</summary>
            <p class="m-muted">Parten del tema elegido. Se ven al instante mientras los tocas; pulsa «Guardar colores del CMS» para dejarlos fijos.</p>
            <div id="skin-colors">${rows}</div>
            <div class="m-section-save m-row">
              <button type="button" class="m-btn" id="save-skin">Guardar colores del CMS</button>
              <button type="button" class="m-btn ghost" id="skin-from-palette">Usar la paleta del sitio</button>
              <button type="button" class="m-btn ghost" id="skin-reset">Volver al tema</button>
            </div>
          </details>
        </div>
      </details>`;
    }

    shell("design", `
      <div class="m-top m-top-fija"><h1>Apariencia</h1>
        <div class="m-row">
          <span class="m-dirty" id="design-dirty" hidden>Hay cambios sin guardar</span>
          <button class="m-btn" id="save-tokens">Guardar cambios</button>
          <button class="m-btn ghost" id="exp-tokens">Exportar el diseño</button>
          <label class="m-btn ghost">Importar un diseño <input type="file" id="imp-tokens" accept="application/json" hidden></label>
        </div>
      </div>
      <p class="m-zona">Tu web <span class="m-muted">— lo que ve quien visita el sitio que estás construyendo.</span></p>
      <div class="m-design-cols">
      <div class="m-design-main">
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Paletas guardadas</h3>
        <p class="m-muted">El interruptor aplica la paleta al instante en esta pantalla y en la vista previa. Para publicarla en el sitio, «Guardar cambios». Solo un interruptor queda encendido.</p>
        <div class="m-presets">${presetCards}</div>
        <p class="m-preset-status">${presetStatus}</p>
        <div class="m-palette-bar">${paletteBar}</div>
        <p class="m-muted" id="preset-dirty" hidden>Has cambiado de paleta: pulsa «Guardar cambios» arriba para publicarla.</p>
        <div class="m-preset-new">
          <h4>Crear una paleta con lo de ahora</h4>
          <p class="m-muted">Guarda los colores y las letras que tienes ahora mismo con un nombre, para poder volver a ellos cuando quieras. Las paletas que vienen con el tema no se tocan.</p>
          <div class="m-row">
            <label class="m-field m-field-grow">Nombre de la paleta
              <input id="new-preset-name" placeholder="Por ejemplo: Verano 2026" maxlength="60">
            </label>
            <button class="m-btn ghost" type="button" id="new-preset">Crear la paleta</button>
          </div>
        </div>
      </div>
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
          <p class="m-muted m-form-nota">El nombre, el eslogan, el logo y el favicon se guardan con «Guardar cambios», arriba.</p>
        </form>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Colores</h3>
        <p class="m-muted">Cada color se guarda con su nombre y lo usan todos los bloques. Ninguno lleva un color escrito a mano, así que cambiarlo aquí lo cambia en toda la web.</p>
        <div id="colors">${colorRows}</div>
        <div class="m-add-color">
          <label class="m-field m-field-grow">Añadir un color
            <input id="new-color-name" placeholder="Por ejemplo: Acento cálido" maxlength="40">
          </label>
          <button type="button" class="m-btn ghost" id="add-color">Añadir</button>
        </div>
        <p class="m-muted">Cada color aparece luego en los selectores de los bloques, con su nombre. Los que vienen de serie no se pueden quitar: hay bloques que cuentan con ellos.</p>
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Tipografías</h3>
        <p class="m-muted">Elige la letra y su variante (Regular, Negrita, Cursiva…). De las que trae WordPress aparecen las caras instaladas. Se guarda con «Guardar cambios», arriba.</p>
        ${familiasConUi(tokens.font).map(([k, v]) => fontFamilyRow(k, v, fontCatalog)).join("")}
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Para qué se usa cada letra</h3>
        <p class="m-muted">El tamaño, el grosor, la letra, el interlineado y la separación entre letras de cada sitio donde se escribe: titulares, párrafo, botón…</p>
        ${typeRows(tokens.typography, tokens.font)}
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Espaciado</h3>${tokenMap(tokens.spacing, "spacing")}
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Esquinas redondeadas</h3>${tokenMap(tokens.radius, "radius")}
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Sombras</h3>${tokenMap(tokens.shadow, "shadow")}
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Medidas de la página</h3>${tokenMap(tokens.layout, "layout")}
      </div>
      <div class="m-panel" style="padding:20px;margin-bottom:16px">
        <h3>Saltos de pantalla</h3>${tokenMap(tokens.breakpoint, "breakpoint")}
      </div>
      </div>
      <aside class="m-design-side">
        <div class="m-preview-card">
          <h3>Vista previa</h3>
          <p class="m-muted">Lo que estás tocando, aplicado a una página de mentira. Cambia mientras escribes; no es tu web, es un ejemplo.</p>
          <style id="design-preview-css"></style>
          <div class="m-preview" id="design-preview">
            <div class="m-pv-bar"><span class="m-pv-logo">${esc(identity.siteName || "Tu sitio")}</span><span class="m-pv-nav"><i></i><i></i><i></i></span></div>
            <div class="m-pv-hero">
              <p class="m-pv-eyebrow">Antetítulo</p>
              <h4 class="m-pv-title">Un titular de ejemplo</h4>
              <p class="m-pv-text">Así queda un párrafo con la tipografía, el color de texto y el ritmo que tienes puestos ahora mismo.</p>
              <span class="m-pv-btn">Botón principal</span>
            </div>
            <div class="m-pv-cards">
              <div class="m-pv-card"><span class="m-pv-badge">Sello</span><strong>Una tarjeta</strong><p>Fondo de superficie, borde y radio de tarjeta.</p></div>
              <div class="m-pv-card"><span class="m-pv-badge">Sello</span><strong>Otra tarjeta</strong><p>La sombra y el relleno salen de sus tokens.</p></div>
            </div>
          </div>
          <div class="m-palette-bar" id="design-chips"></div>
        </div>
      </aside>
      </div>
      ${adminSkinPanel()}`);
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
        const clave = inp.dataset.font;
        let v = inp.value;
        const aMano = v === "__custom__";
        if (aMano) {
          const c = el.querySelector(`[data-font-custom="${clave}"]`);
          v = c ? c.value : "";
        }
        next.tokens.font = next.tokens.font || {};
        const cur = next.tokens.font[clave];
        if (cur && typeof cur === "object") cur.value = v;
        else next.tokens.font[clave] = { value: v, type: "fontFamily" };
        // Quién tiene que servir el archivo de la fuente. Sin esto el
        // CSS declara la familia y nadie la descarga: la web se ve con
        // Arial aunque el inspector diga «Questrial».
        const chk = el.querySelector(`[data-font-google="${clave}"]`);
        if (aMano && chk?.checked && v) next.tokens.font[clave].google = nombreDeFamilia(v);
        else delete next.tokens.font[clave].google;
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
          : "Ninguna paleta puesta: los valores son tuyos.";
      }
    };

    const markPresetDirty = (yes) => {
      const hint = el.querySelector("#preset-dirty");
      if (hint) hint.hidden = !yes;
      // El aviso de arriba es el mismo para todo: un cambio es un
      // cambio, venga de un campo o de cambiar de paleta.
      const bandera = el.querySelector("#design-dirty");
      if (bandera && yes) bandera.hidden = false;
      const b = el.querySelector("#save-tokens");
      if (b) b.classList.toggle("is-pulse", !!yes);
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
      const gwrap = wrap?.querySelector("[data-font-google-wrap]");
      const gchk = wrap?.querySelector("[data-font-google]");
      const aviso = wrap?.querySelector(".m-font-aviso");
      gchk?.addEventListener("change", () => { gchk.dataset.tocada = "1"; });
      const sync = () => {
        const opt = sel.selectedOptions[0];
        const isCustom = sel.value === "__custom__";
        if (custom) custom.hidden = !isCustom;
        if (gwrap) gwrap.hidden = !isCustom;
        // Al pasar a «Personalizada…» la casilla se marca sola: una
        // familia escrita a mano no la sirve nadie si no se pide. Si
        // alguien la desmarca, se respeta.
        if (isCustom && gchk && gchk.dataset.tocada !== "1") gchk.checked = true;
        // El aviso de los pesos cambia con la familia, así que se
        // reescribe aquí y no solo al pintar la fila.
        if (aviso) {
          let pesos = [];
          try {
            pesos = [...new Set(JSON.parse(opt?.getAttribute("data-variants") || "[]").map((v) => String(v.weight)))];
          } catch (e) {
            pesos = [];
          }
          const corto = !isCustom && pesos.length && pesos.length <= 2;
          aviso.hidden = !corto;
          if (corto) {
            aviso.textContent = `Esta fuente solo existe en ${pesos.length === 1 ? "el peso" : "los pesos"} ${pesos.join(" y ")}. `
              + "Si el diseño pide una negrita, el navegador la simula y la letra cambia de aspecto.";
          }
        }
        const css = isCustom ? (custom?.value || "") : sel.value;
        fillFontVariants(wrap);
        const vopt = vsel?.selectedOptions[0];
        if (preview) {
          preview.style.fontFamily = css || "inherit";
          preview.style.fontWeight = vopt?.dataset.weight || "400";
          preview.style.fontStyle = vopt?.dataset.style || "normal";
        }
        // La vista previa de aquí arriba tiene que cargar la fuente por
        // el mismo criterio que la web pública, o el panel enseña una
        // cosa y el sitio otra: del catálogo, por su nombre de Google;
        // escrita a mano, solo si se ha pedido cargarla.
        if (isCustom) {
          if (gchk?.checked) ensureFontLink(nombreDeFamilia(css));
        } else {
          ensureFontLink(opt?.dataset.google || "");
        }
      };
      sel.addEventListener("change", sync);
      custom?.addEventListener("input", sync);
      gchk?.addEventListener("change", sync);
      vsel?.addEventListener("change", sync);
      sync();
    });
    /* ------------------------------------------------------------------
       Un solo botón de guardar.

       Antes había nueve: uno por apartado, más el de la paleta, más el
       de la identidad, más el de arriba. Todos llamaban a lo mismo
       —`PUT /tokens` con la pantalla entera—, así que «Guardar radios»
       guardaba también los colores sin decirlo, y quien tocaba tres
       apartados y pulsaba uno creía haber guardado sólo ese. Ahora hay
       uno arriba, que es verdad: guarda los tokens y, si la has tocado,
       la identidad.
       ------------------------------------------------------------------ */
    const btnGuardar = el.querySelector("#save-tokens");
    const avisoSucio = el.querySelector("#design-dirty");
    let sucio = false;
    const marcarSucio = (si) => {
      sucio = !!si;
      if (avisoSucio) avisoSucio.hidden = !sucio;
      if (btnGuardar) btnGuardar.classList.toggle("is-pulse", sucio);
    };

    const guardarIdentidad = async () => {
      const form = el.querySelector("#idform");
      if (!form) return;
      const fd = new FormData(form);
      await api.put("/identity", {
        siteName: fd.get("siteName"),
        tagline: fd.get("tagline"),
        logoId: Number(fd.get("logoId") || 0),
        faviconId: Number(fd.get("faviconId") || 0),
      });
      identityCache = null;
    };

    const guardarTodo = async () => {
      if (btnGuardar) btnGuardar.disabled = true;
      try {
        await guardarIdentidad();
      } catch (err) {
        toast("No se pudo guardar la identidad: " + (err.message || "error"));
      } finally {
        if (btnGuardar) btnGuardar.disabled = false;
      }
      await saveTokens(btnGuardar, "Guardado. El sitio público ya usa estos valores.");
      marcarSucio(false);
    };
    if (btnGuardar) btnGuardar.onclick = guardarTodo;

    /* ------------------------------------------------------------------
       La vista previa viva.

       Es una página de mentira pintada con los valores que hay ahora
       mismo en los campos, no con los guardados. Las variables se
       escriben acotadas a `#design-preview`, así que no tocan ni el
       panel ni el sitio: sólo este recuadro.
       ------------------------------------------------------------------ */
    const hojaPrevia = el.querySelector("#design-preview-css");
    const chipsPrevia = el.querySelector("#design-chips");
    let pintando = null;
    const pintarPrevia = () => {
      if (!hojaPrevia) return;
      const t = collect().tokens || {};
      const linea = [];
      Object.entries(t.color || {}).forEach(([k, v]) => linea.push(`--color-${k}:${tokVal(v)}`));
      Object.entries(t.font || {}).forEach(([k, v]) => linea.push(`--font-${k}:${tokVal(v)}`));
      ["spacing", "radius", "shadow", "layout"].forEach((g) => {
        Object.entries(t[g] || {}).forEach(([k, v]) => linea.push(`--${g === "layout" ? "" : g + "-"}${k}:${tokVal(v)}`));
      });
      const tipo = t.typography || {};
      const rol = (nombre, pre) => {
        const r = tipo[nombre] || {};
        Object.entries(r).forEach(([k, v]) => { if (v) linea.push(`--pv-${pre}-${k}:${v}`); });
      };
      rol("display", "display"); rol("h2", "h2"); rol("p", "p"); rol("button", "btn");
      hojaPrevia.textContent = `#design-preview{${linea.filter((x) => !/:\s*(undefined|null)?$/.test(x)).join(";")}}`;
      if (chipsPrevia) chipsPrevia.innerHTML = paletteHtml(t.color);
    };
    const repintar = () => {
      clearTimeout(pintando);
      pintando = setTimeout(pintarPrevia, 120);
    };
    // Cualquier campo de la columna de la izquierda repinta el ejemplo y
    // enciende el aviso de «sin guardar».
    const columna = el.querySelector(".m-design-main");
    if (columna) {
      ["input", "change"].forEach((ev) => columna.addEventListener(ev, (e) => {
        if (e.target.closest(".m-skin")) return;   // la piel del CMS no es la web
        marcarSucio(true);
        repintar();
      }));
    }
    pintarPrevia();
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
      /* Avisa si la combinación elegida deja de leerse. El cálculo es el
         mismo que se usa para el sitio público: nada de ojo clínico. */
      const revisarContraste = () => {
        const caja = el.querySelector("#skin-contraste");
        if (!caja) return;
        const val = (k) => {
          const inp = el.querySelector(`[data-skin="${CSS.escape(k)}"]`);
          return normalizeHex(inp ? inp.value : (skinData[k] || ""));
        };
        const pares = [
          ["el texto sobre el fondo", val("ink"), val("paper"), 4.5],
          ["el texto sobre las tarjetas", val("ink"), val("card"), 4.5],
          ["el texto secundario", val("muted"), val("paper"), 4.5],
          ["los botones", "#ffffff", val("action"), 4.5],
          ["la barra lateral", val("card"), val("sidebar"), 4.5],
        ];
        const malos = pares.filter(([, a, b, min]) => ratio(a, b) < min);
        if (!malos.length) {
          caja.textContent = "Contraste comprobado: todo se lee (AA).";
          caja.classList.remove("is-mal");
          return;
        }
        caja.textContent = "Ojo: no se lee bien " + malos.map(([q, a, b]) => `${q} (${ratio(a, b).toFixed(1)}:1)`).join(", ") + ". El objetivo es 4.5:1.";
        caja.classList.add("is-mal");
      };
      /* Cambiar de tema: se pinta al instante y se guarda, porque un tema
         es una decisión entera, no un campo suelto a medio escribir. */
      el.querySelectorAll("[data-tema]").forEach((btn) => {
        btn.onclick = async () => {
          const slug = btn.dataset.tema;
          const tema = skinTemas[slug];
          if (!tema) return;
          el.querySelectorAll("[data-tema]").forEach((b) => {
            const on = b === btn;
            b.classList.toggle("is-on", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          fillSkin(tema.colores || {});
          revisarContraste();
          try {
            await api.put("/admin-skin", { theme: slug });
            toast(`Tema «${tema.nombre || slug}» aplicado al panel.`);
          } catch (err) {
            toast(err.message);
          }
        };
      });
      el.querySelectorAll("[data-skin], [data-skin-picker]").forEach((inp) => {
        inp.addEventListener("change", revisarContraste);
      });
      revisarContraste();

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
            el.querySelectorAll("[data-tema]").forEach((b) => {
              const on = b.dataset.tema === (res.theme || "");
              b.classList.toggle("is-on", on);
              b.setAttribute("aria-pressed", on ? "true" : "false");
            });
            revisarContraste();
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
          toast("Preset desactivado en pantalla. Los valores se mantienen. Pulsa «Guardar cambios».");
          return;
        }
        const preset = (pack.presets || []).find((p) => p.slug === slug);
        if (!preset || !preset.tokens || !Object.keys(preset.tokens).length) {
          inp.checked = false;
          toast("Esta paleta no trae colores cargados.");
          return;
        }
        data.tokens = structuredClone(preset.tokens);
        data.activePreset = slug;
        data.slug = slug;
        data.name = preset.name || slug;
        applyTokensToForm(data.tokens);
        setPresetUI(slug);
        markPresetDirty(true);
        pintarPrevia();
        const label = slug === "marca" ? "Marca Novamix" : (preset.name || "Preset");
        toast(label + " aplicada. Pulsa «Guardar cambios» para publicarla.");
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
    // Pulsar Intro dentro de la identidad hace lo mismo que el botón de
    // arriba: no hay dos guardados distintos que puedan contradecirse.
    el.querySelector("#idform").onsubmit = (e) => {
      e.preventDefault();
      guardarTodo();
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
    const [list, tax] = await Promise.all([api.get("/blog"), api.get("/blog/taxonomies")]);
    const verCats = tax.settings ? tax.settings.showCategories !== false : true;
    shell("blog", `
      <div class="m-top"><h1>Blog</h1><button class="m-btn" id="np">Nueva entrada</button></div>
      <div class="m-table" id="blog-table"></div>

      <div class="m-top m-top-sub">
        <h2>Categorías y etiquetas</h2>
        <label class="m-switch" for="cats-vis">
          <input type="checkbox" id="cats-vis" ${verCats ? "checked" : ""}>
          <span class="m-switch-track"><span class="m-switch-dot"></span></span>
          <span class="m-switch-txt">Mostrar las categorías en la web</span>
        </label>
      </div>
      <p class="m-muted m-tax-note" id="tax-note"></p>
      <div class="m-tabs" id="tax-tabs" role="tablist">
        <button type="button" class="is-active" data-tax="category" role="tab">Categorías</button>
        <button type="button" data-tax="post_tag" role="tab">Etiquetas</button>
      </div>
      <div class="m-table" id="tax-table"></div>
      <div class="m-row m-tax-new">
        <input id="tax-name" placeholder="Nombre de la categoría">
        <button class="m-btn" id="tax-add">Crear</button>
      </div>`);

    el.querySelector("#np").onclick = async () => {
      const p = await api.post("/blog", { title: "Nueva entrada", status: "draft", content: "<p></p>" });
      location.href = `${cfg.admin}?page=krg-blog&view=edit&id=${p.id}`;
    };

    /* ---------------------------------------------------------------- */
    /* La lista de entradas.                                             */
    /*                                                                    */
    /* Cada fila lleva su categoría, su etiqueta y su estado, para no     */
    /* tener que abrir la entrada solo para cambiar una cosa, más         */
    /* duplicar y eliminar. Lo que se toca viaja solo (la API ya solo     */
    /* escribe lo que recibe), así que cambiar el estado no puede         */
    /* tocarle el cuerpo a la entrada.                                    */
    /* ---------------------------------------------------------------- */
    let entradas = list;
    const ESTADOS = [
      ["draft", "Borrador"],
      ["pending", "Pendiente de revisión"],
      ["publish", "Publicada (pública)"],
      ["private", "Privada"],
    ];

    /** Los nombres de los términos que tiene una entrada. */
    function nombresDe(ids, cuales) {
      const n = (ids || []).map((id) => (cuales.find((t) => t.id === id) || {}).name).filter(Boolean);
      return n.length ? n.join(", ") : "—";
    }

    function selectorTerminos(p, clave, cuales) {
      const puestos = p[clave] || [];
      return `<details class="m-pick" data-pick="${clave}" data-id="${p.id}">
        <summary><span class="m-pick-sum">${esc(nombresDe(puestos, cuales))}</span></summary>
        <div class="m-pick-list">${cuales.length ? cuales.map((t) => `
          <label><input type="checkbox" data-term="${t.id}" ${puestos.includes(t.id) ? "checked" : ""}> ${esc(t.name)}</label>`).join("")
          : `<p class="m-muted">Todavía no hay ninguna. Créala aquí abajo.</p>`}</div>
      </details>`;
    }

    function pintaEntradas() {
      const cats = terminos.categories || [];
      const tags = terminos.tags || [];
      el.querySelector("#blog-table").innerHTML = `<table>
        <thead><tr><th>Título</th><th>Categorías</th><th>Etiquetas</th><th>Estado</th><th></th></tr></thead>
        <tbody>${entradas.map((p) => `<tr>
          <td><a href="${cfg.admin}?page=krg-blog&view=edit&id=${p.id}">${esc(p.title)}</a></td>
          <td>${selectorTerminos(p, "categories", cats)}</td>
          <td>${selectorTerminos(p, "tags", tags)}</td>
          <td><select class="m-mini" data-estado="${p.id}">
            ${ESTADOS.map(([v, t]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${t}</option>`).join("")}
            ${ESTADOS.some(([v]) => v === p.status) ? "" : `<option value="${esc(p.status)}" selected>${esc(p.status)}</option>`}
          </select></td>
          <td class="m-tax-acts">
            <button class="m-btn ghost" data-dup-post="${p.id}">Duplicar</button>
            <button class="m-btn ghost" data-del="${p.id}">Eliminar</button>
          </td>
        </tr>`).join("")}</tbody>
      </table>`;

      el.querySelectorAll("#blog-table [data-del]").forEach((b) => b.onclick = async () => {
        if (!confirm("¿Eliminar esta entrada?")) return;
        await api.del(`/blog/${b.dataset.del}`);
        entradas = entradas.filter((p) => String(p.id) !== b.dataset.del);
        pintaEntradas();
        toast("Entrada eliminada");
      });

      el.querySelectorAll("#blog-table [data-dup-post]").forEach((b) => b.onclick = async () => {
        b.disabled = true;
        try {
          const copia = await api.post(`/blog/${b.dataset.dupPost}/duplicar`, {});
          entradas = await api.get("/blog");
          pintaEntradas();
          toast(`Copia creada: «${copia.title}» (borrador)`);
        } catch (err) {
          b.disabled = false;
          toast(err.message || "No se pudo duplicar");
        }
      });

      el.querySelectorAll("#blog-table [data-estado]").forEach((sel) => sel.onchange = async () => {
        const id = Number(sel.dataset.estado);
        const antes = (entradas.find((p) => p.id === id) || {}).status;
        try {
          const r = await api.put(`/blog/${id}`, { status: sel.value });
          const p = entradas.find((x) => x.id === id);
          if (p) p.status = r.status;
          // La API puede dejarlo en «pendiente» si no se puede publicar.
          if (r.status !== sel.value) {
            sel.value = r.status;
            toast("No puedes publicar: queda pendiente de revisión");
          } else {
            toast("Estado guardado");
          }
        } catch (err) {
          sel.value = antes;
          toast(err.message || "No se pudo guardar");
        }
      });

      el.querySelectorAll("#blog-table .m-pick").forEach((caja) => {
        const clave = caja.dataset.pick;
        const id = Number(caja.dataset.id);
        caja.querySelectorAll("[data-term]").forEach((cb) => cb.onchange = async () => {
          const ids = [...caja.querySelectorAll("[data-term]")].filter((x) => x.checked).map((x) => Number(x.dataset.term));
          const antes = (entradas.find((p) => p.id === id) || {})[clave] || [];
          try {
            const r = await api.put(`/blog/${id}`, { [clave]: ids });
            const p = entradas.find((x) => x.id === id);
            if (p) p[clave] = r[clave] || ids;
            caja.querySelector(".m-pick-sum").textContent =
              nombresDe(p ? p[clave] : ids, clave === "categories" ? (terminos.categories || []) : (terminos.tags || []));
            toast(clave === "categories" ? "Categorías guardadas" : "Etiquetas guardadas");
          } catch (err) {
            cb.checked = antes.includes(Number(cb.dataset.term));
            toast(err.message || "No se pudo guardar");
          }
        });
      });
    }

    /* ---------------------------------------------------------------- */
    /* Categorías y etiquetas: crear, duplicar y eliminar.               */
    /*                                                                    */
    /* Vive aquí, debajo de las entradas, porque es lo mismo que se usa   */
    /* al escribirlas. Solo se repinta esta parte: la lista de entradas   */
    /* de arriba no se toca.                                              */
    /* ---------------------------------------------------------------- */
    let terminos = tax;
    let taxActiva = "category";
    const esCat = () => taxActiva === "category";
    const lista = () => (esCat() ? terminos.categories : terminos.tags) || [];
    const tabla = el.querySelector("#tax-table");
    const nota = el.querySelector("#tax-note");
    const campo = el.querySelector("#tax-name");

    function pintaNota() {
      const ver = el.querySelector("#cats-vis").checked;
      nota.textContent = ver
        ? "Las categorías se ven en la web: el módulo de categorías las lista y sus archivos salen en buscadores."
        : "Las categorías están ocultas: el módulo de categorías no se pinta en la web y sus archivos quedan fuera de los buscadores. Dentro del CMS se siguen usando para organizar las entradas.";
    }

    function pintaTerminos() {
      const items = lista();
      campo.placeholder = esCat() ? "Nombre de la categoría" : "Nombre de la etiqueta";
      tabla.innerHTML = `<table>
        <thead><tr><th>Nombre</th><th>Dirección</th><th>Entradas</th><th></th></tr></thead>
        <tbody>${items.length ? items.map((t) => `<tr>
          <td>${esc(t.name)}${t.isDefault ? ' <span class="m-pill">por defecto</span>' : ""}</td>
          <td class="m-muted">${esc(t.slug)}</td>
          <td>${Number(t.count || 0)}</td>
          <td class="m-tax-acts">
            ${esCat() && !t.isDefault ? `<button class="m-btn ghost" data-def="${t.id}" title="Pasa a ser la categoría por defecto; entonces la que lo era se podrá eliminar">Predeterminada</button>` : ""}
            <button class="m-btn ghost" data-dup="${t.id}">Duplicar</button>
            <button class="m-btn ghost" data-rm="${t.id}" ${t.isDefault ? "disabled title='Es la predeterminada: nombra otra antes de borrarla'" : ""}>Eliminar</button>
          </td>
        </tr>`).join("") : `<tr><td colspan="4" class="m-muted">${esCat() ? "Todavía no hay categorías." : "Todavía no hay etiquetas."}</td></tr>`}</tbody>
      </table>`;

      tabla.querySelectorAll("[data-def]").forEach((b) => b.onclick = async () => {
        b.disabled = true;
        try {
          await api.put(`/blog/terms/${b.dataset.def}/predeterminada`, {});
          await recargaTerminos();
          toast("Ya es la categoría por defecto. Ahora puedes borrar la anterior.");
        } catch (err) {
          b.disabled = false;
          toast(err.message || "No se pudo cambiar");
        }
      });

      tabla.querySelectorAll("[data-dup]").forEach((b) => b.onclick = async () => {
        b.disabled = true;
        try {
          const r = await api.post(`/blog/terms/${b.dataset.dup}/duplicar?taxonomy=${taxActiva}`, {});
          await recargaTerminos();
          const n = Number(r.posts || 0);
          toast(`Copia creada: «${r.term.name}»` + (n ? ` con sus ${n} entrada${n === 1 ? "" : "s"}` : ""));
        } catch (err) {
          b.disabled = false;
          toast(err.message || "No se pudo duplicar");
        }
      });

      tabla.querySelectorAll("[data-rm]").forEach((b) => b.onclick = async () => {
        const t = lista().find((x) => String(x.id) === b.dataset.rm);
        const cuantas = Number(t?.count || 0);
        const aviso = esCat()
          ? `¿Eliminar la categoría «${t?.name}»?\n\nNo se borra ninguna entrada. ${cuantas ? `Las ${cuantas} entradas que tiene pasarán a la categoría por defecto si se quedan sin ninguna.` : ""}`
          : `¿Eliminar la etiqueta «${t?.name}»?\n\nNo se borra ninguna entrada.`;
        if (!confirm(aviso)) return;
        b.disabled = true;
        try {
          await api.del(`/blog/terms/${b.dataset.rm}?taxonomy=${taxActiva}`);
          await recargaTerminos();
          toast("Eliminada");
        } catch (err) {
          b.disabled = false;
          toast(err.message || "No se pudo eliminar");
        }
      });
    }

    async function recargaTerminos() {
      terminos = await api.get("/blog/taxonomies");
      pintaTerminos();
      // Las filas de arriba eligen entre estos mismos términos.
      pintaEntradas();
    }

    el.querySelectorAll("#tax-tabs [data-tax]").forEach((b) => b.onclick = () => {
      taxActiva = b.dataset.tax;
      el.querySelectorAll("#tax-tabs [data-tax]").forEach((o) => o.classList.toggle("is-active", o === b));
      pintaTerminos();
    });

    el.querySelector("#tax-add").onclick = async () => {
      const name = campo.value.trim();
      if (!name) return;
      const boton = el.querySelector("#tax-add");
      boton.disabled = true;
      try {
        await api.post("/blog/terms", { name, taxonomy: taxActiva });
        campo.value = "";
        await recargaTerminos();
        toast(esCat() ? "Categoría creada" : "Etiqueta creada");
      } catch (err) {
        toast(err.message || "No se pudo crear");
      }
      boton.disabled = false;
    };
    campo.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); el.querySelector("#tax-add").click(); } };

    el.querySelector("#cats-vis").onchange = async (e) => {
      const valor = e.target.checked;
      pintaNota();
      try {
        await api.put("/blog/settings", { showCategories: valor });
        toast(valor ? "Las categorías se ven en la web" : "Las categorías quedan ocultas en la web");
      } catch (err) {
        e.target.checked = !valor;
        pintaNota();
        toast(err.message || "No se pudo guardar");
      }
    };

    pintaNota();
    pintaTerminos();
    pintaEntradas();
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
        <label class="m-field">Dirección en la web (slug) <input name="slug" value="${esc(p.slug)}"></label>
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
    // El cuadro completo, si WordPress lo ha cargado. La barra de
    // etiquetas de abajo solo tiene sentido sin el.
    cuandoHayaEditor((hay) => {
      // Puede haberse ido a otra pantalla mientras se esperaba.
      if (!hay || !el.contains(ta)) return;
      if (montaEditorRico(EDITOR_RICO)) el.querySelector("#tb").hidden = true;
    });
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
        content: contenidoRico(EDITOR_RICO, ta),
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

  /* ------------------------------------------------------------------ */
  /* Exportar e importar el diseño                                        */
  /* ------------------------------------------------------------------ */

  const KIT_PARTES = [
    ["tokens", "La paleta, las tipografías y las medidas", "Los colores, las familias y los espacios de la marca."],
    ["chrome", "La cabecera, el pie y los menús", "Lo que se repite en todas las páginas."],
    ["biblioteca", "Plantillas y componentes globales", "Lo que está guardado para reutilizar."],
    ["paginas", "Las páginas", "Cada página entera, con sus secciones y su SEO."],
  ];

  /* ------------------------------------------------------------------ */
  /* Reservas de mesa.                                                    */
  /*                                                                      */
  /* Lo que ha dejado la gente en el bloque «Reserva de mesa»: quién,     */
  /* cuándo, cuántos y cómo localizarle. Se puede confirmar, cancelar o   */
  /* borrar, y contestar por teléfono o por WhatsApp de un clic.          */
  /* ------------------------------------------------------------------ */
  const RES_PESTANAS = [
    ["proximas", "Próximas"],
    ["pasadas", "Pasadas"],
    ["canceladas", "Canceladas"],
    ["todas", "Todas"],
  ];
  const RES_ESTADOS = {
    nueva: "Sin confirmar",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
  };

  /** «jueves 16 de octubre», sin inventarse la zona horaria. */
  const resFecha = (f) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f || "")) return f || "";
    const d = new Date(`${f}T12:00:00`);
    if (Number.isNaN(d.getTime())) return f;
    return d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  };
  /** El teléfono tal cual lo escribió el cliente, listo para wa.me. */
  const resWa = (tel) => String(tel || "").replace(/\D+/g, "").replace(/^0+/, "");

  async function reservas() {
    let cuales = new URLSearchParams(location.search).get("ver") || "proximas";
    if (!RES_PESTANAS.some(([id]) => id === cuales)) cuales = "proximas";

    shell("reservas", `
      <div class="m-top"><h1>Reservas</h1></div>
      <p class="m-muted">Las peticiones de mesa que llegan por el bloque «Reserva de mesa». Quedan apuntadas
      aunque el aviso se mandara por correo o por WhatsApp, así que aquí está siempre la lista completa.</p>
      <div class="m-res-tabs">
        ${RES_PESTANAS.map(([id, nombre]) =>
          `<button class="m-btn ghost ${id === cuales ? "is-active" : ""}" data-res-tab="${id}">${nombre}</button>`).join("")}
      </div>
      <div id="res-lista"><p class="m-muted">Cargando…</p></div>`);

    const caja = el.querySelector("#res-lista");

    const ficha = (r) => {
      const wa = resWa(r.telefono);
      return `
        <div class="m-res" data-res="${r.id}">
          <div class="m-res-cuando">
            <strong>${esc(r.horaTexto || r.hora)}</strong>
            <small class="m-muted">${esc(plural(r.comensales, "persona", "personas"))}</small>
          </div>
          <div class="m-res-quien">
            <strong>${esc(r.nombre)}</strong>
            <div class="m-res-datos">
              ${r.telefono ? `<a href="tel:${esc(r.telefono.replace(/\s+/g, ""))}">${esc(r.telefono)}</a>` : ""}
              ${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ""}
              ${wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            </div>
            ${r.mensaje ? `<p class="m-res-nota">${esc(r.mensaje)}</p>` : ""}
          </div>
          <div class="m-res-acciones">
            <span class="m-res-estado is-${esc(r.estado)}">${esc(RES_ESTADOS[r.estado] || r.estado)}</span>
            ${r.estado !== "confirmada" ? `<button class="m-btn ghost" data-res-estado="confirmada" data-id="${r.id}">Confirmar</button>` : ""}
            ${r.estado !== "cancelada" ? `<button class="m-btn ghost" data-res-estado="cancelada" data-id="${r.id}">Cancelar</button>` : ""}
            <button class="m-btn ghost" data-res-borrar="${r.id}">Borrar</button>
          </div>
        </div>`;
    };

    const pintar = (datos) => {
      const lista = datos.reservas || [];
      if (!lista.length) {
        caja.innerHTML = `<div class="m-panel" style="padding:16px 20px;margin-top:16px">
          <p class="m-muted">No hay reservas aquí. Cuando alguien pida mesa en la web, aparece en esta lista.</p>
        </div>`;
        return;
      }
      const dias = [];
      lista.forEach((r) => {
        const ultimo = dias[dias.length - 1];
        if (ultimo && ultimo.fecha === r.fecha) ultimo.items.push(r);
        else dias.push({ fecha: r.fecha, items: [r] });
      });
      caja.innerHTML = `
        <p class="m-muted">${esc(plural(lista.length, "reserva", "reservas"))}${
          datos.resumen && datos.resumen.nueva ? ` · ${esc(plural(datos.resumen.nueva, "sin confirmar", "sin confirmar"))}` : ""}</p>
        ${dias.map((d) => `
          <div class="m-res-dia">
            <h3>${esc(resFecha(d.fecha))}${d.fecha === datos.hoy ? " · hoy" : ""}</h3>
            <div class="m-panel m-res-grupo">${d.items.map(ficha).join("")}</div>
          </div>`).join("")}`;
    };

    const cargar = async () => {
      try {
        pintar(await api.get(`/bookings?cuales=${encodeURIComponent(cuales)}`));
      } catch (err) {
        caja.innerHTML = `<p class="m-form-error">${esc(err.message || "No se pudieron cargar las reservas")}</p>`;
      }
    };

    el.querySelectorAll("[data-res-tab]").forEach((b) => {
      b.onclick = () => {
        cuales = b.getAttribute("data-res-tab");
        el.querySelectorAll("[data-res-tab]").forEach((o) => o.classList.toggle("is-active", o === b));
        caja.innerHTML = `<p class="m-muted">Cargando…</p>`;
        cargar();
      };
    });

    caja.addEventListener("click", async (e) => {
      const cambia = e.target.closest("[data-res-estado]");
      const borra = e.target.closest("[data-res-borrar]");
      if (cambia) {
        const id = Number(cambia.getAttribute("data-id"));
        cambia.disabled = true;
        try {
          await api.post(`/bookings/${id}`, { estado: cambia.getAttribute("data-res-estado") });
          toast("Reserva actualizada");
          await cargar();
        } catch (err) {
          toast(err.message || "No se pudo cambiar");
          cambia.disabled = false;
        }
        return;
      }
      if (borra) {
        const id = Number(borra.getAttribute("data-res-borrar"));
        if (!window.confirm("¿Borrar esta reserva? No se puede deshacer.")) return;
        borra.disabled = true;
        try {
          await api.del(`/bookings/${id}`);
          toast("Reserva borrada");
          await cargar();
        } catch (err) {
          toast(err.message || "No se pudo borrar");
          borra.disabled = false;
        }
      }
    });

    await cargar();
  }

  async function buscar() {
    shell("buscar", `
      <div class="m-top"><h1>Buscar y reemplazar</h1></div>
      <p class="m-muted">Busca un texto por todas las páginas —también dentro de las listas repetidas, en el
      título y en los campos de SEO— y cámbialo donde tú digas. No toca colores, ni medidas, ni ajustes:
      sólo texto y direcciones de enlace. Y nunca cambia la dirección de una página, que rompería los
      enlaces de fuera.</p>

      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <div class="m-busca-campos">
          <label class="m-field">Buscar
            <input type="text" id="bus-q" placeholder="555 12 34 56" autocomplete="off">
          </label>
          <label class="m-field">Reemplazar por
            <input type="text" id="bus-por" placeholder="600 98 76 54" autocomplete="off">
          </label>
        </div>
        <div class="m-kit-grid">
          <label class="m-kit-check"><input type="checkbox" id="bus-sensible">
            <span><strong>Distinguir mayúsculas</strong><small class="m-muted">«Miel» y «miel» dejan de ser lo mismo.</small></span></label>
          <label class="m-kit-check"><input type="checkbox" id="bus-entera">
            <span><strong>Sólo palabras enteras</strong><small class="m-muted">Buscando «miel» no saldría «mielada».</small></span></label>
          <label class="m-kit-check"><input type="checkbox" id="bus-chrome">
            <span><strong>Mirar también la cabecera y el pie</strong><small class="m-muted">Lo que se repite en todas las páginas.</small></span></label>
        </div>
        <div class="m-row" style="margin-top:12px">
          <button class="m-btn" id="bus-ir">Buscar</button>
        </div>
      </div>

      <div id="bus-res" hidden></div>`);

    const q = el.querySelector("#bus-q");
    const campo = (id) => el.querySelector(id).checked;
    const opciones = () => ({
      q: q.value.trim(),
      sensible: campo("#bus-sensible"),
      entera: campo("#bus-entera"),
      chrome: campo("#bus-chrome"),
    });
    let ultimo = null;

    /** Resalta lo encontrado dentro del trozo de contexto. */
    const marcar = (texto, aguja, sensible) => {
      const limpio = esc(texto);
      const objetivo = esc(aguja);
      if (!objetivo) return limpio;
      const re = new RegExp(objetivo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), sensible ? "g" : "gi");
      return limpio.replace(re, (m) => `<mark>${m}</mark>`);
    };

    const pintar = (r) => {
      ultimo = r;
      const caja = el.querySelector("#bus-res");
      caja.hidden = false;
      if (!r.total) {
        caja.innerHTML = `<div class="m-panel" style="padding:16px 20px;margin-top:20px">
          <p class="m-muted">No aparece «${esc(r.consulta)}» en ninguna parte.</p></div>`;
        return;
      }
      const paginas = r.paginas.map((p) => `
        <div class="m-busca-pag">
          <label class="m-kit-check">
            <input type="checkbox" data-bus-pag="${p.id}" checked>
            <span><strong>${esc(p.title)}</strong>
              <small class="m-muted">${esc(plural(p.hallazgos.length, "sitio", "sitios"))} · /${esc(p.slug)}</small></span>
          </label>
          <ul class="m-busca-lista">
            ${p.hallazgos.map((h) => `<li>
              <code>${esc(h.tipo)}${h.campo ? ` · ${esc(h.campo)}` : ""}</code>
              <span>${marcar(h.contexto, r.consulta, campo("#bus-sensible"))}</span>
              ${h.nodeId ? `<a class="m-busca-ir" href="${cfg.admin}?page=krg-builder&id=${p.id}#${esc(h.nodeId)}">Abrir</a>` : ""}
            </li>`).join("")}
          </ul>
        </div>`).join("");
      const chrome = r.chrome.length ? `
        <div class="m-busca-pag">
          <strong>Cabecera y pie</strong>
          <ul class="m-busca-lista">
            ${r.chrome.map((h) => `<li><code>${esc(h.donde)} · ${esc(h.campo)}</code>
              <span>${marcar(h.contexto, r.consulta, campo("#bus-sensible"))}</span></li>`).join("")}
          </ul>
        </div>` : "";
      caja.innerHTML = `
        <div class="m-panel" style="padding:16px 20px;margin-top:20px">
          <h3>${esc(plural(r.total, "sitio", "sitios"))} en ${esc(plural(r.paginas.length, "página", "páginas"))}</h3>
          <p class="m-muted">Desmarca las páginas que no quieras tocar. El cambio se escribe en el borrador:
          cada página queda pendiente de publicar, y en su historial queda la versión de antes por si hay que volver.</p>
          ${paginas}
          ${chrome}
          <div class="m-row" style="margin-top:12px">
            <button class="m-btn" id="bus-cambiar">Reemplazar en lo marcado</button>
          </div>
        </div>
        <div class="m-panel" id="bus-informe" style="padding:16px 20px;margin-top:20px" hidden></div>`;

      caja.querySelector("#bus-cambiar").onclick = async () => {
        const por = el.querySelector("#bus-por").value;
        const marcadas = [...caja.querySelectorAll("[data-bus-pag]")]
          .filter((c) => c.checked).map((c) => Number(c.getAttribute("data-bus-pag")));
        if (!marcadas.length && !campo("#bus-chrome")) {
          toast("No hay nada marcado");
          return;
        }
        const boton = caja.querySelector("#bus-cambiar");
        boton.disabled = true;
        try {
          const inf = await api.post("/search/replace", { ...opciones(), por, paginas: marcadas });
          const caja2 = caja.querySelector("#bus-informe");
          caja2.hidden = false;
          caja2.innerHTML = `
            <h3>Qué se ha cambiado</h3>
            <p>${esc(plural(inf.cambios, "cambio", "cambios"))} en ${esc(plural(inf.paginas, "página", "páginas"))}${
              inf.chrome ? ` y ${esc(plural(inf.chrome, "sitio", "sitios"))} de la cabecera o el pie` : ""}.</p>
            ${inf.detalle.length ? `<ul class="m-muted">${inf.detalle.map((d) =>
              `<li>${esc(d.title)} — ${esc(plural(d.cambios, "cambio", "cambios"))}</li>`).join("")}</ul>` : ""}
            ${(inf.avisos || []).map((a) => `<p class="m-muted">${esc(a)}</p>`).join("")}
            <div class="m-row"><a class="m-btn ghost" href="${cfg.admin}?page=krg-pages">Ver las páginas</a></div>`;
          caja2.scrollIntoView({ behavior: "smooth", block: "nearest" });
          toast("Reemplazado");
        } catch (err) {
          toast(err.message || "No se pudo reemplazar");
        }
        boton.disabled = false;
      };
    };

    const lanzar = async () => {
      const o = opciones();
      if (!o.q) {
        toast("Escribe qué buscar");
        return;
      }
      const boton = el.querySelector("#bus-ir");
      boton.disabled = true;
      try {
        pintar(await api.post("/search", o));
      } catch (err) {
        toast(err.message || "No se pudo buscar");
      }
      boton.disabled = false;
    };
    el.querySelector("#bus-ir").onclick = lanzar;
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") lanzar();
    });
    q.focus();
  }

  async function kit() {
    const pages = await api.get("/pages").catch(() => []);
    const casillas = (prefijo) => KIT_PARTES.map(([id, titulo, nota]) => `
      <label class="m-kit-check">
        <input type="checkbox" data-${prefijo}="${id}" checked>
        <span><strong>${esc(titulo)}</strong><small class="m-muted">${esc(nota)}</small></span>
      </label>`).join("");

    shell("kit", `
      <div class="m-top"><h1>Exportar e importar</h1></div>
      <p class="m-muted">Un paquete es un archivo JSON con el diseño de este sitio. Sirve para montar otro
      sitio con la misma pinta, para pasar una página de pruebas a producción o para guardar una copia
      antes de tocar algo gordo. Las fotos y las fuentes subidas no viajan dentro: se vuelven a elegir allí.</p>

      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Llevarse este sitio</h3>
        <div class="m-kit-grid">${casillas("exp")}</div>
        <label class="m-field" style="margin-top:12px">Qué páginas
          <select id="kit-pag">
            <option value="">Todas (${pages.length})</option>
            ${pages.map((p) => `<option value="${p.id}">Sólo «${esc(p.title)}»</option>`).join("")}
          </select>
        </label>
        <div class="m-row" style="margin-top:12px">
          <button class="m-btn" id="kit-exp">Descargar el paquete</button>
        </div>
      </div>

      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Traer un paquete</h3>
        <p class="m-muted">Primero se mira qué trae, y se importa después. Los enlaces entre páginas se
        reconectan por su dirección: un botón que apuntaba a <code>/contacto</code> en el otro sitio
        acabará en la página <code>contacto</code> de éste.</p>
        <label class="m-btn ghost">Elegir archivo… <input type="file" id="kit-file" accept="application/json" hidden></label>
        <div id="kit-mirar" hidden></div>
      </div>

      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Inspirarse en otra web o en una foto</h3>
        <p class="m-muted">Esto no copia la web de nadie: mide los colores que más ocupan, el tamaño de
        sus títulos y el nombre de sus tipografías, y propone una paleta con esos números. Lo que salga
        es tuyo para retocar. Si la fuente de la referencia no es libre, busca una parecida.</p>
        <div class="m-kit-med">
          <div>
            <h4>Desde otra web</h4>
            <p class="m-muted">Arrastra este botón a la barra de marcadores del navegador. Luego abre la
            web que te gusta, púlsalo, copia lo que salga y pégalo aquí.</p>
            <p><a class="m-btn ghost" id="med-marcador" draggable="true">Medir esta web</a></p>
            <label class="m-field">Lo que ha salido
              <textarea id="med-json" rows="3" placeholder="Pega aquí la medida"></textarea>
            </label>
            <button class="m-btn ghost" id="med-leer">Ver la propuesta</button>
          </div>
          <div>
            <h4>Desde una foto</h4>
            <p class="m-muted">Una foto del producto, del local o de un envase. Se sacan los colores que
            más mandan en la imagen y se ajusta el texto hasta que se lea.</p>
            <label class="m-btn ghost">Elegir una foto… <input type="file" id="med-foto" accept="image/*" hidden></label>
            <p class="m-muted" id="med-foto-nom"></p>
          </div>
        </div>
        <div id="med-prop" hidden></div>
      </div>

      <div class="m-panel" id="kit-informe" style="padding:16px 20px;margin-top:20px" hidden></div>`);

    const leerPartes = (prefijo) => {
      const out = {};
      KIT_PARTES.forEach(([id]) => {
        const c = el.querySelector(`[data-${prefijo}="${id}"]`);
        out[id] = !c || c.checked;
      });
      return out;
    };

    el.querySelector("#kit-exp").onclick = async () => {
      const opts = leerPartes("exp");
      const sola = el.querySelector("#kit-pag").value;
      if (sola) opts.pageIds = [Number(sola)];
      try {
        const pack = await api.post("/kit/export", opts);
        const hoy = new Date().toISOString().slice(0, 10);
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `krg-${hoy}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast("Paquete descargado");
      } catch (err) {
        toast(err.message || "No se pudo exportar");
      }
    };

    let paquete = null;
    el.querySelector("#kit-file").onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const caja = el.querySelector("#kit-mirar");
      try {
        paquete = JSON.parse(await file.text());
      } catch (err) {
        paquete = null;
        caja.hidden = false;
        caja.innerHTML = `<p class="m-form-error">Ese archivo no es un JSON que se pueda leer.</p>`;
        return;
      }
      let resumen;
      try {
        resumen = await api.post("/kit/inspect", { pack: paquete });
      } catch (err) {
        caja.hidden = false;
        caja.innerHTML = `<p class="m-form-error">${esc(err.message || "No parece un paquete de KRG CMS.")}</p>`;
        return;
      }
      const trae = [
        resumen.tokens ? "la paleta" : "",
        resumen.chrome ? "la cabecera y el pie" : "",
        resumen.plantillas ? plural(resumen.plantillas, "plantilla", "plantillas") : "",
        resumen.globales ? plural(resumen.globales, "componente global", "componentes globales") : "",
        resumen.paginas ? plural(resumen.paginas, "página", "páginas") : "",
      ].filter(Boolean);
      caja.hidden = false;
      caja.innerHTML = `
        <h4>Este paquete trae ${esc(trae.join(", ") || "nada que se pueda importar")}</h4>
        <p class="m-muted">Salió de <code>${esc(resumen.origen || "un sitio desconocido")}</code>${
          resumen.fecha ? ` el ${esc(String(resumen.fecha).slice(0, 10))}` : ""}.
          ${resumen.titulos && resumen.titulos.length ? `Páginas: ${esc(resumen.titulos.slice(0, 8).join(", "))}${resumen.titulos.length > 8 ? "…" : ""}.` : ""}
          ${resumen.imagenes ? `Menciona ${esc(plural(resumen.imagenes, "foto", "fotos"))}, que no viajan dentro del archivo.` : ""}</p>
        <div class="m-kit-grid">${casillas("imp")}</div>
        <label class="m-field" style="margin-top:12px">Si una página ya existe aquí con la misma dirección
          <select id="kit-modo">
            <option value="crear">Dejar la mía y crear otra al lado</option>
            <option value="reemplazar">Reemplazar la mía por la del paquete</option>
            <option value="saltar">Saltarla y no tocar nada</option>
          </select>
        </label>
        <div class="m-row" style="margin-top:12px">
          <button class="m-btn" id="kit-imp">Importar</button>
        </div>`;

      caja.querySelector("#kit-imp").onclick = async () => {
        const boton = caja.querySelector("#kit-imp");
        boton.disabled = true;
        const opts = leerPartes("imp");
        opts.modo = caja.querySelector("#kit-modo").value;
        try {
          pintarInforme(await api.post("/kit/import", { pack: paquete, opts }));
          toast("Paquete importado");
        } catch (err) {
          toast(err.message || "No se pudo importar");
        }
        boton.disabled = false;
      };
    };

    /* -----------------------------------------------------------------
     * Inspirarse en otra web o en una foto
     * ----------------------------------------------------------------- */
    const marcador = el.querySelector("#med-marcador");
    if (marcador && window.KrgEstilo) {
      // El href se pone a mano y no por HTML: asi no hay forma de que un
      // saneador del navegador se lleve por delante el `javascript:`.
      marcador.href = window.KrgEstilo.marcador();
      marcador.title = "Arrástralo a la barra de marcadores";
    }

    let propuesta = null;

    function pintarPropuesta(p) {
      propuesta = p;
      const caja = el.querySelector("#med-prop");
      if (!p) {
        caja.hidden = false;
        caja.innerHTML = `<p class="m-form-error">De ahí no se ha podido sacar una paleta.</p>`;
        return;
      }
      const nombres = {
        background: "Fondo", surface: "Superficie", text: "Texto",
        primary: "Primario", border: "Borde",
      };
      const muestras = Object.entries(p.colores).map(([k, v]) => `
        <div class="m-kit-swatch">
          <span style="background:${esc(v)}"></span>
          <strong>${esc(nombres[k] || k)}</strong>
          <code>${esc(String(v).toUpperCase())}</code>
        </div>`).join("");
      caja.hidden = false;
      caja.innerHTML = `
        <h4>Lo que se propone</h4>
        <p class="m-muted">De <code>${esc(p.de || "")}</code>. El texto queda a ${esc(String(p.contraste || "?"))}:1
        sobre el fondo${p.contraste >= 4.5 ? ", que se lee bien" : ", que es poco: cámbialo luego en Identidad y diseño"}.</p>
        <div class="m-kit-swatches">${muestras}</div>
        ${p.tipografias ? `<p>Títulos: <strong>${esc(p.tipografias.heading)}</strong> ·
          Texto: <strong>${esc(p.tipografias.body)}</strong></p>` : ""}
        ${p.escala && p.escala.h1 ? `<p class="m-muted">Sus títulos miden ${esc(String(p.escala.h1))} px (H1)
          y su texto ${esc(String(p.escala.p || "?"))} px.</p>` : ""}
        ${(p.avisos || []).map((a) => `<p class="m-muted">${esc(a)}</p>`).join("")}
        <div class="m-row" style="margin-top:12px">
          <button class="m-btn" id="med-aplicar">Usar esta paleta</button>
          <button class="m-btn ghost" id="med-bajar">Descargar como paquete</button>
        </div>
        <p class="m-muted">«Usar esta paleta» cambia los tokens de este sitio: los colores y, si los hay,
        las tipografías y las medidas. Las páginas no se tocan.</p>`;

      caja.querySelector("#med-aplicar").onclick = async () => {
        const boton = caja.querySelector("#med-aplicar");
        boton.disabled = true;
        try {
          const pack = window.KrgEstilo.aPaquete(propuesta);
          const inf = await api.post("/kit/import", {
            pack,
            opts: { tokens: true, chrome: false, biblioteca: false, paginas: false },
          });
          pintarInforme(inf);
          toast("Paleta puesta");
        } catch (err) {
          toast(err.message || "No se pudo aplicar");
        }
        boton.disabled = false;
      };
      caja.querySelector("#med-bajar").onclick = () => {
        const pack = window.KrgEstilo.aPaquete(propuesta);
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "krg-estilo.json";
        a.click();
        URL.revokeObjectURL(a.href);
        toast("Paquete descargado");
      };
    }

    el.querySelector("#med-leer").onclick = () => {
      const texto = (el.querySelector("#med-json").value || "").trim();
      const caja = el.querySelector("#med-prop");
      if (!texto) {
        caja.hidden = false;
        caja.innerHTML = `<p class="m-form-error">Pega antes lo que te ha dado el marcador.</p>`;
        return;
      }
      let dato;
      try {
        dato = JSON.parse(texto);
      } catch (err) {
        caja.hidden = false;
        caja.innerHTML = `<p class="m-form-error">Eso no es lo que da el marcador: tiene que ser el texto entero, tal cual.</p>`;
        return;
      }
      if (!dato || !dato.colores || !dato.colores.background) {
        caja.hidden = false;
        caja.innerHTML = `<p class="m-form-error">Falta la parte de los colores. Vuelve a medir la web.</p>`;
        return;
      }
      pintarPropuesta(dato);
    };

    el.querySelector("#med-foto").onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      el.querySelector("#med-foto-nom").textContent = file.name;
      const img = new Image();
      img.onload = () => {
        try {
          pintarPropuesta(window.KrgEstilo.desdeFoto(img, { nombre: file.name }));
        } catch (err) {
          pintarPropuesta(null);
        }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        pintarPropuesta(null);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };

    function pintarInforme(inf) {
      const caja = el.querySelector("#kit-informe");
      const p = inf.paginas || {};
      const filas = [
        ["Paleta", inf.tokens === "puestos" ? "puesta" : "sin tocar"],
        ["Cabecera, pie y menús", inf.chrome === "puesto" ? "puestos" : "sin tocar"],
        ["Plantillas", `${inf.plantillas.creadas} nuevas, ${inf.plantillas.actualizadas} actualizadas`],
        ["Componentes globales", `${inf.globales.creados} nuevos, ${inf.globales.actualizados} actualizados`],
        ["Páginas", `${p.creadas || 0} creadas, ${p.reemplazadas || 0} reemplazadas, ${p.saltadas || 0} saltadas${p.fallidas ? `, ${p.fallidas} con error` : ""}`],
        ["Enlaces reconectados", String(inf.enlaces.reconectados || 0)],
      ];
      const perdidos = inf.enlaces["sin destino"] || [];
      caja.hidden = false;
      caja.innerHTML = `
        <h3>Qué ha pasado</h3>
        <div class="m-table"><table><tbody>
          ${filas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}
        </tbody></table></div>
        ${perdidos.length ? `<h4>Enlaces que se han quedado como estaban</h4>
          <ul class="m-muted">${perdidos.slice(0, 20).map((u) => `<li><code>${esc(u)}</code></li>`).join("")}</ul>` : ""}
        ${(inf.avisos || []).map((a) => `<p class="m-muted">${esc(a)}</p>`).join("")}
        <div class="m-row"><a class="m-btn ghost" href="${cfg.admin}?page=krg-pages">Ver las páginas</a></div>`;
      caja.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
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
      <label class="m-field">Modo de diagnóstico <input type="checkbox" id="dbg" ${s.debug?"checked":""}></label>
      <p class="m-muted">Guarda un registro técnico de lo que pasa por dentro. No se enseña nunca a quien visita la web.</p>
      <div class="m-row">
        <button class="m-btn" id="sv">Guardar</button>
        <a class="m-btn ghost" href="${cfg.admin}?page=krg-kit">Exportar e importar</a>
      </div>
      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Caché</h3>
        <p class="m-muted">Si guardas o publicas y la web no muestra el cambio, borra la caché. No se eliminan páginas ni borradores.</p>
        <button class="m-btn" type="button" id="flush-cache">Borrar caché</button>
        <p class="m-muted" id="flush-msg" hidden></p>
      </div>
      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Fotos</h3>
        <p class="m-muted">Las fotos nuevas se preparan solas al subirlas: se les hace una versión en
        WebP y, si el servidor sabe, otra en AVIF. Pesan la mitad o menos y se ven igual; la web sirve
        la que entienda cada navegador y deja la original de respaldo. Las que ya estaban se preparan
        desde aquí.</p>
        <p id="fotos-estado" class="m-muted">Contando…</p>
        <div class="m-row">
          <button class="m-btn" type="button" id="fotos-ir" hidden>Preparar las fotos que ya estaban</button>
        </div>
        <p class="m-muted" id="fotos-parte" hidden></p>
      </div>
      <div class="m-panel" style="padding:16px 20px;margin-top:20px">
        <h3>Permisos</h3>
        <p class="m-muted">Cada petición comprueba el permiso concreto, no sólo que haya alguien dentro. Quien escribe entradas no puede cambiar el diseño.</p>
        <table class="m-table"><thead><tr><th>Rol</th><th>Diseño y plantilla</th><th>Páginas</th><th>Publicar</th><th>Blog</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p class="m-muted">Usuario de prueba autor: <code>autor</code> / <code>autor123</code></p>
      </div>`);
    el.querySelector("#sv").onclick = async () => {
      await api.put("/settings", { debug: el.querySelector("#dbg").checked });
      toast("Guardado");
    };
    /* Las versiones modernas de las fotos, a tandas: el panel sigue
       respondiendo y se ve cuánto queda. */
    const fEstado = el.querySelector("#fotos-estado");
    const fBoton = el.querySelector("#fotos-ir");
    const fParte = el.querySelector("#fotos-parte");
    const peso = (n) => (n >= 1048576
      ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB`
      : `${Math.round(n / 1024)} KB`);

    const contar = async () => {
      try {
        const r = await api.get("/media/formats");
        if (!r.formatos || !r.formatos.length) {
          fEstado.textContent = "Este servidor no sabe escribir ni WebP ni AVIF, así que las fotos se sirven tal cual. "
            + "Es cosa del hospedaje, no del tema.";
          fBoton.hidden = true;
          return null;
        }
        const nombres = r.formatos.map((m) => (m === "image/avif" ? "AVIF" : "WebP")).join(" y ");
        fEstado.textContent = r.pendientes
          ? `${plural(r.fotos, "foto", "fotos")} en la biblioteca, ${r.pendientes} sin preparar. Este servidor sabe hacer ${nombres}.`
          : `Las ${r.fotos} fotos de la biblioteca están preparadas. Este servidor sabe hacer ${nombres}.`;
        fBoton.hidden = !r.pendientes;
        return r;
      } catch (err) {
        fEstado.textContent = "No se ha podido mirar el estado de las fotos.";
        return null;
      }
    };
    contar();

    fBoton.onclick = async () => {
      fBoton.disabled = true;
      fParte.hidden = false;
      let hechas = 0;
      let antes = 0;
      let despues = 0;
      try {
        for (let vuelta = 0; vuelta < 200; vuelta++) {
          const r = await api.post("/media/formats", { cuantas: 8 });
          hechas += r.hechas || 0;
          antes += r.antes || 0;
          despues += r.despues || 0;
          fParte.textContent = r.pendientes
            ? `Preparando… quedan ${plural(r.pendientes, "foto", "fotos")}.`
            : `Listo: ${plural(hechas, "archivo nuevo", "archivos nuevos")}.`;
          if (!r.pendientes) break;
        }
        fParte.textContent = antes
          ? `Listo: ${plural(hechas, "archivo nuevo", "archivos nuevos")}. Lo mismo que antes pesaba ${peso(antes)} ahora pesa ${peso(despues)}.`
          : "No había nada que ganar: las fotos ya estaban todo lo apretadas que podían.";
        toast("Fotos preparadas");
      } catch (err) {
        fParte.textContent = err.message || "Se ha cortado a mitad. Vuelve a pulsar y sigue por donde iba.";
      }
      fBoton.disabled = false;
      contar();
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
    "krg-reservas": reservas,
    "krg-buscar": buscar,
    "krg-kit": kit,
  };
  /* ------------------------------------------------------------------
     El esqueleto de carga.

     Cada pantalla pide sus datos antes de pintar nada, así que entre el
     clic y la pantalla había un hueco en blanco de medio segundo largo
     —más en una instalación con muchas páginas— en el que no se sabía
     si el panel estaba cargando o roto. Esto pinta ya la barra lateral
     (que no depende de ningún dato) y cuatro bloques grises donde va a
     ir el contenido. Lo sustituye el primer `shell()` de verdad.
     ------------------------------------------------------------------ */
  const ACTIVO_DE = {
    krg: view === "onboard" ? "onboard" : "home",
    "krg-pages": view === "templates" ? "templates" : view === "globals" ? "globals" : "pages",
    "krg-blog": "blog", "krg-design": "design", "krg-nav": "nav", "krg-seo": "seo",
    "krg-users": "users", "krg-settings": "settings", "krg-reservas": "reservas",
    "krg-buscar": "buscar", "krg-kit": "kit",
  };
  const esqueleto = () => shell(ACTIVO_DE[pageKey] || "home", `
    <div class="m-skel" aria-hidden="true">
      <div class="m-skel-l is-tit"></div>
      <div class="m-skel-l is-caja"></div>
      <div class="m-skel-l"></div>
      <div class="m-skel-l is-corta"></div>
      <div class="m-skel-l is-caja"></div>
    </div>
    <p class="m-sr-only" role="status">Cargando…</p>`);

  const run = routes[pageKey];
  if (run) {
    esqueleto();
    run().catch((e) => {
      shell("home", `<p class="m-form-error">${esc(e.message)}</p>`);
    });
  }
})();
