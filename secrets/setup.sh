#!/usr/bin/env bash
set -euo pipefail

STORE_DIR="${HOME}/.secrets"
REMOTE="${GOPASS_REMOTE:-git@github.com:davidgasquez/secrets.git}"
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

packages=(
    git
    gopass
    age
)

paru -S --needed --noconfirm "${packages[@]}"

mkdir -p "${SYSTEMD_USER_DIR}"
ln -sf "${SCRIPT_DIR}/gopass-sync.service" "${SYSTEMD_USER_DIR}/gopass-sync.service"
ln -sf "${SCRIPT_DIR}/gopass-sync.timer" "${SYSTEMD_USER_DIR}/gopass-sync.timer"
systemctl --user daemon-reload
systemctl --user enable --now gopass-sync.timer

if [[ -d "${STORE_DIR}/.git" ]]; then
    echo "Configuring gopass root store at ${STORE_DIR}..."
    gopass config mounts.path "${STORE_DIR}"
    systemctl --user start gopass-sync.service
    exit 0
fi

cat <<EOF
Gopass is installed and gopass-sync.timer is enabled, but no local store exists at ${STORE_DIR}.

First machine bootstrap:
  PASSWORD_STORE_DIR=${STORE_DIR} gopass setup --crypto age --storage gitfs
  # When prompted for a git remote, use: ${REMOTE}
  gopass sync

New machine bootstrap:
  gopass clone --path ${STORE_DIR} ${REMOTE}
  gopass config mounts.path ${STORE_DIR}
  gopass sync

If the new machine cannot decrypt secrets, add its age recipient from an existing trusted machine, then sync again.

Check sync status with:
  systemctl --user status gopass-sync.timer
  journalctl --user -u gopass-sync.service -n 50
EOF
