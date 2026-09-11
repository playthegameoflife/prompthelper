#!/usr/bin/env python3
"""
TikTok video compiler — Prompt Helper Gemini ad.
moviepy 2.1.x API. 9:16 (1080×1920), ~26s, Ken Burns zoom + captions + voiceover.
"""
import os
import numpy as np
from PIL import Image as PILImage

from moviepy import (
    ImageClip, AudioFileClip, CompositeVideoClip,
    concatenate_videoclips, TextClip, ColorClip,
    vfx
)

# ── Config ────────────────────────────────────────────────────────────────────
WIDTH, HEIGHT = 1080, 1920
FPS = 30
AUDIO_PATH   = "tiktok/voiceover.mp3"
OUTPUT_PATH  = "/Users/paulpark/Downloads/prompt architect/tiktok-video-1.mp4"

BG_COLOR = (10, 10, 18)

# (image_path, duration_sec, caption_text)
FRAMES = [
    ("tiktok/frame1_generic_cat.png",    3.0,  "This is what 'draw a cat' gets you on Midjourney..."),
    ("tiktok/frame2_enhanced_prompt.png",  5.0,  "Prompt Helper Gemini transforms it into..."),
    ("tiktok/frame3_cinematic_cat.png",   8.0,  "A cinematic masterpiece."),
    ("tiktok/frame4_extension_popup.png",  5.0,  "Get it free on Chrome — link in bio ↓"),
    ("tiktok/frame5_chrome_store.png",    5.0,  "Prompt Helper Gemini — Install Now"),
]


def resize_and_crop_to_16x9(src_path):
    """Load image, fit + crop to 1080×1920, return np array."""
    img = PILImage.open(src_path).convert("RGB")
    iw, ih = img.size

    # Scale so height = 1920
    scale = HEIGHT / ih
    new_w = int(iw * scale)
    img = img.resize((new_w, HEIGHT), PILImage.LANCZOS)

    if new_w > WIDTH:
        left = (new_w - WIDTH) // 2
        img = img.crop((left, 0, left + WIDTH, HEIGHT))
    elif new_w < WIDTH:
        new_img = PILImage.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
        xoff = (WIDTH - new_w) // 2
        new_img.paste(img, (xoff, 0))
        img = new_img

    return np.array(img)


def make_frame(image_path, duration, caption, clip_idx):
    """Build one clip: Ken Burns zoom + fade + caption overlay."""
    arr = resize_and_crop_to_16x9(image_path)
    clip = ImageClip(arr).with_duration(duration)

    # Ken Burns: zoom in on even clips, zoom out on odd clips
    zoom_in = (clip_idx % 2 == 0)

    def zoom_func(t):
        progress = t / duration
        if zoom_in:
            return 1.0 + 0.10 * progress   # 1.0 → 1.10
        else:
            return 1.10 - 0.10 * progress  # 1.10 → 1.0

    # Apply zoom via Resize effect (accepts callable)
    clip = clip.with_effects([vfx.Resize(new_size=zoom_func)])

    # Fade in / fade out
    clip = clip.with_effects([
        vfx.FadeIn(0.3),
        vfx.FadeOut(0.3),
    ])

    if caption:
        # Dark gradient bar behind caption
        bar = (
            ColorClip(size=(WIDTH, 280), color=(0, 0, 0))
            .with_opacity(0.65)
            .with_duration(duration)
            .with_position(("center", HEIGHT - 250))
        )

        txt = (
            TextClip(
                text=caption,
                font="/System/Library/Fonts/HelveticaNeue.ttc",
                font_size=54,
                color="white",
                stroke_color="black",
                stroke_width=4,
                size=(WIDTH - 80, None),
                text_align="center",
                horizontal_align="center",
            )
            .with_duration(duration)
            .with_position(("center", HEIGHT - 230))
        )

        clip = CompositeVideoClip([clip, bar, txt], size=(WIDTH, HEIGHT))

    return clip


def build_video():
    print("Loading audio...")
    audio = AudioFileClip(AUDIO_PATH)

    print("Building clips...")
    clips = []
    for i, (img_path, dur, caption) in enumerate(FRAMES):
        print(f"  [{i+1}/{len(FRAMES)}] {img_path}  {dur}s")
        clips.append(make_frame(img_path, dur, caption, i))

    print("Concatenating...")
    video = concatenate_videoclips(clips, method="compose")
    audio = audio.subclipped(0, min(audio.duration, video.duration))

    print("Compositing audio...")
    final = video.with_audio(audio)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    print(f"Exporting → {OUTPUT_PATH}")
    final.write_videofile(
        OUTPUT_PATH,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        bitrate="8000k",
        preset="ultrafast",
    )
    print("✅ Done!")


if __name__ == "__main__":
    build_video()
