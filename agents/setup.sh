#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS_DIR="${DOTFILES}/agents"
CODEX_DIR="${HOME}/.codex"

setup_codex() {
  if ! pacman -Q openai-codex-autoup-bin >/dev/null 2>&1; then
    paru -S --needed --noconfirm openai-codex-autoup-bin
  fi

  mkdir -p "${CODEX_DIR}"
  ln -sf "${AGENTS_DIR}/codex/config.toml" "${CODEX_DIR}/config.toml"
  ln -sf "${AGENTS_DIR}/AGENTS.md" "${CODEX_DIR}/AGENTS.md"
  ln -sfT "${AGENTS_DIR}/prompts" "${CODEX_DIR}/prompts"
  ln -sfT "${AGENTS_DIR}/skills" "${CODEX_DIR}/skills"
}

setup_pi() {
  npm install -g @mariozechner/pi-coding-agent

  mkdir -p "${HOME}/.pi/agent"
  ln -sf "${AGENTS_DIR}/AGENTS.md" "${HOME}/.pi/agent/AGENTS.md"
}

usage() {
  echo "Usage: $(basename "$0") [codex|pi|all]" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  usage
fi

if [[ $# -eq 0 ]] || [[ $1 == "all" ]]; then
  setup_codex
  setup_pi
  exit 0
fi

if [[ $1 == "codex" ]]; then
  setup_codex
  exit 0
fi

if [[ $1 == "pi" ]]; then
  setup_pi
  exit 0
fi

usage
