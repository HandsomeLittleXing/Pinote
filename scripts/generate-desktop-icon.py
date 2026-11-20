"""从指定桌面源图生成 Windows 多尺寸图标。"""

from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resources" / "icon-source.jpg"
OUTPUT_PNG = ROOT / "resources" / "icon.png"
OUTPUT_ICO = ROOT / "resources" / "icon.ico"
SIZES = (16, 24, 32, 48, 64, 128, 256)


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"桌面图标源图不存在: {SOURCE}")
    source = Image.open(SOURCE).convert("RGB")
    background_color = source.getpixel((0, 0))
    background = Image.new("RGB", source.size, background_color)
    # JPEG 背景有压缩噪声，忽略微小色差后再计算主体边界。
    mask = ImageChops.difference(source, background).convert("L").point(
        lambda value: 255 if value > 12 else 0
    )
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("桌面图标源图没有可见内容")

    left, top, right, bottom = bounds
    side = max(right - left, bottom - top)
    padding = round(side * 0.08)
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2
    crop_side = max(side + padding * 2, 1)
    crop_left = center_x - crop_side // 2
    crop_top = center_y - crop_side // 2
    icon = Image.new("RGB", (crop_side, crop_side), background_color)
    icon.paste(source, (-crop_left, -crop_top))
    icon = icon.resize((1024, 1024), Image.Resampling.LANCZOS)
    icon.save(OUTPUT_PNG, optimize=True)
    icon.save(OUTPUT_ICO, format="ICO", sizes=[(size, size) for size in SIZES])


if __name__ == "__main__":
    main()
