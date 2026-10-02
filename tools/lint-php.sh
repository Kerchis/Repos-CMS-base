#!/usr/bin/env bash
# Comprueba la sintaxis de todo el PHP del tema con el interprete de verdad.
# Sustituye al contador de llaves que veniamos usando a falta de PHP.
#
#   bash tools/devenv.sh && bash tools/lint-php.sh

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP="${PHP_BIN:-$ROOT/.tools/php/php}"

[ -x "$PHP" ] || { echo "No encuentro php. Ejecuta antes: bash tools/devenv.sh"; exit 1; }

fail=0
count=0
while IFS= read -r f; do
  count=$((count + 1))
  if ! out="$("$PHP" -l "$f" 2>&1)"; then
    echo "✗ $f"
    echo "$out" | sed 's/^/    /'
    fail=$((fail + 1))
  fi
done < <(find "$ROOT/krg-cms" -name '*.php' -not -path '*/vendor/*' | sort)

echo
if [ "$fail" -eq 0 ]; then
  echo "✓ $count archivos PHP, sin errores de sintaxis"
else
  echo "✗ $fail de $count archivos con errores"
fi
exit "$fail"
