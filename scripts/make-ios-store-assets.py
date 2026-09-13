#!/usr/bin/env python3
"""App Store 스크린샷 생성 — 쿠폰북 iPhone 6.9" (1320×2868).

    python3 scripts/make-ios-store-assets.py <원본_스크린샷_폴더> [--lang ko|en|both]

원본: iPhone 17 Pro Max 시뮬레이터 캡처(1320×2868, 상태 표시줄 포함). 파일 이름은 아래
SHOTS 의 첫 항목(01_home.png …). App Store 는 기기 해상도를 그대로 요구하므로 캔버스를
1320×2868 로 고정하고, 브랜드 배경 위에 캡션과 (상태 표시줄·홈 인디케이터를 잘라낸) 앱
화면을 얹는다. 출력: store/ios/iphone-6.9/NN.png (ko), store/ios/iphone-6.9-en/NN.png (en).
hangul-lab 의 scripts/make-ios-store-assets.py 를 이 앱의 팔레트·문안에 맞게 고친 것.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'store', 'ios')
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
BOLD, REG = 6, 2

CANVAS = (1320, 2868)
CROP_TOP, CROP_BOTTOM = 186, 102     # 62pt Dynamic-Island safe area / 34pt home indicator @3x
SHOT_W = int(CANVAS[0] * 0.84)
SHOT_Y = int(CANVAS[1] * 0.152)

# 브랜드 팔레트 (static/css/base.css --primary #2563eb, 아이콘 그라디언트)
TOP = (37, 99, 235)
BOTTOM = (29, 78, 216)
GLOW = (14, 165, 233)
HEAD = (255, 255, 255)
SUB = (219, 234, 254)

# (원본 파일, ko 헤드라인, ko 부제, en 헤드라인, en 부제)
SHOTS = [
    ('01_home.png',
     '도장판·횟수권·금액권을 한곳에', '카페 도장부터 마사지 회수권까지, 내 쿠폰 지갑',
     'Stamp cards, passes and balances', 'One wallet for every coupon you carry'),
    ('02_stamp.png',
     '카드에서 바로 도장 쾅', '한 번 탭이면 적립, 실수는 되돌리기로',
     'Stamp right on the card', 'One tap to collect, one tap to undo'),
    ('03_reward.png',
     '도장판을 다 채우면 보상 안내', '축하와 함께 새 도장판으로 이어가요',
     'Fill the card, claim the reward', 'A small celebration, then the next card'),
    ('04_add.png',
     '30초면 등록 끝', '템플릿과 빠른 선택으로 이름과 종류만',
     'Set up a pass in 30 seconds', 'Templates and quick picks — just a name and a type'),
    ('05_detail.png',
     '남은 횟수와 만료일을 한눈에', '전화·지도·길찾기 버튼이 바로 옆에',
     'Sessions and expiry at a glance', 'Call, map and directions right there'),
    ('06_reminders.png',
     '만료 D-7·D-3·D-1 알림', '앱을 꺼 둬도 기기가 직접 알려줘요',
     'Reminders at D-7, D-3 and D-1', 'Scheduled on your iPhone, even with the app closed'),
    ('07_map.png',
     '저장한 가게를 지도에서', '길찾기는 Apple 지도로 바로',
     'Your shops on a map', 'Directions open in Apple Maps'),
    ('08_privacy.png',
     '계정 없이, 내 아이폰에만', '서버 없음 · 파일 백업과 자동 보관본',
     'No account. Stays on your iPhone.', 'No server. File backups plus an automatic copy'),
]


def font(size, idx=BOLD):
    return ImageFont.truetype(FONT, size, index=idx)


def wrap(d, text, ft, max_w):
    """Greedy word wrap (Korean phrases split on spaces / middle dots)."""
    words = text.split(' ')
    lines, cur = [], ''
    for w in words:
        cand = (cur + ' ' + w).strip()
        if d.textlength(cand, font=ft) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit(d, text, idx, start, max_w, max_lines):
    size = start
    while size > 28:
        ft = font(size, idx)
        lines = wrap(d, text, ft, max_w)
        if len(lines) <= max_lines and all(d.textlength(l, font=ft) <= max_w for l in lines):
            return ft, lines
        size -= 2
    ft = font(28, idx)
    return ft, wrap(d, text, ft, max_w)


def background():
    W, H = CANVAS
    bg = Image.new('RGB', (W, H), TOP)
    px = bg.load()
    for y in range(H):
        t = y / (H - 1)
        px_row = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = px_row
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((W * 0.45, H * 0.62, W * 1.35, H * 1.25), fill=GLOW + (150,))
    g.ellipse((-W * 0.35, -H * 0.12, W * 0.45, H * 0.28), fill=(147, 197, 253, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(int(W * 0.18)))
    return Image.alpha_composite(bg.convert('RGBA'), glow).convert('RGB')


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=r, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out


def compose(src, head, sub, dst, bg):
    W, H = CANVAS
    canvas = bg.copy()
    d = ImageDraw.Draw(canvas)
    margin = int(W * 0.075)
    max_w = W - margin * 2

    ft_head, head_lines = fit(d, head, BOLD, int(W * 0.066), max_w, 2)
    ft_sub, sub_lines = fit(d, sub, REG, int(W * 0.036), max_w, 2)
    y = int(H * 0.046)
    for line in head_lines:
        d.text((W // 2, y), line, font=ft_head, fill=HEAD, anchor='ma')
        y += int(ft_head.size * 1.22)
    y += int(H * 0.008)
    for line in sub_lines:
        d.text((W // 2, y), line, font=ft_sub, fill=SUB, anchor='ma')
        y += int(ft_sub.size * 1.3)

    shot = Image.open(src).convert('RGB')
    if shot.size != CANVAS:
        raise SystemExit(f'{src}: expected {CANVAS[0]}x{CANVAS[1]}, got {shot.size[0]}x{shot.size[1]}')
    shot = shot.crop((0, CROP_TOP, shot.size[0], shot.size[1] - CROP_BOTTOM))
    shot = shot.resize((SHOT_W, round(shot.size[1] * SHOT_W / shot.size[0])), Image.LANCZOS)
    radius = int(SHOT_W * 0.075)
    shot = rounded(shot, radius)

    x = (W - SHOT_W) // 2
    sy = max(SHOT_Y, y + int(H * 0.028))
    # bezel ring + soft shadow so the screen reads as a device
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow.paste(Image.new('RGBA', shot.size, (0, 0, 0, 110)), (x, sy + int(H * 0.008)), shot)
    canvas = Image.alpha_composite(canvas.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(int(W * 0.02))))
    ring = ImageDraw.Draw(canvas)
    pad = int(W * 0.012)
    ring.rounded_rectangle((x - pad, sy - pad, x + SHOT_W + pad, sy + shot.size[1] + pad),
                           radius=radius + pad, fill=(17, 24, 39, 255))
    canvas.paste(shot, (x, sy), shot)
    canvas = canvas.convert('RGB')
    # anything below the canvas bottom is simply cut (the shot is taller than the space)
    canvas = canvas.crop((0, 0, W, H))
    assert canvas.size == CANVAS
    canvas.save(dst, optimize=True)


def main():
    if len(sys.argv) < 2:
        sys.exit('사용법: make-ios-store-assets.py <스크린샷_폴더> [--lang ko|en|both]')
    src_root = sys.argv[1]
    lang = 'both'
    if '--lang' in sys.argv:
        lang = sys.argv[sys.argv.index('--lang') + 1]
    langs = ['ko', 'en'] if lang == 'both' else [lang]
    bg = background()
    made = 0
    for lg in langs:
        d_out = os.path.join(OUT, 'iphone-6.9' if lg == 'ko' else 'iphone-6.9-en')
        os.makedirs(d_out, exist_ok=True)
        for i, (fn, ko_h, ko_s, en_h, en_s) in enumerate(SHOTS, 1):
            src = os.path.join(src_root, fn)
            if not os.path.exists(src):
                print(f'  ⏭  {lg}/{fn} 원본 없음')
                continue
            head, sub = (ko_h, ko_s) if lg == 'ko' else (en_h, en_s)
            dst = os.path.join(d_out, f'{i:02d}.png')
            compose(src, head, sub, dst, bg)
            made += 1
            print(f'  ✔ {os.path.relpath(dst, ROOT)}')
    print(f'총 {made}장 → store/ios/ ({CANVAS[0]}x{CANVAS[1]})')


if __name__ == '__main__':
    main()
