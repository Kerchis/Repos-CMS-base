/**
 * KRG CMS — comportamiento de la librería de módulos del sistema visual.
 *
 * Vanilla, sin dependencias, idempotente (se puede re-ejecutar tras un
 * repintado del preview del constructor) y respetuoso con prefers-reduced-motion.
 */
(function () {
  "use strict";

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function each(sel, fn, root) {
    var list = (root || document).querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  }

  function once(el, key) {
    if (el.dataset[key] === "1") return false;
    el.dataset[key] = "1";
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Revelado al entrar en viewport                                     */
  /* ---------------------------------------------------------------- */

  var revealObserver = null;

  function initReveal(root) {
    var targets = (root || document).querySelectorAll("[data-reveal]:not([data-reveal='none']), [data-scroll-text], .m-reveal");
    if (!targets.length) return;

    if (REDUCED || !("IntersectionObserver" in window)) {
      for (var i = 0; i < targets.length; i++) targets[i].classList.add("is-revealed");
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
      );
    }
    for (var j = 0; j < targets.length; j++) {
      if (once(targets[j], "krgReveal")) revealObserver.observe(targets[j]);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Preloader                                                          */
  /* ---------------------------------------------------------------- */

  function initPreloader(root) {
    each(
      "[data-preloader]",
      function (el) {
        if (!once(el, "krgPreloader")) return;
        if (document.body.classList.contains("krg-canvas")) return;

        var duration = parseInt(el.getAttribute("data-duration") || "1600", 10);
        var onlyOnce = el.getAttribute("data-once") === "1";
        var key = "krgPreloaderSeen";

        try {
          if (onlyOnce && window.sessionStorage && sessionStorage.getItem(key)) {
            el.classList.add("is-done");
            return;
          }
        } catch (e) {
          /* sessionStorage bloqueado: seguimos mostrando el loader */
        }

        document.documentElement.style.overflow = "hidden";
        var counter = el.querySelector("[data-pl-count]");
        var bar = el.querySelector("[data-pl-bar]");
        var start = performance.now();

        function tick(now) {
          var pct = Math.min(100, Math.round(((now - start) / duration) * 100));
          if (counter) counter.textContent = pct + "%";
          if (bar) bar.style.width = pct + "%";
          if (pct < 100) {
            requestAnimationFrame(tick);
          } else {
            el.classList.add("is-done");
            document.documentElement.style.overflow = "";
            try {
              if (onlyOnce && window.sessionStorage) sessionStorage.setItem(key, "1");
            } catch (e) {
              /* noop */
            }
          }
        }
        if (REDUCED) {
          el.classList.add("is-done");
          document.documentElement.style.overflow = "";
          return;
        }
        requestAnimationFrame(tick);
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Marquesina: duplica pistas hasta cubrir el viewport                */
  /* ---------------------------------------------------------------- */

  function initMarquee(root) {
    each(
      "[data-marquee]",
      function (el) {
        var track = el.querySelector(".m-mq-track");
        if (!track) return;
        var runs = track.querySelectorAll(".m-mq-run");
        if (!runs.length) return;
        var first = runs[0];

        function fill() {
          // Mantener exactamente dos pistas equivalentes y ensanchar la base
          // hasta superar el ancho del contenedor (bucle sin cortes).
          var needed = el.offsetWidth;
          if (!needed || !first.scrollWidth) return;
          var guard = 0;
          while (first.scrollWidth < needed && guard < 8) {
            var clone = first.cloneNode(true);
            while (clone.firstChild) first.appendChild(clone.firstChild);
            guard++;
          }
          if (runs[1]) runs[1].innerHTML = first.innerHTML;
        }
        fill();
        if (once(el, "krgMarquee")) {
          window.addEventListener("resize", debounce(fill, 200), { passive: true });
        }
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Carril de productos                                                */
  /* ---------------------------------------------------------------- */

  function initRail(root) {
    each(
      "[data-rail]",
      function (el) {
        if (!once(el, "krgRail")) return;
        var track = el.querySelector("[data-rail-track]");
        var prev = el.querySelector("[data-rail-prev]");
        var next = el.querySelector("[data-rail-next]");
        if (!track) return;

        function step() {
          var item = track.querySelector(".m-rail-item");
          return item ? item.offsetWidth + 28 : track.clientWidth * 0.8;
        }
        function sync() {
          if (!prev || !next) return;
          var max = track.scrollWidth - track.clientWidth - 2;
          prev.disabled = track.scrollLeft <= 2;
          next.disabled = track.scrollLeft >= max;
        }
        if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: REDUCED ? "auto" : "smooth" }); });
        if (next) next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: REDUCED ? "auto" : "smooth" }); });
        track.addEventListener("scroll", throttle(sync, 120), { passive: true });
        window.addEventListener("resize", debounce(sync, 200), { passive: true });
        sync();
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Carrusel de reseñas                                                */
  /* ---------------------------------------------------------------- */

  function initReviews(root) {
    each(
      "[data-review-slider]",
      function (el) {
        if (!once(el, "krgReviews")) return;
        var track = el.querySelector("[data-rev-track]");
        if (!track) return;
        var slides = track.querySelectorAll(".m-rev-slide");
        var dots = el.querySelectorAll("[data-rev-dot]");
        var prev = el.querySelector("[data-rev-prev]");
        var next = el.querySelector("[data-rev-next]");
        var autoplay = parseInt(el.getAttribute("data-autoplay") || "0", 10);
        var index = 0;
        var timer = null;

        function perView() {
          if (!slides.length) return 1;
          return Math.max(1, Math.round(track.clientWidth / slides[0].offsetWidth));
        }
        function maxIndex() {
          return Math.max(0, slides.length - perView());
        }
        function go(i) {
          index = Math.min(Math.max(i, 0), maxIndex());
          var offset = slides.length ? index * slides[0].offsetWidth : 0;
          track.style.transform = "translate3d(" + -offset + "px,0,0)";
          for (var d = 0; d < dots.length; d++) dots[d].classList.toggle("is-on", d === index);
          if (prev) prev.disabled = index === 0;
          if (next) next.disabled = index >= maxIndex();
        }
        function play() {
          if (!autoplay || REDUCED) return;
          stop();
          timer = setInterval(function () {
            go(index >= maxIndex() ? 0 : index + 1);
          }, autoplay);
        }
        function stop() {
          if (timer) clearInterval(timer);
          timer = null;
        }

        if (prev) prev.addEventListener("click", function () { go(index - 1); play(); });
        if (next) next.addEventListener("click", function () { go(index + 1); play(); });
        for (var d = 0; d < dots.length; d++) {
          (function (btn, i) {
            btn.addEventListener("click", function () { go(i); play(); });
          })(dots[d], d);
        }
        el.addEventListener("mouseenter", stop);
        el.addEventListener("mouseleave", play);
        el.addEventListener("focusin", stop);
        window.addEventListener("resize", debounce(function () { go(index); }, 200), { passive: true });

        // Swipe táctil
        var startX = null;
        track.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; stop(); }, { passive: true });
        track.addEventListener("touchend", function (e) {
          if (startX === null) return;
          var dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          startX = null;
          play();
        }, { passive: true });

        go(0);
        play();
        initReviewMore(el);
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Reseñas largas: «leer completa» en una ventana                     */
  /* ---------------------------------------------------------------- */

  var revDialog = null;

  // Un solo diálogo compartido por toda la página: se rellena al abrir.
  function reviewDialog() {
    if (revDialog && document.body.contains(revDialog)) return revDialog;
    var d = document.createElement("dialog");
    d.className = "m-rev-dialog krg-root";
    d.setAttribute("aria-label", "Reseña completa");
    d.innerHTML =
      '<div class="m-rev-dialog-inner">' +
      '<button type="button" class="m-rev-dialog-close" data-rev-close aria-label="Cerrar">&#10005;</button>' +
      '<div class="m-rev-dialog-stars"></div>' +
      '<p class="m-rev-dialog-text"></p>' +
      '<p class="m-rev-dialog-meta"></p>' +
      "</div>";
    d.addEventListener("click", function (e) {
      // Clic en el fondo (fuera de la tarjeta) o en la aspa.
      if (e.target === d || (e.target.closest && e.target.closest("[data-rev-close]"))) close();
    });
    d.addEventListener("cancel", function (e) { e.preventDefault(); close(); });

    function close() {
      if (typeof d.close === "function" && d.open) d.close();
      else d.removeAttribute("open");
    }

    document.body.appendChild(d);
    revDialog = d;
    return d;
  }

  function initReviewMore(el) {
    var cards = el.querySelectorAll(".m-rev-card");
    if (!cards.length) return;
    var upper = el.classList.contains("is-upper");

    function sync() {
      each(
        ".m-rev-card",
        function (card) {
          var text = card.querySelector(".m-rev-text");
          var btn = card.querySelector("[data-rev-more]");
          if (!text || !btn) return;
          // Solo se ofrece «leer completa» donde el texto realmente se corta.
          var cut = text.scrollHeight - text.clientHeight > 2;
          btn.hidden = !cut;
        },
        el
      );
    }

    each(
      "[data-rev-more]",
      function (btn) {
        btn.addEventListener("click", function () {
          var card = btn.closest(".m-rev-card");
          if (!card) return;
          var d = reviewDialog();
          var stars = card.querySelector(".m-rev-stars");
          var text = card.querySelector(".m-rev-text");
          var meta = card.querySelector(".m-rev-meta");
          var slotStars = d.querySelector(".m-rev-dialog-stars");
          var slotText = d.querySelector(".m-rev-dialog-text");
          var slotMeta = d.querySelector(".m-rev-dialog-meta");

          slotStars.innerHTML = stars ? stars.outerHTML : "";
          slotText.textContent = text ? text.textContent : "";
          slotMeta.textContent = meta ? meta.textContent : "";
          slotMeta.hidden = !slotMeta.textContent.trim();
          d.classList.toggle("is-upper", upper);
          // El tema de la sección viaja con la ventana para no romper el color.
          d.className = d.className.replace(/\bis-theme-[a-z-]+/g, "").trim();
          var theme = (el.className.match(/is-theme-[a-z-]+/) || [])[0];
          if (theme) d.classList.add(theme);

          d.returnFocus = btn;
          if (typeof d.showModal === "function") d.showModal();
          else d.setAttribute("open", "");
          var close = d.querySelector("[data-rev-close]");
          if (close) close.focus();
        });
      },
      el
    );

    // Al cerrarse, el foco vuelve al enlace que la abrió.
    var d0 = reviewDialog();
    if (!d0.krgCloseBound) {
      d0.krgCloseBound = true;
      d0.addEventListener("close", function () {
        if (d0.returnFocus && document.body.contains(d0.returnFocus)) d0.returnFocus.focus();
      });
    }

    sync();
    // Las fuentes web cambian la altura: se vuelve a medir cuando cargan.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync).catch(function () {});
    window.addEventListener("resize", debounce(sync, 180));
  }

  /* ---------------------------------------------------------------- */
  /* Colección filtrable + cargar más                                   */
  /* ---------------------------------------------------------------- */

  function initFilterCollection(root) {
    each(
      "[data-filter-collection]",
      function (el) {
        if (!once(el, "krgFilter")) return;
        var grid = el.querySelector("[data-fc-grid]");
        if (!grid) return;
        var items = Array.prototype.slice.call(grid.querySelectorAll(".m-fc-item"));
        var chips = el.querySelectorAll("[data-fc-filter]");
        var search = el.querySelector("[data-fc-search]");
        var moreBtn = el.querySelector("[data-fc-more]");
        var moreWrap = el.querySelector(".m-fc-more");
        var empty = el.querySelector("[data-fc-empty]");
        var perPage = parseInt(el.getAttribute("data-per-page") || "8", 10);
        var filter = "*";
        var query = "";
        var shown = perPage;

        function matches(it) {
          var okCat = filter === "*" || it.getAttribute("data-cat") === filter;
          var okTerm = !query || (it.getAttribute("data-term") || "").indexOf(query) !== -1;
          return okCat && okTerm;
        }
        function render() {
          var visible = 0;
          var matched = 0;
          items.forEach(function (it) {
            if (!matches(it)) {
              it.hidden = true;
              return;
            }
            matched++;
            if (visible < shown) {
              it.hidden = false;
              visible++;
            } else {
              it.hidden = true;
            }
          });
          if (empty) empty.hidden = matched !== 0;
          if (moreWrap) moreWrap.hidden = matched <= shown;
        }
        function reset() {
          shown = perPage;
          render();
        }

        for (var c = 0; c < chips.length; c++) {
          (function (chip) {
            chip.addEventListener("click", function () {
              for (var k = 0; k < chips.length; k++) chips[k].classList.remove("is-on");
              chip.classList.add("is-on");
              filter = chip.getAttribute("data-fc-filter") || "*";
              reset();
            });
          })(chips[c]);
        }
        if (search) {
          search.addEventListener("input", debounce(function () {
            query = (search.value || "").trim().toLowerCase();
            reset();
          }, 180));
        }
        if (moreBtn) {
          moreBtn.addEventListener("click", function () {
            shown += perPage;
            render();
          });
        }
        reset();
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Módulo de trazabilidad                                             */
  /* ---------------------------------------------------------------- */

  function initTrace(root) {
    each(
      "[data-trace]",
      function (el) {
        if (!once(el, "krgTrace")) return;
        var form = el.querySelector("[data-trace-form]");
        var input = el.querySelector("[data-trace-input]");
        var error = el.querySelector("[data-trace-error]");
        var expected = (el.getAttribute("data-code") || "").trim().toUpperCase();
        if (!form) return;

        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var value = ((input && input.value) || "").trim().toUpperCase();
          // Sin código configurado, cualquier valor no vacío revela el recorrido.
          var ok = value !== "" && (expected === "" || value === expected);
          if (error) error.hidden = ok;
          el.classList.toggle("is-traced", ok);
          if (ok) {
            var steps = el.querySelector("[data-trace-steps]");
            if (steps && !REDUCED) steps.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Panel partido: carrusel del lado de imagen                         */
  /* ---------------------------------------------------------------- */

  function initSplitPanel(root) {
    each(
      "[data-sp-carousel]",
      function (el) {
        if (!once(el, "krgSplitPanel")) return;
        var track = el.querySelector("[data-sp-track]");
        if (!track) return;
        var slides = track.querySelectorAll(".m-sp-slide");
        if (slides.length < 2) return;
        var dots = el.querySelectorAll("[data-sp-dot]");
        var prev = el.querySelector("[data-sp-prev]");
        var next = el.querySelector("[data-sp-next]");
        var autoplay = parseInt(el.getAttribute("data-autoplay") || "0", 10);
        var index = 0;
        var timer = null;

        function go(i) {
          index = (i + slides.length) % slides.length;
          track.style.transform = "translate3d(" + -index * 100 + "%,0,0)";
          for (var d = 0; d < dots.length; d++) dots[d].classList.toggle("is-on", d === index);
        }
        function play() {
          if (!autoplay || REDUCED) return;
          stop();
          timer = setInterval(function () { go(index + 1); }, autoplay);
        }
        function stop() {
          if (timer) clearInterval(timer);
          timer = null;
        }

        if (prev) prev.addEventListener("click", function () { go(index - 1); play(); });
        if (next) next.addEventListener("click", function () { go(index + 1); play(); });
        for (var d = 0; d < dots.length; d++) {
          (function (btn, i) {
            btn.addEventListener("click", function () { go(i); play(); });
          })(dots[d], d);
        }
        el.addEventListener("mouseenter", stop);
        el.addEventListener("mouseleave", play);
        el.addEventListener("focusin", stop);

        var startX = null;
        track.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; stop(); }, { passive: true });
        track.addEventListener("touchend", function (e) {
          if (startX === null) return;
          var dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          startX = null;
          play();
        }, { passive: true });

        go(0);
        play();
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Header pegajoso: estado "stuck"                                    */
  /* ---------------------------------------------------------------- */

  function initStickyHeader() {
    var header = document.querySelector(".m-site-header");
    if (!header) return;
    // Publica la altura real para las secciones "pantalla menos cabecera".
    var syncHeight = function () {
      document.documentElement.style.setProperty("--m-header-h", header.offsetHeight + "px");
    };
    syncHeight();
    window.addEventListener("resize", debounce(syncHeight, 200), { passive: true });
    if (!header.classList.contains("is-sticky") || !once(header, "krgSticky")) return;
    function onScroll() {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    }
    window.addEventListener("scroll", throttle(onScroll, 100), { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------------- */
  /* Cabecera adaptativa                                                */
  /* La sección que queda bajo la cabecera dicta su color (y su fondo,  */
  /* en modo "full"). Sin listeners por sección: una sola pasada por    */
  /* scroll sobre los candidatos ya recogidos.                          */
  /* ---------------------------------------------------------------- */

  function initAdaptiveHeader() {
    var header = document.querySelector(".m-site-header.is-adaptive");
    if (!header || !once(header, "krgAdaptive")) return;

    var mode = header.getAttribute("data-adaptive") || "text";
    var zones = [];

    function collect() {
      zones = Array.prototype.slice.call(document.querySelectorAll("[data-header-skin]"));
    }

    function apply() {
      if (!zones.length) return;
      // Punto de muestreo: justo debajo del borde inferior de la cabecera.
      var probe = header.getBoundingClientRect().bottom - 1;
      var current = null;
      for (var i = 0; i < zones.length; i++) {
        var r = zones[i].getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) current = zones[i];
      }
      if (!current) {
        header.classList.remove("is-skin-light", "is-skin-dark");
        header.style.removeProperty("--m-hd-bg");
        return;
      }
      var skin = current.getAttribute("data-header-skin");
      header.classList.toggle("is-skin-light", skin === "light");
      header.classList.toggle("is-skin-dark", skin !== "light");

      if (mode === "full") {
        // Busca el primer ancestro/descendiente con fondo real y lo copia.
        var bg = backgroundOf(current);
        if (bg) header.style.setProperty("--m-hd-bg", bg);
        else header.style.removeProperty("--m-hd-bg");
      }
    }

    function backgroundOf(el) {
      var node = el;
      var guard = 0;
      while (node && guard < 4) {
        var c = getComputedStyle(node).backgroundColor;
        if (c && c !== "transparent" && c.indexOf("rgba(0, 0, 0, 0)") === -1) return c;
        node = node.parentElement;
        guard++;
      }
      return "";
    }

    collect();
    apply();
    window.addEventListener("scroll", throttle(apply, 60), { passive: true });
    window.addEventListener("resize", debounce(function () { collect(); apply(); }, 200), { passive: true });
    // Tras cargar imágenes el layout cambia: recalcular una vez.
    window.addEventListener("load", function () { collect(); apply(); });
  }

  /* ---------------------------------------------------------------- */
  /* Pie cortina                                                        */
  /* El pie queda fijo al fondo de la ventana y la pagina se desliza    */
  /* por encima. Al llegar al final del documento el pie queda          */
  /* descubierto entero, de abajo hacia arriba.                         */
  /* ---------------------------------------------------------------- */

  function initCurtainFooter(root) {
    var footer = (root || document).querySelector(".m-site-footer.is-reveal-curtain");
    if (!footer || !once(footer, "krgCurtain")) return;

    var page = document.querySelector(".m-page");
    if (!page || !footer.parentNode) return;

    var body = document.body;
    var spacer = document.querySelector(".m-curtain-spacer");
    if (!spacer) {
      spacer = document.createElement("div");
      spacer.className = "m-curtain-spacer";
      spacer.setAttribute("aria-hidden", "true");
      footer.parentNode.insertBefore(spacer, footer);
    }

    // La pagina necesita un fondo opaco: si no, el pie fijo se veria por
    // los huecos entre secciones durante todo el scroll. Lo pone el CSS
    // (`body.m-curtain-on .m-page`) con el color de fondo del sitio como
    // respaldo. Aqui ya no se lee ningun color calculado: hacerlo
    // dependia del instante de la medida y escribia un valor en linea
    // que luego competia con lo del panel.
    var active = false;

    function measure() {
      // Se mide en flujo normal para no leer el alto del pie ya fijado.
      body.classList.remove("m-curtain-on");
      spacer.style.height = "0px";

      var h = Math.round(footer.getBoundingClientRect().height);
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;

      // Un pie mas alto que la ventana nunca llegaria a descubrirse entero,
      // asi que en ese caso se queda como un pie normal.
      active = h > 0 && vh > 0 && h <= vh * 0.92;

      if (active) {
        body.style.setProperty("--m-footer-h", h + "px");
        spacer.style.height = "";
        body.classList.add("m-curtain-on");
      } else {
        body.style.removeProperty("--m-footer-h");
        spacer.style.height = "0px";
      }
    }

    // Si alguien llega tabulando a un enlace del pie todavia tapado,
    // llevamos el scroll al final para que lo vea de verdad.
    footer.addEventListener("focusin", function () {
      if (!active) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max - (window.scrollY || window.pageYOffset) > 4) {
        window.scrollTo({ top: max, behavior: "smooth" });
      }
    });

    measure();
    window.addEventListener("load", measure);

    var rt;
    function later() {
      clearTimeout(rt);
      rt = setTimeout(measure, 200);
    }
    window.addEventListener("resize", later, { passive: true });

    if ("ResizeObserver" in window) {
      var first = true;
      new ResizeObserver(function () {
        if (first) { first = false; return; }
        later();
      }).observe(footer);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Cortina por seccion                                                */
  /* La seccion marcada se queda quieta mientras la siguiente se        */
  /* desliza por encima y la tapa. Mismo gesto que el pie cortina.      */
  /* ---------------------------------------------------------------- */

  function initCurtainSections(root) {
    var scope = root || document;
    var list = scope.querySelectorAll(".is-curtain");
    if (!list.length) return;

    var items = [];
    Array.prototype.forEach.call(list, function (sec) {
      if (!once(sec, "krgCurtainSec")) return;
      items.push(sec);
      // Todo lo que venga despues debe pasar por delante y ser opaco.
      //
      // Solo se marca con una clase. El color NO se decide aqui.
      //
      // Antes se leia el fondo calculado de cada seccion y, si salia
      // transparente, se le escribia `--m-curtain-bg` en el atributo
      // `style`. Eso convertia a la cortina en un segundo sistema que
      // decidia fondos, con dos consecuencias feas: el valor dependia
      // del instante exacto en que se midiera (y en el constructor se
      // mide cada vez que se repinta el lienzo), y la regla que lo
      // pintaba —`.m-curtain-above[style*="--m-curtain-bg"]`— tenia dos
      // piezas y le ganaba al `.m-n-xxxx{background-color:...}` que
      // escribe el panel. Resultado: elegias un color, se veia un
      // instante y volvia el beige de la pagina.
      //
      // Ahora el fondo de respaldo lo pone el CSS (`.m-curtain-above`)
      // y el del panel le gana siempre, porque el tema vive en
      // `@layer krg` y la hoja del documento no vive en ninguna capa.
      var next = sec.nextElementSibling;
      while (next) {
        next.classList.add("m-curtain-above");
        // Limpieza de versiones anteriores: si quedo escrito a mano, se
        // quita, que si no seguiria pisando lo del panel.
        next.style.removeProperty("--m-curtain-bg");
        next = next.nextElementSibling;
      }
    });
    if (!items.length) return;

    function measure() {
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;
      items.forEach(function (sec) {
        sec.classList.remove("is-curtain-on");
        sec.style.removeProperty("--m-curtain-top");
        var h = sec.getBoundingClientRect().height;
        if (!(h > 0 && vh > 0)) return;
        // Una seccion mas alta que la ventana no cabe fijada desde arriba:
        // se ancla por abajo con un desplazamiento negativo, que es como se
        // resuelve el sticky alto. Asi la cortina funciona a cualquier alto,
        // incluido el panel partido a pantalla completa, que con el relleno
        // de la seccion siempre pasa de 100vh.
        if (h > vh) sec.style.setProperty("--m-curtain-top", Math.round(vh - h) + "px");
        sec.classList.add("is-curtain-on");
      });
    }

    measure();
    window.addEventListener("load", measure);

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(measure, 200);
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- */
  /* Utilidades                                                         */
  /* ---------------------------------------------------------------- */

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function throttle(fn, wait) {
    var last = 0, pending = null;
    return function () {
      var now = Date.now(), args = arguments, ctx = this;
      if (now - last >= wait) {
        last = now;
        fn.apply(ctx, args);
      } else if (!pending) {
        pending = setTimeout(function () {
          pending = null;
          last = Date.now();
          fn.apply(ctx, args);
        }, wait - (now - last));
      }
    };
  }

  /* ---------------------------------------------------------------- */
  /* Carta de restaurante: pestañas de categoría                        */
  /* ---------------------------------------------------------------- */

  function initMenuList(root) {
    each(
      "[data-carta]",
      function (el) {
        if (!once(el, "krgCarta")) return;
        var grid = el.querySelector("[data-carta-grid]");
        if (!grid) return;
        var items = Array.prototype.slice.call(grid.querySelectorAll(".m-carta-item"));
        var tabs = Array.prototype.slice.call(el.querySelectorAll("[data-carta-filter]"));
        var empty = el.querySelector("[data-carta-empty]");
        if (!tabs.length) return;

        function apply(filter) {
          var shown = 0;
          items.forEach(function (it) {
            var ok = filter === "*" || it.getAttribute("data-cat") === filter;
            it.hidden = !ok;
            if (ok) shown++;
          });
          if (empty) empty.hidden = shown !== 0;
        }

        tabs.forEach(function (tab) {
          tab.addEventListener("click", function () {
            tabs.forEach(function (t) {
              var on = t === tab;
              t.classList.toggle("is-on", on);
              t.setAttribute("aria-pressed", on ? "true" : "false");
            });
            apply(tab.getAttribute("data-carta-filter") || "*");
          });
        });

        var start = tabs.filter(function (t) { return t.classList.contains("is-on"); })[0] || tabs[0];
        apply(start.getAttribute("data-carta-filter") || "*");
      },
      root
    );
  }

  /* ---------------------------------------------------------------- */
  /* Arranque                                                           */
  /* ---------------------------------------------------------------- */

  function boot(root) {
    initPreloader(root);
    initReveal(root);
    initMarquee(root);
    initRail(root);
    initReviews(root);
    initFilterCollection(root);
    initMenuList(root);
    initTrace(root);
    initSplitPanel(root);
    initStickyHeader();
    initAdaptiveHeader();
    initCurtainFooter(root);
    initCurtainSections(root);
    reportFit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { boot(document); });
  } else {
    boot(document);
  }

  /* ---------------------------------------------------------------- */
  /* Aviso al constructor: contenido que no cabe en un alto exacto      */
  /* ---------------------------------------------------------------- */

  // Una seccion con alto exacto recorta lo que sobra, asi que el editor
  // tiene que enterarse. Solo se informa dentro del lienzo del CMS.
  function reportFit() {
    if (window.parent === window) return;
    var items = [];
    each(".m-c-section.is-h-exact", function (sec) {
      var id = sec.getAttribute("data-krg-id");
      if (!id) return;
      var have = Math.round(sec.getBoundingClientRect().height);
      var need = sec.scrollHeight;
      if (need > have + 2) items.push({ id: id, have: have, need: need });
    });
    try {
      window.parent.postMessage({ source: "krg", type: "fit", items: items }, "*");
    } catch (e) { /* otro origen: no se avisa */ }
  }

  window.addEventListener("resize", debounce(reportFit, 220));
  window.addEventListener("load", reportFit);

  // El preview del constructor repinta el canvas: permitir re-inicializar.

  window.KrgModules = { boot: boot };
  document.addEventListener("krg:rendered", function (e) {
    boot((e && e.detail && e.detail.root) || document);
  });
})();
