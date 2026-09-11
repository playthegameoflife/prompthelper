"""
Prompt Helper Gemini — TikTok CTA Slide v2
9:16 format (1080x1920), Black + Vibrant Orange (#FF6600)
Premium finish: LINK IN BIO top, screenshot hero, badge bottom.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

# ─── Constants ───────────────────────────────────────────────────────────────
W, H = 1080, 1920
ORANGE      = (255, 102, 0)
ORANGE_DARK = (200,  70,  0)
BLACK       = (  0,   0,   0)
WHITE       = (255, 255, 255)

SRC_IMG   = "/Users/paulpark/.mavis/v2/assets/2026/07/29/16-57-18-154-asset_20260729-165718-154_2a973ea40846_d619fc33-Screenshot 2026-07-29 at 3.38.57 PM.png"
OUT_PATH  = "/Users/paulpark/Downloads/prompt architect/tiktok-cta-orange-v2.png"

# ─── Font helper ─────────────────────────────────────────────────────────────
def load_font(size, bold=False):
    candidates = [
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",       True),
        ("/Library/Fonts/Arial Bold.ttf",                          True),
        ("/System/Library/Fonts/Arial-BoldMT.ttf",                  True),
        ("/System/Library/Fonts/Helvetica.ttc",                     False),
        ("/System/Library/Fonts/HelveticaNeue.ttc",                 False),
        ("/System/Library/Fonts/Arial.ttf",                        False),
        ("/System/Library/FonicsFont.ttf",                          False),
    ]
    for fp, is_bold in candidates:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()

f_cta   = load_font(138, bold=True)   # LINK IN BIO
f_brand = load_font( 44, bold=False)  # Prompt Helper Gemini
f_tag   = load_font( 40, bold=False)  # tagline
f_feat  = load_font( 48, bold=False)  # features list
f_badge = load_font( 60, bold=True)   # FREE Chrome Extension

# ─── Create canvas ───────────────────────────────────────────────────────────
canvas = Image.new('RGB', (W, H), BLACK)
overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)

# ════════════════════════════════════════════════════════════════════════════
# 1.  LINK IN BIO — top section (y: 0 – 310)
# ════════════════════════════════════════════════════════════════════════════

# --- Subtle dark-orange gradient bar behind CTA ---
bar_h = 300
bar = Image.new('RGBA', (W, bar_h), (0, 0, 0, 0))
bd = ImageDraw.Draw(bar)
for y in range(bar_h):
    # Fade from near-black at top → slightly brighter at bottom
    t = y / bar_h
    r = int(40 * t)
    g = int(10 * t)
    b2 = int( 5 * t)
    bar_val = max(0, min(35, int(20 * t)))
    bd.rectangle([(0, y), (W, y+1)], fill=(r, g, b2, bar_val))
# Blur the gradient for smoothness
bar = bar.filter(ImageFilter.GaussianBlur(8))
canvas.paste(bar, (0, 0), bar.split()[3])

# --- Orange glow halo for LINK IN BIO ---
glow_img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow_img)
cta = "LINK IN BIO"
bbox = gd.textbbox((0, 0), cta, font=f_cta)
tw = bbox[2] - bbox[0]
tx = (W - tw) // 2
ty = 58

# Staggered glow layers — soft, natural halo
for blur_r, alpha in [(22, 12), (12, 22), (5, 55)]:
    gd.text((tx + blur_r, ty + blur_r), cta, font=f_cta,
            fill=(255, 102, 0, alpha))
glow_blurred = glow_img.filter(ImageFilter.GaussianBlur(24))
canvas.paste(glow_blurred, (0, 0), glow_blurred.split()[3])

# --- Main LINK IN BIO text ---
canvas_od = ImageDraw.Draw(canvas)
canvas_od.text((tx, ty), cta, font=f_cta, fill=ORANGE)

# --- Brand name under CTA ---
bbox2 = canvas_od.textbbox((0, 0), "Prompt Helper Gemini", font=f_brand)
tw2 = bbox2[2] - bbox2[0]
canvas_od.text(((W - tw2)//2, 205), "Prompt Helper Gemini",
               font=f_brand, fill=(255, 140, 60))

# --- Orange separator rule ---
sep_y = 262
for x in range(W):
    t = min(x / 200, (W - x) / 200, 1)
    a = int(120 * t)
    canvas_od.rectangle([(x, sep_y), (x+1, sep_y+2)], fill=(255, 102, 0, a))

# ════════════════════════════════════════════════════════════════════════════
# 2.  Extension screenshot — hero (y: 270 – 1380)
# ════════════════════════════════════════════════════════════════════════════
src = Image.open(SRC_IMG).convert('RGBA')
PAD_X  = 70
AVAIL_W = W - PAD_X * 2      # 940px
# Scale screenshot to fill available height (no wasted vertical space)
AVAIL_H = 1080
src_r = src.resize((AVAIL_W, AVAIL_H), Image.LANCZOS)
nw, nh = AVAIL_W, AVAIL_H

hero_x = (W - nw) // 2
hero_y = 265   # starts just below CTA, takes up most of slide

# Soft ambient glow behind screenshot
ambient_w = nw + 30
ambient_h = nh + 30
ambient = Image.new('RGBA', (ambient_w, ambient_h), (0, 0, 0, 0))
agd = ImageDraw.Draw(ambient)
agd.rectangle([(0, 0), (ambient_w-1, ambient_h-1)], fill=(255, 102, 0, 18))
ambient_blurred = ambient.filter(ImageFilter.GaussianBlur(20))
canvas.paste(ambient_blurred,
             (hero_x - 15, hero_y - 15),
             ambient_blurred.split()[3])

# Clean white frame
frame_w = nw + 4
frame_h = nh + 4
frame = Image.new('RGB', (frame_w, frame_h), WHITE)
frame_padded = Image.new('RGBA', (frame_w + 4, frame_h + 4), (255, 255, 255, 0))
frame_padded.paste(frame, (2, 2))
canvas.paste(src_r, (hero_x, hero_y), src_r.split()[3])

# Thin orange accent line below screenshot
accent_y = hero_y + nh + 12
for x in range(W):
    t = min(x / 150, (W - x) / 150, 1)
    a = int(160 * t)
    canvas_od.rectangle([(x, accent_y), (x+1, accent_y+2)], fill=(255, 102, 0, a))

# ════════════════════════════════════════════════════════════════════════════
# 3.  Bottom section — tagline + FREE Chrome Extension badge
# ════════════════════════════════════════════════════════════════════════════

# Gradient fade at bottom
fade_start = hero_y + nh + 20
fade_h = H - fade_start
fd = ImageDraw.Draw(canvas)
for y in range(fade_h):
    alpha = int(min(255, 220 * y / fade_h))
    fd.rectangle([(0, fade_start + y), (W, fade_start + y + 1)],
                 fill=(0, 0, 0, alpha))

# Feature lines + divider + CTA
features = [
    "Turn simple ideas into pro prompts",
    "Works with Gemini, ChatGPT & more",
]
feat_y = fade_start + 45
for feat in features:
    bbox_f = canvas_od.textbbox((0, 0), feat, font=f_feat)
    fw = bbox_f[2] - bbox_f[0]
    canvas_od.text(((W - fw)//2, feat_y), feat, font=f_feat,
                   fill=(255, 140, 40))
    feat_y += 56

# Arrow / chevron divider pointing down toward badge
arrow_y = feat_y + 28
arrow_s = 22   # half-arrow side
cx = W // 2
arrow_clr = (255, 102, 0)
for dy in range(arrow_s):
    w_line = int(arrow_s - dy) * 2 + 1
    x1 = cx - w_line // 2
    x2 = cx + w_line // 2 + 1
    a = int(80 + 100 * dy / arrow_s)
    canvas_od.rectangle([(x1, arrow_y + dy), (x2, arrow_y + dy + 1)],
                         fill=(255, 102, 0, max(30, a)))
# center dot
for r in [6, 4, 2]:
    canvas_od.ellipse([(cx-r, arrow_y + arrow_s + 10 - r),
                       (cx+r, arrow_y + arrow_s + 10 + r)],
                      fill=(255, 102, 0, 200 - r*20))

# ─── FREE Chrome Extension badge ───────────────────────────────────────────
badge_text  = "FREE Chrome Extension"
badge_w_raw  = canvas_od.textbbox((0, 0), badge_text, font=f_badge)
badge_str_w  = badge_w_raw[2] - badge_w_raw[0]
badge_str_h  = badge_w_raw[3] - badge_w_raw[1]
badge_w      = badge_str_w + 80
badge_h      = badge_str_h + 44
badge_x      = (W - badge_w) // 2
badge_y      = H - 295

# Badge glow halo — soft ambient bloom
badge_glow_sz = (badge_w + 60, badge_h + 60)
badge_glow    = Image.new('RGBA', badge_glow_sz, (0, 0, 0, 0))
bgd = ImageDraw.Draw(badge_glow)
bgd.rounded_rectangle([(10, 10), (badge_w+49, badge_h+49)],
                      radius=36, fill=(255, 102, 0, 45))
badge_glow_blurred = badge_glow.filter(ImageFilter.GaussianBlur(28))
canvas.paste(badge_glow_blurred,
             (badge_x - 30, badge_y - 30),
             badge_glow_blurred.split()[3])

# Badge background (orange)
badge_bg = Image.new('RGBA', (badge_w, badge_h), (255, 102, 0, 255))
badge_mask = Image.new('L', (badge_w, badge_h), 0)
bmd = ImageDraw.Draw(badge_mask)
bmd.rounded_rectangle([(0, 0), (badge_w-1, badge_h-1)], radius=20, fill=255)
canvas.paste(badge_bg, (badge_x, badge_y), badge_mask)

# Badge text (black on orange)
canvas_od.text(((W - badge_str_w)//2,
                badge_y + (badge_h - badge_str_h)//2 - 2),
               badge_text, font=f_badge, fill=BLACK)

# ─── Tiny decorative dots between CTA and screenshot ──────────────────────
dot_y   = 268
dot_r   = 7
dot_gap = 36
n_dots  = 7
total_dot_span = n_dots * dot_r * 2 + (n_dots - 1) * dot_gap
dot_start = (W - total_dot_span) // 2
for i in range(n_dots):
    dx = dot_start + i * (dot_r * 2 + dot_gap)
    intensity = 255 if i == n_dots // 2 else int(80 + 60 * (1 - abs(i - n_dots//2) / (n_dots//2)))
    dot_img = Image.new('RGBA', (dot_r*2 + 10, dot_r*2 + 10), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dot_img)
    dd.ellipse([(5, 5), (dot_r*2+4, dot_r*2+4)], fill=(255, 102, 0, intensity))
    dot_img = dot_img.filter(ImageFilter.GaussianBlur(5))
    canvas.paste(dot_img, (dx - 5, dot_y - 5), dot_img.split()[3])

# ─── Corner accent marks (RGBA overlay) ─────────────────────────────────
corner_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
cod = ImageDraw.Draw(corner_overlay)
# Top-left L-shape
for i in range(4):
    a = int(180 - i * 40)
    cod.rectangle([(0, i*2),     (50 - i*2, i*2+2)], fill=(255, 102, 0, max(20, a)))
    cod.rectangle([(i*2, 0),     (i*2+2,   50 - i*2)], fill=(255, 102, 0, max(20, a)))
# Top-right L-shape
for i in range(4):
    a = int(180 - i * 40)
    cod.rectangle([(W-50+i*2, i*2), (W-i*2,   i*2+2)], fill=(255, 102, 0, max(20, a)))
    cod.rectangle([(W-i*2-2,  0),   (W-i*2,   50-i*2)], fill=(255, 102, 0, max(20, a)))
canvas.paste(corner_overlay, (0, 0), corner_overlay.split()[3])

# ─── Save ───────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
canvas.save(OUT_PATH, "PNG")
print(f"✅  Saved: {OUT_PATH}")
print(f"    Size : {W} × {H}")
