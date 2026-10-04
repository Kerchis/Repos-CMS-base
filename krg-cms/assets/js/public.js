(() => {
  const animEls = document.querySelectorAll("[data-anim-in], [class*='m-anim-']");
  if (animEls.length) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      animEls.forEach((el) => el.classList.add("is-in"));
    } else {
      const play = (el) => {
        if (el.classList.contains("is-in")) return;
        el.classList.add("is-in");
      };
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            play(e.target);
            io.unobserve(e.target);
          });
        }, { threshold: 0.16, rootMargin: "0px 0px -12% 0px" });
        animEls.forEach((el) => io.observe(el));
      } else {
        const onScroll = () => {
          animEls.forEach((el) => {
            if (el.classList.contains("is-in")) return;
            const r = el.getBoundingClientRect();
            if (r.top < window.innerHeight * 0.88 && r.bottom > 40) play(el);
          });
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
      }
    }
  }

  document.querySelectorAll(".m-nav-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const box = toggle.closest(".m-header-inner, .m-menu") || toggle.parentElement;
      if (!box) return;
      const open = box.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  const fitHeaderNav = () => {
    const nav = document.querySelector(".m-header-nav");
    const list = nav && nav.querySelector(".m-nav-list");
    if (!nav || !list) return;
    const toggle = document.querySelector(".m-nav-toggle");
    const drawerOn = toggle && toggle.offsetParent;
    if (drawerOn) {
      list.style.fontSize = "";
      return;
    }
    list.style.fontSize = "";
    let size = parseFloat(window.getComputedStyle(list).fontSize) || 14;
    const min = 10;
    while (size > min && list.scrollWidth > nav.clientWidth + 2) {
      size -= 0.5;
      list.style.fontSize = size + "px";
    }
  };
  fitHeaderNav();
  window.addEventListener("resize", fitHeaderNav);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeaderNav);

  document.querySelectorAll(".m-tabs").forEach((root) => {
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[role=tab]");
      if (!btn || !root.contains(btn)) return;
      root.querySelectorAll("[role=tab]").forEach((t) => t.setAttribute("aria-selected", t === btn ? "true" : "false"));
      root.querySelectorAll("[role=tabpanel]").forEach((p) => {
        p.hidden = p.id !== btn.getAttribute("aria-controls");
      });
    });
  });

  const headerOffset = () => {
    const h = document.querySelector(".m-site-header.is-sticky, .m-site-header");
    return h ? Math.round(h.getBoundingClientRect().height) + 8 : 8;
  };
  /**
   * Dónde vive una sección en la página.
   *
   * Preguntarle a secas por su posición no vale: una sección con
   * cortina está en `position: sticky` y, mientras está pegada,
   * responde con el sitio en el que está pegada —a la altura de la
   * ventana— y no con el suyo. Por eso, estando abajo, pulsar «Inicio»
   * daba la cuenta de «ya estás ahí» y la página no se movía.
   *
   * Se le quita la pegajosidad a ella y a sus padres el tiempo justo de
   * medir, y se les devuelve antes de que el navegador pinte nada.
   */
  const posicionDe = (el) => {
    const tocados = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (getComputedStyle(n).position === "sticky") {
        tocados.push([n, n.style.position]);
        n.style.position = "static";
      }
    }
    const y = el.getBoundingClientRect().top + window.scrollY;
    tocados.forEach(([n, antes]) => {
      if (antes) n.style.position = antes;
      else n.style.removeProperty("position");
    });
    return y;
  };

  let vigilante = 0;
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    const meta = () => Math.max(0, Math.round(posicionDe(el) - headerOffset()));
    const suave = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top: meta(), behavior: suave });

    // Mientras la página se desliza, lo de alrededor puede cambiar de
    // alto (la cortina, una imagen que termina de cargar) y el destino
    // se mueve. Cuando deja de rodar se comprueba y, si falta, se
    // remata; si la persona toca la rueda, se la deja en paz.
    cancelAnimationFrame(vigilante);
    let quieto = 0;
    let ultimo = -1;
    let remates = 0;
    let vueltas = 0;
    let rendido = false;
    const basta = () => { rendido = true; };
    ["wheel", "touchstart", "keydown"].forEach((ev) => window.addEventListener(ev, basta, { once: true, passive: true }));
    const limpiar = () => {
      ["wheel", "touchstart", "keydown"].forEach((ev) => window.removeEventListener(ev, basta));
    };
    const paso = () => {
      if (rendido || vueltas++ > 240) return limpiar();
      const y = Math.round(window.scrollY);
      quieto = y === ultimo ? quieto + 1 : 0;
      ultimo = y;
      if (quieto >= 4) {
        const falta = Math.abs(y - meta());
        // Abajo del todo no se puede bajar más: eso no es un fallo.
        const tope = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        if (falta > 2 && y < tope && remates++ < 2) {
          window.scrollTo({ top: meta(), behavior: suave });
          quieto = 0;
        } else {
          return limpiar();
        }
      }
      vigilante = requestAnimationFrame(paso);
    };
    vigilante = requestAnimationFrame(paso);
    return true;
  };
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href*="#"]');
    if (link && !link.classList.contains("js-krg-lightbox")) {
      const href = link.getAttribute("href") || "";
      let hash = "";
      try {
        const u = new URL(href, window.location.href);
        if (u.pathname.replace(/\/$/, "") === window.location.pathname.replace(/\/$/, "") || href.startsWith("#")) {
          hash = u.hash.replace(/^#/, "");
        }
      } catch (err) {
        if (href.startsWith("#")) hash = href.slice(1);
      }
      if (hash && scrollToId(hash)) {
        e.preventDefault();
        history.pushState(null, "", "#" + hash);
        document.querySelectorAll(".m-header-inner.is-open, .m-menu.is-open").forEach((el) => el.classList.remove("is-open"));
        document.querySelectorAll(".m-nav-toggle").forEach((t) => t.setAttribute("aria-expanded", "false"));
        return;
      }
    }
    const a = e.target.closest("a.js-krg-lightbox");
    if (!a) return;
    e.preventDefault();
    const ov = document.createElement("div");
    ov.className = "m-lightbox";
    ov.setAttribute("role", "dialog");
    ov.innerHTML = `<button type="button" class="m-lightbox-x" aria-label="Cerrar">×</button><img src="${a.href}" alt="">`;
    const close = () => ov.remove();
    ov.addEventListener("click", close);
    document.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    });
    document.body.appendChild(ov);
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
  const pxBoxes = Array.from(document.querySelectorAll(".m-figure.is-parallax, .m-gallery.is-parallax, .m-sc.is-parallax"));
  const pxActive = new Set();
  let pxTick = false;
  const pxImgs = (box) => {
    // El CTA display tiene tambien iconos y no se pueden mover: solo la
    // foto de fondo.
    if (box.classList.contains("m-sc")) return box.querySelectorAll(".m-sc-bg");
    if (box.classList.contains("m-gallery")) {
      if (box.classList.contains("is-grid")) return box.querySelectorAll("img");
      return box.querySelectorAll(".m-gallery-slide.is-on img");
    }
    return box.querySelectorAll("img");
  };
  const runParallax = () => {
    pxTick = false;
    if (reduceMotion || !pxActive.size) return;
    const vh = window.innerHeight || 1;
    pxActive.forEach((box) => {
      // Si la foto cubre la seccion entera, el recorrido se mide contra
      // la seccion y no contra el bloque: es la caja que se ve.
      const frame = box.querySelector(".m-gallery-viewport")
        || (box.classList.contains("is-bg-section") ? (box.closest(".m-c-section") || box) : box);
      const r = frame.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const p = (r.top + r.height * 0.5 - vh * 0.5) / vh;
      const zoomN = Number(box.getAttribute("data-parallax-zoom"));
      const amtN = Number(box.getAttribute("data-parallax-amount"));
      const dirN = Number(box.getAttribute("data-parallax-dir"));
      let zoom = 1 + (Number.isFinite(zoomN) ? zoomN : 8) / 100;
      let frac = (Number.isFinite(amtN) ? amtN : 10) / 100;
      if (coarse) {
        zoom = 1 + (zoom - 1) * 0.45;
        frac *= 0.4;
      }
      const dir = dirN === -1 ? -1 : 1;
      const y = -p * r.height * frac * dir;
      const t = "translate3d(0," + y + "px,0) scale(" + zoom + ")";
      pxImgs(box).forEach((img) => { img.style.transform = t; });
    });
  };
  const onParallax = () => {
    if (!pxTick) {
      pxTick = true;
      requestAnimationFrame(runParallax);
    }
  };
  window.KrgParallax = { ping: onParallax };
  if (!reduceMotion && pxBoxes.length) {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting) {
            pxActive.add(e.target);
            pxImgs(e.target).forEach((img) => { img.style.willChange = "transform"; });
          } else {
            pxActive.delete(e.target);
            pxImgs(e.target).forEach((img) => { img.style.willChange = "auto"; });
          }
        });
        onParallax();
      }, { rootMargin: "15% 0px", threshold: 0 });
      pxBoxes.forEach((b) => io.observe(b));
    } else {
      pxBoxes.forEach((b) => pxActive.add(b));
    }
    onParallax();
    window.addEventListener("scroll", onParallax, { passive: true });
    window.addEventListener("resize", onParallax, { passive: true });
    window.addEventListener("orientationchange", onParallax, { passive: true });
    document.addEventListener("load", onParallax, true);
  }

  if (window.location.hash.length > 1) {
    const id = decodeURIComponent(window.location.hash.slice(1));
    window.setTimeout(() => scrollToId(id), 60);
  }

  document.querySelectorAll("[data-video]").forEach((box) => {
    const vid = box.querySelector("video");
    const iframe = box.querySelector("iframe");
    const muteBtn = box.querySelector("[data-video-mute]");
    const slider = box.querySelector("[data-video-vol]");
    const savedVol = Math.max(0, Math.min(100, Number(box.getAttribute("data-volume") || 0)));
    const startVol = (savedVol > 0 ? savedVol : 70) / 100;
    const auto = box.getAttribute("data-autoplay") === "1" || (vid && vid.hasAttribute("autoplay"));
    box.classList.add("is-muted");

    const setMuted = (muted) => {
      box.classList.toggle("is-muted", muted);
      muteBtn?.setAttribute("aria-pressed", muted ? "true" : "false");
      muteBtn?.setAttribute("aria-label", muted ? "Activar sonido" : "Silenciar");
      if (vid) {
        vid.muted = muted;
        if (!muted) vid.volume = Math.max(0.05, Number(slider?.value || savedVol || 70) / 100);
      }
      if (iframe && iframe.src) {
        try {
          const u = new URL(iframe.src, window.location.href);
          if (u.hostname.includes("youtube")) {
            u.searchParams.set("mute", muted ? "1" : "0");
            iframe.src = u.toString();
          } else if (u.hostname.includes("vimeo")) {
            u.searchParams.set("muted", muted ? "1" : "0");
            iframe.src = u.toString();
          }
        } catch (e) { /* */ }
      }
    };

    const tryPlay = () => {
      if (!vid) return;
      vid.muted = true;
      const p = vid.play();
      if (p && p.catch) p.catch(() => { vid.muted = true; vid.play().catch(() => {}); });
    };

    if (vid) {
      vid.controls = false;
      vid.playsInline = true;
      vid.setAttribute("webkit-playsinline", "true");
      vid.removeAttribute("controls");
      vid.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback");
      vid.setAttribute("disablepictureinpicture", "");
      vid.muted = true;
      vid.volume = startVol;
      if (slider) slider.value = String(Math.round(startVol * 100));
      if (auto) {
        tryPlay();
        const kick = () => { if (vid.paused) tryPlay(); };
        document.addEventListener("pointerdown", kick, { once: true, passive: true });
        document.addEventListener("touchstart", kick, { once: true, passive: true });
        document.addEventListener("scroll", kick, { once: true, passive: true });
        if ("IntersectionObserver" in window) {
          const io = new IntersectionObserver((ents) => {
            ents.forEach((e) => { if (e.isIntersecting) tryPlay(); });
          }, { threshold: 0.2 });
          io.observe(vid);
        }
      }
      box.addEventListener("click", (e) => {
        if (e.target.closest("[data-video-ui]")) return;
        if (vid.paused) tryPlay();
        else vid.pause();
      });
      vid.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    box.querySelector("[data-video-ui]")?.addEventListener("click", (e) => e.stopPropagation());
    muteBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMuted(!box.classList.contains("is-muted") ? true : false);
      if (vid && vid.paused && auto) tryPlay();
    });
    slider?.addEventListener("input", (e) => {
      e.stopPropagation();
      const v = Math.max(0, Math.min(100, Number(slider.value))) / 100;
      if (vid) {
        vid.volume = v;
        if (v === 0) setMuted(true);
        else if (vid.muted) setMuted(false);
      }
    });
    box.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  const galleries = [];
  document.querySelectorAll("[data-gallery]").forEach((root) => {
    const slides = Array.from(root.querySelectorAll(".m-gallery-slide"));
    const dots = Array.from(root.querySelectorAll(".m-gallery-dot"));
    if (!slides.length) return;
    let i = Math.max(0, slides.findIndex((s) => s.classList.contains("is-on")));
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, j) => s.classList.toggle("is-on", j === i));
      dots.forEach((d, j) => d.classList.toggle("is-on", j === i));
      window.KrgParallax?.ping();
    };
    const api = { root, go: (n) => go(n), get i() { return i; }, keys: () => root.getAttribute("data-keys") !== "0" };
    galleries.push(api);
    root.querySelector(".m-gallery-prev")?.addEventListener("click", (e) => { e.preventDefault(); go(i - 1); });
    root.querySelector(".m-gallery-next")?.addEventListener("click", (e) => { e.preventDefault(); go(i + 1); });
    dots.forEach((d) => d.addEventListener("click", () => go(Number(d.getAttribute("data-i") || 0))));
    const vp = root.querySelector(".m-gallery-viewport") || root;
    let sx = 0, sy = 0, swiping = false;
    const startSwipe = (x, y) => { swiping = true; sx = x; sy = y; };
    const endSwipe = (x, y) => {
      if (!swiping) return;
      swiping = false;
      const dx = x - sx;
      const dy = y - sy;
      if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      go(dx < 0 ? i + 1 : i - 1);
    };
    vp.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startSwipe(e.clientX, e.clientY);
    }, { passive: true });
    vp.addEventListener("pointerup", (e) => endSwipe(e.clientX, e.clientY), { passive: true });
    vp.addEventListener("pointercancel", () => { swiping = false; }, { passive: true });
    vp.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      if (t) startSwipe(t.clientX, t.clientY);
    }, { passive: true });
    vp.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      if (t) endSwipe(t.clientX, t.clientY);
    }, { passive: true });
    const ms = Number(root.getAttribute("data-autoplay") || 0);
    if (ms > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInterval(() => go(i + 1), ms);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const ae = document.activeElement;
    const tag = (ae && ae.tagName) || "";
    if (ae && (ae.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(tag))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const vh = window.innerHeight || 1;
    let best = null;
    let score = 0;
    galleries.forEach((g) => {
      if (!g.keys()) return;
      const r = g.root.getBoundingClientRect();
      const vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (vis > score) {
        score = vis;
        best = g;
      }
    });
    if (!best || score < 24) return;
    e.preventDefault();
    best.go(e.key === "ArrowLeft" ? best.i - 1 : best.i + 1);
  });

  document.querySelectorAll(".js-krg-form, .js-meridian-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector(".m-form-msg");
      const btn = form.querySelector("[type=submit]");
      const fd = new FormData(form);
      fd.append("action", "krg_contact");
      if (btn) btn.disabled = true;
      try {
        const res = await fetch(window.KrgPublic.ajax, { method: "POST", body: fd, credentials: "same-origin" });
        const json = await res.json();
        if (!json.success) throw new Error(json.data?.message || window.KrgPublic.i18n.error);
        if (msg) {
          msg.hidden = false;
          msg.textContent = json.data?.message || msg.dataset.success || window.KrgPublic.i18n.sent;
          msg.classList.remove("m-form-error");
        }
        form.reset();
      } catch (err) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = err.message || window.KrgPublic.i18n.error;
          msg.classList.add("m-form-error");
        }
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  });
})();
