/* global window, document */
/**
 * Inspirarse en otra web o en una foto.
 * ---------------------------------------------------------------------
 * Dos caminos que acaban en el mismo sitio: una **propuesta** de paleta
 * y tipografías en el formato de paquete que ya sabe leer la pantalla
 * de «Exportar e importar». Ni se copia HTML ajeno, ni CSS, ni se
 * descarga nada de la web de referencia: lo que sale de aquí son
 * números —seis colores, dos nombres de familia tipográfica, un par de
 * medidas— que es lo que se mira cuando alguien dice «quiero que se
 * parezca a esto».
 *
 *   window.KrgMedidor()   mide la página en la que se ejecuta y
 *                         devuelve el paquete. Se usa como marcador
 *                         del navegador, así que tiene que ser una
 *                         función autosuficiente: nada de fuera.
 *
 *   window.KrgEstilo      lo que usa el panel: la paleta de una foto,
 *                         el empaquetado y los arreglos de contraste.
 *
 * Sobre las tipografías: se propone el **nombre** de la familia que usa
 * la referencia, no su archivo. Si esa fuente no es libre, la decisión
 * de usarla o buscar una parecida es de quien monta el sitio.
 */

/* ===================================================================
 * El marcador. Autosuficiente a propósito: se convierte en texto con
 * `toString()` y se pega en la barra de marcadores del navegador.
 * =================================================================== */
