#!/usr/bin/env bash
set -euo pipefail

TRANSCRIBE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_DIR="${TRANSCRIBE_DIR}/models"
MODEL_NAME="MOSS-Transcribe-Diarize-Q8_0.gguf"
MODEL_PATH="${MODEL_DIR}/${MODEL_NAME}"
MODEL_URL="https://huggingface.co/handy-computer/MOSS-Transcribe-Diarize-gguf/resolve/main/${MODEL_NAME}"
MODEL_SHA256="64ec654dc6ffcfdfe180422dffce1d33422b0c30959b7edfd131bad77ee35039"

readonly PACKAGE_VERSION="0.2.3-1"

packages=(
  base-devel
  cmake
  openblas
  rocm-hip-sdk
)

installed_version="$(pacman -Q transcribe-cpp-hip 2>/dev/null | cut -d ' ' -f 2 || true)"
if [[ -z ${installed_version} || $(vercmp "${installed_version}" "${PACKAGE_VERSION}") -lt 0 ]]; then
  paru -S --needed --noconfirm "${packages[@]}"
  (
    cd "${TRANSCRIBE_DIR}"
    makepkg --cleanbuild --clean --syncdeps --install --needed --noconfirm
  )
fi

mkdir -p "${MODEL_DIR}"
if [[ ! -f ${MODEL_PATH} ]]; then
  curl --fail --location --continue-at - \
    --output "${MODEL_PATH}.part" \
    "${MODEL_URL}"
  printf '%s  %s\n' "${MODEL_SHA256}" "${MODEL_PATH}.part" | sha256sum --check --status
  mv "${MODEL_PATH}.part" "${MODEL_PATH}"
fi

printf '%s  %s\n' "${MODEL_SHA256}" "${MODEL_PATH}" | sha256sum --check
