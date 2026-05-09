#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW_DIR="$REPO_ROOT/public/sprites/raw"
OUT_DIR="$REPO_ROOT/public/sprites"

PUBMON_SIZE="64x64"
TRAINER_SIZE="160x160"

process() {
  local category="$1" size="$2"
  local src_dir="$RAW_DIR/$category"
  local dst_dir="$OUT_DIR/$category"

  mkdir -p "$dst_dir"

  for img in "$src_dir"/*.png; do
    [ -f "$img" ] || continue
    local name
    name="$(basename "$img")"
    local out="$dst_dir/$name"

    if [ "$out" -nt "$img" ]; then
      echo "SKIP $category/$name (up to date)"
      continue
    fi

    echo "PROC $category/$name -> ${size}"
    rembg i "$img" - | magick - -filter Point -resize "$size" "$out"
  done
}

process pubmon "$PUBMON_SIZE"
process pubtrainers "$TRAINER_SIZE"

echo "Done."
