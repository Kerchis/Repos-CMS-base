#!/usr/bin/env python3
"""
Genera una pagina de verificacion del sistema visual.

Reproduce el marcado que emite BrandRenders para poder revisar los bloques
sin levantar WordPress. Escribe dos cosas:

  krg-cms/docs/vista-previa.html   un unico archivo con el CSS y el JS
                                   incrustados: se abre con doble clic y
                                   funciona sin servidor ni internet.
  .preview/                        la misma pagina con los assets sueltos,
                                   para servirla con un servidor estatico.

Uso:  python3 tools/preview.py
"""
import json, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
THEME = ROOT / 'krg-cms'
SERVE = ROOT / '.preview'
STANDALONE = THEME / 'docs' / 'vista-previa.html'

CSS = ['base.css', 'components.css', 'modules.css']
JS = ['public.js', 'modules.js']


def tokens_css() -> str:
    t = json.loads((THEME / 'presets/honeycomb.json').read_text(encoding='utf-8'))['tokens']
    out = []
    for group, prefix in (('color', 'color'), ('font', 'font'), ('spacing', 'spacing')):
        for k, v in t.get(group, {}).items():
            out.append(f"--{prefix}-{k}:{v['value'] if isinstance(v, dict) else v}")
    out.append('--page-max-width:1360px')
    return ':root,.krg-root{' + ';'.join(out) + ';}'


PH = ('<span class="qa-ph">FOTOGRAFIA</span>')


def title(text, cls):
    lines = ''.join(f'<span class="m-line">{l}</span>' for l in text.split('\n'))
    return f'<h2 class="{cls} is-reveal-fade" data-reveal="fade">{lines}</h2>'


def split_panel(p):
    side = p.get('mediaSide', 'right')
    style = ''
    height = p.get('height', 'screen')
    if height == 'custom':
        style = f' style="--m-sp-h:{p.get("heightValue", 70)}{p.get("heightUnit", "svh")}"'
    copy = (f'<div class="m-sp-copy is-theme-{p.get("theme","cream")} is-align-{p.get("align","center")}">'
            '<div class="m-sp-copy-inner">'
            + (f'<p class="m-eyebrow">{p["eyebrow"]}</p>' if p.get('eyebrow') else '')
            + title(p['title'], 'm-sp-title m-track-normal')
            + (f'<p class="m-sp-sub m-track-wide">{p["sub"]}</p>' if p.get('sub') else '')
            + '<div class="m-btn-row"><a class="m-btn m-btn-primary m-sp-btn" href="#">'
              'VER MAS<span class="m-btn-arrow" aria-hidden="true">&#8594;</span></a></div>'
            '</div></div>')
    media = (f'<div class="m-sp-media is-theme-{p.get("mediaTheme","surface")} is-fit-cover">'
             f'<ul class="m-sp-track" data-sp-track><li class="m-sp-slide">{PH}</li></ul></div>')
    inner = (media + copy) if side == 'left' else (copy + media)
    return (f'<div class="m-sp is-media-{side} is-ratio-{p.get("ratio","half")} '
            f'is-h-{height}"{style}><div class="m-sp-grid">{inner}</div></div>')


def wordmark(text):
    return (f'<div class="m-wm is-fit-fill is-size-display is-align-center is-shadow-offset '
            f'is-theme-cream" style="--m-wm-len:{len(text)};--m-wm-x:6px;--m-wm-y:6px;'
            '--m-wm-shadow:#7FB3C8;"><div class="m-container m-wm-inner">'
            f'<p class="m-wm-text m-track-wide">{text}</p></div></div>')


def gmap(h='360px'):
    return (f'<div class="m-map" style="--m-map-h:{h}"><iframe title="Mapa" loading="lazy" '
            'src="https://maps.google.com/maps?output=embed&amp;q=Chia,Cundinamarca"></iframe></div>')


