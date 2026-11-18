#!/usr/bin/env python3
"""
Génère les icônes Android haute définition (Adaptive Icons + legacy mipmaps + splash)
pour Mes Cartes avec suréchantillonnage 4x.
© Louis Martignon (@louismrtg)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"

MIPMAP_SIZES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def lerp_color(c1, c2, t: float):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(len(c1)))


def create_gradient_bg(size: int) -> Image.Image:
    c_top = (11, 17, 32, 255)      # #0B1120
    c_mid = (23, 37, 84, 255)      # #172554
    c_bot = (29, 78, 216, 255)     # #1D4ED8

    grad = Image.new("RGBA", (size, size))
    px = grad.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2.0 * max(size - 1, 1))
            if t < 0.55:
                px[x, y] = lerp_color(c_top, c_mid, t / 0.55)
            else:
                px[x, y] = lerp_color(c_mid, c_bot, (t - 0.55) / 0.45)

    # Halo doux central
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    r = int(size * 0.42)
    cx, cy = int(size * 0.52), int(size * 0.42)
    gdraw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(96, 165, 250, 55))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(size // 10, 4)))
    return Image.alpha_composite(grad, glow)


def render_emblem(canvas_size: int, safe_scale: float = 1.0) -> Image.Image:
    ss = 4
    s = canvas_size * ss
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # Zone utile (pour adaptive icon safe zone ~0.64, pour plein carré ~0.92)
    u = s * safe_scale
    ox = (s - u) / 2.0
    oy = (s - u) / 2.0

    # Carte arrière inclinée (-8 deg)
    back = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(back)
    bx1 = ox + u * 0.14
    by1 = oy + u * 0.21
    bx2 = ox + u * 0.86
    by2 = oy + u * 0.67
    bdraw.rounded_rectangle((bx1, by1, bx2, by2), radius=int(u * 0.07), fill=(96, 165, 250, 210))
    back = back.rotate(8, resample=Image.Resampling.BICUBIC, center=(s // 2, int(oy + u * 0.48)))
    layer = Image.alpha_composite(layer, back)

    # Ombre douce sous la carte avant
    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    fx1 = ox + u * 0.13
    fy1 = oy + u * 0.29
    fx2 = ox + u * 0.87
    fy2 = oy + u * 0.77
    sdraw.rounded_rectangle((fx1, fy1 + u * 0.025, fx2, fy2 + u * 0.025), radius=int(u * 0.075), fill=(2, 6, 23, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(int(u * 0.03), 3)))
    layer = Image.alpha_composite(layer, shadow)

    # Carte avant blanche nacrée
    fdraw = ImageDraw.Draw(layer)
    fdraw.rounded_rectangle((fx1, fy1, fx2, fy2), radius=int(u * 0.075), fill=(248, 250, 252, 255))

    # Puce / pastille bleu cobalt en haut à gauche de la carte
    cw = fx2 - fx1
    ch = fy2 - fy1
    chip_x1 = fx1 + cw * 0.10
    chip_y1 = fy1 + ch * 0.15
    chip_x2 = chip_x1 + cw * 0.17
    chip_y2 = chip_y1 + ch * 0.19
    fdraw.rounded_rectangle((chip_x1, chip_y1, chip_x2, chip_y2), radius=int(u * 0.025), fill=(37, 99, 235, 255))

    # Lignes de titre stylisées à côté de la puce
    line_x1 = chip_x2 + cw * 0.06
    fdraw.rounded_rectangle(
        (line_x1, chip_y1 + ch * 0.02, line_x1 + cw * 0.42, chip_y1 + ch * 0.085),
        radius=int(u * 0.015),
        fill=(15, 23, 42, 230),
    )
    fdraw.rounded_rectangle(
        (line_x1, chip_y1 + ch * 0.125, line_x1 + cw * 0.27, chip_y1 + ch * 0.175),
        radius=int(u * 0.012),
        fill=(100, 116, 139, 175),
    )

    # Barres de code-barres minimalistes et nettes
    bars = [
        (0.10, 0.045),
        (0.165, 0.025),
        (0.21, 0.058),
        (0.29, 0.028),
        (0.34, 0.052),
        (0.415, 0.026),
        (0.465, 0.062),
        (0.55, 0.032),
        (0.605, 0.050),
        (0.68, 0.026),
        (0.73, 0.054),
        (0.81, 0.036),
        (0.865, 0.035),
    ]
    bar_y1 = fy1 + ch * 0.50
    bar_y2 = fy1 + ch * 0.84
    bar_r = max(int(u * 0.008), 2)
    for rel_x, rel_w in bars:
        bx_start = fx1 + cw * rel_x
        bx_end = bx_start + cw * rel_w
        fdraw.rounded_rectangle((bx_start, bar_y1, bx_end, bar_y2), radius=bar_r, fill=(15, 23, 42, 255))

    return layer.resize((canvas_size, canvas_size), Image.Resampling.LANCZOS)


def apply_mask(img: Image.Image, mask_type: str) -> Image.Image:
    size = img.size[0]
    mask = Image.new("L", (size * 2, size * 2), 0)
    mdraw = ImageDraw.Draw(mask)
    if mask_type == "round":
        mdraw.ellipse((0, 0, size * 2 - 1, size * 2 - 1), fill=255)
    else:
        r = int(size * 2 * 0.225)
        mdraw.rounded_rectangle((0, 0, size * 2 - 1, size * 2 - 1), radius=r, fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    # Générer les icônes mipmap pour chaque densité
    for density, (launcher_px, adaptive_px) in MIPMAP_SIZES.items():
        mdir = RES / f"mipmap-{density}"
        mdir.mkdir(parents=True, exist_ok=True)

        bg = create_gradient_bg(launcher_px)
        emblem = render_emblem(launcher_px, safe_scale=0.92)
        composed = Image.alpha_composite(bg, emblem)

        apply_mask(composed, "squircle").save(mdir / "ic_launcher.png", "PNG")
        apply_mask(composed, "round").save(mdir / "ic_launcher_round.png", "PNG")

        fg = render_emblem(adaptive_px, safe_scale=0.66)
        fg.save(mdir / "ic_launcher_foreground.png", "PNG")

    # Écrire un beau Splash Screen sombre #0D0E12 avec l'emblème centré
    splash_size = 512
    splash = Image.new("RGBA", (splash_size, splash_size), (13, 14, 18, 255))
    emblem_splash = render_emblem(320, safe_scale=0.90)
    splash.paste(emblem_splash, ((splash_size - 320) // 2, (splash_size - 320) // 2), emblem_splash)

    for folder in RES.glob("drawable*"):
        target = folder / "splash.png"
        if target.exists():
            splash.save(target, "PNG")

    print("Icones et splash screens generes avec succes.")


if __name__ == "__main__":
    main()
