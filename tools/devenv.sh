#!/usr/bin/env bash
# Monta PHP y un navegador en el entorno de trabajo.
#
# Por que existe: el sandbox no trae PHP ni Chromium, no hay root (apt esta
# descartado) y la red solo deja pasar tres origenes: el registry de npm,
# PyPI y GitHub. Las descargas habituales de navegador (storage.googleapis.com
# de Puppeteer, cdn.playwright.dev de Playwright) estan bloqueadas.
#
# Asi que se tira de los dos canales que si responden:
#   PHP       -> binario estatico de NativePHP/php-bin, por la API de GitHub.
#   Chromium  -> binario comprimido dentro del paquete npm @sparticuz/chromium.
#
# El sandbox se reinicia entre turnos, de modo que esto hay que volver a
# ejecutarlo. Tarda menos de un minuto y es idempotente.
#
#   bash tools/devenv.sh          instala lo que falte
#   source tools/devenv.sh        ademas deja php y chromium en el PATH
#
# Nada de esto se versiona: todo cae en .tools/, que esta ignorado.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS="$ROOT/.tools"
PHP_DIR="$TOOLS/php"
CHR_DIR="$TOOLS/chromium"
PHP_VERSION="${PHP_VERSION:-8.3}"

mkdir -p "$TOOLS"

log() { printf '  %s\n' "$*"; }

# --------------------------------------------------------------------------
# PHP
# --------------------------------------------------------------------------
install_php() {
  if [ -x "$PHP_DIR/php" ]; then
    log "php ya estaba: $("$PHP_DIR/php" -r 'echo PHP_VERSION;')"
    return 0
  fi
  command -v gh >/dev/null || { log "falta gh, no puedo bajar php"; return 1; }

  log "bajando php $PHP_VERSION estatico de NativePHP/php-bin..."
  mkdir -p "$PHP_DIR"
  gh api -H "Accept: application/vnd.github.raw" \
    "repos/NativePHP/php-bin/contents/bin/linux/x64/php-$PHP_VERSION.zip" \
    > "$TOOLS/php.zip" || { log "fallo la descarga"; return 1; }

  unzip -oq "$TOOLS/php.zip" -d "$PHP_DIR" || return 1
  rm -f "$TOOLS/php.zip"
  chmod +x "$PHP_DIR/php"
  log "php listo: $("$PHP_DIR/php" -r 'echo PHP_VERSION;')"
}

# --------------------------------------------------------------------------
# Chromium
# --------------------------------------------------------------------------
install_chromium() {
  if [ -x "$CHR_DIR/chromium" ]; then
    log "chromium ya estaba: $(LD_LIBRARY_PATH="$CHR_DIR/lib/lib:$CHR_DIR/lib" "$CHR_DIR/chromium" --version 2>/dev/null)"
    return 0
  fi
  command -v npm >/dev/null || { log "falta npm, no puedo bajar chromium"; return 1; }

  log "bajando chromium del paquete npm @sparticuz/chromium..."
  mkdir -p "$CHR_DIR" "$TOOLS/npm"
  ( cd "$TOOLS/npm" \
    && [ -f package.json ] || echo '{"name":"krg-devenv","private":true}' > package.json )
  ( cd "$TOOLS/npm" && npm install --silent --no-audit --no-fund \
      @sparticuz/chromium playwright-core ) || return 1

  # El binario y sus librerias viajan comprimidos en brotli dentro del paquete.
  node -e '
    const fs = require("fs"), zlib = require("zlib"), cp = require("child_process");
    const src = process.argv[1], out = process.argv[2];
    fs.mkdirSync(out + "/lib", { recursive: true });
    fs.writeFileSync(out + "/chromium", zlib.brotliDecompressSync(fs.readFileSync(src + "/bin/chromium.br")));
    fs.chmodSync(out + "/chromium", 0o755);
    for (const name of ["al2023", "fonts", "swiftshader"]) {
      const tar = src + "/bin/" + name + ".tar.br";
      if (!fs.existsSync(tar)) continue;
      const tmp = out + "/" + name + ".tar";
      fs.writeFileSync(tmp, zlib.brotliDecompressSync(fs.readFileSync(tar)));
      cp.execSync("tar xf " + JSON.stringify(tmp) + " -C " + JSON.stringify(out + "/lib"));
      fs.unlinkSync(tmp);
    }
  ' "$TOOLS/npm/node_modules/@sparticuz/chromium" "$CHR_DIR" || return 1

  log "chromium listo: $(LD_LIBRARY_PATH="$CHR_DIR/lib/lib:$CHR_DIR/lib" "$CHR_DIR/chromium" --version 2>/dev/null)"
}

echo "Preparando el entorno en $TOOLS"
install_php
install_chromium

# Ruta que necesitan tanto el binario suelto como playwright-core.
export CHROMIUM_LD_PATH="$CHR_DIR/lib/lib:$CHR_DIR/lib"
export CHROMIUM_BIN="$CHR_DIR/chromium"
export PATH="$PHP_DIR:$PATH"

cat <<EOF

Listo. Para usarlo en la sesion actual:

  export PATH="$PHP_DIR:\$PATH"
  export LD_LIBRARY_PATH="$CHROMIUM_LD_PATH"
  export CHROMIUM_BIN="$CHROMIUM_BIN"

  php -l krg-cms/core/render/BrandRenders.php
  node tools/shoot.mjs krg-cms/docs/vista-previa.html
EOF
