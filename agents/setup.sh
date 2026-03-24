#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS_DIR="${DOTFILES}/agents"
GLOBAL_AGENTS_DIR="${HOME}/.agents"
GLOBAL_SKILLS_DIR="${GLOBAL_AGENTS_DIR}/skills"
CODEX_DIR="${HOME}/.codex"
PI_AGENT_DIR="${HOME}/.pi/agent"
AMP_DIR="${HOME}/.config/amp"

link_pi_profiles() {
  local source_profiles_dir="${AGENTS_DIR}/pi/profiles"
  local target_profiles_dir="${PI_AGENT_DIR}/profiles"
  local profile_entries
  local source_has_profiles=false
  local target_has_profiles=false

  mkdir -p "${source_profiles_dir}"

  if [[ -d "${target_profiles_dir}" && ! -L "${target_profiles_dir}" ]]; then
    if find "${source_profiles_dir}" -mindepth 1 -maxdepth 1 ! -name '.gitignore' -print -quit | grep -q .; then
      source_has_profiles=true
    fi

    if find "${target_profiles_dir}" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
      target_has_profiles=true
    fi

    if [[ "${source_has_profiles}" == true && "${target_has_profiles}" == true ]]; then
      echo "Refusing to migrate ${target_profiles_dir}: both profile dirs contain data" >&2
      exit 1
    fi

    shopt -s dotglob nullglob
    profile_entries=("${target_profiles_dir}"/*)
    if (( ${#profile_entries[@]} > 0 )); then
      mv "${profile_entries[@]}" "${source_profiles_dir}/"
    fi
    shopt -u dotglob nullglob

    rmdir "${target_profiles_dir}" 2>/dev/null || true
  fi

  ln -sfT "${source_profiles_dir}" "${target_profiles_dir}"
}

packages=(
  pi-coding-agent
  agent-browser
  googleworkspace-cli-bin
  openai-codex-bin
  qmd
)

paru -S --needed --noconfirm "${packages[@]}"

mkdir -p "${GLOBAL_AGENTS_DIR}"
ln -sfT "${AGENTS_DIR}/skills" "${GLOBAL_SKILLS_DIR}"

mkdir -p "${CODEX_DIR}"
ln -sf "${AGENTS_DIR}/codex/config.toml" "${CODEX_DIR}/config.toml"
ln -sf "${AGENTS_DIR}/AGENTS.md" "${CODEX_DIR}/AGENTS.md"

mkdir -p "${PI_AGENT_DIR}"
link_pi_profiles
ln -sf "${AGENTS_DIR}/AGENTS.md" "${PI_AGENT_DIR}/AGENTS.md"
ln -sf "${AGENTS_DIR}/pi/settings.json" "${PI_AGENT_DIR}/settings.json"
ln -sfT "${AGENTS_DIR}/pi/extensions" "${PI_AGENT_DIR}/extensions"
ln -sfT "${AGENTS_DIR}/pi/themes" "${PI_AGENT_DIR}/themes"
ln -sfT "${AGENTS_DIR}/commands" "${PI_AGENT_DIR}/prompts"

mkdir -p "${AMP_DIR}"
ln -sf "${AGENTS_DIR}/AGENTS.md" "${AMP_DIR}/AGENTS.md"
ln -sf "${AGENTS_DIR}/amp/settings.json" "${AMP_DIR}/settings.json"
