"""Generate raster PWA icons from the vector icon design (static/icon.svg).

Renders the SVG to a 1024 master with ImageMagick (`magick`, which honors the
gradients/paths in icon.svg), then downsamples with PIL LANCZOS.
Outputs: icon-512.png, icon-192.png, icon-180.png in static/ (full-bleed, so the
OS/browser applies its own rounding/masking).

Requires ImageMagick on PATH (the `magick` command).
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

STATIC = Path(__file__).resolve().parent.parent / "static"
SVG = STATIC / "icon.svg"
MASTER = 1024  # high-res master for anti-aliased downscales
SIZES = [(512, "icon-512.png"), (192, "icon-192.png"), (180, "icon-180.png")]


def render_master() -> Path:
    """Rasterize icon.svg to a 1024 PNG master via ImageMagick."""
    magick = shutil.which("magick") or shutil.which("convert")
    if not magick:
        raise SystemExit("ImageMagick not found on PATH (need the `magick` command).")
    out = Path(tempfile.gettempdir()) / "coupon_icon_master.png"
    subprocess.run(
        [magick, "-background", "none", "-density", "1200",
         str(SVG), "-resize", f"{MASTER}x{MASTER}", str(out)],
        check=True,
    )
    return out


def main() -> None:
    master_path = render_master()
    with Image.open(master_path) as master:
        master = master.convert("RGBA")
        for size, name in SIZES:
            master.resize((size, size), Image.LANCZOS).save(STATIC / name)
    master_path.unlink(missing_ok=True)

    for _, name in SIZES:
        p = STATIC / name
        with Image.open(p) as im:
            print(f"{name}: {im.size[0]}x{im.size[1]}, {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
