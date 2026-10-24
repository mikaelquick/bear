#!/usr/bin/env python3
"""Generates the app icons from code, so there is no binary to hand-edit.

Pillow is not a dependency, so this writes PNG bytes directly: zlib is in the
standard library and a PNG is just a few chunks around a deflated bitmap.
Shapes are drawn at 4x and averaged down, which is enough antialiasing for a
flat icon.

    python3 tools/make-icons.py
"""
import struct
import zlib
from pathlib import Path

SS = 4  # supersampling factor
OUT = Path(__file__).resolve().parent.parent / "icons"

BG = (0x1C, 0x24, 0x35)
FUR = (0x8A, 0x5A, 0x33)
FUR_DARK = (0x6B, 0x44, 0x25)
SNOUT = (0xD9, 0xB3, 0x8C)
DARK = (0x2A, 0x1A, 0x0E)
EYE = (0x1B, 0x11, 0x09)


def ellipse(px, py, cx, cy, rx, ry):
    dx = (px - cx) / rx
    dy = (py - cy) / ry
    return dx * dx + dy * dy <= 1.0


def shade(u, v, padding):
    """Colour at unit coordinates (0..1), or None for transparent."""
    # Squeeze the bear inwards on maskable icons so a circular mask cannot
    # crop its ears off.
    s = 1.0 - 2.0 * padding
    u = (u - 0.5) / s + 0.5
    v = (v - 0.5) / s + 0.5

    if ellipse(u, v, 0.29, 0.27, 0.125, 0.125): return FUR_DARK
    if ellipse(u, v, 0.71, 0.27, 0.125, 0.125): return FUR_DARK
    if ellipse(u, v, 0.50, 0.50, 0.310, 0.310):
        if ellipse(u, v, 0.500, 0.620, 0.165, 0.125):
            if ellipse(u, v, 0.500, 0.555, 0.062, 0.045): return DARK
            return SNOUT
        if ellipse(u, v, 0.385, 0.450, 0.044, 0.044): return EYE
        if ellipse(u, v, 0.615, 0.450, 0.044, 0.044): return EYE
        return FUR
    return None


def render(size, padding=0.0, background=BG):
    big = size * SS
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = 0
            for sy in range(SS):
                for sx in range(SS):
                    u = (x * SS + sx + 0.5) / big
                    v = (y * SS + sy + 0.5) / big
                    c = shade(u, v, padding) or background
                    r += c[0]; g += c[1]; b += c[2]
            n = SS * SS
            row += bytes((r // n, g // n, b // n))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)  # filter byte 0 per scanline

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))  # 8-bit RGB
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    return len(png)


def main():
    OUT.mkdir(exist_ok=True)
    targets = [
        ("icon-192.png", 192, 0.0),
        ("icon-512.png", 512, 0.0),
        ("icon-maskable-512.png", 512, 0.12),
        ("apple-touch-icon.png", 180, 0.06),
    ]
    for name, size, padding in targets:
        path = OUT / name
        n = write_png(path, size, render(size, padding))
        print(f"  {name}  {size}x{size}  {n // 1024} kB")


if __name__ == "__main__":
    main()
