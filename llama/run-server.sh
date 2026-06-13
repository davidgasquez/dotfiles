#!/usr/bin/env bash

set -euo pipefail

ROCBLAS_USE_HIPBLASLT=1 llama-server \
    -hf unsloth/Qwen3.6-27B-MTP-GGUF:UD-Q4_K_XL \
    --host 0.0.0.0 \
    --port 8080 \
    -a qwen-3.6-27b-q4 \
    -ngl 999 \
    --flash-attn on \
    --ctx-size 32768 \
    --cache-type-k q8_0 \
    --cache-type-v q8_0 \
    -b 2048 \
    -ub 512 \
    --parallel 1 \
    --jinja \
    --reasoning-format deepseek \
    --reasoning auto \
    --temp 0.6 \
    --top-p 0.95 \
    --top-k 20 \
    --min-p 0 \
    --spec-type draft-mtp \
    --spec-draft-n-max 2