def section(inner, skin='dark', curtain=False, width='full', mh=None):
    """Reproduce fila + columna, que es como queda una seccion hecha a mano."""
    legacy = 'is-boxed' if width == 'boxed' else 'is-full'
    cls = f'm-c-section {legacy} is-w-{width}' + (' is-curtain' if curtain else '')
    style = ''
    if mh:
        cls += ' is-mh-custom is-va-center'
        style = f' style="--m-sec-h:{mh}"'
    return (f'<section class="{cls}"{style} data-header-skin="{skin}">'
            f'<div class="m-container"><div class="m-c-row"><div class="m-c-column">'
            f'{inner}</div></div></div></section>')


BLOCKS = [
    ('Panel partido · imagen derecha', section(split_panel({
        'title': 'PLANTAS | CAFE |\nGASTRONOMIA', 'eyebrow': 'DESDE 1920',
        'sub': 'SABOR QUE PUEDES RASTREAR.'}))),
    ('Panel partido · imagen izquierda', section(split_panel({
        'title': 'EL MISMO BLOQUE,\nDADO LA VUELTA', 'eyebrow': 'LADO DE LA IMAGEN',
        'sub': 'SOLO CAMBIA UN SELECTOR.', 'mediaSide': 'left', 'theme': 'forest'}), skin='light')),
    ('Panel partido · altura 420 px', section(split_panel({
        'title': 'ALTURA EN PIXELES', 'eyebrow': 'A MEDIDA',
        'sub': '420 PX EXACTOS.', 'height': 'custom', 'heightValue': 420, 'heightUnit': 'px'}))),
    ('Panel partido · altura 45 %', section(split_panel({
        'title': 'ALTURA EN PORCENTAJE', 'eyebrow': 'A MEDIDA',
        'sub': '45 % DE LA PANTALLA.', 'height': 'custom', 'heightValue': 45,
        'heightUnit': 'svh', 'mediaSide': 'left', 'theme': 'surface'}))),
    ('Seccion con cortina', section(
        '<div class="qa-pad">' + title('ESTA SECCION SE QUEDA QUIETA', 'm-sp-title m-track-normal')
        + '<p class="m-sp-sub m-track-wide">La siguiente se desliza por encima.</p></div>',
        curtain=True)),
    ('Seccion que la tapa', section(
        '<div class="qa-pad qa-dark">' + title('Y ESTA LA CUBRE', 'm-sp-title m-track-normal')
        + '</div>', skin='light')),
    ('Logotipo tipografico', section(wordmark('MIEL HONESTA'))),
    ('Mapa borde a borde · 420 px', section(gmap('420px'), width='full')),
    ('Mapa borde a borde · 60 % pantalla', section(gmap('60svh'), width='full')),
    ('Mapa con margen lateral', section(gmap('300px'), width='padded')),
    ('Seccion centrada y limitada', section(
        '<div class="qa-pad">' + title('CENTRADO Y LIMITADO', 'm-sp-title m-track-normal')
        + '</div>', width='boxed')),
    ('Alto de seccion · 35 % pantalla', section(
        '<div class="qa-dark qa-pad0">' + title('ALTO AL 35 %', 'm-sp-title m-track-normal')
        + '</div>', skin='light', mh='35svh')),
    ('Alto de seccion · 260 px', section(
        '<div class="qa-pad0">' + title('ALTO DE 260 PX', 'm-sp-title m-track-normal')
        + '</div>', mh='260px')),
]

