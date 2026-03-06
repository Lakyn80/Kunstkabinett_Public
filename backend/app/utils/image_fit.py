# app/utils/image_fit.py
from __future__ import annotations
from pathlib import Path
from typing import Iterable, Tuple
from PIL import Image

def fit_4x3(
    src_path: str | Path,
    out_dir: str | Path,
    bg: Tuple[int, int, int] = (255, 255, 255),  # např. (15, 23, 42) pro dark
    sizes: Iterable[Tuple[int, int]] = ((1600, 1200), (800, 600), (600, 450)),
    quality: int = 82,
) -> None:
    src = Path(src_path)
    outdir = Path(out_dir)
    outdir.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as im:
        im = im.convert("RGB")
        basename = src.stem

        for (w, h) in sizes:
            canvas = Image.new("RGB", (w, h), bg)
            img = im.copy()
            img.thumbnail((w, h), Image.Resampling.LANCZOS)  # zachová poměr stran
            x = (w - img.width) // 2
            y = (h - img.height) // 2
            canvas.paste(img, (x, y))
            out_file = outdir / f"{basename}_{w}.webp"
            canvas.save(out_file, "WEBP", quality=quality, method=6)
