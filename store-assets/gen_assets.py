# Compose Play-store screenshots (caption band + raw capture) and the
# 1024x500 feature graphic. Run: .venv/Scripts/python.exe store-assets/gen_assets.py
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).parent
RAW = ROOT / "raw"
OUT = ROOT / "final"
OUT.mkdir(exist_ok=True)

FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"
FONT_REG = "C:/Windows/Fonts/malgun.ttf"
BLUE = (37, 99, 235)
CYAN = (6, 182, 212)

W, SHOT_H, BAND_H = 1080, 1920, 200  # 1080x2120 (< 2:1 Play limit)

CAPTIONS = {
    "1-onboarding": ("회원가입 없이 바로 시작", "모든 데이터는 내 폰에만 저장돼요"),
    "2-home": ("내 쿠폰을 한눈에", "도장판·회수권·금액권까지 전부"),
    "3-detail": ("몇 번 남았는지 바로 확인", "만료 D-day와 메모까지 함께"),
    "4-list": ("검색과 필터로 전체 관리", "진행 · 임박 · 완성 상태별 정리"),
    "5-map": ("단골 가게를 지도에서", "길찾기와 근처 알림 지원"),
    "6-settings": ("잃어버릴 걱정 없이", "JSON 백업 · 복원 지원"),
}


def gradient(w, h, c1, c2, vertical=False):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (y / (h - 1)) if vertical else (x / (w - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
    return img


def screenshots():
    title_f = ImageFont.truetype(FONT_BOLD, 64)
    sub_f = ImageFont.truetype(FONT_REG, 38)
    for name, (title, sub) in CAPTIONS.items():
        shot = Image.open(RAW / f"{name}.png").convert("RGB")
        if shot.size != (W, SHOT_H):
            shot = shot.resize((W, SHOT_H))
        canvas = gradient(W, BAND_H + SHOT_H, BLUE, CYAN)
        d = ImageDraw.Draw(canvas)
        tw = d.textlength(title, font=title_f)
        sw = d.textlength(sub, font=sub_f)
        d.text(((W - tw) / 2, 36), title, font=title_f, fill="white")
        d.text(((W - sw) / 2, 122), sub, font=sub_f, fill=(224, 242, 254))
        canvas.paste(shot, (0, BAND_H))
        canvas.save(OUT / f"{name}.png")
        print("shot:", name, canvas.size)


def feature_graphic():
    W2, H2 = 1024, 500
    canvas = gradient(W2, H2, BLUE, CYAN)
    d = ImageDraw.Draw(canvas)
    icon = Image.open(ROOT.parent / "static" / "icon-512.png").convert("RGBA")
    icon = icon.resize((320, 320))
    # soft white card behind the icon
    pad = 0
    canvas.paste(icon, (96, (H2 - 320) // 2 - pad), icon)
    title_f = ImageFont.truetype(FONT_BOLD, 110)
    sub_f = ImageFont.truetype(FONT_REG, 44)
    d.text((470, 150), "쿠폰북", font=title_f, fill="white")
    d.text((474, 290), "내 쿠폰·도장·이용권 지갑", font=sub_f, fill=(224, 242, 254))
    canvas.save(OUT / "feature-graphic.png")
    print("feature:", canvas.size)


screenshots()
feature_graphic()
print("->", OUT)
