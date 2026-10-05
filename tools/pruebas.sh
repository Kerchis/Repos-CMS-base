#!/usr/bin/env bash
# Pasa TODAS las pruebas del tema y cuenta lo que ha salido.
#
# Es lo mismo que veníamos haciendo a mano —el lint, los cuatro bancos de
# PHP y los bancos del navegador, uno detrás de otro— pero en un sitio
# solo, con un resumen al final y, sobre todo, devolviendo un número
# distinto de cero cuando algo falla. Eso último es lo que permite que
# GitHub lo ejecute en cada empujón y ponga el aspa roja sin que nadie
# tenga que acordarse de mirar.
#
#   bash tools/devenv.sh && bash tools/pruebas.sh     todo (unos 5 min)
#   bash tools/pruebas.sh v2 panel                    solo esos dos
#   bash tools/pruebas.sh --lista                     qué hay sin ejecutar
#   bash tools/pruebas.sh --rapido                    sin los del navegador
#
# Los bancos del navegador se descubren solos: basta con dejar un
# tools/prueba-ALGO.mjs para que entre en la ronda. No hay lista que
# mantener.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PHP="${PHP_BIN:-$ROOT/.tools/php/php}"
CHR="$ROOT/.tools/chromium"
export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:+$LD_LIBRARY_PATH:}$CHR/lib/lib:$CHR/lib"

# Colores solo si hay terminal delante; en GitHub se ven los símbolos.
if [ -t 1 ]; then
  VERDE=$'\033[32m'; ROJO=$'\033[31m'; GRIS=$'\033[90m'; FIN=$'\033[0m'
else
  VERDE=''; ROJO=''; GRIS=''; FIN=''
fi

solo=()
rapido=0
for arg in "$@"; do
  case "$arg" in
    --rapido|--rápido) rapido=1 ;;
    --lista)
      echo "PHP:"
      echo "  lint"
      for f in tools/prueba-*.php; do echo "  ${f#tools/prueba-}" | sed 's/\.php$//'; done
      echo "Navegador:"
      for f in tools/prueba-*.mjs; do echo "  ${f#tools/prueba-}" | sed 's/\.mjs$//'; done
      exit 0 ;;
    -*) echo "No conozco la opción $arg"; exit 2 ;;
    *) solo+=("$arg") ;;
  esac
done

# ¿Toca correr este banco? Si no se han pedido unos concretos, todos.
quiere() {
  [ "${#solo[@]}" -eq 0 ] && return 0
  local n
  for n in "${solo[@]}"; do [ "$n" = "$1" ] && return 0; done
  return 1
}

[ -x "$PHP" ] || { echo "No encuentro php. Ejecuta antes: bash tools/devenv.sh"; exit 1; }
if [ "$rapido" -eq 0 ] && [ ! -x "$CHR/chromium" ]; then
  echo "No encuentro chromium. Ejecuta antes: bash tools/devenv.sh"; exit 1
fi

REG="$(mktemp)"            # una línea por banco: estado<TAB>nombre<TAB>resumen
trap 'rm -f "$REG"' EXIT
fallos=0
t0=$SECONDS

# Ejecuta un banco, enseña su última línea y apunta el resultado.
#
# La última línea es la del recuento que imprimen todos («LOS HUECOS NO
# DESBORDAN (41 comprobaciones)»), que es justo lo que se quiere ver en
# el resumen. Si revienta antes, se enseña la salida entera, que para
# eso está.
corre() {
  local nombre="$1"; shift
  quiere "$nombre" || return 0
  printf '%-14s ' "$nombre"
  local ini=$SECONDS salida estado
  salida="$("$@" 2>&1)"; estado=$?
  local seg=$((SECONDS - ini))
  local ultima
  ultima="$(printf '%s' "$salida" | grep -v '^[[:space:]]*$' | tail -1)"
  if [ "$estado" -eq 0 ]; then
    printf '%s✓%s %s%s  %ss%s\n' "$VERDE" "$FIN" "$ultima" "$GRIS" "$seg" "$FIN"
    printf 'ok\t%s\t%s\n' "$nombre" "$ultima" >> "$REG"
  else
    printf '%s✗%s salida %s%s  %ss%s\n' "$ROJO" "$FIN" "$estado" "$GRIS" "$seg" "$FIN"
    printf '%s\n' "$salida" | sed 's/^/    /'
    printf 'mal\t%s\tsalida %s\n' "$nombre" "$estado" >> "$REG"
    fallos=$((fallos + 1))
  fi
}

echo "PHP $("$PHP" -r 'echo PHP_VERSION;')"
if [ "$rapido" -eq 0 ]; then
  echo "Chromium $("$CHR/chromium" --version 2>/dev/null | sed 's/Chromium //')"
fi
echo

echo "── Sintaxis y bancos de PHP ─────────────────────────────"
corre lint bash tools/lint-php.sh
for f in tools/prueba-*.php; do
  n="${f#tools/prueba-}"; n="${n%.php}"
  corre "$n" "$PHP" "$f"
done

if [ "$rapido" -eq 0 ]; then
  echo
  echo "── Bancos del navegador ─────────────────────────────────"
  for f in tools/prueba-*.mjs; do
    n="${f#tools/prueba-}"; n="${n%.mjs}"
    corre "$n" node "$f"
  done
fi

total=$(wc -l < "$REG" | tr -d ' ')
bien=$((total - fallos))
mins=$(( (SECONDS - t0) / 60 )); segs=$(( (SECONDS - t0) % 60 ))

echo
echo "─────────────────────────────────────────────────────────"
if [ "$fallos" -eq 0 ]; then
  printf '%s✓ los %s bancos en verde%s (%sm %ss)\n' "$VERDE" "$total" "$FIN" "$mins" "$segs"
else
  printf '%s✗ %s de %s bancos con fallos%s (%sm %ss)\n' "$ROJO" "$fallos" "$total" "$FIN" "$mins" "$segs"
  echo
  grep '^mal' "$REG" | cut -f2,3 | sed 's/^/    /'
fi

# Para que GitHub lo enseñe en el resumen del trabajo sin abrir el registro.
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Pruebas del tema"
    echo
    echo "| | Banco | Resultado |"
    echo "|---|---|---|"
    while IFS=$'\t' read -r estado nombre resumen; do
      [ "$estado" = ok ] && icono='✅' || icono='❌'
      echo "| $icono | \`$nombre\` | $resumen |"
    done < "$REG"
    echo
    if [ "$fallos" -eq 0 ]; then
      echo "**Los $total bancos en verde** en ${mins}m ${segs}s."
    else
      echo "**$fallos de $total bancos con fallos** en ${mins}m ${segs}s."
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

[ "$fallos" -eq 0 ] || exit 1
echo "$bien bancos, ningún fallo."
