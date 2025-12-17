#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")

llm_plugins=(
    llm-anthropic
    llm-cmd
    llm-fragments-github
    llm-fragments-reader
    llm-fragments-youtube
    llm-gemini
    llm-github-copilot
    llm-openai-plugin
)

llm_with_args=()
for plugin in "${llm_plugins[@]}"; do
    llm_with_args+=("--with" "$plugin")
done

uv tool install --reinstall -U llm "${llm_with_args[@]}"

mkdir -p "${HOME}/.config/io.datasette.llm"
ln -sfT "${DOTFILES}/llm/templates" "${HOME}/.config/io.datasette.llm/templates"
