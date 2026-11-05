from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageOps


ASSETS = Path(__file__).resolve().parents[1] / "assets"
SOURCE = ASSETS / "icon-source.jpg"
SIZE = 1024
WHITE_THRESHOLD = 245


def remove_outer_white(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    queue = deque((x, y) for x in range(width) for y in (0, height - 1))
    queue.extend((x, y) for y in range(height) for x in (0, width - 1))
    background = set()

    while queue:
        x, y = queue.popleft()
        if (x, y) in background or not (0 <= x < width and 0 <= y < height):
            continue
        if min(pixels[x, y][:3]) < WHITE_THRESHOLD:
            continue
        background.add((x, y))
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    for x, y in background:
        pixels[x, y] = (255, 255, 255, 0)
    return image


foreground = remove_outer_white(Image.open(SOURCE))
foreground = foreground.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
foreground.save(ASSETS / "icon.png", optimize=True)
foreground.save(ASSETS / "android-icon-foreground.png", optimize=True)

dark_detail = ImageOps.invert(ImageOps.grayscale(foreground))
dark_detail = dark_detail.point(lambda value: min(255, max(0, (value - 25) * 2)))
alpha = ImageChops.multiply(dark_detail, foreground.getchannel("A"))
monochrome = Image.new("RGBA", foreground.size, "white")
monochrome.putalpha(alpha)
monochrome.save(ASSETS / "android-icon-monochrome.png", optimize=True)
