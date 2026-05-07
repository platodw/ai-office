#!/usr/bin/env python3
"""Generate PNG icons for the AI Office Chrome extension. No dependencies needed."""
import struct, zlib, os, math

def make_png(size, fg=(138, 106, 46), bg=(250, 246, 239)):
    """Brand logotype: bronze starburst on cream background."""
    cx = cy = size / 2
    r_outer = size * 0.44
    r_inner = size * 0.18
    spoke_w = size * 0.07

    def pixel(x, y):
        dx, dy = x - cx, y - cy
        dist = math.hypot(dx, dy)
        angle = math.atan2(dy, dx)
        in_spoke = False
        for base in (0, math.pi/4, math.pi/2, 3*math.pi/4):
            a = (angle - base) % math.pi
            if a > math.pi/2: a -= math.pi
            if abs(dist * math.sin(a)) < spoke_w/2 and abs(dist * math.cos(a)) <= r_outer:
                in_spoke = True
                break
        on_brand = in_spoke or dist <= r_inner
        if dist > r_outer + 1:
            return bg
        if dist > r_outer:
            t = r_outer + 1 - dist
            return tuple(int(bg[i] + t*(fg[i]-bg[i])) for i in range(3))
        return fg if on_brand else bg

    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row += bytes(pixel(x + 0.5, y + 0.5))
        rows.append(bytes(row))

    raw = b"".join(rows)
    idat = zlib.compress(raw)

    def chunk(tag, data):
        payload = tag + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "extension", "icons")
    os.makedirs(out, exist_ok=True)
    for sz in (16, 32, 48, 128):
        path = os.path.join(out, f"default_{sz}.png")
        with open(path, "wb") as f:
            f.write(make_png(sz))
        print(f"  {path}")
    print("Icons generated.")
