#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS_DIR="${DOTFILES}/agents"
GLOBAL_AGENTS_DIR="${HOME}/.agents"
GLOBAL_SKILLS_DIR="${GLOBAL_AGENTS_DIR}/skills"
CODEX_DIR="${HOME}/.codex"
PI_AGENT_DIR="${HOME}/.pi/agent"
AMP_DIR="${HOME}/.config/amp"

packages=(
  pi-coding-agent
  agent-browser
  googleworkspace-cli-bin
  openai-codex-bin
)

paru -S --needed --noconfirm "${packages[@]}"

mkdir -p "${GLOBAL_AGENTS_DIR}"
ln -sfT "${AGENTS_DIR}/skills" "${GLOBAL_SKILLS_DIR}"

mkdir -p "${CODEX_DIR}"
ln -sf "${AGENTS_DIR}/codex/config.toml" "${CODEX_DIR}/config.toml"
ln -sf "${AGENTS_DIR}/AGENTS.md" "${CODEX_DIR}/AGENTS.md"

mkdir -p "${PI_AGENT_DIR}"
ln -sf "${AGENTS_DIR}/AGENTS.md" "${PI_AGENT_DIR}/AGENTS.md"
ln -sf "${AGENTS_DIR}/pi/settings.json" "${PI_AGENT_DIR}/settings.json"
ln -sfT "${AGENTS_DIR}/pi/extensions" "${PI_AGENT_DIR}/extensions"
ln -sfT "${AGENTS_DIR}/pi/themes" "${PI_AGENT_DIR}/themes"
ln -sfT "${AGENTS_DIR}/commands" "${PI_AGENT_DIR}/prompts"

mkdir -p "${AMP_DIR}"
ln -sf "${AGENTS_DIR}/AGENTS.md" "${AMP_DIR}/AGENTS.md"
ln -sf "${AGENTS_DIR}/amp/settings.json" "${AMP_DIR}/settings.json"
