# 앱 아이콘(분홍 바탕 + 흰 테두리 하트 스티커)을 그린다. 외부 그림 자산 없이 직접 그림.
import os
from PIL import Image, ImageDraw, ImageFilter
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "icons")

def heart(d, cx, cy, s, fill):
    r = s * 0.27
    d.ellipse([cx - s*0.5, cy - s*0.42, cx - s*0.5 + 2*r, cy - s*0.42 + 2*r], fill=fill)
    d.ellipse([cx + s*0.5 - 2*r, cy - s*0.42, cx + s*0.5, cy - s*0.42 + 2*r], fill=fill)
    d.polygon([(cx - s*0.49, cy - s*0.08), (cx + s*0.49, cy - s*0.08), (cx, cy + s*0.45)], fill=fill)

def icon(size, maskable=False):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, S, S], fill="#ff7a9c")
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill="#ff7a9c")
    scale = 0.5 if maskable else 0.62
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    heart(ImageDraw.Draw(shadow), S/2, S/2 + S*0.03, S*scale*1.18, (120, 20, 60, 90))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(S*0.02)))
    heart(d, S/2, S/2, S*scale*1.18, "white")
    heart(d, S/2, S/2 + S*scale*0.04, S*scale*0.9, "#ff3d6e")
    return img.resize((size, size), Image.LANCZOS)

icon(192).save(os.path.join(OUT, "icon-192.png"))
icon(512).save(os.path.join(OUT, "icon-512.png"))
icon(512, True).save(os.path.join(OUT, "icon-512-maskable.png"))
