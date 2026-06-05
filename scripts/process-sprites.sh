#!/usr/bin/env bash
# Thin wrapper around the Python sprite pipeline.
# Removes backgrounds (rembg), clamps alpha to binary 0/255 for crisp
# pixel-art edges, and nearest-neighbour downscales (aspect-preserving).
#
#   pubmon      -> 64x64 box
#   pubtrainers -> 86x86 box (3:4 portraits land at 64x86)
#
# Pass through any args, e.g. `./scripts/process-sprites.sh --force pubmon`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$REPO_ROOT/scripts/process_sprites.py" "$@"
