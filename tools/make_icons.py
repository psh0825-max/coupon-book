"""Generate raster PWA icons from the vector icon design (static/icon.svg).

Renders at 2x (1024) for anti-aliasing, then downsamples with LANCZOS.
Outputs: icon-512.png, icon-192.png, icon-180.png in static/.
"""
from pathlib import Path
from PIL import Image, ImageDraw

STATIC = Path(__file__).resolve().parent.parent / "static"

# Design is authored on a 512 canvas; render at SCALE for anti-aliasing.
BASE = 512
SCALE = 2
S = BASE * SCALE  # 1024

BG = "#141419"
CARD = "#f0f0f5"
DOTS = ["#66b37a", "#6f8cff", "#e07a5f"]


def render(size: int) -> Image.Image:
    """Draw the icon at `size`x`size`."""
    k = size / BASE  # scale factor from design coords
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background rounded square (full bleed)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=112 * k, fill=BG)
    # ticket card
    d.rounded_rectangle(
        [88 * k, 132 * k, (88 + 336) * k, (132 + 248) * k],
        radius=36 * k,
        fill=CARD,
    )
    # divider line (stroke width 28)
    d.line([88 * k, 210 * k, 424 * k, 210 * k], fill=BG, width=round(28 * k))
    # three dots (radius 32)
    r = 32 * k
    for cx, color in zip((168, 256, 344), DOTS):
        cy = 294
        d.ellipse(
            [cx * k - r, cy * k - r, cx * k + r, cy * k + r],
            fill=color,
        )
    return img


def save_downscaled(master: Image.Image, target: int, name: str) -> None:
    out = master.resize((target, target), Image.LANCZOS)
    out.save(STATIC / name)


def main() -> None:
    master = render(S)  # high-res master at 1024
    save_downscaled(master, 512, "icon-512.png")
    save_downscaled(master, 192, "icon-192.png")
    save_downscaled(master, 180, "icon-180.png")

    for name in ("icon-512.png", "icon-192.png", "icon-180.png"):
        p = STATIC / name
        with Image.open(p) as im:
            print(f"{name}: {im.size[0]}x{im.size[1]}, {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
