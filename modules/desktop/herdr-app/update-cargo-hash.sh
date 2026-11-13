#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
file=modules/desktop/herdr-app/default.nix
deps=.#herdr-app.cargoDeps

if log=$(nix build --no-link --no-update-lock-file "$deps" 2>&1); then
  exit 0
fi
old=$(grep -oP 'hash = "\Ksha256-[^"]+' "$file")
new=$(grep -oP '^\s*got:\s+\Ksha256-\S+' <<<"$log") || {
  printf '%s\n' "$log" >&2
  exit 1
}
sed -i "s|$old|$new|" "$file"
nix build --no-link --no-update-lock-file "$deps"
echo "Updated Herdr cargo vendor hash: $old -> $new"
