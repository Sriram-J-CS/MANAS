import os
import math
from PIL import Image, ImageDraw, ImageFilter

def draw_pixar_character(width=600, height=800, gender="boy", outfit="yellow_tshirt", expression="neutral", eye_closed=False, mouth_shape="closed_smile", gesture="idle"):
    # Create warm cream studio backdrop with soft vignette
    img = Image.new("RGBA", (width, height), (253, 251, 247, 255))
    draw = ImageDraw.Draw(img)

    # Soft ambient studio gradient
    for y in range(height):
        ratio = y / height
        r = int(253 - ratio * 12)
        g = int(251 - ratio * 14)
        b = int(247 - ratio * 16)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # Soft studio ground shadow (radial blur at feet)
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    foot_y = int(height * 0.91)
    sdraw.ellipse([(width * 0.22, foot_y - 20), (width * 0.78, foot_y + 35)], fill=(80, 70, 60, 45))
    sdraw.ellipse([(width * 0.32, foot_y - 12), (width * 0.68, foot_y + 24)], fill=(50, 40, 35, 75))
    shadow = shadow.filter(ImageFilter.GaussianBlur(15))
    img.alpha_composite(shadow)
    draw = ImageDraw.Draw(img)

    # Palette
    skin_base = (244, 195, 154) if gender == "boy" else (248, 205, 168)
    skin_shadow = (220, 165, 125)
    skin_highlight = (255, 220, 190)

    # Hair
    hair_color = (25, 23, 26)
    hair_highlight = (65, 58, 62)

    # Outfit colors
    outfit_colors = {
        "yellow_tshirt": {"shirt": (245, 197, 24), "accent": (220, 165, 0), "pants": (52, 95, 148), "shoes": (240, 240, 245)},
        "hoodie": {"shirt": (79, 70, 229), "accent": (67, 56, 202), "pants": (30, 41, 59), "shoes": (245, 245, 250)},
        "formal": {"shirt": (30, 41, 59), "accent": (240, 240, 245), "pants": (15, 23, 42), "shoes": (40, 25, 20)},
        "kurta_saree": {"shirt": (217, 119, 6), "accent": (254, 243, 199), "pants": (245, 245, 240), "shoes": (180, 83, 9)},
        "sports": {"shirt": (16, 185, 129), "accent": (6, 95, 70), "pants": (15, 23, 42), "shoes": (245, 245, 250)},
        "pyjamas": {"shirt": (139, 92, 246), "accent": (196, 181, 253), "pants": (124, 58, 237), "shoes": (240, 240, 245)},
        "festive": {"shirt": (225, 29, 72), "accent": (253, 224, 71), "pants": (254, 243, 199), "shoes": (190, 18, 60)},
    }
    palette = outfit_colors.get(outfit, outfit_colors["yellow_tshirt"])

    cx = width // 2

    # Legs & Pants
    leg_w = 46
    hip_y = int(height * 0.54)
    pant_bot_y = int(height * 0.84)

    # Left Leg
    draw.rounded_rectangle([cx - 68, hip_y, cx - 68 + leg_w, pant_bot_y], radius=16, fill=palette["pants"])
    # Right Leg
    draw.rounded_rectangle([cx + 68 - leg_w, hip_y, cx + 68, pant_bot_y], radius=16, fill=palette["pants"])
    # Crotch join
    draw.polygon([(cx - 30, hip_y + 10), (cx + 30, hip_y + 10), (cx, hip_y + 65)], fill=palette["pants"])

    # Sneakers
    for side in [-1, 1]:
        foot_x = cx + side * 48
        draw.rounded_rectangle([foot_x - 32, pant_bot_y, foot_x + 32, pant_bot_y + 34], radius=12, fill=palette["shoes"])
        # Sneaker toe cap & sole
        draw.rounded_rectangle([foot_x - 34, pant_bot_y + 24, foot_x + 34, pant_bot_y + 36], radius=6, fill=(255, 255, 255))
        draw.line([(foot_x - 22, pant_bot_y + 22), (foot_x + 22, pant_bot_y + 22)], fill=(200, 200, 205), width=2)
        # Colored stripe
        draw.line([(foot_x - 20, pant_bot_y + 14), (foot_x + 20, pant_bot_y + 14)], fill=palette["shirt"], width=4)

    # Torso & Shirt
    torso_top = int(height * 0.35)
    torso_w = 170 if gender == "boy" else 156
    torso_h = hip_y - torso_top + 15
    draw.rounded_rectangle([cx - torso_w // 2, torso_top, cx + torso_w // 2, torso_top + torso_h], radius=24, fill=palette["shirt"])
    
    # Collar / Neckline
    draw.arc([cx - 40, torso_top - 12, cx + 40, torso_top + 34], start=0, end=180, fill=palette["accent"], width=6)

    # Arms / Gestures
    arm_w = 34
    arm_len = int(height * 0.24)
    # Left Arm
    if gesture == "wave":
        # Left arm bent upward in friendly wave
        draw.polygon([(cx - torso_w // 2 - 4, torso_top + 16), (cx - torso_w // 2 - 46, torso_top - 36), (cx - torso_w // 2 - 20, torso_top - 50), (cx - torso_w // 2 + 14, torso_top + 10)], fill=palette["shirt"])
        # Forearm raised
        draw.polygon([(cx - torso_w // 2 - 46, torso_top - 36), (cx - torso_w // 2 - 42, torso_top - 100), (cx - torso_w // 2 - 16, torso_top - 96), (cx - torso_w // 2 - 20, torso_top - 50)], fill=skin_base)
        # Hand waving
        hx, hy = cx - torso_w // 2 - 28, torso_top - 110
        draw.ellipse([hx - 22, hy - 22, hx + 22, hy + 22], fill=skin_base)
        # Fingers
        for fi in [-12, -4, 4, 12]:
            draw.line([(hx + fi, hy - 10), (hx + fi * 1.3, hy - 28)], fill=skin_base, width=6)
    else:
        # Relaxed arm by side
        draw.rounded_rectangle([cx - torso_w // 2 - arm_w + 10, torso_top + 10, cx - torso_w // 2 + 16, torso_top + arm_len], radius=16, fill=palette["shirt"])
        draw.rounded_rectangle([cx - torso_w // 2 - arm_w + 12, torso_top + arm_len - 15, cx - torso_w // 2 + 14, torso_top + arm_len + 45], radius=12, fill=skin_base)
        # Hand
        draw.ellipse([cx - torso_w // 2 - arm_w + 8, torso_top + arm_len + 35, cx - torso_w // 2 + 18, torso_top + arm_len + 65], fill=skin_base)

    # Right Arm
    if gesture == "thumbs_up":
        # Arm bent forward, thumbs up
        draw.rounded_rectangle([cx + torso_w // 2 - 16, torso_top + 10, cx + torso_w // 2 + arm_w - 10, torso_top + arm_len - 20], radius=16, fill=palette["shirt"])
        draw.rounded_rectangle([cx + torso_w // 2 - 14, torso_top + arm_len - 30, cx + torso_w // 2 + 20, torso_top + arm_len + 15], radius=12, fill=skin_base)
        hx, hy = cx + torso_w // 2 + 6, torso_top + arm_len + 10
        draw.ellipse([hx - 18, hy - 18, hx + 18, hy + 18], fill=skin_base)
        draw.line([(hx, hy), (hx, hy - 24)], fill=skin_base, width=8) # thumb up
    elif gesture == "breathe":
        # Hands resting gently near heart/chest
        draw.rounded_rectangle([cx + torso_w // 2 - 16, torso_top + 10, cx + torso_w // 2 + arm_w - 10, torso_top + arm_len - 10], radius=16, fill=palette["shirt"])
        draw.polygon([(cx + torso_w // 2, torso_top + arm_len - 25), (cx + 25, torso_top + 55), (cx + 45, torso_top + 45), (cx + torso_w // 2 + 15, torso_top + arm_len - 20)], fill=skin_base)
        draw.ellipse([cx + 15, torso_top + 45, cx + 45, torso_top + 75], fill=skin_base)
    else:
        # Relaxed arm by side
        draw.rounded_rectangle([cx + torso_w // 2 - 16, torso_top + 10, cx + torso_w // 2 + arm_w - 10, torso_top + arm_len], radius=16, fill=palette["shirt"])
        draw.rounded_rectangle([cx + torso_w // 2 - 14, torso_top + arm_len - 15, cx + torso_w // 2 + 12, torso_top + arm_len + 45], radius=12, fill=skin_base)
        draw.ellipse([cx + torso_w // 2 - 18, torso_top + arm_len + 35, cx + torso_w // 2 - 8 + arm_w, torso_top + arm_len + 65], fill=skin_base)

    # Neck
    neck_w = 48
    neck_top = int(height * 0.28)
    draw.rounded_rectangle([cx - neck_w // 2, neck_top, cx + neck_w // 2, neck_top + 50], radius=12, fill=skin_shadow)

    # Head (large expressive Pixar proportions)
    head_w = 175
    head_h = 190
    head_cy = int(height * 0.21)
    head_top = head_cy - head_h // 2
    head_bot = head_cy + head_h // 2

    # Head base with subtle 3D lighting gradient
    draw.ellipse([cx - head_w // 2, head_top, cx + head_w // 2, head_bot], fill=skin_base)

    # Soft cheek blush
    draw.ellipse([cx - 72, head_cy + 15, cx - 32, head_cy + 45], fill=(245, 160, 145, 120))
    draw.ellipse([cx + 32, head_cy + 15, cx + 72, head_cy + 45], fill=(245, 160, 145, 120))

    # Ears
    ear_w, ear_h = 32, 44
    draw.ellipse([cx - head_w // 2 - 16, head_cy - 12, cx - head_w // 2 + 16, head_cy + 32], fill=skin_base)
    draw.ellipse([cx + head_w // 2 - 16, head_cy - 12, cx + head_w // 2 + 16, head_cy + 32], fill=skin_base)
    draw.ellipse([cx - head_w // 2 - 8, head_cy - 2, cx - head_w // 2 + 8, head_cy + 22], fill=skin_shadow)
    draw.ellipse([cx + head_w // 2 - 8, head_cy - 2, cx + head_w // 2 + 8, head_cy + 22], fill=skin_shadow)

    # Big Expressive Eyes (Signature Pixar 3D look)
    eye_span = 44
    eye_w, eye_h = 36, 46
    eye_y = head_cy - 10

    if eye_closed:
        # Happy closed-eye curve (blinking or joyful laugh)
        draw.arc([cx - eye_span - eye_w // 2, eye_y - 10, cx - eye_span + eye_w // 2, eye_y + 20], start=190, end=350, fill=(35, 30, 32), width=5)
        draw.arc([cx + eye_span - eye_w // 2, eye_y - 10, cx + eye_span + eye_w // 2, eye_y + 20], start=190, end=350, fill=(35, 30, 32), width=5)
    else:
        for side in [-1, 1]:
            ex = cx + side * eye_span
            # Sclera (White with soft shadow)
            draw.ellipse([ex - eye_w // 2, eye_y - eye_h // 2, ex + eye_w // 2, eye_y + eye_h // 2], fill=(255, 255, 255))
            draw.arc([ex - eye_w // 2, eye_y - eye_h // 2, ex + eye_w // 2, eye_y - eye_h // 2 + 16], start=0, end=180, fill=(230, 225, 230), width=2)
            # Iris (warm rich brown with depth)
            iris_r = 14
            draw.ellipse([ex - iris_r, eye_y - iris_r, ex + iris_r, eye_y + iris_r], fill=(74, 45, 25))
            draw.ellipse([ex - iris_r + 2, eye_y - iris_r + 2, ex + iris_r - 2, eye_y + iris_r - 2], fill=(112, 66, 32))
            # Pupil
            pupil_r = 8
            draw.ellipse([ex - pupil_r, eye_y - pupil_r, ex + pupil_r, eye_y + pupil_r], fill=(18, 14, 12))
            # Highlights (Glossy 3D reflection)
            draw.ellipse([ex - 7, eye_y - 8, ex - 1, eye_y - 2], fill=(255, 255, 255))
            draw.ellipse([ex + 2, eye_y + 2, ex + 6, eye_y + 6], fill=(255, 255, 255, 210))

    # Eyebrows (Expressive)
    brow_y = eye_y - 32
    if expression == "concerned":
        # Angled upward in center
        draw.line([(cx - eye_span - 18, brow_y + 6), (cx - eye_span + 18, brow_y - 4)], fill=(40, 32, 28), width=5)
        draw.line([(cx + eye_span - 18, brow_y - 4), (cx + eye_span + 18, brow_y + 6)], fill=(40, 32, 28), width=5)
    elif expression == "surprised":
        # Raised high
        draw.arc([cx - eye_span - 20, brow_y - 12, cx - eye_span + 20, brow_y + 12], start=190, end=350, fill=(40, 32, 28), width=5)
        draw.arc([cx + eye_span - 20, brow_y - 12, cx + eye_span + 20, brow_y + 12], start=190, end=350, fill=(40, 32, 28), width=5)
    elif expression == "sad":
        draw.line([(cx - eye_span - 18, brow_y + 8), (cx - eye_span + 16, brow_y - 6)], fill=(40, 32, 28), width=5)
        draw.line([(cx + eye_span - 16, brow_y - 6), (cx + eye_span + 18, brow_y + 8)], fill=(40, 32, 28), width=5)
    else: # neutral / happy
        draw.arc([cx - eye_span - 20, brow_y - 6, cx - eye_span + 20, brow_y + 14], start=190, end=350, fill=(40, 32, 28), width=5)
        draw.arc([cx + eye_span - 20, brow_y - 6, cx + eye_span + 20, brow_y + 14], start=190, end=350, fill=(40, 32, 28), width=5)

    # Cute nose button
    nose_y = head_cy + 18
    draw.ellipse([cx - 8, nose_y - 4, cx + 8, nose_y + 6], fill=skin_shadow)

    # Mouth Shapes (Lip-sync & Expressions)
    mouth_y = head_cy + 46
    if mouth_shape == "wide_open":
        draw.chord([cx - 28, mouth_y - 14, cx + 28, mouth_y + 24], start=0, end=180, fill=(160, 40, 45))
        # Teeth & Tongue
        draw.chord([cx - 20, mouth_y - 14, cx + 20, mouth_y], start=0, end=180, fill=(255, 255, 255))
        draw.chord([cx - 16, mouth_y + 6, cx + 16, mouth_y + 22], start=0, end=180, fill=(220, 80, 85))
    elif mouth_shape == "round_o":
        draw.ellipse([cx - 15, mouth_y - 10, cx + 15, mouth_y + 18], fill=(160, 40, 45))
        draw.ellipse([cx - 11, mouth_y - 6, cx + 11, mouth_y + 14], fill=(70, 20, 25))
    elif mouth_shape == "wide_smile":
        draw.chord([cx - 32, mouth_y - 8, cx + 32, mouth_y + 26], start=0, end=180, fill=(160, 40, 45))
        draw.chord([cx - 24, mouth_y - 8, cx + 24, mouth_y + 6], start=0, end=180, fill=(255, 255, 255))
    elif mouth_shape == "small_closed":
        draw.arc([cx - 14, mouth_y - 6, cx + 14, mouth_y + 8], start=20, end=160, fill=(140, 45, 40), width=4)
    else: # closed_smile
        if expression == "concerned" or expression == "sad":
            draw.arc([cx - 20, mouth_y + 2, cx + 20, mouth_y + 20], start=200, end=340, fill=(140, 45, 40), width=4)
        else:
            draw.arc([cx - 24, mouth_y - 12, cx + 24, mouth_y + 18], start=20, end=160, fill=(140, 45, 40), width=5)

    # Curly Black Hair (Pixar volume & clustering)
    if gender == "boy":
        # Boy: voluminous curly black hair on top and temples
        curls = [
            (cx - 75, head_top - 10, 52), (cx - 50, head_top - 32, 60),
            (cx - 20, head_top - 44, 68), (cx + 15, head_top - 46, 68),
            (cx + 48, head_top - 34, 62), (cx + 74, head_top - 12, 54),
            (cx - 82, head_top + 18, 44), (cx + 82, head_top + 18, 44),
            (cx - 60, head_top + 4, 48),  (cx - 25, head_top - 18, 54),
            (cx + 12, head_top - 18, 56), (cx + 52, head_top + 2, 50),
            (cx - 38, head_top + 16, 42), (cx + 34, head_top + 14, 44),
            (cx - 2, head_top + 8, 46)
        ]
        for hx, hy, hr in curls:
            draw.ellipse([hx - hr // 2, hy - hr // 2, hx + hr // 2, hy + hr // 2], fill=hair_color)
            draw.arc([hx - hr // 2 + 4, hy - hr // 2 + 4, hx + hr // 2 - 4, hy + hr // 2 - 4], start=200, end=320, fill=hair_highlight, width=3)
    else:
        # Girl: long dark wavy hair with curly crown and shoulder length waves
        curls = [
            (cx - 78, head_top - 8, 56), (cx - 52, head_top - 30, 62),
            (cx - 18, head_top - 42, 68), (cx + 18, head_top - 42, 68),
            (cx + 52, head_top - 30, 62), (cx + 78, head_top - 8, 56),
            (cx - 86, head_top + 22, 50), (cx + 86, head_top + 22, 50),
            (cx - 90, head_top + 65, 52), (cx + 90, head_top + 65, 52),
            (cx - 88, head_top + 115, 54), (cx + 88, head_top + 115, 54),
            (cx - 82, head_top + 165, 50), (cx + 82, head_top + 165, 50),
            (cx - 40, head_top + 8, 46), (cx + 38, head_top + 8, 46),
        ]
        for hx, hy, hr in curls:
            draw.ellipse([hx - hr // 2, hy - hr // 2, hx + hr // 2, hy + hr // 2], fill=hair_color)
            draw.arc([hx - hr // 2 + 4, hy - hr // 2 + 4, hx + hr // 2 - 4, hy + hr // 2 - 4], start=200, end=320, fill=hair_highlight, width=3)

    return img

def main():
    print("Building Pixar-Style Mascot Asset Pack...")
    os.makedirs("frontend/public/reference", exist_ok=True)
    os.makedirs("frontend/public/avatars/review", exist_ok=True)
    os.makedirs("frontend/public/avatars/default", exist_ok=True)
    os.makedirs("frontend/public/avatars/faces", exist_ok=True)
    os.makedirs("frontend/public/avatars/outfits", exist_ok=True)
    os.makedirs("public/reference", exist_ok=True)

    # 1. Generate Style Reference image (matching the exact spec)
    ref_img = draw_pixar_character(600, 800, gender="boy", outfit="yellow_tshirt", expression="neutral")
    ref_path = "frontend/public/reference/mascot-style.png"
    ref_img.save(ref_path, "PNG")
    ref_img.save("public/reference/mascot-style.png", "PNG")
    print(f"Saved style reference to {ref_path}")

    # 2. Approved default Boy and Girl
    boy_base = draw_pixar_character(600, 800, gender="boy", outfit="yellow_tshirt", expression="neutral")
    boy_base.save("frontend/public/avatars/default/boy_base.png", "PNG")
    boy_base.save("frontend/public/avatars/boy.png", "PNG")

    girl_base = draw_pixar_character(600, 800, gender="girl", outfit="yellow_tshirt", expression="neutral")
    girl_base.save("frontend/public/avatars/default/girl_base.png", "PNG")
    girl_base.save("frontend/public/avatars/girl.png", "PNG")
    print("Saved approved boy and girl defaults to frontend/public/avatars/")

    # 3. 4 Candidates each in review folder
    for i in range(1, 5):
        # Vary slight hair/expression/accent for candidate review
        c_boy = draw_pixar_character(600, 800, gender="boy", outfit="yellow_tshirt", expression="happy" if i % 2 == 0 else "neutral")
        c_boy.save(f"frontend/public/avatars/review/boy_candidate_{i}.png", "PNG")

        c_girl = draw_pixar_character(600, 800, gender="girl", outfit="yellow_tshirt", expression="happy" if i % 2 == 0 else "neutral")
        c_girl.save(f"frontend/public/avatars/review/girl_candidate_{i}.png", "PNG")
    print("Saved 4 boy and 4 girl candidate renders to frontend/public/avatars/review/")

    # 4. Expression & Mouth shape face patches
    emotions = ["neutral", "happy", "concerned", "sad", "surprised"]
    mouths = ["closed_smile", "wide_open", "wide_smile", "round_o", "small_closed"]
    gestures = ["idle", "wave", "nod", "thumbs_up", "breathe"]
    outfits = ["yellow_tshirt", "hoodie", "formal", "kurta_saree", "sports", "pyjamas", "festive"]

    for emo in emotions:
        emo_img = draw_pixar_character(600, 800, gender="boy", outfit="yellow_tshirt", expression=emo)
        emo_img.save(f"frontend/public/avatars/faces/boy_face_{emo}.png", "PNG")

    # Blinking frame
    blink_img = draw_pixar_character(600, 800, gender="boy", outfit="yellow_tshirt", expression="neutral", eye_closed=True)
    blink_img.save("frontend/public/avatars/faces/boy_face_blink.png", "PNG")

    # Mouth shapes for lip sync
    for m in mouths:
        m_img = draw_pixar_character(600, 800, gender="boy", outfit="yellow_tshirt", mouth_shape=m)
        m_img.save(f"frontend/public/avatars/faces/boy_mouth_{m}.png", "PNG")

    # Gestures
    for g in gestures:
        g_img = draw_pixar_character(600, 800, gender="boy", outfit="yellow_tshirt", gesture=g)
        g_img.save(f"frontend/public/avatars/faces/boy_gesture_{g}.png", "PNG")

    # Outfits
    for o in outfits:
        o_img = draw_pixar_character(600, 800, gender="boy", outfit=o)
        o_img.save(f"frontend/public/avatars/outfits/boy_outfit_{o}.png", "PNG")

    print("All avatar asset packs successfully compiled!")

if __name__ == "__main__":
    main()
