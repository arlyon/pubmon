#!/usr/bin/env python3
"""Sprite processing pipeline for PubMon.

Pipeline per image:
  1. rembg background removal (soft alpha, full resolution)
  2. nearest-neighbour downscale (each output pixel samples one source pixel),
     aspect-preserving, fitting inside an NxN box
  3. clamp alpha to binary 0/255 (pixel-art crisp edges, no halo)
  4. optional per-sprite cleanup: fill interior holes / despeckle fragments

Some sprites need different settings (e.g. translucent wings that a high clamp
threshold would erase). Those live in OVERRIDES below, keyed by sprite name.

The rembg model is loaded once and reused for every image.

Usage:
  python3 scripts/process_sprites.py                 # process all categories
  python3 scripts/process_sprites.py pubmon          # one category
  python3 scripts/process_sprites.py --force         # ignore up-to-date check
  python3 scripts/process_sprites.py --threshold 128 # global clamp cutoff

  # Threshold preview: render a sprite at a sweep of clamp thresholds so you
  # can pick the right value. Output is written to sprite-previews/.
  python3 scripts/process_sprites.py --preview blancbat martini seltzerpent
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time

import numpy as np
from PIL import Image, ImageDraw

# Quiet onnxruntime CUDA-provider noise; we run on CPU.
os.environ.setdefault("ORT_LOGGING_LEVEL", "3")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(REPO_ROOT, "public", "sprites", "raw")
OUT_DIR = os.path.join(REPO_ROOT, "public", "sprites")
PREVIEW_DIR = os.path.join(REPO_ROOT, "sprite-previews")

# Target box (max side, px). Aspect ratio is preserved within the box.
SIZES = {
    "pubmon": 64,
    "pubtrainers": 86,
}

# Per-sprite settings, keyed by normalised name (lowercase, variant tag and
# .png stripped -- e.g. "Blancbat_00005_.png" -> "blancbat"). Any field omitted
# falls back to DEFAULTS. Variants of the same name share one entry.
#
# Fields:
#   threshold     int  alpha clamp cutoff (lower keeps more translucent pixels)
#   alpha_matting bool rembg alpha matting (better soft edges, slower)
#   fill_holes    bool fill enclosed transparent islands (size-capped)
#   despeckle     bool drop detached fragments, keep the main body
#   fill_max_frac float max hole area (fraction of sprite) eligible for filling
#   keep_frac     float despeckle: keep components >= this * largest component
# Field "model" picks the rembg segmentation network. birefnet-general handles
# both solid AND thin/translucent subjects cleanly (no interior holes), so it is
# the universal default and hole-filling is OFF. Per-sprite overrides exist only
# for sprites that genuinely need a different model or cleanup -- compare any
# sprite across models with `--compare <name>`.
BIREFNET = "birefnet-general"
U2NET = "u2net"
ISNET = "isnet-general-use"

DEFAULTS = {
    "model": BIREFNET,
    "threshold": 128,
    "alpha_matting": False,
    "fill_holes": False,
    "despeckle": False,
    "fill_max_frac": 0.08,
    "keep_frac": 0.12,
    "flip": False,  # mirror horizontally (e.g. sprite faces the wrong way)
}

# birefnet-general is the default for everything. Entries below are only the
# handful of sprites that review better with a tweak.
# (cidra: handled manually -- birefnet keeps its orange background which is the
#  same hue as the body, so no threshold/despeckle setting isolates it.)
OVERRIDES: dict[str, dict] = {
    # this one looked better on the old model
    "seltzerpent": {"model": ISNET, "alpha_matting": True, "threshold": 48},
    # raw art faces the wrong way
    "springer": {"flip": True},
}


def fit_box(w: int, h: int, box: int) -> tuple[int, int]:
    """Scale (w,h) to fit inside box x box, preserving aspect ratio."""
    if w >= h:
        return box, max(1, round(h * box / w))
    return max(1, round(w * box / h)), box


def normalise_name(filename: str) -> str:
    """Map a raw filename to its override key.

    "Blancbat_00005_.png" -> "blancbat"; "Magnumoth_00001_.png.png" ->
    "magnumoth"; "luke.png" -> "luke".
    """
    s = filename.lower()
    while s.endswith(".png"):
        s = s[:-4]
    s = re.sub(r"_0*\d+_?$", "", s)
    return s.strip("_ ")


def settings_for(filename: str) -> dict:
    cfg = dict(DEFAULTS)
    cfg.update(OVERRIDES.get(normalise_name(filename), {}))
    return cfg


def is_precut(rgba: Image.Image) -> bool:
    """True if the source already has a removed background.

    Some raws are already transparent sprites (small, pre-cut). Re-running
    rembg on those re-segments and can destroy thin shapes, so we skip removal.
    """
    a = np.asarray(rgba.split()[3])
    return bool(a.min() < 250 and (a < 16).mean() > 0.05)


def cut_and_scale(
    raw: Image.Image,
    session,
    remove_fn,
    box: int,
    alpha_matting: bool,
) -> tuple[Image.Image, bool]:
    """rembg removal (full res) -> nearest-neighbour downscale.

    Returns the downscaled RGBA with *soft* alpha still intact (clamping and
    cleanup happen later in finalize()).
    """
    rgba_in = raw.convert("RGBA")
    removed_bg = not is_precut(rgba_in)
    if removed_bg:
        kwargs = {"session": session}
        if alpha_matting:
            kwargs.update(
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_size=2,
            )
        cut = remove_fn(rgba_in, **kwargs).convert("RGBA")
        # rembg ZEROES the RGB of removed pixels. If we later refill interior
        # holes, that RGB would show up black. So keep the RAW colours (true
        # everywhere) and only take rembg's alpha as the cutout mask.
        soft = rgba_in.convert("RGB")
        soft.putalpha(cut.getchannel("A"))
    else:
        soft = rgba_in

    W, H = soft.size
    nw, nh = fit_box(W, H, box)
    return soft.resize((nw, nh), Image.NEAREST), removed_bg


def _fill_small_holes(mask: np.ndarray, max_frac: float) -> np.ndarray:
    """Fill enclosed transparent islands below max_frac of the sprite area.

    Background regions touching the image border are the real exterior and are
    left transparent. Interior holes (not border-connected) under the size cap
    are filled, so genuine gaps (snake coils, bike wheels) stay open.
    """
    from scipy import ndimage

    bg = ~mask
    lbl, n = ndimage.label(bg)
    if n == 0:
        return mask
    border = np.unique(
        np.concatenate([lbl[0, :], lbl[-1, :], lbl[:, 0], lbl[:, -1]])
    )
    border = set(int(x) for x in border)
    cap = max_frac * mask.shape[0] * mask.shape[1]
    sizes = np.bincount(lbl.ravel())
    out = mask.copy()
    for i in range(1, n + 1):
        if i in border:
            continue
        if sizes[i] <= cap:
            out[lbl == i] = True
    return out


def _despeckle(mask: np.ndarray, keep_frac: float) -> np.ndarray:
    """Keep foreground components >= keep_frac of the largest; drop the rest."""
    from scipy import ndimage

    lbl, n = ndimage.label(mask)
    if n <= 1:
        return mask
    sizes = np.bincount(lbl.ravel())
    sizes[0] = 0
    biggest = sizes.max()
    keep = [i for i in range(1, n + 1) if sizes[i] >= keep_frac * biggest]
    return np.isin(lbl, keep)


def finalize(small_soft: Image.Image, cfg: dict) -> Image.Image:
    """Clamp alpha to binary and apply optional hole-fill / despeckle.

    Holes that get filled have no real colour (rembg zeroes removed pixels and
    the raw may be plain background), so their RGB is inpainted from the nearest
    surviving subject pixel -- never black or background-white.
    """
    arr = np.asarray(small_soft).copy()
    orig_fg = arr[..., 3] >= cfg["threshold"]
    mask = orig_fg.copy()

    if cfg["despeckle"]:
        mask = _despeckle(mask, cfg["keep_frac"])
    if cfg["fill_holes"]:
        mask = _fill_small_holes(mask, cfg["fill_max_frac"])

    # Inpaint colour for pixels newly added by hole-fill: copy from the nearest
    # original foreground pixel so holes take on real subject colour.
    filled = mask & ~orig_fg
    if filled.any() and orig_fg.any():
        from scipy.ndimage import distance_transform_edt

        inds = distance_transform_edt(
            ~orig_fg, return_distances=False, return_indices=True
        )
        rgb = arr[..., :3]
        nearest = rgb[inds[0], inds[1]]
        rgb[filled] = nearest[filled]

    arr[..., 3] = np.where(mask, 255, 0).astype(np.uint8)
    arr[..., :3][~mask] = 0  # zero RGB where transparent (clean, smaller PNG)

    out = Image.fromarray(arr, "RGBA")
    if cfg.get("flip"):
        out = out.transpose(Image.FLIP_LEFT_RIGHT)
    return out


_SESSIONS: dict = {}


def get_session(model: str):
    """Lazily create and cache a rembg session per model name."""
    if model not in _SESSIONS:
        from rembg import new_session

        print(f"Loading rembg model: {model} ...", flush=True)
        _SESSIONS[model] = new_session(model)
    return _SESSIONS[model]


def process_image(
    raw: Image.Image, remove_fn, box: int, cfg: dict
) -> tuple[Image.Image, bool]:
    session = get_session(cfg["model"])
    small_soft, removed_bg = cut_and_scale(
        raw, session, remove_fn, box, cfg["alpha_matting"]
    )
    return finalize(small_soft, cfg), removed_bg


# --------------------------------------------------------------------------- #
# Preview                                                                      #
# --------------------------------------------------------------------------- #

MAGENTA = (255, 0, 255, 255)


def _find_raws(query: str) -> list[tuple[str, str, int]]:
    """Return (category, filename, box) for raws matching a name query."""
    q = query.lower().replace(".png", "")
    hits = []
    for cat, box in SIZES.items():
        d = os.path.join(RAW_DIR, cat)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.lower().endswith(".png"):
                continue
            if q in f.lower() or q in normalise_name(f):
                hits.append((cat, f, box))
    return hits


def build_preview(
    cat: str, filename: str, box: int, remove_fn, thresholds: list[int]
) -> str:
    """Render a threshold sweep strip for one sprite over a magenta backdrop."""
    cfg = settings_for(filename)
    raw = Image.open(os.path.join(RAW_DIR, cat, filename))
    session = get_session(cfg["model"])
    small_soft, _ = cut_and_scale(raw, session, remove_fn, box, cfg["alpha_matting"])

    scale = max(2, 256 // max(small_soft.size))
    cw = small_soft.width * scale
    ch = small_soft.height * scale
    pad, label_h = 8, 14
    cells = []

    # First cell: soft alpha as-is (no clamp) for reference.
    soft_big = small_soft.resize((cw, ch), Image.NEAREST)
    cells.append(("soft", soft_big))
    for t in thresholds:
        c = dict(cfg)
        c["threshold"] = t
        # show pure threshold effect: skip fill/despeckle in the sweep
        c["fill_holes"] = c["despeckle"] = False
        img = finalize(small_soft, c).resize((cw, ch), Image.NEAREST)
        marker = " *" if t == cfg["threshold"] else ""
        cells.append((f"t={t}{marker}", img))

    strip_w = len(cells) * (cw + pad) + pad
    strip_h = ch + label_h + pad * 2
    canvas = Image.new("RGBA", (strip_w, strip_h), MAGENTA)
    draw = ImageDraw.Draw(canvas)
    x = pad
    for label, img in cells:
        canvas.alpha_composite(img, (x, label_h + pad))
        draw.text((x + 2, 2), label, fill=(0, 0, 0, 255))
        x += cw + pad

    os.makedirs(PREVIEW_DIR, exist_ok=True)
    out = os.path.join(PREVIEW_DIR, f"{normalise_name(filename)}__{filename}".replace(".png", "") + ".png")
    canvas.convert("RGB").save(out)
    return out


def run_preview(queries: list[str], thresholds: list[int]) -> int:
    from rembg import remove

    seen = set()
    for q in queries:
        hits = _find_raws(q)
        if not hits:
            print(f"  ?? no raw match for '{q}'", flush=True)
            continue
        for cat, filename, box in hits:
            if filename in seen:
                continue
            seen.add(filename)
            cfg = settings_for(filename)
            out = build_preview(cat, filename, box, remove, thresholds)
            print(
                f"  {filename}: model={cfg['model']} matting={cfg['alpha_matting']} "
                f"current_t={cfg['threshold']} -> {out}",
                flush=True,
            )
    print(f"\nPreviews in {PREVIEW_DIR}", flush=True)
    return 0


def run_compare(queries: list[str], models: list[str]) -> int:
    """Render each matching sprite cut by several models, side by side, so you
    can pick the one with the cleanest edges. Binary clamp at the sprite's
    threshold, no hole-fill -- shows the raw model mask honestly."""
    from rembg import remove

    seen = set()
    for q in queries:
        for cat, filename, box in _find_raws(q):
            if filename in seen:
                continue
            seen.add(filename)
            cfg = settings_for(filename)
            raw = Image.open(os.path.join(RAW_DIR, cat, filename))
            scale = max(2, 256 // box)
            cells = []
            for model in models:
                small, _ = cut_and_scale(
                    raw, get_session(model), remove, box, False
                )
                arr = np.asarray(small).copy()
                m = arr[..., 3] >= cfg["threshold"]
                arr[..., 3] = np.where(m, 255, 0).astype(np.uint8)
                arr[..., :3][~m] = 0
                img = Image.fromarray(arr, "RGBA").resize(
                    (arr.shape[1] * scale, arr.shape[0] * scale), Image.NEAREST
                )
                cells.append((model, img))

            pad, lh = 8, 14
            cw = max(i.width for _, i in cells) + pad
            ch = max(i.height for _, i in cells) + lh + pad
            canvas = Image.new("RGBA", (len(cells) * cw + pad, ch), MAGENTA)
            draw = ImageDraw.Draw(canvas)
            x = pad
            for label, img in cells:
                canvas.alpha_composite(img, (x, lh + (ch - lh - img.height) // 2))
                draw.text((x + 2, 2), label, fill=(0, 0, 0, 255))
                x += cw
            os.makedirs(PREVIEW_DIR, exist_ok=True)
            out = os.path.join(
                PREVIEW_DIR, "compare__" + normalise_name(filename) + ".png"
            )
            canvas.convert("RGB").save(out)
            print(f"  {filename}: {out}", flush=True)
    print(f"\nComparisons in {PREVIEW_DIR}", flush=True)
    return 0


# --------------------------------------------------------------------------- #
# Main                                                                         #
# --------------------------------------------------------------------------- #


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "categories",
        nargs="*",
        help="Categories to process (pubmon, pubtrainers) or 'all'.",
    )
    parser.add_argument("--force", action="store_true", help="Reprocess even if up to date.")
    parser.add_argument("--model", default=None, help="Override the default rembg model.")
    parser.add_argument(
        "--threshold",
        type=int,
        default=None,
        help="Override the global default clamp cutoff 0-255.",
    )
    parser.add_argument("--out", default=OUT_DIR, help="Output root dir.")
    parser.add_argument(
        "--preview",
        nargs="+",
        metavar="NAME",
        help="Render a threshold sweep for the named sprite(s) and exit.",
    )
    parser.add_argument(
        "--preview-thresholds",
        default="16,32,48,64,96,128,160,192",
        help="Comma-separated thresholds for --preview.",
    )
    parser.add_argument(
        "--compare",
        nargs="+",
        metavar="NAME",
        help="Render the named sprite(s) cut by several models side by side.",
    )
    parser.add_argument(
        "--compare-models",
        default="u2net,isnet-general-use,isnet-anime",
        help="Comma-separated models for --compare.",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="NAME",
        help="Process only sprites whose name matches (always reprocessed).",
    )
    args = parser.parse_args()

    if args.model:
        DEFAULTS["model"] = args.model

    if args.compare:
        models = [m.strip() for m in args.compare_models.split(",") if m.strip()]
        return run_compare(args.compare, models)

    if args.preview:
        ts = [int(x) for x in args.preview_thresholds.split(",") if x.strip()]
        return run_preview(args.preview, ts)

    if args.threshold is not None:
        DEFAULTS["threshold"] = args.threshold

    cats = (
        list(SIZES.keys())
        if (not args.categories or "all" in args.categories)
        else args.categories
    )
    for c in cats:
        if c not in SIZES:
            parser.error(f"unknown category '{c}' (choose: {', '.join(SIZES)}, all)")

    from rembg import remove

    total = 0
    t0 = time.time()
    for cat in cats:
        box = SIZES[cat]
        src_dir = os.path.join(RAW_DIR, cat)
        dst_dir = os.path.join(args.out, cat)
        os.makedirs(dst_dir, exist_ok=True)

        if not os.path.isdir(src_dir):
            print(f"!! missing raw dir: {src_dir}", flush=True)
            continue

        files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(".png"))
        print(f"\n== {cat}: {len(files)} files -> {box}x{box} box ==", flush=True)

        for name in files:
            if args.only:
                low = name.lower()
                stem = normalise_name(name)
                if not any(q.lower() in low or q.lower() == stem for q in args.only):
                    continue

            src = os.path.join(src_dir, name)
            # Normalise accidental double extensions (e.g. "*.png.png").
            out_name = re.sub(r"(\.png)+$", ".png", name, flags=re.I)
            dst = os.path.join(dst_dir, out_name)

            # --only always reprocesses; otherwise honour the up-to-date check.
            if (
                not args.force
                and not args.only
                and os.path.exists(dst)
                and os.path.getmtime(dst) >= os.path.getmtime(src)
            ):
                print(f"  SKIP {name} (up to date)", flush=True)
                continue

            try:
                raw = Image.open(src)
            except Exception as exc:  # noqa: BLE001
                print(f"  ERR  {name}: cannot open ({exc})", flush=True)
                continue

            cfg = settings_for(name)
            result, removed_bg = process_image(raw, remove, box, cfg)
            result.save(dst)
            total += 1
            tags = [cfg["model"]]
            if not removed_bg:
                tags.append("pre-cut")
            print(f"  OK   {name} -> {result.size} [{','.join(tags)}]", flush=True)

    dt = time.time() - t0
    print(f"\nDone. Processed {total} image(s) in {dt:.1f}s.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
