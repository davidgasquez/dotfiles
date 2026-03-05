#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS_DIR="${DOTFILES}/agents"
CODEX_DIR="${HOME}/.codex"

packages=(
  pi-coding-agent
  agent-browser
  googleworkspace-cli-bin
  openai-codex-bin
)

paru -S --needed --noconfirm "${packages[@]}"

setup_codex() {
  mkdir -p "${CODEX_DIR}"
  ln -sf "${AGENTS_DIR}/codex/config.toml" "${CODEX_DIR}/config.toml"
  ln -sf "${AGENTS_DIR}/AGENTS.md" "${CODEX_DIR}/AGENTS.md"
  ln -sfT "${AGENTS_DIR}/skills" "${CODEX_DIR}/skills"
}

setup_pi() {
  mkdir -p "${HOME}/.pi/agent"
  ln -sf "${AGENTS_DIR}/AGENTS.md" "${HOME}/.pi/agent/AGENTS.md"
  ln -sf "${AGENTS_DIR}/pi/settings.json" "${HOME}/.pi/agent/settings.json"
  ln -sfT "${AGENTS_DIR}/pi/extensions" "${HOME}/.pi/agent/extensions"
  ln -sfT "${AGENTS_DIR}/skills" "${HOME}/.pi/agent/skills"
}

setup_amp() {
  mkdir -p "${HOME}/.config/amp"
  ln -sf "${AGENTS_DIR}/AGENTS.md" "${HOME}/.config/amp/AGENTS.md"
  ln -sf "${AGENTS_DIR}/amp/settings.json" "${HOME}/.config/amp/settings.json"
  ln -sfT "${AGENTS_DIR}/skills" "${HOME}/.config/amp/skills"
}

setup_codex
setup_pi
setup_amp
