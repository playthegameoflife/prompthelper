#!/usr/bin/env python3
"""
Premium TikTok CTA Slide for Prompt Helper Gemini
9:16 Format (1080x1920)
Orange + Black theme with neon glow effects
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
import os

# Canvas dimensions (TikTok 9:16)
WIDTH = 1080
HEIGHT = 1920

# Colors
BLACK = (0, 0, 0)
ORANGE = (255, 102, 0)
ORANGE_BRIGHT = (255, 120, 0)
ORANGE_GLOW = (255, 80, 0)
WHITE = (255, 255, 255)
DARK_GRAY = (30, 30, 30)
MID_GRAY = (50, 50, 50)

# Output path
OUTPUT_PATH = "/Users/paulpark/Downloads/prompt architect/tiktok-cta-premium.png"

def load_source_image():
    """Load and prepare the source hero image"""
    source_path = "/Users/paulpark/.mavis/v2/assets/2026/07/29/17-41-36-627-asset_20260729-174136-627_2a973ea40846_b11f53b0-Screenshot 2026-07-29 at 3.38.57 PM.png"
    
    if os.path.exists(source_path):
        img = Image.open(source_path).convert("RGBA")
        # Crop to focus on the extension UI area
        # Source image appears to be roughly 1200x800 browser view
        # Focus on the extension popup area
        width, height = img.size
        # Take center portion focusing on the UI
        crop_height = int(height * 0.65)
        top = int(height * 0.15)
        img = img.crop((0, top, width, top + crop_height))
        return img
    return None

def create_glow_layer(size, color, intensity=1.0):
    """Create a glowing layer"""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Draw multiple concentric glow circles
    for i in range(8, 0, -1):
        alpha = int(60 * intensity * (i / 8))
        radius = int(20 * intensity * (i / 4))
        glow_color = (*color[:3], alpha)
        x = size[0] // 2
        y = size[1] // 2
        draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=glow_color)
    
    # Apply blur for smoother glow
    layer = layer.filter(ImageFilter.GaussianBlur(radius=15))
    return layer

def draw_glow_text(draw, text, position, font, color, glow_color, glow_radius=20):
    """Draw text with orange glow effect"""
    x, y = position
    
    # Draw glow layers
    for i in range(5, 0, -1):
        alpha = int(40 * (i / 5))
        glow_font = font
        glow_pos = (x, y + (5-i)*2)
        # Create a temporary layer for glow
        temp_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
        temp_draw = ImageDraw.Draw(temp_layer)
        temp_draw.text(glow_pos, text, font=glow_font, fill=(*glow_color[:3], alpha))
        temp_layer = temp_layer.filter(ImageFilter.GaussianBlur(radius=glow_radius * (i/5)))
        draw.bitmap((0, 0), temp_layer, alpha=True)
    
    # Draw main text
    draw.text(position, text, font=font, fill=color)

def create_premium_cta():
    """Create the premium TikTok CTA slide"""
    
    # Create base canvas
    canvas = Image.new('RGBA', (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(canvas)
    
    # Try to load fonts
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Supplemental/Poppins-Bold.ttf", 120)
        font_medium = ImageFont.truetype("/System/Library/Fonts/Supplemental/Poppins-Bold.ttf", 72)
        font_small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Poppins-SemiBold.ttf", 42)
        font_cta = ImageFont.truetype("/System/Library/Fonts/Supplemental/Poppins-ExtraBold.ttf", 48)
        font_badge = ImageFont.truetype("/System/Library/Fonts/Supplemental/Poppins-Bold.ttf", 36)
        font_body = ImageFont.truetype("/System/Library/Fonts/Supplemental/Poppins-Regular.ttf", 28)
        font_arrow = ImageFont.truetype("/System/Library/Fonts/Supplemental/Poppins-Bold.ttf", 36)
    except:
        # Fallback to default fonts
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
        font_cta = ImageFont.load_default()
        font_badge = ImageFont.load_default()
        font_body = ImageFont.load_default()
        font_arrow = ImageFont.load_default()
    
    # ========== ZONE 1: TOP (15-25%) - LINK IN BIO ==========
    
    # Top glow effect
    top_glow = Image.new('RGBA', (WIDTH, 300), (0, 0, 0, 0))
    top_glow_draw = ImageDraw.Draw(top_glow)
    
    # Draw horizontal glow bar at top
    for i in range(30, 0, -1):
        alpha = int(25 * (i / 30))
        y_pos = 80 + (30 - i) * 2
        top_glow_draw.rectangle([200, y_pos - i*3, WIDTH - 200, y_pos + i*3], 
                                fill=(*ORANGE_GLOW, alpha))
    top_glow = top_glow.filter(ImageFilter.GaussianBlur(radius=25))
    canvas.paste(top_glow, (0, 0), top_glow)
    
    # LINK IN BIO - Big bold text with glow
    link_in_bio_text = "LINK IN BIO"
    link_bbox = draw.textbbox((0, 0), link_in_bio_text, font=font_large)
    link_width = link_bbox[2] - link_bbox[0]
    link_x = (WIDTH - link_width) // 2
    link_y = 100
    
    # Orange glow behind text
    glow_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    # Multiple glow layers for premium look
    for blur_radius in [30, 20, 10, 5]:
        for offset in range(-20, 21, 10):
            glow_text = link_in_bio_text
            glow_x = link_x + offset
            glow_y = link_y + abs(offset) // 3
            alpha = max(5, 40 - abs(offset))
            glow_draw.text((glow_x, glow_y), glow_text, font=font_large, 
                          fill=(*ORANGE, alpha))
    
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=20))
    canvas.paste(glow_layer, (0, 0), glow_layer)
    
    # Main text
    draw.text((link_x, link_y), link_in_bio_text, font=font_large, fill=ORANGE)
    
    # ========== ZONE 2: MIDDLE (50%) - HERO IMAGE ==========
    
    # Load and process hero image
    hero_img = load_source_image()
    
    if hero_img:
        # Calculate hero dimensions to fit in middle zone
        hero_max_height = 750
        hero_max_width = 900
        
        # Scale to fit while maintaining aspect ratio
        img_ratio = hero_img.width / hero_img.height
        if img_ratio > hero_max_width / hero_max_height:
            new_width = hero_max_width
            new_height = int(new_width / img_ratio)
        else:
            new_height = hero_max_height
            new_width = int(new_height * img_ratio)
        
        hero_img = hero_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Create frame with glow
        frame_padding = 25
        frame_x = (WIDTH - new_width) // 2 - frame_padding
        frame_y = 340
        frame_width = new_width + frame_padding * 2
        frame_height = new_height + frame_padding * 2
        
        # Draw orange glow border
        glow_border = Image.new('RGBA', (frame_width + 40, frame_height + 40), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_border)
        
        for i in range(20, 0, -1):
            alpha = int(30 * (i / 20))
            glow_draw.rectangle([20-i, 20-i, frame_width+20+i, frame_height+20+i], 
                               outline=(*ORANGE_GLOW, alpha), width=2)
        glow_border = glow_border.filter(ImageFilter.GaussianBlur(radius=15))
        canvas.paste(glow_border, (frame_x - 20, frame_y - 20), glow_border)
        
        # Draw main orange border
        draw.rectangle([frame_x, frame_y, frame_x + frame_width, frame_y + frame_height],
                      outline=ORANGE, width=4)
        
        # Inner border (brighter)
        inner_padding = 3
        draw.rectangle([frame_x + inner_padding, frame_y + inner_padding,
                       frame_x + frame_width - inner_padding, frame_y + frame_height - inner_padding],
                      outline=ORANGE_BRIGHT, width=2)
        
        # Paste hero image
        hero_x = frame_x + frame_padding
        hero_y = frame_y + frame_padding
        
        # Create a slightly lighter version for contrast
        enhancer = ImageEnhance.Brightness(hero_img)
        hero_img_bright = enhancer.enhance(1.1)
        
        # Convert to RGBA if needed
        if hero_img_bright.mode != 'RGBA':
            hero_img_bright = hero_img_bright.convert('RGBA')
        
        canvas.paste(hero_img_bright, (hero_x, hero_y), hero_img_bright)
    
    # ========== PROMPT TRANSFORMATION VISUAL ==========
    
    # "draw a dog" → enhanced prompt visual below hero
    prompt_y = frame_y + new_height + frame_padding + 40
    
    # Input prompt box
    input_box_width = 350
    input_box_height = 60
    input_x = (WIDTH - input_box_width) // 2 - 150
    input_y = prompt_y
    
    draw.rounded_rectangle([input_x, input_y, input_x + input_box_width, input_y + input_box_height],
                           radius=12, fill=DARK_GRAY, outline=ORANGE, width=2)
    
    input_text = '"draw a dog"'
    input_bbox = draw.textbbox((0, 0), input_text, font=font_body)
    input_text_width = input_bbox[2] - input_bbox[0]
    draw.text((input_x + (input_box_width - input_text_width) // 2, input_y + 15),
             input_text, font=font_body, fill=WHITE)
    
    # Arrow
    arrow_x = input_x + input_box_width + 10
    arrow_y = input_y + 15
    draw.text((arrow_x, arrow_y), "→", font=font_medium, fill=ORANGE)
    
    # Enhanced prompt box
    enhanced_x = arrow_x + 60
    enhanced_box_width = 400
    enhanced_y = prompt_y
    
    # Glow behind enhanced box
    enhanced_glow = Image.new('RGBA', (enhanced_box_width + 20, input_box_height + 20), (0, 0, 0, 0))
    enhanced_glow_draw = ImageDraw.Draw(enhanced_glow)
    for i in range(15, 0, -1):
        alpha = int(25 * (i / 15))
        enhanced_glow_draw.rounded_rectangle([10-i, 10-i, enhanced_box_width+10+i, input_box_height+10+i],
                                             radius=12, outline=(*ORANGE_GLOW, alpha), width=2)
    enhanced_glow = enhanced_glow.filter(ImageFilter.GaussianBlur(radius=10))
    canvas.paste(enhanced_glow, (enhanced_x - 10, enhanced_y - 10), enhanced_glow)
    
    draw.rounded_rectangle([enhanced_x, enhanced_y, enhanced_x + enhanced_box_width, enhanced_y + input_box_height],
                           radius=12, fill=MID_GRAY, outline=ORANGE, width=3)
    
    enhanced_text = "PRO-GRADE PROMPT"
    enhanced_bbox = draw.textbbox((0, 0), enhanced_text, font=font_small)
    enhanced_text_width = enhanced_bbox[2] - enhanced_bbox[0]
    draw.text((enhanced_x + (enhanced_box_width - enhanced_text_width) // 2, enhanced_y + 12),
             enhanced_text, font=font_small, fill=ORANGE)
    
    # ========== ZONE 3: BOTTOM (25-35%) - CTA ==========
    
    bottom_start = 1350
    
    # Main headline
    headline_text = "SIMPLE PROMPT"
    headline_bbox = draw.textbbox((0, 0), headline_text, font=font_medium)
    headline_width = headline_bbox[2] - headline_bbox[0]
    headline_x = (WIDTH - headline_width) // 2
    headline_y = bottom_start
    
    # Headline glow
    for blur in [15, 10, 5]:
        hl_glow = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
        hl_draw = ImageDraw.Draw(hl_glow)
        for offset in range(-8, 9, 4):
            alpha = max(10, 50 - abs(offset) * 3)
            hl_draw.text((headline_x + offset, headline_y + abs(offset) // 2),
                        headline_text, font=font_medium, fill=(*ORANGE, alpha))
        hl_glow = hl_glow.filter(ImageFilter.GaussianBlur(radius=blur))
        canvas.paste(hl_glow, (0, 0), hl_glow)
    
    draw.text((headline_x, headline_y), headline_text, font=font_medium, fill=WHITE)
    
    # Second line
    headline2_text = "TO PRO-GRADE PROMPT"
    headline2_bbox = draw.textbbox((0, 0), headline2_text, font=font_medium)
    headline2_width = headline2_bbox[2] - headline2_bbox[0]
    headline2_x = (WIDTH - headline2_width) // 2
    headline2_y = headline_y + 90
    
    # Headline2 glow
    for blur in [15, 10, 5]:
        hl2_glow = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
        hl2_draw = ImageDraw.Draw(hl2_glow)
        for offset in range(-8, 9, 4):
            alpha = max(10, 50 - abs(offset) * 3)
            hl2_draw.text((headline2_x + offset, headline2_y + abs(offset) // 2),
                         headline2_text, font=font_medium, fill=(*ORANGE, alpha))
        hl2_glow = hl2_glow.filter(ImageFilter.GaussianBlur(radius=blur))
        canvas.paste(hl2_glow, (0, 0), hl2_glow)
    
    draw.text((headline2_x, headline2_y), headline2_text, font=font_medium, fill=ORANGE)
    
    # FREE Chrome Extension badge
    badge_width = 320
    badge_height = 70
    badge_x = (WIDTH - badge_width) // 2
    badge_y = headline2_y + 120
    
    # Badge glow
    badge_glow = Image.new('RGBA', (badge_width + 30, badge_height + 30), (0, 0, 0, 0))
    badge_glow_draw = ImageDraw.Draw(badge_glow)
    for i in range(20, 0, -1):
        alpha = int(40 * (i / 20))
        badge_glow_draw.rounded_rectangle([15-i, 15-i, badge_width+15+i, badge_height+15+i],
                                          radius=20, outline=(*ORANGE_GLOW, alpha), width=3)
    badge_glow = badge_glow.filter(ImageFilter.GaussianBlur(radius=15))
    canvas.paste(badge_glow, (badge_x - 15, badge_y - 15), badge_glow)
    
    # Badge background
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_width, badge_y + badge_height],
                          radius=20, fill=ORANGE)
    
    # Badge text
    badge_text = "FREE Chrome Extension"
    badge_bbox = draw.textbbox((0, 0), badge_text, font=font_cta)
    badge_text_width = badge_bbox[2] - badge_bbox[0]
    badge_text_x = badge_x + (badge_width - badge_text_width) // 2
    badge_text_y = badge_y + 12
    draw.text((badge_text_x, badge_text_y), badge_text, font=font_cta, fill=BLACK)
    
    # Arrow icon on badge
    arrow_text = "→"
    arrow_bbox = draw.textbbox((0, 0), arrow_text, font=font_cta)
    arrow_width = arrow_bbox[2] - arrow_bbox[0]
    arrow_x = badge_x + badge_width - arrow_width - 25
    arrow_y = badge_y + 10
    draw.text((arrow_x, arrow_y), arrow_text, font=font_cta, fill=BLACK)
    
    # Bottom tagline
    tagline_y = badge_y + 100
    tagline_text = "Prompt Helper Gemini"
    tagline_bbox = draw.textbbox((0, 0), tagline_text, font=font_small)
    tagline_width = tagline_bbox[2] - tagline_bbox[0]
    tagline_x = (WIDTH - tagline_width) // 2
    draw.text((tagline_x, tagline_y), tagline_text, font=font_small, fill=MID_GRAY)
    
    # ========== DECORATIVE ELEMENTS ==========
    
    # Corner accents - top left
    corner_size = 60
    draw.line([(30, 30), (30 + corner_size, 30)], fill=ORANGE, width=4)
    draw.line([(30, 30), (30, 30 + corner_size)], fill=ORANGE, width=4)
    
    # Corner accents - top right
    draw.line([(WIDTH - 30, 30), (WIDTH - 30 - corner_size, 30)], fill=ORANGE, width=4)
    draw.line([(WIDTH - 30, 30), (WIDTH - 30, 30 + corner_size)], fill=ORANGE, width=4)
    
    # Corner accents - bottom left
    draw.line([(30, HEIGHT - 30), (30 + corner_size, HEIGHT - 30)], fill=ORANGE, width=4)
    draw.line([(30, HEIGHT - 30), (30, HEIGHT - 30 - corner_size)], fill=ORANGE, width=4)
    
    # Corner accents - bottom right
    draw.line([(WIDTH - 30, HEIGHT - 30), (WIDTH - 30 - corner_size, HEIGHT - 30)], fill=ORANGE, width=4)
    draw.line([(WIDTH - 30, HEIGHT - 30), (WIDTH - 30, HEIGHT - 30 - corner_size)], fill=ORANGE, width=4)
    
    # Subtle gradient overlay at top for premium feel
    top_gradient = Image.new('RGBA', (WIDTH, 150), (0, 0, 0, 0))
    top_gradient_draw = ImageDraw.Draw(top_gradient)
    for y in range(150):
        alpha = int(100 * (1 - y / 150))
        top_gradient_draw.line([(0, y), (WIDTH, y)], fill=(255, 102, 0, alpha))
    top_gradient = top_gradient.filter(ImageFilter.GaussianBlur(radius=30))
    canvas.paste(top_gradient, (0, 0), top_gradient)
    
    # Save the result
    # Convert to RGB for PNG compatibility
    if canvas.mode == 'RGBA':
        # Create white background
        final = Image.new('RGB', canvas.size, BLACK)
        final.paste(canvas, mask=canvas.split()[3])
    else:
        final = canvas
    
    # Save
    final.save(OUTPUT_PATH, 'PNG', quality=95)
    print(f"✅ Premium TikTok CTA saved to: {OUTPUT_PATH}")
    
    return OUTPUT_PATH

if __name__ == "__main__":
    create_premium_cta()
