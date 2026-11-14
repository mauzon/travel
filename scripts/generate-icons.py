"""Twemoji-based suitcase icons (U+1F9F3) → public/."""
import io
import base64
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"
ROOT.mkdir(exist_ok=True)
url = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9f3.png"
data = urllib.request.urlopen(url, timeout=30).read()
from PIL import Image

base = Image.open(io.BytesIO(data)).convert("RGBA")


def center_on(size, bg=None):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0) if bg is None else bg)
    scale = size * 0.72 / max(base.size)
    w, h = int(base.width * scale), int(base.height * scale)
    img = base.resize((w, h), Image.Resampling.LANCZOS)
    canvas.paste(img, ((size - w) // 2, (size - h) // 2), img)
    return canvas


def maskable(size):
    canvas = Image.new("RGBA", (size, size), (247, 247, 245, 255))
    scale = size * 0.56 / max(base.size)
    w, h = int(base.width * scale), int(base.height * scale)
    img = base.resize((w, h), Image.Resampling.LANCZOS)
    canvas.paste(img, ((size - w) // 2, (size - h) // 2), img)
    return canvas


for name, size, bg in [
    ("favicon-32.png", 32, None),
    ("apple-touch-icon.png", 180, (247, 247, 245, 255)),
    ("icon-192.png", 192, (0, 0, 0, 0)),
    ("icon-512.png", 512, (0, 0, 0, 0)),
]:
    center_on(size, bg).save(ROOT / name, optimize=True)

maskable(512).save(ROOT / "icon-512-maskable.png", optimize=True)
ico_images = [center_on(s).convert("RGBA") for s in (16, 32, 48)]
ico_images[0].save(
    ROOT / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=ico_images[1:],
)
b64 = base64.b64encode((ROOT / "favicon-32.png").read_bytes()).decode()
(ROOT / "favicon.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Travel">\n'
    f'  <image width="32" height="32" href="data:image/png;base64,{b64}"/>\n</svg>\n'
)
print(f"wrote icons under {ROOT}")