window.KrgMedidor = function () {
  const TOPE = 4000;

  const aRgb = (s) => {
    const m = String(s || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const aHex = (c) => '#' + [c.r, c.g, c.b]
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
    .join('');
  const lum = (c) => {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const sat = (c) => {
    const mx = Math.max(c.r, c.g, c.b);
    const mn = Math.min(c.r, c.g, c.b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };
  const familia = (s) => String(s || '').split(',')[0].replace(/["']/g, '').trim();
  const mayor = (mapa) => {
    let clave = '';
    let top = 0;
    mapa.forEach((v, k) => {
      if (v > top) {
        top = v;
        clave = k;
      }
    });
    return clave;
  };
  const suma = (mapa, clave, cuanto) => {
    if (!clave) return;
    mapa.set(clave, (mapa.get(clave) || 0) + cuanto);
  };
  const mediana = (lista) => {
    if (!lista.length) return 0;
    const l = lista.slice().sort((a, b) => a - b);
    return l[Math.floor(l.length / 2)];
  };

  const fondos = new Map();
  const textos = new Map();
  const bordes = new Map();
  const famTexto = new Map();
  const famTitulo = new Map();
  const radios = new Map();
  const tamanos = { h1: [], h2: [], h3: [], p: [] };
  const rellenos = [];
  const acentos = new Map();

  const nodos = Array.prototype.slice.call(document.body.querySelectorAll('*'), 0, TOPE);
  nodos.forEach((el) => {
    const caja = el.getBoundingClientRect();
    if (caja.width < 2 || caja.height < 2) return;
    const cs = window.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.1) return;
    const area = Math.min(caja.width, 2000) * Math.min(caja.height, 2000);
    const etiqueta = el.tagName.toLowerCase();

    const bg = aRgb(cs.backgroundColor);
    if (bg && bg.a > 0.85) {
      suma(fondos, aHex(bg), area);
      // Un fondo de color vivo en algo pequeño —un botón, un sello— es
      // justo lo que hace de acento.
      if (sat(bg) > 0.25 && area < 120000) suma(acentos, aHex(bg), area);
    }

    const letras = (el.childNodes.length ? Array.prototype.filter
      .call(el.childNodes, (n) => n.nodeType === 3)
      .map((n) => n.textContent.trim().length)
      .reduce((a, b) => a + b, 0) : 0);
    if (letras > 1) {
      const col = aRgb(cs.color);
      if (col && col.a > 0.5) suma(textos, aHex(col), letras);
      suma(famTexto, familia(cs.fontFamily), letras);
      if (/^h[1-3]$/.test(etiqueta)) suma(famTitulo, familia(cs.fontFamily), letras);
      if (etiqueta === 'a') {
        const c = aRgb(cs.color);
        if (c && sat(c) > 0.2) suma(acentos, aHex(c), letras * 40);
      }
    }

    const bw = parseFloat(cs.borderTopWidth) || 0;
    if (bw > 0) {
      const bc = aRgb(cs.borderTopColor);
      if (bc && bc.a > 0.3) suma(bordes, aHex(bc), caja.width);
    }

    const r = parseFloat(cs.borderTopLeftRadius) || 0;
    if ((bg && bg.a > 0.5) || bw > 0) suma(radios, String(Math.round(r)), 1);

    if (/^h[1-3]$/.test(etiqueta)) tamanos[etiqueta].push(parseFloat(cs.fontSize) || 0);
    if (etiqueta === 'p' && letras > 20) tamanos.p.push(parseFloat(cs.fontSize) || 0);

    // El aire de una sección es el de las franjas de primer nivel. Una
    // tarjeta dentro de una franja también es ancha y alta, así que
    // sólo cuentan las que cuelgan directamente del cuerpo o del main.
    const padre = el.parentElement;
    const primerNivel = padre === document.body || (padre && padre.tagName === 'MAIN' && padre.parentElement === document.body);
    if (primerNivel && caja.width > window.innerWidth * 0.8 && caja.height > 200) {
      const pt = parseFloat(cs.paddingTop) || 0;
      if (pt > 8) rellenos.push(pt);
    }
  });

  const lista = (mapa) => Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const porArea = lista(fondos);
  const fondoPagina = aRgb(window.getComputedStyle(document.body).backgroundColor);
  const fondo = (fondoPagina && fondoPagina.a > 0.85 ? aHex(fondoPagina) : porArea[0]) || '#ffffff';
  const superficie = porArea.filter((c) => c !== fondo)[0] || fondo;
  const texto = mayor(textos) || '#000000';
  const borde = mayor(bordes) || superficie;
  const acento = lista(acentos).filter((c) => c !== fondo && c !== texto)[0]
    || porArea.filter((c) => c !== fondo && c !== superficie)[0]
    || texto;

  const avisos = [];
  const hex = (h) => aRgb('rgb(' + [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)).join(',') + ')');
  const contraste = Math.round(ratio(hex(texto), hex(fondo)) * 10) / 10;
  if (contraste < 4.5) {
    avisos.push('El texto de esa web queda a ' + contraste + ':1 sobre su fondo, por debajo del mínimo legible (4.5:1). Revísalo antes de usarlo.');
  }

  const famCuerpo = mayor(famTexto) || 'system-ui';
  const famTit = mayor(famTitulo) || famCuerpo;
  const escala = {
    h1: Math.round(mediana(tamanos.h1)) || 0,
    h2: Math.round(mediana(tamanos.h2)) || 0,
    h3: Math.round(mediana(tamanos.h3)) || 0,
    p: Math.round(mediana(tamanos.p)) || 0,
  };
  const radio = Number(mayor(radios) || 0);
  const seccion = Math.round(mediana(rellenos)) || 0;

  const propuesta = {
    de: location.href,
    medidoEn: new Date().toISOString(),
    colores: {
      background: fondo,
      surface: superficie,
      text: texto,
      primary: acento,
      border: borde,
    },
    tipografias: {
      heading: famTit,
      body: famCuerpo,
    },
    escala,
    radio,
    seccion,
    contraste,
    avisos,
  };

  // Como marcador, además de devolverlo lo enseña: una caja con el JSON
  // listo para copiar, que es lo que se pega luego en el panel.
  if (document.getElementById('krg-medidor')) document.getElementById('krg-medidor').remove();
  const caja = document.createElement('div');
  caja.id = 'krg-medidor';
  caja.setAttribute('style', 'position:fixed;inset:auto 16px 16px auto;z-index:2147483647;width:min(420px,92vw);'
    + 'background:#fff;color:#111;border:1px solid #999;border-radius:12px;padding:14px 16px;'
    + 'font:13px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25)');
  const muestras = Object.keys(propuesta.colores)
    .map((k) => '<span title="' + k + ': ' + propuesta.colores[k] + '" style="display:inline-block;width:28px;height:28px;'
      + 'border-radius:6px;border:1px solid #0002;background:' + propuesta.colores[k] + '"></span>')
    .join(' ');
  caja.innerHTML = '<strong>Medida para KRG CMS</strong>'
    + '<div style="margin:8px 0">' + muestras + '</div>'
    + '<div style="margin:0 0 8px">Títulos: <b>' + famTit + '</b> · Texto: <b>' + famCuerpo + '</b></div>'
    + (avisos.length ? '<div style="margin:0 0 8px;color:#a33">' + avisos[0] + '</div>' : '')
    + '<textarea readonly style="width:100%;height:110px;font:11px/1.4 monospace">'
    + JSON.stringify(propuesta) + '</textarea>'
    + '<div style="margin-top:8px;display:flex;gap:8px">'
    + '<button id="krg-med-copiar" style="padding:6px 10px">Copiar</button>'
    + '<button id="krg-med-cerrar" style="padding:6px 10px">Cerrar</button></div>'
    + '<div style="margin-top:6px;color:#666">Pégalo en KRG CMS → Exportar e importar → «Inspirarse en otra web».</div>';
  document.body.appendChild(caja);
  caja.querySelector('#krg-med-copiar').onclick = function () {
    const ta = caja.querySelector('textarea');
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) { /* si el navegador no deja, queda seleccionado para copiar a mano */ }
  };
  caja.querySelector('#krg-med-cerrar').onclick = function () {
    caja.remove();
  };
  return propuesta;
};

/* ===================================================================
 * Lo que usa el panel
 * =================================================================== */
(() => {
  const aNum = (h) => {
    const s = String(h || '').replace('#', '');
    const t = s.length === 3 ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2] : s;
    return {
      r: parseInt(t.substr(0, 2), 16) || 0,
      g: parseInt(t.substr(2, 2), 16) || 0,
      b: parseInt(t.substr(4, 2), 16) || 0,
    };
  };
  const aHex = (c) => '#' + [c.r, c.g, c.b]
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const lum = (h) => {
    const c = aNum(h);
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  /** La misma fórmula que `Contrast::ratio()` en PHP. */
  const contraste = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const mezclar = (h, hacia, cuanto) => {
    const a = aNum(h);
    const b = aNum(hacia);
    return aHex({
      r: a.r + (b.r - a.r) * cuanto,
      g: a.g + (b.g - a.g) * cuanto,
      b: a.b + (b.b - a.b) * cuanto,
    });
  };

  /**
   * Un color de texto que se lea de verdad sobre ese fondo.
   *
   * No se inventa otro color: se oscurece o se aclara el que había
   * hasta que pasa el mínimo. Si ni así, blanco o negro.
   */
  const legible = (texto, fondo, minimo = 4.5) => {
    if (contraste(texto, fondo) >= minimo) return texto;
    const hacia = lum(fondo) > 0.4 ? '#000000' : '#ffffff';
    for (let i = 1; i <= 10; i++) {
      const prueba = mezclar(texto, hacia, i / 10);
      if (contraste(prueba, fondo) >= minimo) return prueba;
    }
    return hacia;
  };

  /**
   * La paleta de una foto.
   *
   * Se reduce la imagen a un lienzo pequeño, se agrupan los colores en
   * cubos y se eligen cinco: el que más manda como fondo, el más vivo
   * como acento, el más oscuro (o el más claro, según el fondo) como
   * texto. No es magia: es contar píxeles.
   */
  function desdeFoto(fuente, opciones = {}) {
    const lado = opciones.lado || 80;
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(fuente, 0, 0, lado, lado);
    const datos = ctx.getImageData(0, 0, lado, lado).data;

    const cubos = new Map();
    for (let i = 0; i < datos.length; i += 4) {
      if (datos[i + 3] < 128) continue;
      const r = datos[i];
      const g = datos[i + 1];
      const b = datos[i + 2];
      // Cubos de 32: suficiente para agrupar lo que el ojo ve igual.
      const clave = `${r >> 5}|${g >> 5}|${b >> 5}`;
      const c = cubos.get(clave) || { r: 0, g: 0, b: 0, n: 0 };
      c.r += r;
      c.g += g;
      c.b += b;
      c.n += 1;
      cubos.set(clave, c);
    }
    const colores = Array.from(cubos.values())
      .map((c) => ({
        hex: aHex({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }),
        peso: c.n,
      }))
      .sort((a, b) => b.peso - a.peso);
    if (!colores.length) return null;

    const sat = (h) => {
      const c = aNum(h);
      const mx = Math.max(c.r, c.g, c.b);
      const mn = Math.min(c.r, c.g, c.b);
      return mx === 0 ? 0 : (mx - mn) / mx;
    };
    const fondo = colores[0].hex;
    const claro = lum(fondo) > 0.4;
    const resto = colores.slice(1);
    const superficie = resto.length
      ? resto.slice(0, 6).sort((a, b) => Math.abs(lum(a.hex) - lum(fondo)) - Math.abs(lum(b.hex) - lum(fondo)))[0].hex
      : mezclar(fondo, claro ? '#000000' : '#ffffff', 0.06);
    const vivos = resto.slice(0, 12).filter((c) => sat(c.hex) > 0.18);
    const primario = (vivos.length ? vivos.sort((a, b) => sat(b.hex) - sat(a.hex))[0].hex : resto[0] ? resto[0].hex : fondo);
    const extremo = resto.concat([{ hex: claro ? '#111111' : '#f5f5f5', peso: 0 }])
      .sort((a, b) => (claro ? lum(a.hex) - lum(b.hex) : lum(b.hex) - lum(a.hex)))[0].hex;

    const texto = legible(extremo, fondo);
    const avisos = [];
    if (texto !== extremo) {
      avisos.push('El color de texto que salía de la foto no se leía sobre el fondo: se ha ajustado hasta pasar el 4.5:1.');
    }
    return {
      de: opciones.nombre || 'una foto',
      medidoEn: new Date().toISOString(),
      colores: {
        background: fondo,
        surface: superficie,
        text: texto,
        primary: legible(primario, fondo, 3) === primario ? primario : primario,
        border: mezclar(superficie, claro ? '#000000' : '#ffffff', 0.12),
      },
      tipografias: null,
      escala: null,
      radio: null,
      seccion: null,
      contraste: Math.round(contraste(texto, fondo) * 10) / 10,
      avisos,
    };
  }

  /**
   * De una propuesta al paquete que entiende «Exportar e importar».
   *
   * Los cinco colores medidos no bastan: el tema usa una veintena de
   * papeles (secundario, atenuado, borde fuerte, texto sobre
   * primario…). Se derivan de los cinco, mezclando hacia el fondo o
   * hacia el texto, para que la paleta salga entera y coherente en vez
   * de dejar medio tema sin color.
   */
  function aPaquete(propuesta, extra = {}) {
    if (!propuesta || !propuesta.colores) return null;
    const c = propuesta.colores;
    const fondo = c.background;
    const claro = lum(fondo) > 0.4;
    const hacia = claro ? '#000000' : '#ffffff';
    const contra = claro ? '#ffffff' : '#000000';
    const texto = legible(c.text, fondo);
    const primario = c.primary;
    const token = (valor, label) => ({ value: valor, type: 'color', label });

    const color = {
      primary: token(primario, 'Primario'),
      secondary: token(mezclar(primario, hacia, 0.3), 'Secundario'),
      tertiary: token(mezclar(primario, contra, 0.3), 'Terciario'),
      background: token(fondo, 'Fondo'),
      surface: token(c.surface, 'Superficie'),
      'surface-alt': token(mezclar(fondo, contra, 0.5), 'Superficie clara'),
      text: token(texto, 'Texto'),
      'text-secondary': token(legible(mezclar(texto, fondo, 0.25), fondo), 'Texto secundario'),
      muted: token(legible(mezclar(texto, fondo, 0.45), fondo, 4.5), 'Texto atenuado'),
      border: token(c.border, 'Borde'),
      'border-strong': token(texto, 'Borde fuerte'),
      highlight: token(c.surface, 'Destacado'),
      success: token(primario, 'Éxito'),
      info: token(primario, 'Informativo'),
      warning: token(mezclar(primario, contra, 0.25), 'Advertencia'),
      error: token(legible('#a3302a', fondo, 3), 'Error'),
      'on-primary': token(legible(fondo, primario), 'Texto sobre primario'),
      'on-secondary': token(legible(fondo, mezclar(primario, hacia, 0.3)), 'Texto sobre secundario'),
      'on-surface': token(legible(texto, c.surface), 'Texto sobre superficie'),
    };

    const tokens = { color };
    if (propuesta.tipografias) {
      const fam = (n) => ({
        value: `"${n}", system-ui, sans-serif`,
        type: 'fontFamily',
        label: n,
      });
      tokens.font = {
        heading: fam(propuesta.tipografias.heading),
        body: fam(propuesta.tipografias.body),
        special: fam(propuesta.tipografias.heading),
      };
    }
    if (propuesta.seccion) {
      tokens.spacing = { section: { value: `${Math.max(24, Math.min(200, propuesta.seccion))}px` } };
    }
    if (propuesta.radio !== null && propuesta.radio !== undefined) {
      const r = Math.max(0, Math.min(999, propuesta.radio));
      tokens.radius = {
        cards: { value: `${r}px` },
        buttons: { value: `${r}px` },
      };
    }
    return {
      krg: 2,
      exportedAt: new Date().toISOString(),
      origen: { home: propuesta.de || '', nombre: extra.nombre || 'Medida de estilo' },
      tokens: { tokens },
    };
  }

  window.KrgEstilo = {
    contraste,
    legible,
    mezclar,
    desdeFoto,
    aPaquete,
    /** El texto del marcador, hecho con la función de arriba. */
    marcador: () => `javascript:(${window.KrgMedidor.toString()})();void 0;`,
  };
})();