EXTRA = """
 body{background:var(--color-background);color:var(--color-text);font-family:var(--font-body);margin:0}
 .m-site-header.is-transparent{position:fixed;top:0;left:0;right:0;z-index:950}
 .m-site-header .m-header-inner{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-block:16px}
 .m-site-header .m-nav-list{display:flex;gap:26px;list-style:none;margin:0;padding:0}
 .m-site-header .m-nav-list a{text-decoration:none;font:700 11px/1 var(--font-heading);letter-spacing:.14em;text-transform:uppercase}
 .m-site-header .m-logo-text{font:800 18px/1 var(--font-heading);letter-spacing:.12em}
 .qa-ph{display:grid;place-items:center;width:100%;height:100%;font:600 12px/1 var(--font-body);
   letter-spacing:.14em;color:#6d6459;background:repeating-linear-gradient(45deg,#e8d9bb 0 14px,#f2e6cc 14px 28px)}
 .qa-pad{text-align:center;padding:12vh 0}
 .qa-pad0{text-align:center;width:100%;padding:24px}
 .qa-dark{background:var(--color-primary);color:var(--color-background)}
 .qa-nav{position:fixed;top:50%;right:0;transform:translateY(-50%);width:168px;max-height:86vh;
   overflow-y:auto;z-index:900;display:flex;flex-direction:column;gap:3px;background:var(--color-primary);padding:6px}
 .qa-nav a{color:var(--color-background);text-decoration:none;font:600 10px/1.3 var(--font-body);padding:6px 8px}
 .qa-nav a:hover{background:var(--color-background);color:var(--color-primary)}
 .m-site-footer{background:#FBC75B;color:#3B2A1E;padding:22px 0 18px}
 .qa-foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;
   font:700 10px/1.6 var(--font-heading);letter-spacing:.14em}
"""


def build(inline: bool) -> str:
    nav = ''.join(f'<a href="#b{i}">{n}</a>' for i, (n, _) in enumerate(BLOCKS))
    body = ''.join(f'<a id="b{i}"></a>{h}' for i, (n, h) in enumerate(BLOCKS))
    if inline:
        head = '<style>' + '\n'.join(
            (THEME / 'assets/css' / n).read_text(encoding='utf-8') for n in CSS) + '</style>'
        tail = '<script>' + '\n'.join(
            (THEME / 'assets/js' / n).read_text(encoding='utf-8') for n in JS) + '</script>'
    else:
        head = ''.join(f'<link rel="stylesheet" href="/css/{n}">' for n in CSS)
        tail = ''.join(f'<script src="/js/{n}"></script>' for n in JS)
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KRG CMS — vista previa del sistema visual</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800;900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>{tokens_css()}</style>
{head}
<style>{EXTRA}</style></head>
<body class="krg-root">
<header class="m-site-header is-sticky is-transparent is-adaptive" data-adaptive="full" data-nav-d="bar">
  <div class="m-header-inner m-container"><strong class="m-logo-text">MARCA</strong>
  <nav class="m-header-nav"><ul class="m-nav-list"><li><a href="#b0">Portada</a></li>
  <li><a href="#b4">Cortina</a></li><li><a href="#b6">Logotipo</a></li></ul></nav>
  <a class="m-btn m-btn-primary" href="#b6">CONTACTO</a></div>
</header>
<nav class="qa-nav">{nav}</nav>
<div class="m-page" id="contenido"><main>{body}</main></div>
<footer class="m-site-footer is-reveal-curtain" data-header-skin="dark">
  <div class="m-container qa-foot"><span>PRIVACIDAD</span><span>TERMINOS</span></div>
  {wordmark('MIEL HONESTA')}
  <div class="m-container qa-foot"><span>&copy; 2026 MIEL HONESTA</span></div>
</footer>
{tail}
</body></html>"""


STANDALONE.parent.mkdir(parents=True, exist_ok=True)
STANDALONE.write_text(build(True), encoding='utf-8')
print('escrito', STANDALONE.relative_to(ROOT), len(STANDALONE.read_text(encoding='utf-8')), 'bytes')

for sub in ('css', 'js'):
    (SERVE / sub).mkdir(parents=True, exist_ok=True)
for n in CSS:
    shutil.copy(THEME / 'assets/css' / n, SERVE / 'css' / n)
for n in JS:
    shutil.copy(THEME / 'assets/js' / n, SERVE / 'js' / n)
(SERVE / 'index.html').write_text(build(False), encoding='utf-8')
print('escrito', SERVE.relative_to(ROOT) / 'index.html')
