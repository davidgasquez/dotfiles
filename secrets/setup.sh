#!/usr/bin/env bash
set -euo pipefail

STORE_DIR="${HOME}/.secrets"
REMOTE="${GOPASS_REMOTE:-git@github.com:davidgasquez/secrets.git}"

packages=(
    git
    gopass
    age
)

paru -S --needed --noconfirm "${packages[@]}"

if [[ -d "${STORE_DIR}/.git" ]]; then
    echo "Configuring gopass root store at ${STORE_DIR}..."
    gopass config mounts.path "${STORE_DIR}"
    gopass sync
    exit 0
fi

cat <<EOF
Gopass is installed, but no local store exists at ${STORE_DIR}.

First machine bootstrap:
  PASSWORD_STORE_DIR=${STORE_DIR} gopass setup --crypto age --storage gitfs
  # When prompted for a git remote, use: ${REMOTE}
  gopass sync

New machine bootstrap:
  gopass clone --path ${STORE_DIR} ${REMOTE}
  gopass config mounts.path ${STORE_DIR}
  gopass sync

If the new machine cannot decrypt secrets, add its age recipient from an existing trusted machine, then sync again.
EOF
