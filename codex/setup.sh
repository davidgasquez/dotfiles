#!/usr/bin/env bash
set -euo pipefail

DOTFILES=$(dirname "$(dirname "$(realpath "$0")")")
CODEX_DIR="${HOME}/.codex"

paru -S --needed --noconfirm openai-codex-autoup-bin

mkdir -p "${CODEX_DIR}"

ln -sf "${DOTFILES}/codex/config.toml" "${CODEX_DIR}/config.toml"
ln -sf "${DOTFILES}/codex/AGENTS.md" "${CODEX_DIR}/AGENTS.md"
ln -sfT "${DOTFILES}/codex/prompts" "${CODEX_DIR}/prompts"
ln -sfT "${DOTFILES}/codex/skills" "${CODEX_DIR}/skills"
